import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies, headers } from 'next/headers'
import { withRateLimit, getClientIp } from '@/lib/rate-limit'
import { createHash } from 'crypto'

// Obvious bot / scraper / headless-browser user agents. Anything matching
// these is allowed to load the page (we still serve them) but is silently
// excluded from the view count. Keep the list short and conservative -
// false positives undercount real users and can't be diagnosed easily.
//
// Order doesn't matter; the regex is built once at module load.
const BOT_UA_RE = /(?:bot|crawl|spider|slurp|fetch|wget|curl|python-|axios|node-fetch|httpclient|headlesschrome|phantomjs|puppeteer|playwright|selenium|scrapy)/i

// Subnets to dedupe by. IPv4 /24 (first 3 octets) and IPv6 /48 (first
// 4 hextets) catch the typical case where a proxy pool rotates the
// last octet/hextet to look like a new user. Tighter than full-IP
// dedup but loose enough that real visitors behind the same NAT
// (households / mobile carrier CGNAT) still all get counted once
// each via the visitor cookie below.
function ipSubnet(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown'
  if (ip.includes(':')) {
    // IPv6 → keep first four hextets (/48)
    const parts = ip.split(':')
    return parts.slice(0, 4).join(':')
  }
  // IPv4 → keep first three octets (/24)
  const parts = ip.split('.')
  if (parts.length === 4) return parts.slice(0, 3).join('.') + '.0'
  return ip
}

