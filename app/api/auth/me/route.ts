import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { sanitizeProfileForOwner } from '@/lib/sanitize-profile'
import { withRateLimit } from '@/lib/rate-limit'

// Force dynamic - this route must never be cached or statically rendered.
export const dynamic = 'force-dynamic'

// "Who am I?" endpoint. Returns 200 in every case, with `user`/`profile`
// null when there's no active session - this matches NextAuth / Clerk
// conventions and (more importantly) keeps the browser console quiet on
// public pages where the request fires before any auth state is known.
// Callers should branch on `profile === null`, not on response.ok.
const NO_AUTH_BODY = { user: null, profile: null, isAdmin: false }
const COMMON_HEADERS = {
  'Cache-Control': 'no-store, private',
  'X-Robots-Tag': 'noindex',
}

export async function GET(request: Request) {
  try {
    const rl = await withRateLimit(request, 'general')
    if (rl.response) return rl.response

    const profile = await getApiUser()

    if (!profile) {
      return NextResponse.json(NO_AUTH_BODY, { headers: COMMON_HEADERS })
    }

    const isAdmin = profile.username === 'rez' || profile.is_admin === true

    return NextResponse.json(
      {
        user: {
          id: profile.id,
          username: profile.username,
        },
        profile: sanitizeProfileForOwner(profile),
        isAdmin,
      },
      { headers: COMMON_HEADERS },
    )
  } catch {
    return NextResponse.json(NO_AUTH_BODY, { headers: COMMON_HEADERS })
  }
}
