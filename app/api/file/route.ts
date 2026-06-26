import { type NextRequest, NextResponse } from 'next/server'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { join as pathJoin, resolve as pathResolve } from 'path'
import { Readable } from 'stream'
import { withRateLimit } from '@/lib/rate-limit'
import { getMimeTypeFromExtension } from '@/lib/file-validation'

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || '/var/lib/halo-uploads'

// Validate pathname to prevent path traversal and enforce expected format
function isValidPathname(pathname: string): boolean {
  if (pathname.includes('..') || pathname.includes('//')) return false
  if (pathname.startsWith('/') || pathname.includes('\0')) return false
  if (pathname.length > 512) return false
  if (!/^[a-zA-Z0-9\-_.\/]+$/.test(pathname)) return false
  return true
}

// Parse a single-range header "bytes=START-END" (END optional). Multi-range
// is rare for media playback and not worth implementing.
function parseRange(header: string, size: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m) return null
  const startStr = m[1]
  const endStr = m[2]
  let start: number
  let end: number
  if (startStr === '' && endStr !== '') {
    // suffix range: bytes=-N (last N bytes)
    const n = parseInt(endStr, 10)
    if (isNaN(n) || n <= 0) return null
    start = Math.max(0, size - n)
    end = size - 1
  } else {
    start = parseInt(startStr, 10)
    end = endStr === '' ? size - 1 : parseInt(endStr, 10)
    if (isNaN(start) || isNaN(end)) return null
  }
  if (start < 0 || end >= size || start > end) return null
  return { start, end }
}

export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.searchParams.get('pathname')
  if (!pathname) {
    return NextResponse.json({ error: 'Missing pathname' }, { status: 400 })
  }
  if (!isValidPathname(pathname)) {
    return NextResponse.json({ error: 'Invalid pathname' }, { status: 400 })
  }

  const fullPath = pathJoin(UPLOAD_ROOT, pathname)
  // Traversal guard
  if (!pathResolve(fullPath).startsWith(pathResolve(UPLOAD_ROOT) + '/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  let fileStat
  try {
    fileStat = await stat(fullPath)
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
  if (!fileStat.isFile()) {
    return new NextResponse('Not found', { status: 404 })
  }

  const size = fileStat.size
  const mtime = fileStat.mtime
  const etag = `"${size.toString(16)}-${mtime.getTime().toString(16)}"`

  // 304 short-circuit - done BEFORE the rate-limit DB round-trip so cache
  // revalidations (the bulk of repeat profile loads) never touch Postgres.
  const ifNoneMatch = request.headers.get('if-none-match')
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    })
  }

  // Rate-limit only actual byte serving (not 404s or 304s). Dedicated fileServe
  // bucket (600/min) since a rich profile loads 15+ files through this endpoint.
  const rl = await withRateLimit(request, 'fileServe')
  if (rl.response) return rl.response

  const contentType = getMimeTypeFromExtension(pathname) || 'application/octet-stream'

  const headers = new Headers()
  headers.set('Content-Type', contentType)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('ETag', etag)

  // This endpoint is unauthenticated (profile media is public), so harden
  // what it will inline-render: ONLY recognised media (image/video/audio/
  // font) is served inline. Anything else - application/octet-stream, an
  // unexpected type, or a historical SVG (which maps to octet-stream) - is
  // forced to download, so a malicious or mislabeled file can never execute
  // in the halo.rip origin no matter how it got onto disk.
  const isInlineSafeMedia = /^(image|video|audio|font)\//.test(contentType)
  if (!isInlineSafeMedia) {
    headers.set('Content-Type', 'application/octet-stream')
    headers.set('Content-Disposition', 'attachment')
  }

  const rangeHeader = request.headers.get('range')
  let start = 0
  let end = size - 1
  let status: 200 | 206 = 200

  if (rangeHeader) {
    const range = parseRange(rangeHeader, size)
    if (!range) {
      return new NextResponse('Range Not Satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` },
      })
    }
    start = range.start
    end = range.end
    status = 206
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
  }

  const length = end - start + 1
  headers.set('Content-Length', length.toString())

  // Stream the requested byte range. Forward client abort so we tear down
  // the fs stream the moment they disconnect (mobile tab close, video
  // scrub, etc.) - otherwise we get noisy "ReadableStream is already
  // closed" traces and waste IO finishing reads nobody will read.
  const fileStream = createReadStream(fullPath, { start, end })

  // Pre-emptively swallow stream errors so they never surface as
  // uncaughtException. EPIPE / ECONNRESET / ERR_INVALID_STATE on client
  // disconnect are all expected.
  fileStream.on('error', () => { /* noop */ })

  const onAbort = () => {
    try { fileStream.destroy() } catch { /* noop */ }
  }
  request.signal.addEventListener('abort', onAbort, { once: true })

  // Convert Node stream → Web ReadableStream for the Response.
  const webStream = Readable.toWeb(fileStream) as unknown as ReadableStream<Uint8Array>

  return new NextResponse(webStream, { status, headers })
}
