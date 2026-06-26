import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'
import { pendingResets } from '@/lib/pending-resets'
import { Resend } from 'resend'
import { generateVerificationCode } from '@/lib/token-generation'

const resend = new Resend(process.env.RESEND_API_KEY)

function generateCode(): string {
  return generateVerificationCode(6)
}

export async function POST(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'passwordReset')
    if (rateLimit.response) return rateLimit.response

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const emailLower = email.trim().toLowerCase()
    const admin = createAdminClient()

    // Look up user by email
    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, banned')
      .eq('email', emailLower)
      .single()

    // Always return success to prevent email enumeration
    if (!profile || profile.banned) {
      return NextResponse.json({ success: true })
    }

    const code = generateCode()

    await pendingResets.set(profile.id, {
      userId: profile.id,
      email: emailLower,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: 0,
    })

    const emailResult = await resend.emails.send({
      from: 'Halo <noreply@halo.rip>',
      to: emailLower,
      subject: 'Password Reset - Halo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #a855f7; text-align: center;">Password Reset</h1>
          <p style="color: #333; font-size: 16px; text-align: center;">
            Your password reset code is:
          </p>
          <div style="background: linear-gradient(135deg, #9333ea, #db2777); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: white; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #666; font-size: 14px; text-align: center;">
            This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    })
    console.log('[ForgotPassword] Resend response:', JSON.stringify(emailResult))
    if (emailResult.error) {
      // Don't expose the send failure to the client - that would leak
      // which emails actually exist in the system (fake emails return
      // success above without ever calling Resend, real-but-failed
      // emails would have returned 500 here). Log it server-side so
      // the operator can still see + debug delivery issues, then
      // return the same success shape as the "email doesn't exist"
      // branch above.
      console.error('[ForgotPassword] Resend error:', emailResult.error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
