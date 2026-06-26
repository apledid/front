import { NextResponse, type NextRequest } from 'next/server'
import { getClientIp } from '@/lib/rate-limit'

// MAINTENANCE MODE - Set to true to block all traffic except allowed users
const MAINTENANCE_MODE = false
const ALLOWED_IPS: string[] = [] // Add your IP here to bypass, e.g. ['123.456.789.0']

export async function middleware(request: NextRequest) {
  // Canonical host: redirect www.halo.rip → halo.rip with a 308
  // permanent redirect (preserves method + body, browsers cache it).
  //
  // Why this matters: the session cookies set during login are
  // host-only (no Domain attribute), so they live only on whichever
  // exact host the browser saw at login time. When a user types into
  // the URL bar and Brave/Chrome autocompletes to https://www.halo.rip
  // they get sent to a host where their cookies don't exist - the
  // page renders as logged-out and any profile widgets that fetch
  // session-scoped data fail. The browser follows this redirect to
  // the apex and re-sends the cookies it has for halo.rip, so the
  // user stays logged in seamlessly.
  //
  // Keep the path, query, and hash so deep links survive the rewrite.
  //
  // Check the Host header directly instead of relying solely on
  // request.nextUrl.hostname - when Next.js runs behind nginx + a
  // proxy chain, nextUrl can end up reflecting the configured
  // origin from NEXT_PUBLIC_APP_URL rather than the user's actual
  // Host. The raw Host header is what the browser sent and the
  // only authoritative source for canonicalisation.
  const hostHeader = request.headers.get('host') || ''
  const rawHost = hostHeader.split(':')[0].toLowerCase()
  if (rawHost === 'www.halo.rip' || request.nextUrl.hostname === 'www.halo.rip') {
    const target = request.nextUrl.clone()
    target.hostname = 'halo.rip'
    target.port = ''
    return NextResponse.redirect(target, 308)
  }

  // Anti-view-bomb visitor cookie. Public profile pages dedupe their
  // view counter on a hash that combines this cookie with the
  // visitor's /24 (IPv4) or /48 (IPv6) subnet. Setting the cookie
  // here in middleware lets the page's server component read it via
  // cookies() on subsequent visits - server components can't issue
  // Set-Cookie themselves. Random 16-byte hex, HttpOnly, 1 year, lax
  // sameSite so it still goes out on top-level cross-site nav.
  let visitorCookieToSet: string | null = null
  if (!request.cookies.get('halo_visitor')?.value) {
    // Cheap RNG good enough for dedup - not used for auth.
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    visitorCookieToSet = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // Maintenance mode check
  if (MAINTENANCE_MODE) {
    const path = request.nextUrl.pathname

    // Allow maintenance page, login, static assets, and API auth
    if (
      path === '/maintenance' ||
      path === '/login' ||
      path.startsWith('/api/auth/login') ||
      path.startsWith('/api/auth/me') ||
      path.startsWith('/_next') ||
      path.includes('.')
    ) {
      // Continue to normal processing
    } else {
      const ip = getClientIp(request)
      const sessionCookie = request.cookies.get('session_token')?.value

      if (ALLOWED_IPS.length > 0 && ALLOWED_IPS.includes(ip)) {
        // Allowed by IP
      } else if (
        // Tighter session-token check than just `length >= 64`. The token
        // generator in lib/api-auth.ts emits exactly 64 hex chars; this
        // pattern stops a random padding string from sneaking past
        // maintenance mode. Note we still don't fully validate the
        // session against the DB here - middleware runs on the Edge
        // Runtime which can't reach Postgres - but a format check is
        // enough to keep casual probing out.
        sessionCookie &&
        /^[0-9a-f]{64}$/.test(sessionCookie)
      ) {
        // Valid session token format - allow through
      } else {
        return NextResponse.redirect(new URL('/maintenance', request.url))
      }
    }
  }

  // CSP is set via next.config.mjs headers() - do NOT also set it here.
  // Setting it in two places causes browsers to enforce BOTH (most restrictive wins),
  // which breaks nonce-based inline scripts injected by Next.js/Turbopack.
  const response = NextResponse.next()
  if (visitorCookieToSet) {
    response.cookies.set('halo_visitor', visitorCookieToSet, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      // Same domain scope as session cookies so the cookie reaches
      // halo.rip and the canonical-redirected www.halo.rip both.
      ...(process.env.NEXT_PUBLIC_APP_URL?.includes('halo.rip')
        ? { domain: '.halo.rip' }
        : {}),
    })
  }
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
