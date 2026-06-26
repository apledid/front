import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { withRateLimit } from '@/lib/rate-limit'

/**
 * Quick-import search for the Add-audio panel. Uses iTunes (rich metadata +
 * cover + duration). The full audio is resolved + downloaded from Deezer by
 * /api/music/import-search using the picked track's title/artist/duration.
 *
 * Spotify is not usable (Web API gated, no previews); YouTube/SoundCloud are
 * not used.
 */

// iTunes hands back 100x100 artwork; bump it to a crisp 600x600 square.
function upscaleArt(url: string | null | undefined): string | null {
  if (!url) return null
  return url.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/i, '/600x600bb.$1')
}

export async function GET(request: Request) {
  const rl = await withRateLimit(request, 'general')
  if (rl.response) return rl.response

  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 120)
  if (!q) return NextResponse.json({ results: [] })

  try {
    const params = new URLSearchParams({ term: q, entity: 'song', media: 'music', limit: '8' })
    const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
      signal: AbortSignal.timeout(7000),
      headers: { 'User-Agent': 'halo.rip (+https://halo.rip)' },
    })
    if (!res.ok) return NextResponse.json({ results: [] })

    const data = (await res.json().catch(() => null)) as { results?: any[] } | null
    const results = (data?.results ?? [])
      .map((r: any) => ({
        title: String(r.trackName ?? ''),
        artist: String(r.artistName ?? ''),
        album: String(r.collectionName ?? ''),
        cover: upscaleArt(r.artworkUrl100),
        preview: (typeof r.previewUrl === 'string' ? r.previewUrl : null),
        external: (typeof r.trackViewUrl === 'string' ? r.trackViewUrl : null),
        source: 'itunes' as const,
        duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : 0,
      }))
      .filter((r) => r.title)
      .slice(0, 8)

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
