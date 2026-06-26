import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'
import { pendingSignups } from '@/lib/pending-signups'
import { isTempEmail } from '@/lib/temp-email-domains'
import { generateVerificationCode } from '@/lib/token-generation'
import { withRateLimit, getClientIp } from '@/lib/rate-limit'
import { isReservedUsername } from '@/lib/reserved-usernames'
import { findBannedTerm } from '@/lib/banned-username-terms'
import { isSignupIpAtLimit } from '@/lib/account-limits'

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || ''
const resend = new Resend(process.env.RESEND_API_KEY)

// Track resend cooldowns by IP (persists across email changes)
// Map of IP -> { lastSent, sendCount }
const resendCooldowns = new Map<string, { lastSent: number; sendCount: number }>()

// Cleanup old cooldowns every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, data] of resendCooldowns.entries()) {
    // Remove entries older than 1 hour
    if (now - data.lastSent > 60 * 60 * 1000) {
      resendCooldowns.delete(ip)
    }
  }
}, 10 * 60 * 1000)

function getCooldownSeconds(sendCount: number): number {
  // Progressive cooldown: 60s, 120s, 240s, 480s, etc.
  return 60 * Math.pow(2, Math.min(sendCount - 1, 5)) // Cap at ~32 minutes
}

async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  // SECURITY FIX: If TURNSTILE_SECRET_KEY is not configured, we MUST fail validation
  // Never silently succeed - this would bypass bot protection in production
  if (!TURNSTILE_SECRET_KEY) {
    // In development (with no secret configured), require explicit skip flag
    if (process.env.SKIP_TURNSTILE !== 'true') {
      return false // Reject unless explicitly skipped
    }
    return true // Only allow if explicitly configured to skip
  }
  
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip,
      }),
    })
    
    const data = await response.json()
    return data.success === true
  } catch (error) {
    console.error('[signup/send-code] Turnstile verification error:', error)
    return false
  }
}

function generateCode(): string {
  return generateVerificationCode(6)
}

