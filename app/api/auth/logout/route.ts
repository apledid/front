import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/api-auth'
import { withRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const rl = await withRateLimit(request, 'general')
    if (rl.response) return rl.response

    const cookieStore = await cookies()
    const rawToken = cookieStore.get('session_token')?.value

    // Revoke session in DB so the token can't be reused even if the cookie is
    // captured from a log or network trace.
    if (rawToken) {
      try {
        const admin = createAdminClient()
        const tokenHash = hashToken(rawToken)
        await admin
          .from('sessions')
          .update({ revoked_at: new Date().toISOString() })
          .eq('token_hash', tokenHash)
      } catch (err) {
        // Don't block logout if DB revocation fails - cookies still get cleared.
        console.error('[Logout] Failed to revoke session:', err)
      }
    }

    // To clear a cookie reliably we need to match the (path, domain)
    // tuple it was set with. lib/create-session.ts sets session cookies
    // with Domain=.halo.rip in production so the cookie reaches both
    // halo.rip and any subdomain - match that here, else the browser
    // keeps the original domain-scoped cookie around and the user
    // stays "logged in" until it expires naturally.
    //
    // We also issue a host-only clear (no domain) to wipe any legacy
    // host-only cookies left over from before the Domain change. Two
    // Set-Cookie headers, one with Domain, one without, takes care of
    // both states without us tracking which one each user has.
    let domain: string | undefined
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      if (appUrl) {
        const host = new URL(appUrl).hostname
        if (host === 'halo.rip' || host.endsWith('.halo.rip')) {
          domain = '.halo.rip'
        }
      }
    } catch { /* host-only clear is enough in dev */ }

    const res = NextResponse.json({ success: true })
    const clearOptsHostOnly = { maxAge: 0, path: '/' }
    const clearOptsDomain = domain ? { ...clearOptsHostOnly, domain } : clearOptsHostOnly
    for (const name of ['session_token', 'user_id', 'session_created_at', 'staff_license']) {
      res.cookies.set(name, '', clearOptsHostOnly)
      if (domain) res.cookies.set(name, '', clearOptsDomain)
    }
    return res
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
