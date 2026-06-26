import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'
import { SOCIAL_PLATFORMS } from '@/lib/types'

type Period = '3d' | '7d' | '30d' | '90d' | 'all'

function startForPeriod(period: Period): string | null {
  const d = new Date()
  switch (period) {
    case '3d':  d.setDate(d.getDate() - 3);   return d.toISOString()
    case '7d':  d.setDate(d.getDate() - 7);   return d.toISOString()
    case '30d': d.setDate(d.getDate() - 30);  return d.toISOString()
    case '90d': d.setDate(d.getDate() - 90);  return d.toISOString()
    case 'all': return null
  }
}

function parseUA(ua: string): { browser: string; os: string; device: string } {
  const s = ua.toLowerCase()
  let browser = 'Unknown', os = 'Unknown', device = 'Desktop'
  if (s.includes('edg'))                                browser = 'Edge'
  else if (s.includes('chrome'))                        browser = 'Chrome'
  else if (s.includes('firefox'))                       browser = 'Firefox'
  else if (s.includes('safari'))                        browser = 'Safari'
  else if (s.includes('opera') || s.includes('opr/'))   browser = 'Opera'
  if (s.includes('windows'))                            os = 'Windows'
  else if (s.includes('mac os') || s.includes('macintosh')) os = 'macOS'
  else if (s.includes('android'))                       os = 'Android'
  else if (s.includes('iphone') || s.includes('ios'))   os = 'iOS'
  else if (s.includes('linux'))                         os = 'Linux'
  if (s.includes('mobile') || s.includes('android') || s.includes('iphone')) device = 'Mobile'
  else if (s.includes('tablet') || s.includes('ipad'))  device = 'Tablet'
  return { browser, os, device }
}

function categorizeReferrer(r: string): string {
  if (!r) return 'Direct'
  try {
    const host = new URL(r).hostname.replace(/^www\./, '')
    if (host.includes('google'))                        return 'Google'
    if (host.includes('twitter') || host.includes('x.com')) return 'Twitter / X'
    if (host.includes('tiktok'))                        return 'TikTok'
    if (host.includes('instagram'))                     return 'Instagram'
    if (host.includes('discord'))                       return 'Discord'
    if (host.includes('youtube'))                       return 'YouTube'
    if (host.includes('reddit'))                        return 'Reddit'
    if (host.includes('facebook'))                      return 'Facebook'
    return host
  } catch {
    return 'Direct'
  }
}

