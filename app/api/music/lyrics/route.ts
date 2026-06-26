import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { withRateLimit } from '@/lib/rate-limit'

/**
 * "Find lyrics" for the Add-audio panel. Proxies lrclib.net (free, no key,
 * open-source LRC lyrics database) and returns the best synced (timestamped)
 * match for a title + artist so the UI can drop it straight into the synced
 * lyrics box.
 *
 * REZ-ONLY for now (per the staged-rollout rule). The whole audio panel is
 * gated to @rez; this route mirrors that so the feature can't be used by
 * anyone else until it goes public. To make public: drop the username check.
 */
export async function GET(request: Request) {
  const rl = await withRateLimit(request, 'general')
  if (rl.response) return rl.response

  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url    = new URL(request.url)
  const title  = (url.searchParams.get('title')  || '').trim().slice(0, 200)
  const artist = (url.searchParams.get('artist') || '').trim().slice(0, 200)
  if (!title) return NextResponse.json({ error: 'A track title is required' }, { status: 400 })

  try {
    const q = new URLSearchParams({ track_name: title })
    if (artist) q.set('artist_name', artist)
    const res = await fetch(`https://lrclib.net/api/search?${q.toString()}`, {
      signal: AbortSignal.timeout(7000),
      headers: { 'User-Agent': 'halo.rip (+https://halo.rip)' },
    })
    if (!res.ok) return NextResponse.json({ synced: null, plain: null, matched: null })

    const list = (await res.json().catch(() => null)) as
      | Array<{ syncedLyrics?: string | null; plainLyrics?: string | null; trackName?: string; artistName?: string }>
      | null
    if (!Array.isArray(list) || list.length === 0) {
      return NextResponse.json({ synced: null, plain: null, matched: null })
    }

    // Prefer a result that actually carries synced (LRC) lyrics; fall back to
    // the first plain-lyrics result so "Find lyrics" still does something useful.
    const synced   = list.find(r => r.syncedLyrics && r.syncedLyrics.trim())
    const plainHit = list.find(r => r.plainLyrics && r.plainLyrics.trim())
    const chosen   = synced || plainHit || list[0]

    return NextResponse.json({
      synced:  chosen?.syncedLyrics?.trim() || null,
      plain:   chosen?.plainLyrics?.trim()  || null,
      matched: chosen ? { title: chosen.trackName ?? null, artist: chosen.artistName ?? null } : null,
    })
  } catch {
    return NextResponse.json({ synced: null, plain: null, matched: null })
  }
}
