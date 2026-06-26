import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAllowedMediaUrl } from '@/lib/url-validation'
import { withRateLimit } from '@/lib/rate-limit'
import { stripPremiumFields } from '@/lib/strip-premium-fields'
import { getFreeEventActive } from '@/lib/get-free-event-active'
import { isValidHexColor, sanitizeString } from '@/lib/security'

// Per-bucket whitelists for the PUT handler below. Anything not in one
// of these lists either passes through (already validated above, e.g.
// the cursor URLs) or gets coerced by the generic boolean / number /
// string handlers. The point is to stop /api/effects from being a
// sibling write path that bypasses every validator /api/appearance
// applies to the same columns.
const EFFECTS_COLOR_FIELDS = [
  'particle_color', 'cursor_color', 'cursor_click_color',
  'hover_effect_color', 'badge_color', 'badge_accent_color',
  'badge_border_color',
] as const

const EFFECTS_ENUM_FIELDS: Record<string, ReadonlyArray<string>> = {
  // Cursor / effect / animation enums. Anything outside the allowed
  // set gets dropped. Keep these in sync with the option lists in
  // app/dashboard/customize/client.tsx - this is a defence-in-depth
  // floor, not the source of truth.
  cursor_effect:      ['none', 'glow', 'trail', 'sparkle', 'magnet', 'ripple', 'spotlight'],
  username_effect:    ['none', 'rainbow', 'wave', 'glitch', 'typewriter', 'shuffle', 'white-sparkles', 'red-sparkles', 'yellow-sparkles', 'pink-sparkles', 'green-sparkles', 'blue-sparkles'],
  hover_effect:       ['none', 'tilt', 'lift', 'glow', 'rainbow', 'shake', 'pulse', 'scale'],
  entrance_animation: ['none', 'fade', 'slide-up', 'slide-down', 'zoom', 'flip'],
  views_location_position: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
}

const EFFECTS_NUMBER_FIELDS = [
  'particle_count', 'badge_glow_strength', 'badge_border_radius',
  'badge_opacity', 'badge_border_width', 'badge_border_opacity',
] as const

function setColor(updates: Record<string, unknown>, key: string, value: unknown) {
  // Mirror /api/profile's policy: null/empty clears the override,
  // valid hex gets uppercased, anything else is silently dropped so
  // a bad client never poisons the saved value.
  if (value === null || value === '') {
    updates[key] = null
    return
  }
  if (typeof value === 'string' && isValidHexColor(value)) {
    updates[key] = value.toUpperCase()
  }
  // else: silently ignore - same behaviour as /api/profile/route.ts
}

function setEnum(updates: Record<string, unknown>, key: string, value: unknown, allowed: ReadonlyArray<string>) {
  if (value === null || value === '') {
    updates[key] = null
    return
  }
  if (typeof value === 'string' && allowed.includes(value)) {
    updates[key] = value
  }
}

function setNumber(updates: Record<string, unknown>, key: string, value: unknown) {
  const n = Number(value)
  if (Number.isFinite(n)) updates[key] = n
}

function setBool(updates: Record<string, unknown>, key: string, value: unknown) {
  // Coerce to a real boolean rather than relying on truthiness so
  // arrays / objects / "false" strings don't sneak through.
  updates[key] = value === true || value === 'true'
}

