/**
 * JSON endpoint for Profile of the Day. The landing page server
 * component bypasses this and calls `getFeaturedProfile()` directly
 * to avoid a self-fetch; this route exists for anything client-side
 * that wants the same data (future widgets, analytics, etc.).
 *
 * See `lib/featured-profile.ts` for the picker logic + fallback
 * chain.
 */

import { NextResponse } from 'next/server'
import { getFeaturedProfile } from '@/lib/featured-profile'
import { withRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Per-IP rate limit. The 1h s-maxage protects CF edge but origin
  // hits still run the picker (which can do up to 3 DB queries per
  // miss: cache-row lookup, RPC top-viewed, fallback select). Without
  // a rate limit a single client bypassing the cache (e.g. via
  // CF purge or hitting before the daily row is populated) can
  // hammer those queries. 60/min/IP is plenty for legitimate use.
  const rl = await withRateLimit(request, 'general')
  if (rl.response) return rl.response

  const profile = await getFeaturedProfile()
  return NextResponse.json(
    { profile },
    { headers: { 'Cache-Control': 'public, s-maxage=3600' } },
  )
}
