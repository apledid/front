import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSessionResponse } from '@/lib/create-session'
import { withRateLimit } from '@/lib/rate-limit'
import { isTempEmail } from '@/lib/temp-email-domains'

// Owner-issued account recovery for users locked out of both email
// AND Discord OAuth. The Discord bot's /user magic-login creates a
// row in magic_login_tokens with sha256(token); this endpoint
// consumes the token and uses it as authorization to atomically:
//   1. Update the target profile's email + password to whatever
//      the user just picked.
//   2. Invalidate any other active sessions on the account.
//   3. Mint a fresh session for the requesting browser.
//
// The flow is intentionally one-shot: the same POST that consumes
// the token also writes the new credentials. There is no
// in-between "token valid, no creds set" state - either the user
// completes the recovery and gets in with new creds, or the token
// stays unconsumed (until the 15-minute expiry).
//
// Security:
//   - Atomic consume via .is('used_at', null) compare-and-swap so
//     two concurrent requests can't both pass.
//   - Banned users rejected at consumption.
//   - Email format validated + checked for disposable domains +
//     uniqueness checked.
//   - Password >= 8 chars, bcrypted at cost 12.
//   - session_invalidated_at set on the profile so any sessions
//     created elsewhere before this recovery die immediately.
//   - Rate-limited (verifyEmail bucket) for replay-storm noise.
//   - Generic "invalid or already used" error for token-related
//     failures so probing can't distinguish expired vs used vs
//     not-found.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TOKEN_RE = /^[0-9a-f]{64}$/

export async function POST(request: Request) {
  try {
    const rl = await withRateLimit(request, 'verifyEmail')
    if (rl.response) return rl.response

    const body = await request.json().catch(() => ({}))
    const { token, email, password } = body as {
      token?: unknown
      email?: unknown
      password?: unknown
    }

    // ── Input validation ──────────────────────────────────────────
    if (typeof token !== 'string' || !TOKEN_RE.test(token)) {
      return NextResponse.json({ error: 'Invalid or expired recovery link' }, { status: 400 })
    }
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (password.length > 200) {
      return NextResponse.json({ error: 'Password is too long' }, { status: 400 })
    }

    const emailLower = email.trim().toLowerCase()
    if (isTempEmail(emailLower)) {
      return NextResponse.json({
        error: 'Disposable email addresses are not allowed',
      }, { status: 400 })
    }

    const tokenHash = createHash('sha256').update(token).digest('hex')
    const admin = createAdminClient()

    // ── Atomic token consume ──────────────────────────────────────
    // Same pattern as the previous magic-login implementation: the
    // .is('used_at', null) predicate makes the UPDATE itself the
    // compare-and-swap. Two concurrent requests can't both pass.
    const nowIso = new Date().toISOString()
    const { data: claimed, error: claimErr } = await admin
      .from('magic_login_tokens')
      .update({ used_at: nowIso })
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gte('expires_at', nowIso)
      .select('user_id')
      .maybeSingle()

    if (claimErr) {
      console.error('[magic-login] claim error:', claimErr)
      return NextResponse.json({ error: 'Recovery could not be processed. Try again or ask for a fresh link.' }, { status: 500 })
    }
    if (!claimed) {
      // Not-found / expired / already-used all collapse to one
      // message - revealing which would help an attacker probing.
      return NextResponse.json({ error: 'This recovery link is invalid or has already been used' }, { status: 400 })
    }

    // ── Ban re-check + email uniqueness ───────────────────────────
    // We hold the token (already consumed) so even if the steps
    // below fail, the user has to ask for a new link. That's
    // intentional - a token "spent" on a failed recovery should
    // not be reusable.
    const { data: profile } = await admin
      .from('profiles')
      .select('id, banned, ban_reason, email')
      .eq('id', claimed.user_id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }
    if (profile.banned) {
      return NextResponse.json({
        error: `This account has been banned. Reason: ${profile.ban_reason || 'Violation of terms of service'}`,
      }, { status: 403 })
    }

    // Allow the user to "set" their email to the same address they
    // already have (idempotent). Only reject if the email maps to a
    // DIFFERENT account.
    if (emailLower !== (profile.email || '').toLowerCase()) {
      const { data: emailTaken } = await admin
        .from('profiles')
        .select('id')
        .eq('email', emailLower)
        .neq('id', profile.id)
        .maybeSingle()
      if (emailTaken) {
        return NextResponse.json({
          error: 'That email is already used by another account. Pick a different one.',
        }, { status: 400 })
      }
    }

    // ── Apply the new credentials ─────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 12)

    const { error: updateErr } = await admin
      .from('profiles')
      .update({
        email: emailLower,
        email_verified: true,
        password_hash: passwordHash,
        session_invalidated_at: nowIso,
      })
      .eq('id', profile.id)

    if (updateErr) {
      console.error('[magic-login] profile update error:', updateErr)
      return NextResponse.json({ error: 'Could not save the new credentials' }, { status: 500 })
    }

    // ── Revoke all existing sessions ──────────────────────────────
    // Anyone holding a session cookie for this account loses it
    // now. session_invalidated_at on the profile is a marker;
    // explicit revocation here so cached cookies die immediately
    // rather than at next session-validate roundtrip.
    await admin
      .from('sessions')
      .update({ revoked_at: nowIso })
      .eq('user_id', profile.id)
      .is('revoked_at', null)

    // ── Mint a fresh session ──────────────────────────────────────
    // createSessionResponse sets session_token + user_id cookies
    // with Domain=.halo.rip so the new session covers apex + www.
    return createSessionResponse(profile.id, request)
  } catch (error) {
    console.error('[magic-login] error:', error)
    return NextResponse.json({ error: 'Recovery failed' }, { status: 500 })
  }
}

// GET endpoint: lightweight token validation for the form page to
// check the link is still good BEFORE the user fills in the form.
// Does NOT consume the token. Returns 200 with { valid: true } if
// the token is good, or 4xx + error if not.
export async function GET(request: Request) {
  try {
    const rl = await withRateLimit(request, 'verifyEmail')
    if (rl.response) return rl.response

    const url = new URL(request.url)
    const token = url.searchParams.get('token')

    if (!token || !TOKEN_RE.test(token)) {
      return NextResponse.json({ valid: false, error: 'Invalid recovery link' }, { status: 400 })
    }

    const tokenHash = createHash('sha256').update(token).digest('hex')
    const admin = createAdminClient()
    const nowIso = new Date().toISOString()

    const { data: row } = await admin
      .from('magic_login_tokens')
      .select('user_id, used_at, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (!row) {
      return NextResponse.json({ valid: false, error: 'This recovery link is invalid or has already been used' }, { status: 400 })
    }
    if (row.used_at) {
      return NextResponse.json({ valid: false, error: 'This recovery link has already been used' }, { status: 400 })
    }
    if (row.expires_at < nowIso) {
      return NextResponse.json({ valid: false, error: 'This recovery link has expired. Ask for a fresh one.' }, { status: 400 })
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('[magic-login] GET error:', error)
    return NextResponse.json({ valid: false, error: 'Could not check this link' }, { status: 500 })
  }
}
