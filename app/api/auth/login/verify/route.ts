import { NextResponse } from 'next/server'
import { withRateLimit, getClientIp } from '@/lib/rate-limit'
import { pendingLogins } from '@/lib/pending-logins'
import { logLogin } from '@/lib/discord-webhook'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSessionToken, hashToken, constantTimeEqual } from '@/lib/api-auth'

export async function POST(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'verifyEmail')
    if (rateLimit.response) return rateLimit.response

    const { userId, code, rememberDevice } = await request.json()

    if (!userId || !code) {
      return NextResponse.json({ error: 'User ID and code are required' }, { status: 400 })
    }

    const pending = await pendingLogins.get(userId)

    if (!pending) {
      return NextResponse.json({ error: 'No pending verification. Please log in again.' }, { status: 400 })
    }

    if (Date.now() > pending.expiresAt) {
      await pendingLogins.delete(userId)
      return NextResponse.json({ error: 'Verification code expired. Please log in again.' }, { status: 400 })
    }

    if (pending.attempts >= 5) {
      await pendingLogins.delete(userId)
      return NextResponse.json({ error: 'Too many failed attempts. Please log in again.' }, { status: 429 })
    }

    if (!constantTimeEqual(pending.code, code)) {
      await pendingLogins.incrementAttempts(userId)
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    // Code is valid
    logLogin(pending.username).catch(() => {})
    await pendingLogins.delete(userId)

    const admin = createAdminClient()

    // Create the main session
    const sessionToken = generateSessionToken()
    const sessionHash = hashToken(sessionToken)
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await admin.from('sessions').insert({
      user_id: userId,
      token_hash: sessionHash,
      expires_at: sessionExpiresAt.toISOString(),
      ip_address: getClientIp(request),
      user_agent: request.headers.get('user-agent') ?? null,
    })

    // Optionally mint a trusted device token
    let tdRawToken: string | null = null
    if (rememberDevice) {
      try {
        const rawToken = generateSessionToken()
        const tokenHash = hashToken(rawToken)
        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

        const { error: tdErr } = await admin.from('trusted_devices').insert({
          user_id: userId,
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString(),
          ip_address: getClientIp(request),
          user_agent: request.headers.get('user-agent') ?? null,
        })

        if (tdErr) {
          console.error('[Verify] Failed to insert trusted device:', tdErr.message)
        } else {
          tdRawToken = rawToken
        }
      } catch (err) {
        console.error('[Verify] Trusted device error:', err)
      }
    }

    // Scope session cookies to .halo.rip so they reach both halo.rip
    // and www.halo.rip - without this the cookies were host-only and
    // the user appeared logged out the moment their browser
    // autocompleted into the other host. Matches lib/create-session.ts
    // and the Discord OAuth callback.
    let cookieDomain: string | undefined
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      if (appUrl) {
        const host = new URL(appUrl).hostname
        if (host === 'halo.rip' || host.endsWith('.halo.rip')) {
          cookieDomain = '.halo.rip'
        }
      }
    } catch { /* leave undefined in dev */ }

    // Build one response with ALL cookies set at once - avoids Next.js mutation issues
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    }

    const res = NextResponse.json({ success: true, userId })
    res.cookies.set('session_token', sessionToken, { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 })
    res.cookies.set('user_id', userId, { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 })
    res.cookies.set('session_created_at', new Date().toISOString(), { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 })

    if (tdRawToken) {
      res.cookies.set('td_token', tdRawToken, { ...cookieOpts, maxAge: 60 * 60 * 24 * 14 })
      console.log('[Verify] Trusted device cookie set for user:', userId)
    }

    return res
  } catch (error) {
    console.error('Login verify error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
