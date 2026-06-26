import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAllowedMediaUrl } from '@/lib/url-validation'
import { withRateLimit } from '@/lib/rate-limit'
import { stripPremiumFields } from '@/lib/strip-premium-fields'
import { getFreeEventActive } from '@/lib/get-free-event-active'
import { sanitizeMarkupSource, isValidHexColor } from '@/lib/security'

export async function GET() {
  try {
    const profile = await getApiUser()

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return the relevant appearance fields from the profile
    return NextResponse.json({ 
      appearance: {
        accent_color: profile.accent_color,
        text_color: profile.text_color,
        background_color: profile.background_color,
        icon_color: profile.icon_color,
        background_type: profile.background_type,
        background_url: profile.background_url,
        background_gradient: profile.background_gradient,
        font_family: profile.font_family,
        custom_font_url: profile.custom_font_url,
        custom_font_name: profile.custom_font_name,
        card_style: profile.card_style,
        border_style: profile.border_style,
        panel_opacity: profile.panel_opacity,
        panel_size: profile.panel_size,
        profile_opacity: profile.profile_opacity,
        profile_blur: profile.profile_blur,
        profile_gradient_enabled: profile.profile_gradient_enabled,
        profile_gradient_primary: profile.profile_gradient_primary,
        profile_gradient_secondary: profile.profile_gradient_secondary,
        glow_username: profile.glow_username,
        glow_socials: profile.glow_socials,
        glow_badges: profile.glow_badges,
        glow_intensity: profile.glow_intensity,
        glow_color: profile.glow_color,
        outline_enabled: profile.outline_enabled,
        outline_color: profile.outline_color,
        outline_width: profile.outline_width,
        background_effect: profile.background_effect,
        background_effect_strength: profile.background_effect_strength,
        profile_radius: profile.profile_radius,
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch appearance' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    // ─── Helpers ─────────────────────────────────────────────────
    // Apply the same validation /api/profile uses so an attacker can't
    // bypass sanitisation by hitting /api/appearance instead.
    // - hex colour string OR null (rejects garbage that could break out of
    //   inline `style={{ color: '<value>' }}` rendering contexts)
    // - sanitised text (strip script tags, on* handlers, javascript:/data:
    //   protocols, then HTML-escape) for free-form text fields
    function setColor(key: string, value: unknown) {
      if (value === null || value === '') { updates[key] = null; return }
      if (typeof value === 'string' && isValidHexColor(value)) {
        updates[key] = value.toUpperCase()
      }
      // Invalid colours are silently dropped, matching /api/profile.
    }
    function setText(key: string, value: unknown, maxLen: number) {
      if (value === null || value === '') { updates[key] = null; return }
      if (typeof value !== 'string') return
      updates[key] = sanitizeMarkupSource(value.trim()).slice(0, maxLen)
    }

    // Colors - all validated as hex
    if (body.accent_color !== undefined)      setColor('accent_color', body.accent_color)
    if (body.text_color !== undefined)        setColor('text_color', body.text_color)
    if (body.background_color !== undefined)  setColor('background_color', body.background_color)
    if (body.icon_color !== undefined)        setColor('icon_color', body.icon_color)
    // Advanced per-element text colors (null = inherit text_color)
    if (body.display_name_color !== undefined)    setColor('display_name_color', body.display_name_color)
    if (body.username_handle_color !== undefined) setColor('username_handle_color', body.username_handle_color)
    if (body.bio_color !== undefined)             setColor('bio_color', body.bio_color)
    if (body.location_color !== undefined)        setColor('location_color', body.location_color)
    if (body.card_text_color !== undefined)       setColor('card_text_color', body.card_text_color)
    if (body.music_text_color !== undefined)      setColor('music_text_color', body.music_text_color)
    // Per-element font targeting (legacy boolean toggles)
    if (body.font_apply_displayname !== undefined) updates.font_apply_displayname = body.font_apply_displayname
    if (body.font_apply_username !== undefined) updates.font_apply_username = body.font_apply_username
    if (body.font_apply_bio !== undefined) updates.font_apply_bio = body.font_apply_bio
    if (body.font_apply_music !== undefined) updates.font_apply_music = body.font_apply_music
    // 4 named font slots (each has url + display name). URLs go through
    // isAllowedMediaUrl (rejects external hosts), names are sanitised
    // so an attacker can't inject markup that later renders unescaped.
    for (const i of [1, 2, 3, 4]) {
      const urlKey = `font_${i}_url`
      const nameKey = `font_${i}_name`
      if (body[urlKey] !== undefined) {
        const url = body[urlKey]
        if (url && !isAllowedMediaUrl(String(url))) {
          return NextResponse.json({ error: 'External font URLs are not allowed.' }, { status: 400 })
        }
        updates[urlKey] = url || null
      }
      if (body[nameKey] !== undefined) setText(nameKey, body[nameKey], 40)
    }
    // Per-element font slot assignment (0 = no custom font, 1-4 = slot N)
    for (const target of ['displayname', 'username', 'bio', 'music']) {
      const k = `font_slot_${target}`
      if (body[k] !== undefined) {
        const n = Number(body[k])
        if (!Number.isNaN(n) && n >= 0 && n <= 4) updates[k] = Math.floor(n)
      }
    }
    
    // Background
    if (body.background_type !== undefined) updates.background_type = body.background_type
    if (body.background_url !== undefined) {
      // Validate background_url - only allow uploads from our domain
      if (body.background_url && !isAllowedMediaUrl(body.background_url)) {
        return NextResponse.json({ 
          error: "External background URLs are not allowed. Please upload your background using the upload button." 
        }, { status: 400 })
      }
      updates.background_url = body.background_url
    }
    if (body.background_gradient !== undefined) {
      // Only accept a real CSS gradient with no url()/breakout chars, so this
      // free-form value can't be used to inject a beacon or break out of an
      // inline style context (matches the validation on every other style field).
      const g = body.background_gradient
      updates.background_gradient =
        (typeof g === 'string' && /^(linear|radial|conic)-gradient\([^;{}<>\\"']*\)$/.test(g.trim()) && !/url\(/i.test(g))
          ? g.trim()
          : null
    }
    if (body.background_effect !== undefined) updates.background_effect = body.background_effect

    // Font - restrict to a safe token (alnum, space, dash) so it can't break the
    // inline style / CSS context it's rendered into.
    if (body.font_family !== undefined) {
      const f = body.font_family
      updates.font_family = (typeof f === 'string' && /^[\w\s-]{1,48}$/.test(f)) ? f : null
    }
    if (body.custom_font_url !== undefined) {
      if (body.custom_font_url && !isAllowedMediaUrl(body.custom_font_url)) {
        return NextResponse.json({ 
          error: "External font URLs are not allowed. Please upload your font using the upload button." 
        }, { status: 400 })
      }
      updates.custom_font_url = body.custom_font_url
    }
    if (body.custom_font_name !== undefined) setText('custom_font_name', body.custom_font_name, 40)
    
    // Card & Panel
    if (body.card_style !== undefined) updates.card_style = body.card_style
    if (body.border_style !== undefined) updates.border_style = body.border_style
    if (body.panel_opacity !== undefined) updates.panel_opacity = body.panel_opacity
    if (body.panel_size !== undefined) updates.panel_size = body.panel_size
    if (body.profile_opacity !== undefined) updates.profile_opacity = body.profile_opacity
    if (body.profile_blur !== undefined) updates.profile_blur = body.profile_blur
    if (body.profile_radius !== undefined) updates.profile_radius = Math.min(50, Math.max(0, Number(body.profile_radius)))
    if (body.background_effect_strength !== undefined) updates.background_effect_strength = Math.min(100, Math.max(0, Number(body.background_effect_strength)))
    
    // Profile gradient - hex validation on the colour stops
    if (body.profile_gradient_enabled !== undefined) updates.profile_gradient_enabled = !!body.profile_gradient_enabled
    if (body.profile_gradient_primary !== undefined) setColor('profile_gradient_primary', body.profile_gradient_primary)
    if (body.profile_gradient_secondary !== undefined) setColor('profile_gradient_secondary', body.profile_gradient_secondary)

    // Glow effects - colour fields validated as hex
    if (body.glow_username !== undefined) updates.glow_username = !!body.glow_username
    if (body.glow_socials !== undefined) updates.glow_socials = !!body.glow_socials
    if (body.glow_badges !== undefined) updates.glow_badges = !!body.glow_badges
    if (body.glow_intensity !== undefined) updates.glow_intensity = Math.min(100, Math.max(0, Number(body.glow_intensity) || 0))
    if (body.glow_color !== undefined) setColor('glow_color', body.glow_color)

    // Outline
    if (body.outline_enabled !== undefined) updates.outline_enabled = !!body.outline_enabled
    if (body.outline_color !== undefined) setColor('outline_color', body.outline_color)
    if (body.outline_width !== undefined) updates.outline_width = Math.min(12, Math.max(0, Number(body.outline_width) || 0))

    // Avatar
    if (body.avatar_shape !== undefined) updates.avatar_shape = body.avatar_shape
    if (body.avatar_position !== undefined) updates.avatar_position = body.avatar_position
    if (body.avatar_placement !== undefined) updates.avatar_placement = body.avatar_placement
    if (body.show_avatar !== undefined) updates.show_avatar = body.show_avatar

    // Enter Page - text fields sanitised to strip <script> tags / on*
    // handlers / javascript: protocols before HTML-escape. Without this
    // an attacker could store XSS payloads here and trigger them when
    // the enter splash renders the title/subtitle.
    if (body.enter_enabled !== undefined) updates.enter_enabled = !!body.enter_enabled
    if (body.enter_title !== undefined) setText('enter_title', body.enter_title, 60)
    if (body.enter_subtitle !== undefined) setText('enter_subtitle', body.enter_subtitle, 200)
    if (body.enter_show_profile !== undefined) updates.enter_show_profile = !!body.enter_show_profile
    if (body.enter_show_title !== undefined) updates.enter_show_title = !!body.enter_show_title
    if (body.enter_show_subtitle !== undefined) updates.enter_show_subtitle = !!body.enter_show_subtitle

    // Profile Metadata (premium-only - stripped below if not). These power
    // the Open Graph / Discord embed and the browser tab favicon. text
    // fields sanitised so a malicious user can't inject markup into
    // <meta property="og:title"> tags rendered by generateMetadata.
    if (body.favicon_url !== undefined) {
      if (body.favicon_url && !isAllowedMediaUrl(body.favicon_url)) {
        return NextResponse.json({ error: 'External favicon URLs are not allowed.' }, { status: 400 })
      }
      updates.favicon_url = body.favicon_url || null
    }
    if (body.embed_title !== undefined) setText('embed_title', body.embed_title, 60)
    if (body.embed_description !== undefined) setText('embed_description', body.embed_description, 160)
    if (body.embed_image_url !== undefined) {
      if (body.embed_image_url && !isAllowedMediaUrl(body.embed_image_url)) {
        return NextResponse.json({ error: 'External embed image URLs are not allowed.' }, { status: 400 })
      }
      updates.embed_image_url = body.embed_image_url || null
    }
    if (body.embed_color !== undefined) {
      const v = String(body.embed_color || '').trim()
      // Accept #RGB / #RRGGBB or empty
      updates.embed_color = /^#[0-9a-fA-F]{3,6}$/.test(v) ? v : null
    }

    // Server-side premium gate
    const freeEvent = await getFreeEventActive()
    const isPremium = (profile as any).premium_active === true || freeEvent
    const stripped = stripPremiumFields(updates, isPremium)
    Object.assign(updates, stripped.updates)

    const admin = createAdminClient()
    const { error } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update appearance' }, { status: 500 })
  }
}