// Cap how many fresh anonymous views a single profile can accumulate
// per hour. Dropped from 500 to 100 after a botter publicly
// announced he could sustain 300-400 views/hour through a residential
// proxy pool. Real viral growth rarely exceeds 100/hour organically;
// when it does, the cap throttles (doesn't erase) excess views so
// the profile keeps growing at the ceiling rate instead of getting
// view-bombed past every legitimate creator on the leaderboard.
const HOURLY_VIEW_CAP_PER_PROFILE = 100

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await withRateLimit(request, 'trackView')
    if (rateLimit.response) return rateLimit.response

    const url = new URL(request.url)
    const profileId = url.searchParams.get('profileId')

    if (!profileId) {
      return NextResponse.json({ error: 'Profile ID required' }, { status: 400 })
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
      return NextResponse.json({ error: 'Invalid profile ID format' }, { status: 400 })
    }

    const headersList = await headers()

    const visitorIp    = getClientIp(headersList)
    const userAgent    = headersList.get('user-agent') || null
    const referrer     = headersList.get('referer') || null

    // Bot UA filter - silently no-op for crawler-shaped requests. We
    // still respond 200 so we don't tip off scrapers, but the view
    // never lands in the DB.
    if (userAgent && BOT_UA_RE.test(userAgent)) {
      return NextResponse.json({ success: true })
    }

    // Use Cloudflare / Vercel geo headers - no external HTTP call needed
    const cfCountry = headersList.get('cf-ipcountry') || null
    const vcCountry = headersList.get('x-vercel-ip-country') || null
    let country: string | null = null
    if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') country = cfCountry
    else if (vcCountry && vcCountry !== 'XX') country = vcCountry

    // Tor exit traffic (cf-ipcountry: 'T1') is heavily abused for
    // view-bombing. Serve the page but never count the view.
    if (cfCountry === 'T1') {
      return NextResponse.json({ success: true })
    }

    // If no geo header available, do the lookup AFTER responding so it never blocks
    const needsGeoLookup = !country && visitorIp && visitorIp !== 'unknown'

    // Visitor cookie REQUIRED. Middleware sets it on every page load
    // before this endpoint can be called, so a real browser always
    // has it by the time the client-side TrackView component fires
    // its POST. A bot that calls /api/track-view directly without
    // first loading the profile page (or without cookie storage) has
    // no cookie - silently 200 and don't count. This is the layer
    // that defeats the "rotate residential IPs + skip the page" bot
    // pattern, because the cookie has to come from a real GET to the
    // profile page that processed the Set-Cookie header.
    const jar = await cookies()
    const visitorId = jar.get('halo_visitor')?.value
    if (!visitorId || !/^[0-9a-f]{32}$/i.test(visitorId)) {
      return NextResponse.json({ success: true })
    }
    // Referer must be from halo.rip - same-origin XHR/fetch only.
    // Bots that POST cross-origin can't easily forge this header
    // (browsers strip / refuse to send Referer when origin doesn't
    // match). Optional, since some privacy-focused browsers strip
    // Referer entirely, but if present it has to match.
    const refererHost = (() => {
      try { return referrer ? new URL(referrer).hostname : '' } catch { return '' }
    })()
    if (refererHost && refererHost !== 'halo.rip' && !refererHost.endsWith('.halo.rip')) {
      return NextResponse.json({ success: true })
    }

    const subnet = ipSubnet(visitorIp)
    const visitorHash = createHash('sha256')
      .update(`${visitorId}:${subnet}`)
      .digest('hex')
      .slice(0, 16)

    const admin = createAdminClient()

    // Velocity cap - count fresh visitor_hashes inserted in the last
    // hour for this profile. If we're at or above the ceiling, accept
    // the request but skip the insert so the view never counts. Real
    // users behind the cap still all show up; bot floods just hit a
    // wall.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentNewViews } = await admin
      .from('page_views')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .gte('first_viewed_at', oneHourAgo)

    const overCap = (recentNewViews ?? 0) >= HOURLY_VIEW_CAP_PER_PROFILE

    // Upsert page_views - one row per (profile_id, visitor_hash).
    // ignoreDuplicates: true → ON CONFLICT DO NOTHING, so a refresh or repeat
    // visit is a no-op and never counts twice.
    //
    // profiles.view_count is bumped by a DB trigger on this table
    // (page_view_insert_trigger, AFTER INSERT FOR EACH ROW, runs
    // increment_profile_view_count()), which fires exactly once per genuinely
    // new row. We must NOT also increment from here: doing both was
    // double-counting every unique visitor, so view_count grew at ~2x the real
    // unique page_views (02lob read 1158 for 579 visitors). The trigger is
    // atomic with the insert so it can't drift. See migration 076.
    if (!overCap) {
      await admin.from('page_views').upsert(
        {
          profile_id:    profileId,
          visitor_hash:  visitorHash,
          user_agent:    userAgent,
          referrer,
          country,
          last_viewed_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,visitor_hash', ignoreDuplicates: true },
      )
    }

    // Fire-and-forget geo lookup - runs after response is sent, no latency cost.
    // Switched from ipapi.co to ip-api.com: ipapi.co started returning
    // RateLimited on every call from this VPS, which left country NULL on
    // 100% of rows (the dashboard showed "Unknown" for everyone). ip-api.com
    // is free (45 req/min, no key) and reachable from the box. It's HTTP-only
    // on the free tier, which is fine here - this is a server-to-server call,
    // so there's no browser / mixed-content / CSP involved.
    if (needsGeoLookup) {
      ;(async () => {
        try {
          const geoRes = await fetch(`http://ip-api.com/json/${encodeURIComponent(visitorIp)}?fields=status,countryCode`, {
            signal: AbortSignal.timeout(2500),
          })
          if (geoRes.ok) {
            const j = (await geoRes.json().catch(() => null)) as { status?: string; countryCode?: string } | null
            const code = j?.status === 'success' ? (j.countryCode || '').trim() : ''
            if (code && /^[A-Z]{2}$/.test(code)) {
              await admin
                .from('page_views')
                .update({ country: code })
                .eq('profile_id', profileId)
                .eq('visitor_hash', visitorHash)
            }
          }
        } catch {
          // Geo lookup failed - country stays null, not a hard error
        }
      })()
    }

    // The visitor cookie is set by middleware on every page load,
    // not here - by the time a request reaches /api/track-view the
    // cookie is guaranteed to already exist (or the bot doesn't
    // have one, which is the whole point).
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Track view error:', error)
    return NextResponse.json({ error: 'Failed to track view' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimit = await withRateLimit(request, 'trackView')
    if (rateLimit.response) return rateLimit.response

    const profileId = request.nextUrl.searchParams.get('profileId')
    // Validate UUID format - this runs an exact count() so reject junk early
    // and keep the public endpoint from being a cheap unbounded-query lever.
    if (!profileId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
      return NextResponse.json({ error: 'Valid profile ID required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { count, error } = await admin
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profileId)

    if (error) return NextResponse.json({ views: 0 })
    return NextResponse.json({ views: count || 0 })
  } catch {
    return NextResponse.json({ views: 0 })
  }
}
