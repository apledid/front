import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import bcrypt from 'bcryptjs'
import { withRateLimit } from '@/lib/rate-limit'
import { pendingResets } from '@/lib/pending-resets'
import { constantTimeEqual } from '@/lib/api-auth'

export async function POST(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'passwordReset')
    if (rateLimit.response) return rateLimit.response

    const { email, code, newPassword } = await request.json()

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const emailLower = email.trim().toLowerCase()
    const admin = createAdminClient()

    // Look up userId from email (pendingResets is keyed by userId)
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', emailLower)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'No pending reset. Please start over.' }, { status: 400 })
    }

    const pending = await pendingResets.get(profile.id)

    if (!pending) {
      return NextResponse.json({ error: 'No pending reset. Please start over.' }, { status: 400 })
    }

    if (Date.now() > pending.expiresAt) {
      await pendingResets.delete(profile.id)
      return NextResponse.json({ error: 'Reset expired. Please start over.' }, { status: 400 })
    }

    // Mirror the /verify endpoint's lockout. The previous version
    // re-checked the code here but never incremented attempts or
    // cleared the pending row on failure, leaving the 6-digit
    // (10^6 combination) code brute-forceable within the 10-minute
    // window via a botnet that distributes the requests across
    // enough IPs to evade the per-IP passwordReset bucket. With the
    // same 5-attempt lockout the /verify path enforces, a
    // distributed brute force gets 5 tries per pending row total -
    // not 5 per IP - and the row gets nuked on hit.
    if (pending.attempts >= 5) {
      await pendingResets.delete(profile.id)
      return NextResponse.json({ error: 'Too many attempts. Please start over.' }, { status: 400 })
    }

    if (!constantTimeEqual(pending.code, code)) {
      await pendingResets.incrementAttempts(profile.id)
      return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
    }

    // Hash the new password and update
    const passwordHash = await bcrypt.hash(newPassword, 12)

    const { error } = await admin
      .from('profiles')
      .update({
        password_hash: passwordHash,
        session_invalidated_at: new Date().toISOString(), // Force re-login everywhere
        must_reset_password: false, // Lift any admin-forced reset now that they've reset
      })
      .eq('id', profile.id)

    if (error) {
      console.error('Password reset update error:', error)
      return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
    }

    // Actually force re-login everywhere: revoke every session for this user.
    // session_invalidated_at alone was a no-op (getApiUser never reads it), so a
    // stolen/leaked session survived a password reset. Deleting the rows is the
    // same force-logout magic-login and the ban path already perform.
    await admin.from('sessions').delete().eq('user_id', profile.id)

    // Clean up
    await pendingResets.delete(profile.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
