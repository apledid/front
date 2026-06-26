import { NextResponse } from 'next/server'
import { pendingLogins } from '@/lib/pending-logins'
import { withRateLimit } from '@/lib/rate-limit'
import { Resend } from 'resend'
import { generateVerificationCode } from '@/lib/token-generation'

const resend = new Resend(process.env.RESEND_API_KEY)

function generateCode(): string {
  return generateVerificationCode(6)
}

export async function POST(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'sendEmail')
    if (rateLimit.response) return rateLimit.response

    const { userId, resendToken } = await request.json()

    if (!userId || !resendToken) {
      return NextResponse.json({ error: 'User ID and resend token are required' }, { status: 400 })
    }

    // Find pending login for this user
    const pending = await pendingLogins.get(userId)

    if (!pending) {
      return NextResponse.json(
        { error: 'No pending verification found. Please log in again.' },
        { status: 404 },
      )
    }

    if (pending.expiresAt < Date.now()) {
      await pendingLogins.delete(userId)
      return NextResponse.json(
        { error: 'Verification expired. Please log in again.' },
        { status: 410 },
      )
    }

    // Verify the resend token to ensure the caller is the one who
    // initiated the login. Helper uses timingSafeEqual under the hood
    // and a dedicated RESEND_TOKEN_SIGNING_KEY (see lib/resend-token.ts).
    const { verifyResendToken } = await import('@/lib/resend-token')
    if (!verifyResendToken(userId, pending.expiresAt, resendToken)) {
      return NextResponse.json(
        { error: 'Invalid resend token. Please log in again.' },
        { status: 403 },
      )
    }

    // Generate new code and reset expiry
    const code = generateCode()
    await pendingLogins.set(userId, {
      ...pending,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    })

    console.log('[Login Resend] Sending verification email to:', pending.email)
    const emailResult = await resend.emails.send({
      from: 'Halo <noreply@halo.rip>',
      to: pending.email,
      subject: 'Login Verification - Halo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #a855f7; text-align: center;">Login Verification</h1>
          <p style="color: #333; font-size: 16px; text-align: center;">
            Your verification code is:
          </p>
          <div style="background: linear-gradient(135deg, #9333ea, #db2777); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: white; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #666; font-size: 14px; text-align: center;">
            This code expires in 10 minutes. If you didn't try to log in, change your password immediately.
          </p>
        </div>
      `,
    })
    console.log('[Login Resend] Resend response:', JSON.stringify(emailResult))
    if (emailResult.error) {
      console.error('[Login Resend] Resend error:', emailResult.error)
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Login resend error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}
