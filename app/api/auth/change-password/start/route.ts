import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getApiUser } from '@/lib/api-auth'
import { withRateLimit } from '@/lib/rate-limit'
import { makeCode, hashCode, expiryIso, sendCodeEmail } from '@/lib/change-verification'

// Step 1 of the password change flow.
// Authed user clicks "Change password". We:
//   1. Look up their current email (we need somewhere to send a code).
//   2. Issue a 6-digit code, sha256 it, store under
//      (user_id, 'password') with no payload.
//   3. Send the code to the user's current email.
//
// The new password itself doesn't get submitted until /verify, so
// it never sits in the DB or in the email body.

export async function POST(request: Request) {
  try {
    const rl = await withRateLimit(request, 'changeStart')
    if (rl.response) return rl.response

    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('id, username, email')
      .eq('id', user.id)
      .maybeSingle()
    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }
    if (!profile.email) {
      return NextResponse.json({
        error: 'Your account has no email on file. Add one first before changing the password.',
      }, { status: 400 })
    }

    const code = makeCode()
    const { error: upsertErr } = await admin
      .from('change_verifications')
      .upsert({
        user_id: profile.id,
        purpose: 'password',
        code_hash: hashCode(code),
        sent_to: profile.email,
        payload: null,
        attempts: 0,
        expires_at: expiryIso(),
      }, { onConflict: 'user_id,purpose' })
    if (upsertErr) {
      console.error('[change-password/start] upsert error:', upsertErr)
      return NextResponse.json({ error: 'Could not start verification' }, { status: 500 })
    }

    const send = await sendCodeEmail({
      to: profile.email,
      username: profile.username,
      code,
      context: 'password-change',
    })
    if (!send.ok) {
      return NextResponse.json({ error: send.error || 'Could not send verification email' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sentTo: profile.email,
      message: 'A verification code was sent to your email.',
    })
  } catch (error) {
    console.error('[change-password/start] error:', error)
    return NextResponse.json({ error: 'Could not start password change' }, { status: 500 })
  }
}
