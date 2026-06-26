import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { getApiUser, hashToken } from '@/lib/api-auth'
import { withRateLimit } from '@/lib/rate-limit'
import { hashCode, MAX_ATTEMPTS } from '@/lib/change-verification'

// Step 2 (final) of the password change flow.
// User submits { code, newPassword }. If the code matches and the
// new password passes the length checks, we bcrypt and update
// profiles.password_hash, then delete the verification row.
//
// Why include the new password here rather than in /start: keeping
// the password out of the DB during the code-wait window means a
// brief code-leak (e.g. shoulder-surfed email) can't pre-empt the
// password the user is about to pick. The change only "commits"
// once code AND new password are submitted together.

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
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
    if (!CODE_RE.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code from your email' }, { status: 400 })
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (newPassword.length > 200) {
      return NextResponse.json({ error: 'Password is too long' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: row, error: rowErr } = await admin
      .from('change_verifications')
      .select('user_id, code_hash, attempts, expires_at')
      .eq('user_id', user.id)
      .eq('purpose', 'password')
      .maybeSingle()
    if (rowErr) {
      console.error('[change-password/verify] read error:', rowErr)
      return NextResponse.json({ error: 'Could not verify code' }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({
        error: 'No pending password change. Start the flow again from settings.',
      }, { status: 400 })
    }
    if (new Date(row.expires_at) < new Date()) {
      await admin.from('change_verifications').delete().eq('user_id', user.id).eq('purpose', 'password')
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
        .eq('purpose', 'password')
      const remaining = Math.max(0, MAX_ATTEMPTS - ((row.attempts || 0) + 1))
      return NextResponse.json({
        error: `Wrong code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`,
      }, { status: 400 })
    }

    // Code accepted. Bcrypt the new password and write.
    const passwordHash = await bcrypt.hash(newPassword, 12)
    const { error: updateErr } = await admin
      .from('profiles')
      .update({ password_hash: passwordHash })
      .eq('id', user.id)
    if (updateErr) {
      console.error('[change-password/verify] profile update error:', updateErr)
      return NextResponse.json({ error: 'Could not save the new password' }, { status: 500 })
    }

    // Revoke every OTHER session so a stolen/leaked session is killed the
    // moment the user changes their password (the most common "I think I'm
    // compromised" remediation). Keep the current browser's session - identified
    // by its cookie token hash - so the user who just changed it stays logged in.
    try {
      const jar = await cookies()
      const rawToken = jar.get('session_token')?.value
      const currentHash = rawToken ? hashToken(rawToken) : null
      let del = admin.from('sessions').delete().eq('user_id', user.id)
      if (currentHash) del = del.neq('token_hash', currentHash)
      await del
    } catch (e) {
      console.error('[change-password/verify] session revoke error:', e)
    }

    await admin
      .from('change_verifications')
      .delete()
      .eq('user_id', user.id)
      .eq('purpose', 'password')

    return NextResponse.json({
      success: true,
      message: 'Password updated.',
    })
  } catch (error) {
    console.error('[change-password/verify] error:', error)
    return NextResponse.json({ error: 'Could not verify code' }, { status: 500 })
  }
}
