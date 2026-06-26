import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSessionToken, hashToken } from '@/lib/api-auth'
import { getClientIp } from '@/lib/rate-limit'

/**
 * Creates a verified session in the database and returns a NextResponse
 * with the session_token, user_id, and session_created_at cookies set.
 *
 * The raw token is sent to the user; only the SHA-256 hash is stored.
 */
export async function createSessionResponse(
  userId: string,
  request?: Request,
): Promise<NextResponse> {
  const rawToken = generateSessionToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const admin = createAdminClient()
  const { error } = await admin.from('sessions').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    ip_address: request ? getClientIp(request) : null,
    user_agent: request?.headers.get('user-agent') ?? null,
  })

  if (error) {
    console.error('[Session] Failed to persist session:', error.message)
    // Don't block login on DB write error - but log it
  }

  // Cookie domain: scope session cookies to `.halo.rip` in production
  // so they're sent to BOTH halo.rip and any subdomain (e.g. the
  // legacy www.halo.rip). Without this the cookies were host-only -
  // logging in on halo.rip left no session on www.halo.rip and vice
  // versa, which broke users whose browser autocompleted to the www
  // form. The middleware redirects www → apex on top of this so the
  // two layers cover each other: even if a stray request hits www
  // directly (e.g. a third-party preload, the Discord OAuth allowlist),
  // the cookie still applies.
  //
  // Derive the host from VPS_URL/NEXT_PUBLIC_APP_URL so local dev and
  // preview deploys (where the host isn't halo.rip) stay host-only.
  let domain: string | undefined
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    if (appUrl) {
      const host = new URL(appUrl).hostname
      if (host === 'halo.rip' || host.endsWith('.halo.rip')) {
        domain = '.halo.rip'
      }
    }
  } catch {
    /* leave domain undefined for local dev */
  }

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    ...(domain ? { domain } : {}),
  }

  const res = NextResponse.json({ success: true, userId })
  res.cookies.set('session_token', rawToken, cookieOpts)
  res.cookies.set('user_id', userId, cookieOpts)
  res.cookies.set('session_created_at', new Date().toISOString(), cookieOpts)
  return res
}
