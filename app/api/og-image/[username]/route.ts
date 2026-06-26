import { NextResponse } from 'next/server'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { Readable } from 'stream'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'
import { getMimeTypeFromExtension } from '@/lib/file-validation'

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || '/var/lib/halo-uploads'

const FALLBACK_SVG = `<svg xmlns="http://w3.org" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0e0e16"/>
  <circle cx="256" cy="196" r="100" fill="#1a1a2e" stroke="#e87fa0" stroke-width="3"/>
  <circle cx="256" cy="176" r="56" fill="#e87fa0" opacity="0.9"/>
  <ellipse cx="256" cy="310" rx="96" ry="60" fill="#e87fa0" opacity="0.9"/>
  <text x="256" y="468" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="bold" fill="#e87fa0">halo.rip</text>
</svg>`

// Cache OG images for 1 hour - avatar changes are infrequent
export const revalidate = 3600

function isValidPathname(pathname: string): boolean {
  if (pathname.includes('..') || pathname.includes('//')) return false
  if (pathname.startsWith('/') || pathname.includes('\0')) return false
  if (pathname.length > 512) return false
  if (!/^[a-zA-Z0-9\-_.\/]+$/.test(pathname)) return false
  return true
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const rl = await withRateLimit(request, 'general')
    if (rl.response) return rl.response

    const { username } = await params
    const admin = createAdminClient()

    // Page-route params arrive URL-encoded (e.g. `%2B_%2B` for `+_+`); decode
    // before looking up.
    let decoded = username
    try { decoded = decodeURIComponent(username) } catch {}
    // The metadata layer appends a `.gif` (or other image) extension to this
    // URL so Discord's media proxy animates GIF avatars - strip it before the
    // username lookup. The extension only steers Discord; the bytes/content
    // type come from the avatar file itself.
    decoded = decoded.replace(/\.(gif|png|jpe?g|webp)$/i, '')
    const { data: profile } = await admin
      .from('profiles')
      .select('avatar_url, embed_image_url')
      .eq('username', decoded.toLowerCase())
      .maybeSingle()

    // Prefer the custom embed image (what the metadata advertises) and fall
    // back to the avatar, so the `.gif` proxy path animates either source.
    const avatarUrl = profile?.embed_image_url || profile?.avatar_url
    if (!avatarUrl) throw new Error('no avatar')

    // ── Locally-hosted upload (/api/file?pathname=...) ───────────────────────
    // avatar_url is stored as "/api/file?pathname=avatar/<user-id>/...". Read
    // the file directly from disk and stream it. Discord's OG crawler doesn't
    // follow redirects, so we serve the bytes inline with public cache.
    if (avatarUrl.includes('?pathname=') || avatarUrl.startsWith('/api/file')) {
      try {
        const urlObj = new URL(avatarUrl, 'https://placeholder.invalid')
        const pathname = urlObj.searchParams.get('pathname')

        if (pathname && isValidPathname(pathname)) {
          // Bypassed path.join / path.resolve entirely using clean string literals 
          // to completely hide the operations from Turbopack's tracer
          const cleanRoot = UPLOAD_ROOT.endsWith('/') ? UPLOAD_ROOT.slice(0, -1) : UPLOAD_ROOT
          const fullPath = `${cleanRoot}/${pathname}`
          
          const fileStat = await stat(fullPath)
          if (fileStat.isFile()) {
            const contentType = getMimeTypeFromExtension(pathname) || 'image/jpeg'
            const stream = createReadStream(fullPath)
            stream.on('error', () => { /* swallow client disconnect */ })
            const webStream = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>
            return new NextResponse(webStream, {
              headers: {
                'Content-Type': contentType,
                'Content-Length': fileStat.size.toString(),
                'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
              },
            })
          }
        }
      } catch {
        // fall through to remote / fallback
      }
    }

    // ── External / absolute URL ───────────────────────────────────────────────
    // Discord's OG crawler does NOT follow HTTP redirects for og:image,
    // so we must proxy the bytes directly.
    // SECURITY: Only proxy from trusted image CDN domains to prevent SSRF.
    const ALLOWED_OG_HOSTS = [
      '://discordapp.com',
      '://githubusercontent.com',
      'github.com',
      '://imgur.com',
      'imgur.com',
      '://twimg.com',
      '://twimg.com',
      '://tiktokcdn-us.com',
      '://tiktokcdn.com',
      '://tiktokcdn.com',
      '://tikwm.com',
    ]
    if (avatarUrl.startsWith('https://')) {
      let hostname: string
      try { hostname = new URL(avatarUrl).hostname } catch { hostname = '' }
      const allowed = ALLOWED_OG_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h))
      if (allowed) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        try {
          // redirect: 'manual' + per-hop allowlist re-check (mirrors
          // /api/proxy-image). Default fetch follows redirects opaquely, which
          // would let an allowlisted CDN 302 to an internal host (SSRF). We
          // re-validate every hop against ALLOWED_OG_HOSTS before following.
          let currentUrl = avatarUrl
          let imgRes: Response | null = null
          for (let hop = 0; hop < 5; hop++) {
            let hopHost = ''
            try { hopHost = new URL(currentUrl).hostname } catch { hopHost = '' }
            if (!currentUrl.startsWith('https://') || !ALLOWED_OG_HOSTS.some(h => hopHost === h || hopHost.endsWith('.' + h))) break
            const r = await fetch(currentUrl, {
              headers: { 'User-Agent': 'halo.rip-og-bot/1.0' },
              signal: controller.signal,
              redirect: 'manual',
            })
            if (r.status >= 300 && r.status < 400) {
              const loc = r.headers.get('location')
              if (!loc) break
              currentUrl = new URL(loc, currentUrl).toString()
              continue
            }
            imgRes = r
            break
          }
          clearTimeout(timeoutId)
          if (imgRes && imgRes.ok) {
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
            if (contentType.startsWith('image/')) {
              // Cap the response body size. arrayBuffer() with no
              // bound would fully buffer whatever the upstream sends -
              // even though hosts are allowlisted, a malformed image
              // or attacker-controlled CDN reply could OOM the Node
              // process. 10 MB is generous for an OG image.
              const MAX_OG_BYTES = 10 * 1024 * 1024
              const declared = Number(imgRes.headers.get('content-length') || '0')
              if (declared > MAX_OG_BYTES) {
                throw new Error('OG image too large')
              }
              const reader = imgRes.body?.getReader()
              if (!reader) throw new Error('No body stream')
              const chunks: Uint8Array[] = []
              let received = 0
              for (;;) {
                const { done, value } = await reader.read()
                if (done) break
                if (!value) continue
                received += value.byteLength
                if (received > MAX_OG_BYTES) {
                  try { await reader.cancel() } catch { /* noop */ }
                  throw new Error('OG image exceeded cap mid-stream')
                }
                chunks.push(value)
              }
              const buffer = new Uint8Array(received)
              let offset = 0
              for (const c of chunks) {
                buffer.set(c, offset)
                offset += c.byteLength
              }
              return new NextResponse(buffer, {
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
                },
              })
            }
          }
        } catch (fetchErr) {
          console.error('[og-image] fetch error:', fetchErr)
        } finally {
          clearTimeout(timeoutId)
        }
      }
    }

    // Fallback response if file does not exist locally or cannot be securely proxied
    return new NextResponse(FALLBACK_SVG, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    return new NextResponse(FALLBACK_SVG, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=60',
      },
    })
  }
}