export async function GET() {
  try {
    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Return the effects fields from the profile
    return NextResponse.json({ 
      effects: {
        particle_enabled: profile.particle_enabled,
        particle_color: profile.particle_color,
        particle_count: profile.particle_count,
        cursor_glow_enabled: profile.cursor_glow_enabled,
        cursor_trail_enabled: profile.cursor_trail_enabled,
        cursor_effect: profile.cursor_effect,
        cursor_color: profile.cursor_color,
        cursor_click_effect: profile.cursor_click_effect,
        cursor_click_color: profile.cursor_click_color,
        custom_cursor_url: profile.custom_cursor_url,
        custom_cursor_hover_url: profile.custom_cursor_hover_url,
        effect_enabled: profile.effect_enabled,
        effect_type: profile.effect_type,
        username_effect: profile.username_effect,
        hover_effect: profile.hover_effect,
        hover_effect_color: profile.hover_effect_color,
        entrance_animation: profile.entrance_animation,
        tilt_effect: profile.tilt_effect,
        show_view_count: profile.show_view_count,
        show_badges: profile.show_badges,
        monochrome_icons: profile.monochrome_icons,
        animated_title: profile.animated_title,
        swap_box_colors: profile.swap_box_colors,
        show_likes: profile.show_likes,
        volume_control: profile.volume_control,
        discord_avatar: profile.discord_avatar,
        discord_avatar_decoration: profile.discord_avatar_decoration,
        views_location_position: (profile as any).views_location_position,
        animate_view_count: (profile as any).animate_view_count,
        views_badge_background: (profile as any).views_badge_background,
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch effects' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    // /api/effects writes overlapping columns with /api/appearance
    // and /api/profile. Previously every field here was a raw
    // pass-through, which bypassed isValidHexColor / numeric
    // coercion / enum allowlists that the sibling routes apply
    // (defence-in-depth assumed: same column, same validation).
    // The hover_effect_color value in particular flows into a CSS
    // custom property on guns-profile.tsx so an attacker could
    // inject extra CSS declarations / selectors via this endpoint
    // while /api/appearance would have rejected them.
    //
    // Each setter is conservative: invalid values are silently
    // dropped rather than returning 400, matching the policy in
    // /api/profile so old clients with stale form state still
    // round-trip.

    // Colours
    for (const key of EFFECTS_COLOR_FIELDS) {
      if (body[key] !== undefined) setColor(updates, key, body[key])
    }

    // Numerics
    for (const key of EFFECTS_NUMBER_FIELDS) {
      if (body[key] !== undefined) setNumber(updates, key, body[key])
    }

    // Enums
    for (const [key, allowed] of Object.entries(EFFECTS_ENUM_FIELDS)) {
      if (body[key] !== undefined) setEnum(updates, key, body[key], allowed)
    }

    // Booleans
    const boolFields = [
      'particle_enabled', 'cursor_glow_enabled', 'cursor_trail_enabled',
      'effect_enabled', 'tilt_effect', 'show_view_count', 'show_badges',
      'badges_next_to_name', 'monochrome_badges', 'badge_border_enabled',
      'monochrome_icons', 'animated_title', 'swap_box_colors', 'show_likes',
      'volume_control', 'discord_avatar', 'discord_avatar_decoration',
      'animate_view_count', 'views_badge_background',
    ]
    for (const key of boolFields) {
      if (body[key] !== undefined) setBool(updates, key, body[key])
    }

    // Cursor-effect string passthrough (kept off the enum list
    // because the cursor effect catalog is large and dynamic - the
    // click handler is itself styled, but raw text in here can't
    // reach a CSS sink because it flows through className / SVG
    // refs not inline styles).
    if (body.cursor_click_effect !== undefined && typeof body.cursor_click_effect === 'string') {
      updates.cursor_click_effect = sanitizeString(body.cursor_click_effect).slice(0, 32)
    }
    if (body.effect_type !== undefined && typeof body.effect_type === 'string') {
      updates.effect_type = sanitizeString(body.effect_type).slice(0, 32)
    }

    // Cursor URLs - already validated against the upload allowlist.
    if (body.custom_cursor_url !== undefined) {
      if (body.custom_cursor_url && !isAllowedMediaUrl(body.custom_cursor_url)) {
        return NextResponse.json({
          error: "External cursor URLs are not allowed. Please upload your cursor using the upload button."
        }, { status: 400 })
      }
      updates.custom_cursor_url = body.custom_cursor_url
    }
    if (body.custom_cursor_hover_url !== undefined) {
      if (body.custom_cursor_hover_url && !isAllowedMediaUrl(body.custom_cursor_hover_url)) {
        return NextResponse.json({
          error: "External cursor URLs are not allowed. Please upload your cursor using the upload button."
        }, { status: 400 })
      }
      updates.custom_cursor_hover_url = body.custom_cursor_hover_url
    }

    // Server-side premium gate
    const freeEvent = await getFreeEventActive()
    const isPremium = (profile as any).premium_active === true || freeEvent
    const stripped = stripPremiumFields(updates, isPremium)
    Object.assign(updates, stripped.updates)

    const admin = createAdminClient()
    const { error } = await admin.from('profiles').update(updates).eq('id', profile.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update effects' }, { status: 500 })
  }
}