export async function GET(request: Request) {
  try {
    const rl = await withRateLimit(request, 'general')
    if (rl.response) return rl.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url     = new URL(request.url)
    const period  = (url.searchParams.get('period') || '7d') as Period
    const startIso = startForPeriod(period)

    const supabase = createAdminClient()
    const id       = profile.id

    // All aggregations run in Postgres - no bulk row fetches into Node memory
    const [
      summaryRes,
      viewsByDayRes,
      countryRes,
      referrerRes,
      uaRes,
      hourlyRes,
      dowRes,
      topClicksRes,
      recentViewsRes,
    ] = await Promise.all([
      supabase.rpc('get_analytics_summary',           { p_profile_id: id, p_start: startIso }),
      supabase.rpc('get_analytics_views_by_day',      { p_profile_id: id, p_start: startIso }),
      supabase.rpc('get_analytics_country_breakdown', { p_profile_id: id, p_start: startIso }),
      supabase.rpc('get_analytics_referrer_breakdown',{ p_profile_id: id, p_start: startIso }),
      supabase.rpc('get_analytics_ua_breakdown',      { p_profile_id: id, p_start: startIso }),
      supabase.rpc('get_analytics_hourly',            { p_profile_id: id, p_start: startIso }),
      supabase.rpc('get_analytics_dow',               { p_profile_id: id, p_start: startIso }),
      supabase.rpc('get_analytics_top_clicks',        { p_profile_id: id, p_start: startIso }),
      supabase.rpc('get_analytics_recent_views',      { p_profile_id: id, p_start: startIso }),
    ])

    // --- Summary ---
    const summary       = summaryRes.data?.[0] ?? {}
    const totalViews    = Number(summary.total_views    ?? 0)
    const uniqueVisitors= Number(summary.unique_visitors ?? 0)
    const totalClicks   = Number(summary.total_clicks   ?? 0)
    const totalViewsAll = Number(summary.total_views_all ?? 0)
    const totalClicksAll= Number(summary.total_clicks_all ?? 0)

    // Number of days the trend chart should span.
    //  - fixed windows: the window length (3 / 7 / 30 / 90)
    //  - "all time": the span from the user's earliest day with views to
    //    today. startIso is null for "all", so the old code evaluated
    //    Date.now() - Date.now() = 0 -> days = 1, which collapsed the whole
    //    chart to a single dot AND made avgDaily = totalViews / 1. Derive
    //    the real span from the views-by-day result (RPC returns every day
    //    with views, ascending) instead. Capped at 730 so one stray/corrupt
    //    date row can't blow the fill loop up into thousands of points.
    let days: number
    if (period === 'all') {
      const dayKeys = ((viewsByDayRes.data ?? []) as { day: string }[])
        .map(r => r.day)
        .filter(Boolean)
      if (dayKeys.length > 0) {
        const firstKey = dayKeys.reduce((min, k) => (k < min ? k : min), dayKeys[0])
        const todayKey = new Date().toISOString().split('T')[0]
        const spanMs = new Date(`${todayKey}T00:00:00Z`).getTime()
                     - new Date(`${firstKey}T00:00:00Z`).getTime()
        days = Math.min(730, Math.max(1, Math.round(spanMs / 86400000) + 1))
      } else {
        days = 1
      }
    } else {
      days = ({ '3d': 3, '7d': 7, '30d': 30, '90d': 90 } as Record<string, number>)[period] ?? 7
    }
    const avgDaily  = Math.round(totalViews / days)
    const clickRate = totalViews > 0 ? +(totalClicks / totalViews * 100).toFixed(1) : 0

    // --- Views by day (fill in zeros for missing days) ---
    const dbDayMap  = new Map<string, number>(
      (viewsByDayRes.data ?? []).map((r: any) => [r.day, Number(r.views)])
    )
    const viewsByDay: { date: string; views: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      viewsByDay.push({ date: key, views: dbDayMap.get(key) ?? 0 })
    }

    // --- Hourly (0-23) ---
    const hourlyMap = new Map<number, number>(
      (hourlyRes.data ?? []).map((r: any) => [r.hour, Number(r.views)])
    )
    const hourly = Array.from({ length: 24 }, (_, h) => hourlyMap.get(h) ?? 0)

    // --- Day of week (0-6) ---
    const dowMap = new Map<number, number>(
      (dowRes.data ?? []).map((r: any) => [r.dow, Number(r.views)])
    )
    const dayOfWeek = Array.from({ length: 7 }, (_, d) => dowMap.get(d) ?? 0)

    // --- UA breakdown (aggregated in DB, parsed here - small result set) ---
    const deviceCounts: Record<string, number>  = {}
    const browserCounts: Record<string, number> = {}
    const osCounts: Record<string, number>      = {}
    for (const row of (uaRes.data ?? [])) {
      const count = Number(row.views)
      const { browser, os, device } = parseUA(row.user_agent ?? '')
      deviceCounts[device]  = (deviceCounts[device]  ?? 0) + count
      browserCounts[browser]= (browserCounts[browser] ?? 0) + count
      osCounts[os]          = (osCounts[os]           ?? 0) + count
    }

    // --- Country ---
    const topCountries = (countryRes.data ?? []).map((r: any) => ({
      country:    r.country,
      views:      Number(r.views),
      percentage: totalViews > 0 ? Math.round((Number(r.views) / totalViews) * 100) : 0,
    }))

    // --- Traffic sources ---
    const sourceCounts: Record<string, number> = {}
    for (const row of (referrerRes.data ?? [])) {
      const cat = categorizeReferrer(row.referrer ?? '')
      sourceCounts[cat] = (sourceCounts[cat] ?? 0) + Number(row.views)
    }
    const trafficSources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({
        source,
        visits:     count,
        percentage: totalViews > 0 ? Math.round((count / totalViews) * 100) : 0,
      }))

    // --- Top links (resolve real names + platform so the UI can show the
    // link's actual name and brand icon instead of a row of "Social"). Links
    // that were since deleted resolve to nothing and are dropped rather than
    // shown as a nameless placeholder. ---
    const rawTopLinks = (topClicksRes.data ?? []).map((r: any) => ({
      link_type: String(r.link_type),
      link_id:   (r.link_id ?? null) as string | null,
      clicks:    Number(r.clicks),
    }))
    const socialIds = rawTopLinks.filter(l => l.link_type === 'social' && l.link_id).map(l => l.link_id as string)
    const buttonIds = rawTopLinks.filter(l => l.link_type === 'button' && l.link_id).map(l => l.link_id as string)
    const [socialRes, buttonRes] = await Promise.all([
      socialIds.length
        ? supabase.from('social_links').select('id, platform, label, url').in('id', socialIds)
        : Promise.resolve({ data: [] as any[] }),
      buttonIds.length
        ? supabase.from('custom_buttons').select('id, label, url').in('id', buttonIds)
        : Promise.resolve({ data: [] as any[] }),
    ])
    const socialMap = new Map<string, any>((socialRes.data ?? []).map((r: any) => [r.id, r]))
    const buttonMap = new Map<string, any>((buttonRes.data ?? []).map((r: any) => [r.id, r]))
    const platformName = (p: string | null) =>
      (p && SOCIAL_PLATFORMS.find(x => x.id === p)?.name) || (p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Link')

    const topLinks = rawTopLinks.map(l => {
      if (l.link_type === 'social') {
        const s = l.link_id ? socialMap.get(l.link_id) : null
        if (!s) return null // deleted link - drop it
        return { ...l, name: s.label || platformName(s.platform), platform: (s.platform || null) as string | null, url: (s.url || null) as string | null }
      }
      if (l.link_type === 'button') {
        const b = l.link_id ? buttonMap.get(l.link_id) : null
        if (!b) return null
        return { ...l, name: b.label || 'Button', platform: null as string | null, url: (b.url || null) as string | null }
      }
      // crypto / music / custom etc. - label by type, no brand icon
      return { ...l, name: l.link_type.charAt(0).toUpperCase() + l.link_type.slice(1), platform: null as string | null, url: null as string | null }
    }).filter(Boolean) as { link_type: string; link_id: string | null; clicks: number; name: string; platform: string | null; url: string | null }[]

    // --- Recent views ---
    const recentViews = (recentViewsRes.data ?? []).map((r: any) => ({
      viewed_at: r.viewed_at,
      referrer:  r.referrer,
      country:   r.country,
    }))

    return NextResponse.json({
      period,
      totalViews,
      totalClicks,
      totalViewsAllTime:  totalViewsAll,
      totalClicksAllTime: totalClicksAll,
      uniqueVisitors,
      avgDaily,
      clickRate,
      viewsByDay,
      hourly,
      dayOfWeek,
      deviceBreakdown:  Object.entries(deviceCounts).map(([k, v])  => ({ label: k, value: v })),
      browserBreakdown: Object.entries(browserCounts).map(([k, v]) => ({ label: k, value: v })),
      osBreakdown:      Object.entries(osCounts).map(([k, v])      => ({ label: k, value: v })),
      topCountries,
      trafficSources,
      topLinks,
      recentViews,
    })
  } catch (error) {
    console.error('Analytics GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
