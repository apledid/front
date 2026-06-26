import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getApiUser } from '@/lib/api-auth'
import { withRateLimit } from '@/lib/rate-limit'
import { hashCode, makeCode, expiryIso, sendCodeEmail, MAX_ATTEMPTS } from '@/lib/change-verification'

// Step 2 of the email change flow.
// User submits the code we just sent to their CURRENT email. If it
// matches, we delete the 'email_old' row, write a fresh 'email_new'
// row keyed under the same new email payload, and send a new 6-digit
// code to the NEW email.
//
// Two-row design rather than mutating one row's purpose so a
// concurrent /verify-old attempt can't race with /verify-new and
// somehow skip the second code.

const CODE_RE = /^[0-9]{6}$/

export async function POST(request: Request) {
  try {
    const rl = await withRateLimit(request, 'changeVerify')
    if (rl.response) return rl.response

    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!CODE_RE.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code from your email' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: row, error: rowErr } = await admin
      .from('change_verifications')
      .select('user_id, purpose, code_hash, payload, attempts, expires_at')
      .eq('user_id', user.id)
      .eq('purpose', 'email_old')
      .maybeSingle()
    if (rowErr) {
      console.error('[change-email/verify-old] read error:', rowErr)
      return NextResponse.json({ error: 'Could not verify code' }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({
        error: 'No pending email change. Start the flow again from settings.',
      }, { status: 400 })
    }
    if (new Date(row.expires_at) < new Date()) {
      // Clean up the dead row so the next /start has a fresh slate.
      await admin.from('change_verifications').delete().eq('user_id', user.id).eq('purpose', 'email_old')
      return NextResponse.json({ error: 'That code expired. Start again from settings.' }, { status: 400 })
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({
        error: 'Too many wrong codes. Start the flow again from settings.',
      }, { status: 400 })
    }

    // Hash-compare. We could timing-safe this but the codes are
    // already 6 chars of sha256 hex on both sides; the leakage
    // surface is symbol position in a 64-char hex string the
    // attacker doesn't know in advance. Still, hex compare via ===
    // on identical-length strings is constant-time in V8.
    if (hashCode(code) !== row.code_hash) {
      // Bump the counter so brute force is bounded.
      await admin
        .from('change_verifications')
        .update({ attempts: (row.attempts || 0) + 1 })
        .eq('user_id', user.id)
        .eq('purpose', 'email_old')
      const remaining = Math.max(0, MAX_ATTEMPTS - ((row.attempts || 0) + 1))
      return NextResponse.json({
        error: `Wrong code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`,
      }, { status: 400 })
    }

    // Code matched. Now move the flow to step 3: drop the email_old
    // row, create an email_new row, send the second code to the
    // new address.
    const newEmail = (row.payload as any)?.new_email as string | undefined
    if (!newEmail) {
      // Should never happen, but if it does the row is broken -
      // wipe it so the user can /start over cleanly.
      await admin.from('change_verifications').delete().eq('user_id', user.id).eq('purpose', 'email_old')
      return NextResponse.json({ error: 'Verification record is corrupted. Start again.' }, { status: 500 })
    }

    // Race-safety: someone could have taken that email between
    // /start and now. Re-check.
    const { data: takenNow } = await admin
      .from('profiles')
      .select('id')
      .eq('email', newEmail)
      .neq('id', user.id)
      .maybeSingle()
    if (takenNow) {
      await admin.from('change_verifications').delete().eq('user_id', user.id).eq('purpose', 'email_old')
      return NextResponse.json({
        error: 'That email was just taken by another account. Start again with a different one.',
      }, { status: 400 })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
    const username = profile?.username || 'user'

    const newCode = makeCode()
    const { error: upsertErr } = await admin
      .from('change_verifications')
      .upsert({
        user_id: user.id,
        purpose: 'email_new',
        code_hash: hashCode(newCode),
        sent_to: newEmail,
        payload: { new_email: newEmail },
        attempts: 0,
        expires_at: expiryIso(),
      }, { onConflict: 'user_id,purpose' })
    if (upsertErr) {
      console.error('[change-email/verify-old] upsert error:', upsertErr)
      return NextResponse.json({ error: 'Could not advance verification' }, { status: 500 })
    }

    // Best-effort cleanup of the now-consumed step-1 row.
    await admin
      .from('change_verifications')
      .delete()
      .eq('user_id', user.id)
      .eq('purpose', 'email_old')

    const send = await sendCodeEmail({
      to: newEmail,
      username,
      code: newCode,
      context: 'email-change-new',
    })
    if (!send.ok) {
      // Surface the error but leave the email_new row in place so
      // the user can hit /resend on the next iteration (not built
      // yet) or just /start again.
      return NextResponse.json({ error: send.error || 'Could not send new-email code' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sentTo: newEmail,
      message: 'Code sent to your new email. Enter it to finish.',
    })
  } catch (error) {
    console.error('[change-email/verify-old] error:', error)
    return NextResponse.json({ error: 'Could not verify code' }, { status: 500 })
  }
}
