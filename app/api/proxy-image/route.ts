import { NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limit'

// Allowed root domains (any subdomain of these is permitted)
const ALLOWED_ROOT_DOMAINS = [
  'tiktokcdn.com',      // all TikTok CDN subdomains (p16-*, p19-*, p77-*, etc.)
  'tiktokcdn-us.com',
  'muscdn.com',         // TikTok music CDN
  'tikwm.com',
  'discordapp.com',
  'discord.com',
  'githubusercontent.com',
  'robloxcdn.com',
  'rbxcdn.com',
]

function isAllowedDomain(hostname: string): boolean {
  return ALLOWED_ROOT_DOMAINS.some(
    root => hostname === root || hostname.endsWith('.' + root)
  )
}

export async function GET(request: Request) {
  const rateLimit = await withRateLimit(request, 'general')
  if (rateLimit.response) return rateLimit.response

  const { searchParams } = new URL(request.url)
  const rawUrl = searchParams.get('url')

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

  // Hard cap on response size. 25 MB is wider than any legitimate avatar /
  // social-share image; anything bigger is almost certainly an attempt to
  // exhaust the Node process memory through this proxy.
  const MAX_BYTES = 25 * 1024 * 1024

  try {
    // redirect: 'manual' so we can RE-VALIDATE the redirected hostname
    // against the allowlist before following. Default fetch behavior
    // follows redirects opaquely, which lets a compromised allowlisted
    // CDN 302 to an arbitrary host (evil.com / 127.0.0.1) and trick the
    // proxy into fetching + serving its content. Manual handling lets us
    // re-run isAllowedDomain on each hop.
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
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.tiktok.com/',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
        cache: 'no-store',
        redirect: 'manual',
      })
      // Manual redirect handling - 30x with Location header means follow.
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc) return new NextResponse('Redirect missing Location', { status: 502 })
        currentUrl = new URL(loc, currentUrl).toString()
        continue
      }
      upstream = res
      break
    }
    if (!upstream) {
      return new NextResponse('Too many redirects', { status: 502 })
    }

    if (!upstream.ok) {
      return new NextResponse('Failed to fetch image', { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg'
    // Reject non-image responses so a compromised CDN can't serve HTML/JS
    // through the proxy and trick browsers into MIME-sniffing it as a script.
    if (!/^image\//i.test(contentType)) {
      return new NextResponse('Upstream did not return an image', { status: 415 })
    }

    // Pre-check Content-Length when the upstream advertises it. Avoids
    // allocating a giant ArrayBuffer just to reject it.
    const advertisedLength = Number(upstream.headers.get('content-length') || '0')
    if (Number.isFinite(advertisedLength) && advertisedLength > MAX_BYTES) {
      return new NextResponse('Image too large', { status: 413 })
    }

    // Stream the body and reject if it grows past MAX_BYTES. Without this,
    // an upstream that omits Content-Length (chunked encoding) could
    // stream gigabytes through arrayBuffer() and OOM the process.
    const reader = upstream.body?.getReader()
    if (!reader) {
      return new NextResponse('Upstream had no body', { status: 502 })
    }
    const chunks: Uint8Array[] = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        received += value.byteLength
        if (received > MAX_BYTES) {
          try { await reader.cancel() } catch {}
          return new NextResponse('Image too large', { status: 413 })
        }
        chunks.push(value)
      }
    }
    const buffer = new Uint8Array(received)
    let offset = 0
    for (const c of chunks) {
      buffer.set(c, offset)
      offset += c.byteLength
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Cache for 30 min in the browser - short enough to refresh before CDN tokens expire
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    })
  } catch {
    return new NextResponse('Proxy error', { status: 502 })
  }
}
