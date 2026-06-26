import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { withRateLimit } from '@/lib/rate-limit'
import { deezerSearchBestId, downloadDeezerMp3 } from '@/lib/deezer'

/**
 * Quick Import "full song" resolver. The browser sends { title, artist,
 * duration } (an iTunes pick). We find the exact original on Deezer (by
 * title/artist/duration) and download the real audio via streamrip, then
 * stream the MP3 back to the browser for the trim modal.
 *
 * No proxy, no YouTube, no SoundCloud - just Deezer. Nothing is written to disk
 * past a temp dir that gets cleaned up.
 */

export const maxDuration = 120

export async function POST(request: Request) {
  const rl = await withRateLimit(request, 'upload')
  if (rl.response) return rl.response

  const profile = await getApiUser()
  if (!profile) {
    return NextResponse.json({ error: 'Please log in first' }, { status: 401 })
  }
  if (!(profile as any).email_verified) {
    return NextResponse.json({ error: 'Please verify your email before importing audio' }, { status: 403 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 200) : ''
  const artist = typeof body?.artist === 'string' ? body.artist.trim().slice(0, 200) : ''
  const duration = typeof body?.duration === 'number' && body.duration > 0 ? body.duration : 0
  if (!title && !artist) {
    return NextResponse.json({ error: 'Missing song title' }, { status: 400 })
  }

  const trackId = await deezerSearchBestId(title, artist, duration)
  if (!trackId) {
    return NextResponse.json({ error: 'Could not find that song.' }, { status: 404 })
  }

  const buf = await downloadDeezerMp3(trackId)
  if (!buf || buf.length === 0) {
    return NextResponse.json({ error: 'Could not download that song. Try uploading a file.' }, { status: 502 })
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(buf.length),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
