import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getApiUser } from '@/lib/api-auth'
import { withRateLimit } from '@/lib/rate-limit'
import { hashCode, MAX_ATTEMPTS } from '@/lib/change-verification'

// Step 3 (final) of the email change flow.
// User submits the code that was sent to the NEW email. If it
// matches, we atomically update profiles.email + email_verified
// and delete the verification row.

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
      .select('user_id, code_hash, payload, attempts, expires_at')
      .eq('user_id', user.id)
      .eq('purpose', 'email_new')
      .maybeSingle()
    if (rowErr) {
      console.error('[change-email/verify-new] read error:', rowErr)
      return NextResponse.json({ error: 'Could not verify code' }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({
        error: 'No pending email change. Start the flow again from settings.',
      }, { status: 400 })
    }
    if (new Date(row.expires_at) < new Date()) {
      await admin.from('change_verifications').delete().eq('user_id', user.id).eq('purpose', 'email_new')
      return NextResponse.json({ error: 'That code expired. Start again from settings.' }, { status: 400 })
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({
        error: 'Too many wrong codes. Start the flow again from settings.',
      }, { status: 400 })
    }

    if (hashCode(code) !== row.code_hash) {
      await admin
        .from('change_verifications')
        .update({ attempts: (row.attempts || 0) + 1 })
        .eq('user_id', user.id)
        .eq('purpose', 'email_new')
      const remaining = Math.max(0, MAX_ATTEMPTS - ((row.attempts || 0) + 1))
      return NextResponse.json({
        error: `Wrong code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`,
      }, { status: 400 })
    }

    const newEmail = (row.payload as any)?.new_email as string | undefined
    if (!newEmail) {
      await admin.from('change_verifications').delete().eq('user_id', user.id).eq('purpose', 'email_new')
      return NextResponse.json({ error: 'Verification record is corrupted. Start again.' }, { status: 500 })
    }

    // Final race-safety check on uniqueness. Even though we checked
    // at /start and /verify-old, this commit is the one that
    // actually writes the row, so another concurrent change-email
    // could in principle land first.
    const { data: takenNow } = await admin
      .from('profiles')
      .select('id')
      .eq('email', newEmail)
      .neq('id', user.id)
      .maybeSingle()
    if (takenNow) {
      await admin.from('change_verifications').delete().eq('user_id', user.id).eq('purpose', 'email_new')
      return NextResponse.json({
        error: 'That email was just taken by another account. Start again with a different one.',
      }, { status: 400 })
    }

    // Apply the change. email_verified stays true because the user
    // just proved control by entering the code sent to that
    // address. session_invalidated_at is left alone - the user is
    // currently logged in, and a self-initiated email change
    // shouldn't kick them out of their own browser.
    const { error: updateErr } = await admin
      .from('profiles')
      .update({
        email: newEmail,
        email_verified: true,
      })
      .eq('id', user.id)
    if (updateErr) {
      console.error('[change-email/verify-new] profile update error:', updateErr)
      return NextResponse.json({ error: 'Could not save the new email' }, { status: 500 })
    }

    // Consume the row.
    await admin
      .from('change_verifications')
      .delete()
      .eq('user_id', user.id)
      .eq('purpose', 'email_new')

    return NextResponse.json({
      success: true,
      email: newEmail,
      message: 'Email updated.',
    })
  } catch (error) {
    console.error('[change-email/verify-new] error:', error)
    return NextResponse.json({ error: 'Could not verify code' }, { status: 500 })
  }
}
