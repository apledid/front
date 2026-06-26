import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { createSessionResponse } from '@/lib/create-session'
import { withRateLimit, getClientIp } from '@/lib/rate-limit'
import { isReservedUsername } from '@/lib/reserved-usernames'
import { findBannedTerm } from '@/lib/banned-username-terms'
import { isSignupIpAtLimit } from '@/lib/account-limits'

const GLOBAL_RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const GLOBAL_RATE_LIMIT_MAX = 150 // Max 150 signups per minute globally
const SIGNUPS_DISABLED = false // Emergency kill switch - set to true to disable signups
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || ''

async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  if (!TURNSTILE_SECRET_KEY) {
    console.warn('TURNSTILE_SECRET_KEY not set, skipping verification')
    return true // Skip verification if no secret key configured
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
    console.error('Turnstile verification error:', error)
    return false
  }
}

// Simple in-memory rate limiting (resets on server restart)
const recentSignups: number[] = []
const ipSignupTimes: Map<string, number[]> = new Map()

function isGlobalRateLimited(): boolean {
  const now = Date.now()
  // Remove old entries
  while (recentSignups.length > 0 && recentSignups[0] < now - GLOBAL_RATE_LIMIT_WINDOW) {
    recentSignups.shift()
  }
  return recentSignups.length >= GLOBAL_RATE_LIMIT_MAX
}

function isIpRateLimited(ip: string): boolean {
  const now = Date.now()
  const times = ipSignupTimes.get(ip) || []
  // Remove entries older than 1 hour
  const filtered = times.filter(t => t > now - 60 * 60 * 1000)
  ipSignupTimes.set(ip, filtered)
  // Max 2 signups per IP per hour
  return filtered.length >= 2
}

function recordSignup(ip: string): void {
  const now = Date.now()
  recentSignups.push(now)
  const times = ipSignupTimes.get(ip) || []
  times.push(now)
  ipSignupTimes.set(ip, times)
}

export async function POST(request: Request) {
  try {
    // Cross-instance rate limit (in addition to per-IP/global counters below)
    const rl = await withRateLimit(request, 'signup')
    if (rl.response) return rl.response

    // Emergency kill switch
    if (SIGNUPS_DISABLED) {
      return NextResponse.json(
        { error: 'Signups are temporarily disabled. Please try again later.' },
        { status: 503 }
      )
    }

    // Check global rate limit first
    if (isGlobalRateLimited()) {
      return NextResponse.json(
        { error: 'Too many signups. Please try again in a minute.' },
        { status: 429 }
      )
    }

    // Get IP address from request headers first (before consuming body)
    const ip = getClientIp(request)
    
    // Check IP-based rate limit
    if (ip !== 'unknown' && isIpRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many signups from this IP. Please try again later.' },
        { status: 429 }
      )
    }
    
    const body = await request.json()
    const { username, password, turnstileToken, email } = body

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }

    // Verify Turnstile token
    if (TURNSTILE_SECRET_KEY && !turnstileToken) {
      return NextResponse.json({ error: 'Verification required' }, { status: 400 })
    }
    
    if (turnstileToken) {
      const isValidToken = await verifyTurnstileToken(turnstileToken, ip)
      if (!isValidToken) {
        return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 })
      }
    }

    // Validate username format
    const usernameRegex = /^[a-z0-9_]+$/
    if (!usernameRegex.test(username.toLowerCase())) {
      return NextResponse.json(
        { error: 'Username can only contain lowercase letters, numbers, and underscores' },
        { status: 400 }
      )
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json({ error: 'Username must be between 3 and 20 characters' }, { status: 400 })
    }

    if (isReservedUsername(username)) {
      return NextResponse.json({ error: 'That username is reserved. Please choose another.' }, { status: 400 })
    }

    // CSAM / slur / hate-term filter (normalized substring match).
    const bannedTerm = findBannedTerm(username)
    if (bannedTerm) {
      console.warn(`[signup] blocked banned username "${username}" (matched: ${bannedTerm})`)
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

    // Per-IP account cap (shared across all signup paths, see lib/account-limits).
    if (await isSignupIpAtLimit(admin, ip)) {
      return NextResponse.json(
        { error: 'Maximum accounts per IP reached. Contact support if you need assistance.' },
        { status: 429 }
      )
    }

    // Check if username already exists in profiles
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 400 })
    }

    // If email provided, check if it's already in use
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }

      const { data: existingEmail } = await admin
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle()

      if (existingEmail) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user ID
    const userId = uuidv4()

    // Set email deadline for users signing up without email (24 hours)
    const emailDeadline = email ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    // Create profile with auto-incrementing UID via the database trigger
    const { data: newProfile, error: profileError } = await admin.from('profiles').insert({
      id: userId,
      username: username.toLowerCase(),
      display_name: username,
      password_hash: passwordHash,
      email: email ? email.toLowerCase() : null,
      email_verified: false, // Even if email provided, needs verification
      email_deadline: emailDeadline,
      enter_title: username,
      enter_subtitle: 'Click anywhere to enter',
      enter_enabled: true, // Enable click-to-enter by default
      music_show_title: true,
      music_show_artist: true,
      show_views: true,
      layout_style: 'floating',
      card_style: 'classic',
      content_alignment: 'center',
      signup_ip: ip !== 'unknown' ? ip : null,
    }).select('uid').single()

    if (profileError) {
      // The DB-level per-IP cap trigger raises this when a race slips past the
      // app-level check above. Surface it as the same friendly 429.
      if (profileError.message?.includes('account_limit_per_ip')) {
        return NextResponse.json(
          { error: 'Maximum accounts per IP reached. Contact support if you need assistance.' },
          { status: 429 },
        )
      }
      return NextResponse.json({ error: 'Failed to create account: ' + profileError.message }, { status: 500 })
    }

    // Record successful signup for rate limiting
    recordSignup(ip)

    // Give OG badge to users with UID < 1000 (matches the backfill cutoff and
    // the other signup paths - was inconsistently <= 1500 here). maybeSingle
    // avoids a thrown error (and a 500 on an otherwise-created account) if the
    // %og% match returns 0 or >1 rows.
    if (newProfile?.uid && newProfile.uid < 1000) {
      const { data: ogBadge } = await admin
        .from('badges')
        .select('id')
        .ilike('name', '%og%')
        .maybeSingle()

      if (ogBadge) {
        await admin.from('profile_badges').insert({
          user_id: userId,
          badge_id: ogBadge.id,
        })
      }
    }

    return createSessionResponse(userId, request)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'An unexpected error occurred' }, { status: 500 })
  }
}
