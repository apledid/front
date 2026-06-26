import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { withRateLimit } from '@/lib/rate-limit'

/**
 * Fetch an iTunes 30s preview clip server-side so the Audio Manager's trim
 * modal can decode + crop it in the browser. The preview URLs come from
 * /api/music/search (iTunes Search API) and are NOT reliably CORS-enabled, so
 * a direct client fetch can't read the bytes for Web Audio decoding.
 *
 * Locked down the same way as /api/proxy-image: auth + rate limit, a tight
 * host allowlist (Apple media hosts only), per-hop redirect re-validation to
 * stop an allowlisted host 302-ing to an internal address (SSRF), an
 * audio-only content-type gate, and a streamed size cap. Previews are ~1-2 MB.
 */

const ALLOWED_ROOT_DOMAINS = [
  'itunes.apple.com', // audio-ssl.itunes.apple.com / audio-ss.itunes.apple.com
  'mzstatic.com',     // Apple media CDN that previews sometimes redirect to
]

function isAllowedDomain(hostname: string): boolean {
  return ALLOWED_ROOT_DOMAINS.some(
    root => hostname === root || hostname.endsWith('.' + root),
  )
}

const MAX_BYTES = 15 * 1024 * 1024

export async function GET(request: Request) {
  const rateLimit = await withRateLimit(request, 'general')
  if (rateLimit.response) return rateLimit.response

  // Same gate as the rest of the audio panel - signed-in users only.
  const user = await getApiUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const rawUrl = new URL(request.url).searchParams.get('url')
  if (!rawUrl) return new NextResponse('Missing url parameter', { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return new NextResponse('Invalid protocol', { status: 400 })
  }
  if (!isAllowedDomain(parsed.hostname)) {
    return new NextResponse('Domain not allowed', { status: 403 })
  }

  try {
    // Manual redirect handling so each hop is re-validated against the
    // allowlist (an allowlisted host could otherwise 302 to an internal IP).
    let currentUrl = rawUrl
    let upstream: Response | null = null
    for (let hop = 0; hop < 5; hop++) {
      const target = new URL(currentUrl)
      if (!['http:', 'https:'].includes(target.protocol)) {
        return new NextResponse('Invalid redirect protocol', { status: 400 })
      }
      if (!isAllowedDomain(target.hostname)) {
        return new NextResponse('Redirected to disallowed domain', { status: 403 })
      }
      const res = await fetch(currentUrl, {
        headers: { 'User-Agent': 'halo.rip (+https://halo.rip)', 'Accept': 'audio/*,*/*;q=0.8' },
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(12000),
      })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc) return new NextResponse('Redirect missing Location', { status: 502 })
        currentUrl = new URL(loc, currentUrl).toString()
        continue
      }
      upstream = res
      break
    }
    if (!upstream) return new NextResponse('Too many redirects', { status: 502 })
    if (!upstream.ok) return new NextResponse('Failed to fetch audio', { status: 502 })

    const contentType = upstream.headers.get('content-type') || 'audio/mp4'
    // Audio only. octet-stream is allowed because some CDNs serve m4a that
    // way; nosniff + the client only ever decoding it as audio means a
    // mislabelled body can't be coerced into executable content.
    if (!/^audio\//i.test(contentType) && contentType !== 'application/octet-stream' && contentType !== 'video/mp4') {
      return new NextResponse('Upstream did not return audio', { status: 415 })
    }

    const advertised = Number(upstream.headers.get('content-length') || '0')
    if (Number.isFinite(advertised) && advertised > MAX_BYTES) {
      return new NextResponse('Audio too large', { status: 413 })
    }

    const reader = upstream.body?.getReader()
    if (!reader) return new NextResponse('Upstream had no body', { status: 502 })
    const chunks: Uint8Array[] = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        received += value.byteLength
        if (received > MAX_BYTES) {
          try { await reader.cancel() } catch {}
          return new NextResponse('Audio too large', { status: 413 })
        }
        chunks.push(value)
      }
    }
    const buffer = new Uint8Array(received)
    let offset = 0
    for (const c of chunks) { buffer.set(c, offset); offset += c.byteLength }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=1800',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    })
  } catch {
    return new NextResponse('Proxy error', { status: 502 })
  }
}
