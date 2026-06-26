import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import bcrypt from 'bcryptjs'
import { withRateLimit } from '@/lib/rate-limit'
import { pendingLogins } from '@/lib/pending-logins'
import { Resend } from 'resend'
import { generateVerificationCode } from '@/lib/token-generation'
import { createSessionResponse } from '@/lib/create-session'

const resend = new Resend(process.env.RESEND_API_KEY)

function generateCode(): string {
  return generateVerificationCode(6)
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

export async function POST(request: Request) {
  try {
    // Rate limit: 10 login attempts per 15 minutes per IP
    const rateLimit = await withRateLimit(request, 'login')
    if (rateLimit.response) return rateLimit.response

    const { email, password, turnstileToken } = await request.json()
    const input = (email || '').trim().toLowerCase()

    if (!input || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      )
    }

    // Verify Cloudflare Turnstile (skip in dev mode)
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
    if (turnstileSecret && process.env.SKIP_EMAIL_VERIFICATION !== 'true') {
      if (!turnstileToken) {
        return NextResponse.json(
          { error: 'Please complete the verification' },
          { status: 400 },
        )
      }
      const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: turnstileToken,
        }),
      })
      const turnstileData = await turnstileRes.json()
      if (!turnstileData.success) {
        return NextResponse.json(
          { error: 'Verification failed. Please try again.' },
          { status: 400 },
        )
      }
    }

    const admin = createAdminClient()

    // Look up user by email
    const { data: profile } = await admin
      .from('profiles')
      .select('id, username, email, password_hash, banned, ban_reason, email_verified, must_reset_password')
      .eq('email', input)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      )
    }

    // Check if user is banned
    if (profile.banned) {
      return NextResponse.json(
        { error: `Your account has been banned. Reason: ${profile.ban_reason || 'Violation of terms of service'}` },
        { status: 403 },
      )
    }

    if (!profile.password_hash) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      )
    }

    const isValid = await bcrypt.compare(password, profile.password_hash)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      )
    }

    // Admin forced a password reset on this account - block login (and every
    // session-minting branch below) until the user actually resets via
    // /forgot-password, which clears the flag. Without this gate the flag was
    // set but never read, so the moderation action did nothing.
    if ((profile as any).must_reset_password) {
      return NextResponse.json(
        { error: 'You must reset your password before logging in. Use "Forgot password" to set a new one.', requiresPasswordReset: true },
        { status: 403 },
      )
    }

    // Credentials are valid - check for a trusted device cookie first
    // If this browser was trusted for 14 days, skip the email code entirely
    const trustedToken = parseCookie(request.headers.get('cookie'), 'td_token')
    if (trustedToken) {
      const { hashToken } = await import('@/lib/api-auth')
      const tokenHash = hashToken(trustedToken)
      const { data: device } = await admin
        .from('trusted_devices')
        .select('id, expires_at')
        .eq('user_id', profile.id)
        .eq('token_hash', tokenHash)
        .maybeSingle()
      if (device && new Date(device.expires_at) > new Date()) {
        console.log('[Login] Trusted device - skipping email code')
        return createSessionResponse(profile.id, request)
      }
    }

    // If user has no email, skip verification and log them in directly
    if (!profile.email) {
      return createSessionResponse(profile.id, request)
    }

    // DEV MODE: Skip email verification if SKIP_EMAIL_VERIFICATION is set
    if (process.env.SKIP_EMAIL_VERIFICATION === 'true') {
      console.log('[Login] SKIP_EMAIL_VERIFICATION enabled - logging in directly')
      return createSessionResponse(profile.id, request)
    }

    // Generate and send verification code
    const code = generateCode()
    const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutes

    await pendingLogins.set(profile.id, {
      userId: profile.id,
      username: profile.username,
      email: profile.email,
      code,
      expiresAt,
      attempts: 0,
    })

    // Generate a resend token so only the caller who initiated login
    // can re-request a fresh email. Uses a dedicated signing secret
    // (RESEND_TOKEN_SIGNING_KEY) - the previous code fell back to
    // the literal string 'fallback-key' if the env var was missing,
    // which would have made every token forgeable by anyone with
    // repo access. Helper throws at boot in production if the key
    // is missing or too short. See lib/resend-token.ts.
    const { signResendToken } = await import('@/lib/resend-token')
    const resendToken = signResendToken(profile.id, expiresAt)

    console.log('[Login] Sending verification email to:', profile.email)
    const emailResult = await resend.emails.send({
      from: 'Halo <noreply@halo.rip>',
      to: profile.email,
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
    console.log('[Login] Resend response:', JSON.stringify(emailResult))
    if (emailResult.error) {
      console.error('[Login] Resend error:', emailResult.error)
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 },
      )
    }

    // Mask email for display
    const parts = profile.email.split('@')
    const maskedLocal = parts[0].slice(0, 2) + '***'
    const maskedEmail = `${maskedLocal}@${parts[1]}`

    return NextResponse.json({
      requiresVerification: true,
      userId: profile.id,
      maskedEmail,
      resendToken,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}

// createSessionResponse is now imported from @/lib/create-session
