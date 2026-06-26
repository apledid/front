import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeMarkupSource, isValidHexColor } from '@/lib/security'
import { jsonResponse, errorResponse } from '@/lib/api-validation'
import { withRateLimit } from '@/lib/rate-limit'
import { sanitizeProfileForOwner } from '@/lib/sanitize-profile'
import { stripPremiumFields } from '@/lib/strip-premium-fields'
import { getFreeEventActive } from '@/lib/get-free-event-active'
import { PROFILE_ALLOWED_COLUMNS } from '@/lib/profile-columns'
import { isAllowedMediaUrl } from '@/lib/url-validation'

export async function GET() {
  try {
    const profile = await getApiUser()

    if (!profile) {
      return errorResponse('Unauthorized', 401)
    }

    return jsonResponse({ profile: sanitizeProfileForOwner(profile) })
  } catch (error) {
    console.error('Profile GET error:', error)
    return errorResponse('Failed to fetch profile', 500)
  }
}

// Single source of truth lives in lib/profile-columns.ts so /api/templates/apply
// can apply the same allowlist (otherwise a malicious public template could
// stuff dangerous columns like is_admin / premium_active / banned into its
// config and escalate anyone who applies it).
const ALLOWED_COLUMNS = PROFILE_ALLOWED_COLUMNS

export async function PUT(request: Request) {
  try {
    // Rate limit: 30 profile updates per minute per IP
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const updates: Record<string, any> = {}
    
    // Fields that should be sanitized as text (prevent XSS)
    const textFields = ['display_name', 'bio', 'location', 'enter_title', 'enter_subtitle', 'music_title', 'music_artist', 'custom_font_name', 'font_1_name', 'font_2_name', 'font_3_name', 'font_4_name']
    
    // Fields that should be validated as hex colors
    const colorFields = ['accent_color', 'background_color', 'text_color', 'particle_color', 'background_effect_color', 'hover_effect_color', 'card_color', 'card_border_color', 'inner_card_background', 'inner_card_border_color', 'card_gradient_from', 'card_gradient_to', 'profile_border_color', 'display_name_color', 'username_handle_color', 'bio_color', 'location_color', 'card_text_color', 'music_text_color', 'icon_color', 'cursor_color', 'glow_color', 'outline_color', 'profile_gradient_primary', 'profile_gradient_secondary', 'badge_color', 'badge_accent_color', 'badge_border_color']

    // Fields that must be valid URLs
    const urlFields = ['avatar_url', 'banner_url', 'background_url', 'custom_font_url', 'custom_cursor_url', 'music_url', 'font_1_url', 'font_2_url', 'font_3_url', 'font_4_url', 'custom_cursor_hover_url']

    // Fields that must be numbers
    const numberFields = ['typing_speed', 'particle_count', 'card_radius', 'card_border_width', 'card_blur', 'panel_height', 'profile_opacity', 'profile_blur', 'profile_radius', 'layout_max_width', 'font_slot_displayname', 'font_slot_username', 'font_slot_bio', 'font_slot_music', 'outline_width', 'glow_intensity', 'panel_opacity', 'background_effect_strength', 'badge_glow_strength', 'badge_border_radius', 'badge_opacity', 'badge_border_width', 'badge_border_opacity']
    
    for (const key of ALLOWED_COLUMNS) {
      if (body[key] !== undefined) {
        const value = body[key]
        
        if (key === 'rez_unequipped_crypto') {
          // Owner-only crypto badge hide list. Whitelist to known slugs so a
          // malicious caller can't stuff arbitrary text into this column.
          const ALLOWED_CRYPTO = ['btc', 'eth', 'usdt', 'ltc']
          updates[key] = Array.isArray(value)
            ? value.filter((s: any) => typeof s === 'string' && ALLOWED_CRYPTO.includes(s))
            : []
        } else if (key === 'bio_texts') {
          // bio_texts feeds the typewriter component (React text-node
          // render) AND the static-bio markdown path (renderBioMarkdown,
          // which escapes on output). Either way the render layer
          // handles HTML escape, so do NOT escape on save - escaping
          // here on top of escaping on render produced progressive
          // `&amp;amp;amp;...` build-up every save.
          const arr = value
          updates[key] = Array.isArray(arr)
            ? arr.filter((t: any) => typeof t === 'string' && t.trim()).map((t: string) => sanitizeMarkupSource(t.trim()))
            : []
        } else if (key === 'bio') {
          // Same reasoning as bio_texts - let the render path escape.
          updates[key] = typeof value === 'string' ? sanitizeMarkupSource(value.trim()) : null
        } else if (textFields.includes(key)) {
          // Sanitize text fields to prevent XSS
          updates[key] = typeof value === 'string' ? sanitizeMarkupSource(value.trim()) : null
        } else if (colorFields.includes(key)) {
          // Validate hex colors - only accept valid hex or null
          if (value === null || value === '') {
            updates[key] = null
          } else if (typeof value === 'string' && isValidHexColor(value)) {
            updates[key] = value.toUpperCase()
          }
          // Invalid colors are silently ignored
        } else if (urlFields.includes(key)) {
          // Delegate URL validation to the shared isAllowedMediaUrl()
          // helper. The previous inline version had two real bugs:
          //   1. Relative-URL branch accepted ANY string starting with
          //      '/', so values like "/'); background: red; --" got
          //      written to the DB and broke out of the CSS url()
          //      context on the rendered profile.
          //   2. Hostname check used .includes() instead of a suffix
          //      match, so an attacker-controlled domain like
          //      'evil.halo.rip.attacker.com' passed validation.
          //
          // The shared helper handles relative paths via a strict
          // regex (no quotes, parens, semicolons, whitespace) and
          // does a hostname=='halo.rip' || hostname.endsWith('.halo.rip')
          // suffix check.
          if (value === null || value === '') {
            updates[key] = null
          } else if (typeof value === 'string' && isAllowedMediaUrl(value)) {
            updates[key] = value
          }
          // Anything else: silently dropped (preserves old behaviour of
          // not surfacing validation errors for URL fields).
        } else if (numberFields.includes(key)) {
          // Validate numbers - must be numeric
          const num = Number(value)
          if (!isNaN(num)) {
            updates[key] = num
          }
        } else if (typeof value === 'boolean') {
          // Booleans pass through
          updates[key] = value
        } else if (typeof value === 'string') {
          // Other string fields - basic sanitization
          updates[key] = sanitizeMarkupSource(value)
        } else {
          // Other types pass through (already validated by schema)
          updates[key] = value
        }
      }
    }
    // Server-side premium gate: if the user isn't on a paid plan (or there's
    // no active free event), strip any premium-only fields from the update.
    // This is the security floor - the client UI also locks these features
    // but a determined caller can craft a JSON PATCH directly.
    const freeEvent = await getFreeEventActive()
    const isPremium = (profile as any).premium_active === true || freeEvent
    const stripped = stripPremiumFields(updates, isPremium)
    Object.assign(updates, stripped.updates)
    updates.updated_at = new Date().toISOString()

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ profile: sanitizeProfileForOwner(data) })
  } catch (error) {
    return errorResponse('Failed to update profile', 500)
  }
}

// PATCH is an alias for PUT
export async function PATCH(request: Request) {
  return PUT(request)
}
