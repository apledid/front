// Supabase-backed rate limiter
// Uses an atomic PostgreSQL upsert so limits are shared across all serverless
// instances - unlike the old in-memory Maps which reset per cold start.

import { createAdminClient } from '@/lib/supabase/admin'

interface RateLimitConfig {
  windowMs: number   // time window in milliseconds
  maxRequests: number
}

export const RATE_LIMITS = {
  // Auth - strict to prevent brute force
  login:         { windowMs: 15 * 60 * 1000, maxRequests: 10  },
  signup:        { windowMs: 60 * 60 * 1000, maxRequests: 3   },
  passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 5   },

  // Email - tight to prevent spam
  sendEmail:     { windowMs: 60 * 1000,       maxRequests: 3   },
  verifyEmail:   { windowMs: 15 * 60 * 1000, maxRequests: 10  },
  addEmail:      { windowMs: 60 * 60 * 1000, maxRequests: 5   },

  // Sensitive account change flows (email + password) - the /start
  // step sends an outbound email so it lives in the tighter
  // sendEmail-class budget; the /verify step is just code submission
  // and can be slightly looser to give legit users retries within
  // the 5-attempts-per-code lockout.
  changeStart:   { windowMs: 60 * 60 * 1000, maxRequests: 5   },
  changeVerify:  { windowMs: 15 * 60 * 1000, maxRequests: 20  },

  // Content
  upload:        { windowMs: 60 * 1000,       maxRequests: 20  },
  report:        { windowMs: 60 * 60 * 1000, maxRequests: 10  },

  // Profile / data
  profileUpdate: { windowMs: 60 * 1000,       maxRequests: 20  },
  checkUsername: { windowMs: 60 * 1000,       maxRequests: 10  },

  // Messaging
  inbox:         { windowMs: 60 * 1000,       maxRequests: 30  },

  // View / click tracking
  trackView:     { windowMs: 60 * 1000,       maxRequests: 60  },
  trackClick:    { windowMs: 60 * 1000,       maxRequests: 60  },

  // General - bumped from 60 to 300 because ~20 different endpoints
  // share this bucket (widgets/fetch, auth/me, discord-presence,
  // proxy-image, social-links/list, custom-buttons/list, inbox,
  // landing/featured, analytics, etc.). A single profile page load
  // fires 5-10 requests against this bucket plus a 6/min widget
  // poll, so navigating between a handful of profiles in 30 seconds
  // used to hit the old 60/min ceiling and start returning 429 for
  // everything - manifested as "Network error" tiles on every
  // widget and intermittent logged-out flicker on the home nav.
  // 300/min = 5/sec keeps abuse-pace traffic (scrapers, bots)
  // blocked while leaving plenty of headroom for normal browsing.
  general:       { windowMs: 60 * 1000,       maxRequests: 300 },

  // Static file serving - /api/file streams uploaded avatars,
  // backgrounds, music covers, button icons, custom cursors, etc.
  // A single rich profile page can easily request 15+ files (one
  // avatar, one background, four-ish widget covers, several social
  // icons, music covers). Treating it like a normal API endpoint
  // would exhaust any reasonable per-IP budget on the first refresh.
  // 600/min = 10/sec is plenty for a heavy gallery profile while
  // still blocking range-fetch download abuse.
  fileServe:     { windowMs: 60 * 1000,       maxRequests: 600 },

  // Widget fetcher fan-out: each /api/widgets/fetch call dispatches
  // to N upstream APIs (Last.fm, GitHub, TikWM, Tracker.gg, Discord,
  // Roblox, Spotify, Weather, etc.). If we let this share the
  // general 300/min bucket, a single attacker IP could drive
  // 300 * 8 = 2,400 upstream requests/minute through us and burn
  // through every third-party key's free-tier quota long before our
  // own bucket noticed. 30/min is plenty for a single browser tab
  // polling every 10s; anything past that smells like scraping.
  widgetsFetch:  { windowMs: 60 * 1000,       maxRequests: 30  },
} as const

