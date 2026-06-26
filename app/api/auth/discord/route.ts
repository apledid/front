import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { withRateLimit } from '@/lib/rate-limit'

// Start Discord OAuth flow.
// ?action=login  - find a profile by discord_id and create a session (no auth required)
// ?action=connect - link Discord to the currently logged-in account (auth required)
//
// Rate-limited at `general` (60/min). The `login` bucket is for actual
// password attempts where brute force is the threat; this route just
// generates a state token + redirects to Discord, which is cheap and
// non-sensitive. Using `login` here meant a user retrying Connect a
// few times after any transient error got locked out for 15 minutes.
export async function GET(request: Request) {
  const rl = await withRateLimit(request, 'general')
  if (rl.response) return rl.response

  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) {
    const url = new URL(request.url)
    const action = url.searchParams.get('action') || 'login'
    const dest = action === 'connect' ? '/dashboard/settings?error=discord_not_configured' : '/login?error=discord_not_configured'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  const url = new URL(request.url)
  const action = url.searchParams.get('action') || 'login'

  const state = randomBytes(16).toString('hex')
  // Use NEXT_PUBLIC_APP_URL if set, otherwise derive from forwarded host (Railway/Cloudflare)
  // Normalise bare "halo.rip" → "www.halo.rip" so the redirect_uri matches Discord's allowlist
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    || (() => {
      const fwdHost = request.headers.get('x-forwarded-host')
      const proto = request.headers.get('x-forwarded-proto') || 'https'
      if (fwdHost) {
        const host = fwdHost === 'halo.rip' ? 'www.halo.rip' : fwdHost
        return `${proto}://${host}`
      }
      return url.origin
    })()
  const redirectUri = `${appUrl}/api/auth/discord/callback`

  const discordUrl = new URL('https://discord.com/oauth2/authorize')
  discordUrl.searchParams.set('client_id', clientId)
  discordUrl.searchParams.set('redirect_uri', redirectUri)
  discordUrl.searchParams.set('response_type', 'code')
  // `email` added alongside `identify` so the callback can match a
  // Discord signup against an existing email-signup account and LINK
  // instead of spawning a duplicate (the boka bug). Discord verifies
  // the email before sharing it; we only trust it when verified=true.
  discordUrl.searchParams.set('scope', 'identify email')
  discordUrl.searchParams.set('state', `${state}:${action}`)

  // Cookie needs to be valid on BOTH halo.rip (where the user starts the
  // flow if they hit the bare domain) AND www.halo.rip (where Discord's
  // OAuth allowlist sends them on callback). Without a `domain` attribute
  // the cookie pins to whatever exact host the route was hit on, and the
  // browser refuses to send it to the other subdomain - manifests as
  // `error=discord_state_mismatch` on the callback.
  //
  // Derive the parent domain from the normalised appUrl: any *.halo.rip
  // host (including halo.rip itself) gets `domain: '.halo.rip'`. For
  // local dev / preview deploys we leave domain unset so the default
  // host-only scoping kicks in.
  let cookieDomain: string | undefined
  try {
    const host = new URL(appUrl).hostname
    if (host === 'halo.rip' || host.endsWith('.halo.rip')) {
      cookieDomain = '.halo.rip'
    }
  } catch {
    /* leave cookieDomain undefined */
  }

  const response = NextResponse.redirect(discordUrl.toString())
  response.cookies.set('discord_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/',
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  })
  return response
}
