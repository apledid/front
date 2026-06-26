import { NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { withRateLimit } from '@/lib/rate-limit'
import { isAllowedMediaUrl } from '@/lib/url-validation'
import { SOCIAL_PLATFORMS } from '@/lib/types'

// Crypto + other platforms that store an opaque value (wallet address, etc.)
// rather than a real URL. The `url` column is reused as the value field.
const COPY_ONLY_PLATFORMS = new Set(
  SOCIAL_PLATFORMS.filter((p) => (p as any).copyOnly).map((p) => p.id),
)

function isCopyOnly(platform: unknown): boolean {
  return typeof platform === 'string' && COPY_ONLY_PLATFORMS.has(platform)
}

export async function POST(request: Request) {
  try {
    // Rate limit: 30 link operations per minute per IP
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { platform, url, display_order, label, icon_url } = await request.json()

    // Copy-only platforms (BTC/ETH/LTC/SOL/XMR wallet addresses) store an
    // opaque value, not a URL - skip the URL check for them.
    if (url && !isCopyOnly(platform)) {
      try {
        const parsed = new URL(url)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return NextResponse.json({ error: "Only http and https URLs are allowed" }, { status: 400 })
        }
      } catch {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
      }
    }

    // Validate icon_url - only allow uploads from our domain
    if (icon_url && !isAllowedMediaUrl(icon_url)) {
      return NextResponse.json({
        error: "External icon URLs are not allowed. Please upload your icon using the upload button."
      }, { status: 400 })
    }

    const admin = createAdminClient()

    // Custom-link cap. Pre-defined platforms (Twitter, GitHub, etc.)
    // are naturally capped at 1 each by the UI - users can't add two
    // Twitter links because the tile disables itself once one exists.
    // But the "Custom Link" tile lets users add arbitrarily many,
    // which would let someone stuff hundreds of links onto their
    // profile and tank render time + storage. Cap at 10 per user.
    if (platform === 'custom') {
      const { count } = await admin
        .from("social_links")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", profile.id)
        .eq("platform", "custom")
      if ((count || 0) >= 10) {
        return NextResponse.json({
          error: "You can only have up to 10 custom links",
        }, { status: 400 })
      }
    }

    const insertPayload: Record<string, unknown> = {
      user_id: profile.id,
      platform,
      url,
      display_order: display_order || 0,
    }

    if (label !== undefined) insertPayload.label = label || null
    if (icon_url !== undefined) insertPayload.icon_url = icon_url || null

    const { data, error } = await admin
      .from("social_links")
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Close the count-then-insert race for custom links: if a concurrent
    // request pushed us over the cap, undo this insert.
    if (platform === 'custom' && data) {
      const { count: after } = await admin
        .from("social_links")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", profile.id)
        .eq("platform", "custom")
      if ((after || 0) > 10) {
        await admin.from("social_links").delete().eq("id", (data as { id: string }).id)
        return NextResponse.json({ error: "You can only have up to 10 custom links" }, { status: 400 })
      }
    }

    return NextResponse.json({ link: data })
  } catch (error) {
    return NextResponse.json({ error: "Failed to create link" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id } = body

    // For PUT we may need to consult the existing row's platform, since the
    // body might not include it. Look it up first when needed.
    let effectivePlatform = body.platform as string | undefined
    if (effectivePlatform === undefined && body.url !== undefined && id) {
      const adminLookup = createAdminClient()
      const { data: existing } = await adminLookup
        .from('social_links')
        .select('platform')
        .eq('id', id)
        .eq('user_id', profile.id)
        .single()
      if (existing) effectivePlatform = (existing as any).platform
    }

    // Whitelist only safe fields - prevent mass assignment
    const updates: Record<string, unknown> = {}
    if (body.platform !== undefined) updates.platform = body.platform
    if (body.url !== undefined) {
      // Copy-only platforms (crypto wallet addresses) skip the URL check.
      if (body.url && !isCopyOnly(effectivePlatform)) {
        try {
          const parsed = new URL(body.url)
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return NextResponse.json({ error: "Only http and https URLs are allowed" }, { status: 400 })
          }
        } catch {
          return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
        }
      }
      updates.url = body.url
    }
    if (body.label !== undefined) updates.label = body.label || null
    if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0
    if (body.icon_url !== undefined) {
      if (body.icon_url && !isAllowedMediaUrl(body.icon_url)) {
        return NextResponse.json({
          error: "External icon URLs are not allowed. Please upload your icon using the upload button."
        }, { status: 400 })
      }
      updates.icon_url = body.icon_url || null
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("social_links")
      .update(updates)
      .eq("id", id)
      .eq("user_id", profile.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ link: data })
  } catch (error) {
    return NextResponse.json({ error: "Failed to update link" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await request.json()

    const admin = createAdminClient()
    const { error } = await admin
      .from("social_links")
      .delete()
      .eq("id", id)
      .eq("user_id", profile.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete link" }, { status: 500 })
  }
}