export type RateLimitType = keyof typeof RATE_LIMITS

export interface RateLimitResult {
  success:   boolean
  remaining: number
  resetAt:   number   // unix ms
  limit:     number
}

/** Read a single header from either a Request or a Headers-like object
 *  (matches both `Headers` and `ReadonlyHeaders` from `next/headers`). */
type HeaderSource = Request | { get(name: string): string | null }

function readHeader(src: HeaderSource, name: string): string | null {
  if (src instanceof Request) return src.headers.get(name)
  return src.get(name)
}

/** Extract the best IP from request headers.
 *
 * Order of trust:
 *   1. `CF-Connecting-IP` - Cloudflare strips any client-supplied copy of
 *      this header before it reaches the origin, so the value is reliable.
 *   2. `X-Real-IP` - usually set by the closest reverse proxy.
 *   3. `X-Forwarded-For` - we take the LAST entry, not the first. Cloudflare
 *      APPENDS the true client IP rather than replacing the header, so an
 *      attacker can stuff whatever they want into `X-Forwarded-For[0]`.
 *      The rightmost entry is what the immediate upstream proxy actually
 *      observed, which is closer to truth.
 *
 * Previously this trusted `X-Forwarded-For[0]`, which let attackers rotate
 * the header to bypass every rate limit on the site (login, signup, verify,
 * redeem, report).
 *
 * Accepts either a `Request` or a `Headers`/`ReadonlyHeaders` (so the same
 * helper works in app router server components that use `headers()`).
 */
export function getClientIp(src: HeaderSource): string {
  const cf = readHeader(src, 'cf-connecting-ip')
  if (cf) return cf.trim()
  const real = readHeader(src, 'x-real-ip')
  if (real) return real.trim()
  const fwd = readHeader(src, 'x-forwarded-for')
  if (fwd) {
    const parts = fwd.split(',').map((s) => s.trim()).filter(Boolean)
    return parts[parts.length - 1] || 'unknown'
  }
  return 'unknown'
}

/**
 * Atomically check + increment the rate limit for an identifier.
 * Falls back to "allow" if the DB call fails, so a transient Supabase
 * hiccup never blocks legitimate users.
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[type]
  const key    = `${identifier}:${type}`

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('rate_limit_check', {
      p_key:          key,
      p_window_ms:    config.windowMs,
      p_max_requests: config.maxRequests,
    })

    if (error || !data || data.length === 0) {
      // DB error - fail open so users aren't accidentally locked out
      console.error('rate_limit_check RPC error:', error)
      return { success: true, remaining: config.maxRequests, resetAt: Date.now() + config.windowMs, limit: config.maxRequests }
    }

    const row       = data[0]
    const resetAt   = new Date(row.reset_at).getTime()
    const remaining = Math.max(0, config.maxRequests - row.count_val)

    return {
      success:   row.allowed,
      remaining,
      resetAt,
      limit:     config.maxRequests,
    }
  } catch (err) {
    console.error('rate_limit_check unexpected error:', err)
    return { success: true, remaining: config.maxRequests, resetAt: Date.now() + config.windowMs, limit: config.maxRequests }
  }
}

/** Build a 429 response */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.', retryAfter }),
    {
      status: 429,
      headers: {
        'Content-Type':        'application/json',
        'Retry-After':         String(retryAfter),
        'X-RateLimit-Limit':   String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset':   String(result.resetAt),
      },
    },
  )
}

/**
 * Async middleware helper.
 * Usage: const rl = await withRateLimit(request, 'login')
 *        if (rl.response) return rl.response
 */
export async function withRateLimit(
  request: Request,
  type: RateLimitType,
): Promise<RateLimitResult & { response?: Response }> {
  const ip     = getClientIp(request)
  const result = await checkRateLimit(ip, type)
  if (!result.success) return { ...result, response: rateLimitResponse(result) }
  return result
}
