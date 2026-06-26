import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { v4 as uuidv4 } from 'uuid'
import { pendingSignups } from '@/lib/pending-signups'
import { createSessionResponse } from '@/lib/create-session'
import { constantTimeEqual } from '@/lib/api-auth'
import { withRateLimit, getClientIp } from '@/lib/rate-limit'
import { isSignupIpAtLimit } from '@/lib/account-limits'

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || ''

async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  if (!TURNSTILE_SECRET_KEY) {
    console.warn('[signup/verify] TURNSTILE_SECRET_KEY not set, skipping verification')
    return true
  }
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
    })
    const data = await response.json()
    return data.success === true
  } catch (error) {
    console.error('[signup/verify] Turnstile verification error:', error)
    return false
  }
}

export async function POST(request: Request) {
  try {
    const rl = await withRateLimit(request, 'verifyEmail')
    if (rl.response) return rl.response

    const ip = getClientIp(request)

    const { email, code, turnstileToken } = await request.json()

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
    }

    // Verify Turnstile token (skip in dev mode)
    if (process.env.SKIP_EMAIL_VERIFICATION !== 'true') {
      if (!turnstileToken) {
        return NextResponse.json({ error: 'Please complete the verification' }, { status: 400 })
      }
      const isValidToken = await verifyTurnstileToken(turnstileToken, ip)
      if (!isValidToken) {
        return NextResponse.json({ error: 'Verification failed. Please refresh and try again.' }, { status: 400 })
      }
    }

    const emailLower = email.toLowerCase()
    const pending = await pendingSignups.get(emailLower)

    if (!pending) {
      return NextResponse.json({ error: 'No pending signup found. Please start over.' }, { status: 400 })
    }

    if (Date.now() > pending.expiresAt) {
      await pendingSignups.delete(emailLower)
      return NextResponse.json({ error: 'Verification code expired. Please request a new one.' }, { status: 400 })
    }

    if (pending.attempts >= 5) {
      await pendingSignups.delete(emailLower)
      return NextResponse.json({ error: 'Too many failed attempts. Please start over.' }, { status: 429 })
    }

    if (!constantTimeEqual(pending.code, code)) {
      await pendingSignups.incrementAttempts(emailLower)
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    // Code is valid - create the account
    const admin = createAdminClient()

    // Per-IP account cap (shared across all signup paths). Key it on the IP
    // that INITIATED the signup (captured at send-code time) rather than the IP
    // submitting the code, so swapping networks between the two steps can't dodge
    // the cap or stamp the account with someone else's IP.
    const signupIp = pending.ip || ip
    if (await isSignupIpAtLimit(admin, signupIp)) {
      await pendingSignups.delete(emailLower)
      return NextResponse.json(
        { error: 'Maximum accounts per IP reached. Contact support if you need assistance.' },
        { status: 429 },
      )
    }

    // Double-check username and email are still available
    const [{ data: existingUsername }, { data: existingEmail }] = await Promise.all([
      admin.from('profiles').select('id').eq('username', pending.username).maybeSingle(),
      admin.from('profiles').select('id').eq('email', emailLower).maybeSingle(),
    ])

    if (existingUsername) {
      await pendingSignups.delete(emailLower)
      return NextResponse.json({ error: 'Username was taken while you were verifying. Please start over.' }, { status: 400 })
    }

    if (existingEmail) {
      await pendingSignups.delete(emailLower)
      return NextResponse.json({ error: 'Email was registered while you were verifying. Please start over.' }, { status: 400 })
    }

    // Create the user
    const userId = uuidv4()

    const { data: newProfile, error: profileError } = await admin.from('profiles').insert({
      id: userId,
      username: pending.username,
      display_name: pending.username,
      password_hash: pending.passwordHash,
      email: emailLower,
      email_verified: true,
      enter_title: pending.username,
      enter_subtitle: 'Click anywhere to enter',
      enter_enabled: true,
      music_show_title: true,
      music_show_artist: true,
      show_views: true,
      layout_style: 'floating',
      card_style: 'classic',
      content_alignment: 'center',
      signup_ip: signupIp !== 'unknown' ? signupIp : null,
    }).select('uid').single()

    if (profileError) {
      console.error('[signup/verify] Profile creation error:', profileError)
      if (profileError.message?.includes('account_limit_per_ip')) {
        await pendingSignups.delete(emailLower)
        return NextResponse.json(
          { error: 'Maximum accounts per IP reached. Contact support if you need assistance.' },
          { status: 429 },
        )
      }
      return NextResponse.json({ error: 'Failed to create account: ' + profileError.message }, { status: 500 })
    }

    // If a free event is active, grant this new account event premium too
    const { data: eventRow } = await admin
      .from('site_config')
      .select('value')
      .eq('key', 'free_event')
      .maybeSingle()
    if (eventRow?.value?.active === true) {
      await admin.from('profiles').update({
        is_premium:    true,
        premium_active: true,
        premium_type:  'event',
      }).eq('id', userId)
    }

    // Give OG badge to early users (UID < 1000). Tightened from the
    // original <= 1500 threshold to match the 2026-05 backfill cutoff
    // the owner asked for. Sequence has long since passed both
    // thresholds so this doesn't affect any new signups - kept here
    // for future signups in case the sequence ever gets reset.
    if (newProfile?.uid && newProfile.uid < 1000) {
      const { data: ogBadge } = await admin
        .from('badges')
        .select('id')
        .ilike('name', '%og%')
        .maybeSingle()

      if (ogBadge) {
        await admin.from('profile_badges').insert({ user_id: userId, badge_id: ogBadge.id })
      }
    }

    // Clean up pending signup
    await pendingSignups.delete(emailLower)

    return createSessionResponse(userId, request)
  } catch (error) {
    console.error('[signup/verify] Error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
