import { NextResponse } from "next/server"
import { getApiUser } from "@/lib/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { withRateLimit } from '@/lib/rate-limit'
import { isAllowedMediaUrl } from '@/lib/url-validation'
import { sanitizeMarkupSource, isValidHexColor } from '@/lib/security'

function validateButtonUrl(url: unknown): string | null {
  if (!url) return null
  if (typeof url !== 'string') return null
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    return url
  } catch {
    return null
  }
}

// Hex-or-null colour validator matching the patterns used in
// /api/profile and /api/appearance so all three routes apply the same
// validation. Without this an attacker could store an arbitrary string
// in bg_color / text_color, which then renders into inline
// `style={{ backgroundColor: <value> }}` on the public profile.
function safeColor(value: unknown, fallback: string | null = null): string | null {
  if (value === null || value === '') return null
  if (typeof value === 'string' && isValidHexColor(value)) return value.toUpperCase()
  return fallback
}

// Strip <script>, on* handlers, and javascript:/data:/vbscript: protocols
// from the button label. Does NOT HTML-escape: the label renders through a
// React text node (escapes on output), so escaping here too would store
// literal entities like "/" -> "&#x2F;" that show as garbage. Caps at 40
// chars so one button can't take over the link list with a wall of text.
function safeLabel(value: unknown): string {
  if (typeof value !== 'string') return ''
  return sanitizeMarkupSource(value.trim()).slice(0, 40)
}

export async function POST(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { label, url, display_order, bg_color, text_color, media_url, media_type, disable_background } = body

    // Validate URL
    if (url && validateButtonUrl(url) === null) {
      return NextResponse.json({ error: "Only http and https URLs are allowed" }, { status: 400 })
    }
    // Validate media_url
    if (media_url && !isAllowedMediaUrl(media_url)) {
      return NextResponse.json({ error: "External media URLs are not allowed" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { count } = await supabase
      .from("custom_buttons")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", profile.id)

    if ((count || 0) >= 3) {
      return NextResponse.json({ error: 'You can only keep up to 3 custom buttons' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("custom_buttons")
      .insert({
        user_id: profile.id,
        label: safeLabel(label),
        url,
        display_order: display_order || 0,
        bg_color: safeColor(bg_color, "#06B6D4") || "#06B6D4",
        text_color: safeColor(text_color, "#FFFFFF") || "#FFFFFF",
        media_url: media_url || null,
        media_type: typeof media_type === 'string' && /^[a-z]+\/[a-z0-9.+-]+$/i.test(media_type) ? media_type : null,
        disable_background: !!disable_background,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Close the count-then-insert race: if a concurrent request pushed us over
    // the cap, undo this insert so the final state never exceeds 3.
    const { count: after } = await supabase
      .from("custom_buttons")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", profile.id)
    if ((after || 0) > 3 && data) {
      await supabase.from("custom_buttons").delete().eq("id", (data as { id: string }).id)
      return NextResponse.json({ error: 'You can only keep up to 3 custom buttons' }, { status: 400 })
    }

    return NextResponse.json({ button: data })
  } catch (error) {
    return NextResponse.json({ error: "Failed to create button" }, { status: 500 })
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

    // Whitelist only safe fields - prevent mass assignment
    const updates: Record<string, unknown> = {}
    if (body.label !== undefined) updates.label = safeLabel(body.label)
    if (body.url !== undefined) {
      if (body.url && validateButtonUrl(body.url) === null) {
        return NextResponse.json({ error: "Only http and https URLs are allowed" }, { status: 400 })
      }
      updates.url = body.url
    }
    if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0
    // bg_color + text_color: hex-validated. Anything not matching #abc /
    // #aabbcc / etc. is silently dropped (matching /api/profile + the
    // new /api/appearance behaviour). Without this an attacker could
    // store arbitrary strings that flow into inline style attributes.
    if (body.bg_color !== undefined) {
      const v = safeColor(body.bg_color)
      if (v !== null) updates.bg_color = v
    }
    if (body.text_color !== undefined) {
      const v = safeColor(body.text_color)
      if (v !== null) updates.text_color = v
    }
    if (body.disable_background !== undefined) updates.disable_background = Boolean(body.disable_background)
    if (body.media_url !== undefined) {
      if (body.media_url && !isAllowedMediaUrl(body.media_url)) {
        return NextResponse.json({ error: "External media URLs are not allowed" }, { status: 400 })
      }
      updates.media_url = body.media_url || null
    }
    // media_type: validate as a standard MIME shape (`type/subtype`).
    // Was passing arbitrary strings through.
    if (body.media_type !== undefined) {
      const mt = body.media_type
      updates.media_type = typeof mt === 'string' && /^[a-z]+\/[a-z0-9.+-]+$/i.test(mt) ? mt : null
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("custom_buttons")
      .update(updates)
      .eq("id", id)
      .eq("user_id", profile.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ button: data })
  } catch (error) {
    return NextResponse.json({ error: "Failed to update button" }, { status: 500 })
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

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("custom_buttons")
      .delete()
      .eq("id", id)
      .eq("user_id", profile.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete button" }, { status: 500 })
  }
}