export async function POST(request: Request) {
  try {
    const rl = await withRateLimit(request, 'sendEmail')
    if (rl.response) return rl.response

    const ip = getClientIp(request)
    
    const body = await request.json()
    const { username, email, password, turnstileToken, resend: isResend } = body

    // Check IP-based resend cooldown (applies regardless of email changes)
    // Skip cooldown in dev mode
    const cooldownData = process.env.SKIP_EMAIL_VERIFICATION === 'true' ? null : resendCooldowns.get(ip)
    if (cooldownData) {
      const cooldownSeconds = getCooldownSeconds(cooldownData.sendCount)
      const elapsedSeconds = (Date.now() - cooldownData.lastSent) / 1000
      
      if (elapsedSeconds < cooldownSeconds) {
        const remainingSeconds = Math.ceil(cooldownSeconds - elapsedSeconds)
        return NextResponse.json(
          { error: `Please wait ${remainingSeconds} seconds before requesting another code`, cooldown: remainingSeconds },
          { status: 429 }
        )
      }
    }

    // Validate required fields
    if (!username || !email || !password) {
      return NextResponse.json({ error: 'Username, email, and password are required' }, { status: 400 })
    }

    // Skip Turnstile check on resend (user already verified) or in dev mode
    if (!isResend && process.env.SKIP_EMAIL_VERIFICATION !== 'true') {
      if (!turnstileToken) {
        return NextResponse.json({ error: 'Please complete the verification' }, { status: 400 })
      }

      const isValidToken = await verifyTurnstileToken(turnstileToken, ip)
      if (!isValidToken) {
        return NextResponse.json({ error: 'Verification failed. Please refresh and try again.' }, { status: 400 })
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Block temporary/disposable email domains
    if (isTempEmail(email)) {
      return NextResponse.json({ error: 'Temporary or disposable email addresses are not allowed. Please use a permanent email address.' }, { status: 400 })
    }

    // Validate username format
    const usernameRegex = /^[a-z0-9_]+$/
    if (!usernameRegex.test(username.toLowerCase())) {
      return NextResponse.json({ error: 'Username can only contain lowercase letters, numbers, and underscores' }, { status: 400 })
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json({ error: 'Username must be between 3 and 20 characters' }, { status: 400 })
    }

    // Reject usernames that conflict with platform routing (e.g. `404`,
    // `500`, `dashboard`). See lib/reserved-usernames.ts for the full list
    // and rationale.
    if (isReservedUsername(username)) {
      return NextResponse.json({ error: 'That username is reserved. Please choose another.' }, { status: 400 })
    }

    // Reject usernames containing CSAM terms, hard slurs, or other
    // universally-offensive content. Normalized substring match so
    // leet/padding evasion (ch1ld_p0rn etc) is caught. Generic error
    // - never echo the matched term back. Logged server-side for abuse
    // monitoring.
    const banned = findBannedTerm(username)
    if (banned) {
      console.warn(`[signup] blocked banned username "${username}" (matched: ${banned})`)
      return NextResponse.json({ error: 'That username isn’t allowed. Please choose another.' }, { status: 400 })
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (!/[A-Z]/.test(password)) {
      return NextResponse.json({ error: 'Password must contain an uppercase letter' }, { status: 400 })
    }
    if (!/[a-z]/.test(password)) {
      return NextResponse.json({ error: 'Password must contain a lowercase letter' }, { status: 400 })
    }
    if (!/[0-9]/.test(password)) {
      return NextResponse.json({ error: 'Password must contain a number' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Fail fast on the per-IP account cap so we don't email a verification
    // code to someone who'd be blocked at account creation anyway. The hard
    // enforcement still lives in the verify step.
    if (await isSignupIpAtLimit(admin, ip)) {
      return NextResponse.json(
        { error: 'Maximum accounts per IP reached. Contact support if you need assistance.' },
        { status: 429 },
      )
    }

    // Check if username already exists
    const { data: existingUsername } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle()

    if (existingUsername) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 400 })
    }

    // Check if email already exists
    const { data: existingEmail } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existingEmail) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    // Generate verification code
    const code = generateCode()
    const passwordHash = await bcrypt.hash(password, 12)

    // Store pending signup (expires in 10 minutes)
    await pendingSignups.set(email.toLowerCase(), {
      username: username.toLowerCase(),
      passwordHash,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
      ip,
    })

    // DEV MODE: Skip email, return code directly
    if (process.env.SKIP_EMAIL_VERIFICATION === 'true') {
      // Silently return code - don't log
      return NextResponse.json({ success: true, message: 'Dev mode: use code below', devCode: code })
    }

    // Send verification email
    const emailResult = await resend.emails.send({
      from: 'Halo <noreply@halo.rip>',
      to: email,
      subject: 'Verify your email - Halo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #a855f7; text-align: center;">Welcome to Halo!</h1>
          <p style="color: #333; font-size: 16px; text-align: center;">
            Your verification code is:
          </p>
          <div style="background: linear-gradient(135deg, #9333ea, #db2777); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: white; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #666; font-size: 14px; text-align: center;">
            This code expires in 10 minutes.
          </p>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    })
    console.log('[Signup] Resend response:', JSON.stringify(emailResult))
    if (emailResult.error) {
      console.error('[Signup] Resend error:', emailResult.error)
      return NextResponse.json({ error: 'Failed to send verification email. Please try again.' }, { status: 500 })
    }

    // Bump the progressive cooldown only AFTER a confirmed-successful send, so a
    // Resend outage doesn't lock a legitimate user out who never got a code.
    const existingCooldown = resendCooldowns.get(ip)
    resendCooldowns.set(ip, {
      lastSent: Date.now(),
      sendCount: (existingCooldown?.sendCount || 0) + 1,
    })

    return NextResponse.json({ success: true, message: 'Verification code sent' })
  } catch (error) {
    console.error('[signup/send-code]', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
