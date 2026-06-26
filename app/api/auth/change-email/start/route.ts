import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getApiUser } from '@/lib/api-auth'
import { withRateLimit } from '@/lib/rate-limit'
import { isTempEmail } from '@/lib/temp-email-domains'
import { makeCode, hashCode, expiryIso, sendCodeEmail } from '@/lib/change-verification'

// Step 1 of the email change flow.
// Authed user submits a new email. We:
//   1. Validate format + not disposable + not taken.
//   2. Issue a 6-digit code, sha256 it, store it under
//      (user_id, 'email_old') with the new email tucked in payload.
//   3. Send the code to the user's CURRENT email so they prove
//      control of the address they signed up with before we touch
//      anything.
//
// We deliberately do NOT update profiles.email here. The change only
// commits at the end of step 3 (/verify-new). If the user abandons,
// the row expires after 10 min and nothing happens.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const rl = await withRateLimit(request, 'changeStart')
    if (rl.response) return rl.response

    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const newEmailRaw = typeof body.newEmail === 'string' ? body.newEmail.trim() : ''
    if (!EMAIL_RE.test(newEmailRaw)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }
    const newEmail = newEmailRaw.toLowerCase()
    if (isTempEmail(newEmail)) {
      return NextResponse.json({ error: 'Disposable email addresses are not allowed' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Load the user's current email so we know where to send the code.
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('id, username, email')
      .eq('id', user.id)
      .maybeSingle()
    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }
    if (!profile.email) {
      // Can't send a code if we don't have a current email on file -
      // these users should use the "add email" flow instead.
      return NextResponse.json({
        error: 'Your account has no email on file. Add one first instead of changing it.',
      }, { status: 400 })
    }
    if (newEmail === profile.email.toLowerCase()) {
      return NextResponse.json({
        error: "That's already your email - pick a different one if you want to change it.",
      }, { status: 400 })
    }

    // Email uniqueness against other accounts. Same silent no-op as
    // /api/auth/add-email so authed attackers can't iterate the user
    // table by changing-email at random addresses.
    const { data: taken } = await admin
      .from('profiles')
      .select('id')
      .eq('email', newEmail)
      .neq('id', profile.id)
      .maybeSingle()
    if (taken) {
      return NextResponse.json({
        success: true,
        message: 'If that email is available, a verification code was sent to your current email.',
      })
    }

    const code = makeCode()
    // Upsert overwrites any previous in-flight row for this user
    // under the 'email_old' purpose. Starting fresh means abandoning
    // a half-finished flow is fine - the old row just gets replaced.
    const { error: upsertErr } = await admin
      .from('change_verifications')
      .upsert({
        user_id: profile.id,
        purpose: 'email_old',
        code_hash: hashCode(code),
        sent_to: profile.email,
        payload: { new_email: newEmail },
        attempts: 0,
        expires_at: expiryIso(),
      }, { onConflict: 'user_id,purpose' })
    if (upsertErr) {
      console.error('[change-email/start] upsert error:', upsertErr)
      return NextResponse.json({ error: 'Could not start verification' }, { status: 500 })
    }
    // Also nuke any 'email_new' row left over from a prior attempt
    // - we're rewinding the flow to step 1, the step 2 row is stale.
    await admin
      .from('change_verifications')
      .delete()
      .eq('user_id', profile.id)
      .eq('purpose', 'email_new')

    const send = await sendCodeEmail({
      to: profile.email,
      username: profile.username,
      code,
      context: 'email-change-current',
    })
    if (!send.ok) {
      return NextResponse.json({ error: send.error || 'Could not send verification email' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sentTo: profile.email,
      message: 'A verification code was sent to your current email.',
    })
  } catch (error) {
    console.error('[change-email/start] error:', error)
    return NextResponse.json({ error: 'Could not start email change' }, { status: 500 })
  }
}
