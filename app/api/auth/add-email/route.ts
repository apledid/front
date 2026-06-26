import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getApiUser } from '@/lib/api-auth'
import { Resend } from 'resend'
import { withRateLimit } from '@/lib/rate-limit'
import { generateVerificationCode } from '@/lib/token-generation'
import { hashCode } from '@/lib/change-verification'

function generateCode(): string {
  return generateVerificationCode(6)
}

export async function POST(request: Request) {
  try {
    // Rate limit: 5 email additions per hour per IP
    const rateLimit = await withRateLimit(request, 'addEmail')
    if (rateLimit.response) return rateLimit.response

    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Never let this endpoint clobber an already-verified email. Verified users
    // change their address through the change-email flow (which stages the new
    // address and only commits on verify); add-email is only for accounts that
    // have no verified email yet. Without this guard a direct call would
    // overwrite a verified email with an unverified one and reset verification.
    if ((user as any).email && (user as any).email_verified) {
      return NextResponse.json(
        { error: 'You already have a verified email. Use the change-email flow in settings.' },
        { status: 400 },
      )
    }

    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check if email is already used by another account
    const { data: existingUser } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .neq('id', user.id)
      .maybeSingle()

    if (existingUser) {
      // Silently no-op so an authenticated attacker can't iterate emails to
      // discover which ones are registered. Real owners of an email already
      // attached to their own account take a different code path on the
      // settings page, so the UX cost is zero.
      return NextResponse.json({
        success: true,
        message: 'Verification code sent to your email',
      })
    }

    // Generate verification code
    const code = generateCode()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Update user with pending email and code
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        email: email.toLowerCase(),
        verification_code: hashCode(code), // store a hash, not the plaintext code
        verification_expires_at: expiresAt.toISOString(),
        email_verified: false,
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    // Send verification email
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'halo.rip <noreply@halo.rip>',
          to: email.toLowerCase(),
          subject: 'Verify your email - halo.rip',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px; background: #0a0a0b;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #a855f7; font-size: 28px; margin: 0;">halo.rip</h1>
              </div>
              <div style="background: #111113; border-radius: 12px; padding: 30px; border: 1px solid #222;">
                <p style="color: #e5e5e5; font-size: 16px; margin: 0 0 20px 0;">
                  Hey <strong>@${user.username}</strong>, here's your verification code:
                </p>
                <div style="background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
                  <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #fff;">${code}</span>
                </div>
                <p style="color: #888; font-size: 14px; margin: 0;">
                  This code expires in 15 minutes. If you didn't request this, you can ignore this email.
                </p>
              </div>
            </div>
          `,
        })
      } catch (emailError) {
        console.error('Error sending email:', emailError)
        return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 })
      }
    } else if (process.env.NODE_ENV !== 'production') {
      // Dev fallback: when no Resend key is configured locally, log the code
      // so the developer can still verify their own account. Gated on
      // NODE_ENV so this never fires in production (a leaked log stream
      // would otherwise become an account-takeover vector).
      console.log(`[VERIFICATION] Code for ${email}: ${code}`)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Verification code sent to your email' 
    })
  } catch (error) {
    console.error('Add email error:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}
