import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse, NextRequest } from "next/server"
import { withRateLimit } from '@/lib/rate-limit'

// Records a link/button/social click for analytics.
//
// Threat model: any visitor (including the profile owner themselves)
// can call this endpoint. We can't prevent click-count inflation by
// hiding the user_id - it's literally visible on the profile page
// the visitor is currently looking at. The actual abuse mitigation
// is the `trackClick` rate limit (30/min per IP) + a future per-IP
// per-link dedup if we ever care enough about analytics accuracy.
//
// What we DO enforce:
//   - user_id must be a UUID (no SQL/injection escapes through it)
//   - link_id must be a UUID if provided
//   - link_type is whitelisted to a known set (no arbitrary tag stuffing)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_LINK_TYPES = new Set(['social', 'button', 'custom', 'crypto', 'music'])

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 60 clicks per minute per IP (see lib/rate-limit.ts trackClick).
    const rateLimit = await withRateLimit(request, 'trackClick')
    if (rateLimit.response) return rateLimit.response

    // Accept user_id from EITHER query (legacy) or body (current renderers).
    // Every existing call site sends it in the body, which meant every
    // tracked click silently returned 400 before this fix - analytics
    // were dark on the dashboard for any profile using the standard
    // renderer. Reading from body restores click tracking; the rate
    // limit + UUID format check below keep the endpoint safe.
    const url = new URL(request.url)
    const body = await request.json().catch(() => ({}))
    const userId = url.searchParams.get('userId') || body.user_id || body.userId
    const linkType = body.link_type || body.linkType
    const linkId = body.link_id || body.linkId || null

    if (!userId || !linkType) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }
    if (!UUID_RE.test(String(userId))) {
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 })
    }
    const typeStr = String(linkType).slice(0, 40)
    if (!VALID_LINK_TYPES.has(typeStr)) {
      return NextResponse.json({ error: 'Invalid link type' }, { status: 400 })
    }

    const admin = createAdminClient()
    const insert: Record<string, any> = {
      user_id: userId,
      link_type: typeStr,
    }
    // link_id column is uuid typed - only pass if it looks like one
    if (linkId && UUID_RE.test(String(linkId))) {
      insert.link_id = linkId
    }
    await admin.from('link_clicks').insert(insert)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Track click error:', error)
    // Return 200 so the client's fire-and-forget `.catch()` doesn't
    // surface anything to the user - tracking failures shouldn't
    // disrupt the actual click navigation.
    return NextResponse.json({ success: true })
  }
}
