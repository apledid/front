import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectPremiumFeatures } from '@/lib/premium-features'
import { withRateLimit } from '@/lib/rate-limit'
import { PROFILE_ALLOWED_COLUMNS } from '@/lib/profile-columns'
import { stripPremiumFields } from '@/lib/strip-premium-fields'
import { getFreeEventActive } from '@/lib/get-free-event-active'
import { isAllowedMediaUrl } from '@/lib/url-validation'
import { isValidHexColor } from '@/lib/security'

// Mirror the allowlist used by /api/profile PUT. Anything not here gets
// silently dropped from the template's config before writing to profiles.
// Without this, a malicious public template can stuff dangerous columns
// (is_admin, premium_active, banned, uid, flagged_for_review) into its
// config and escalate any user who applies it.
const ALLOWED_PROFILE_KEYS = new Set<string>(PROFILE_ALLOWED_COLUMNS)

// Apply a template: overwrite profile styling + replace related rows
// (social_links, custom_buttons, music_history, widgets) from the snapshot.
// Premium features are gated: if the template uses any premium feature and
// the applying user is not premium, the apply is blocked.
export async function POST(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Template id required' }, { status: 400 })

    const admin = createAdminClient()
    const { data: tpl, error } = await admin.from('templates').select('*').eq('id', id).single()
    if (error || !tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    if (tpl.visibility !== 'public' && tpl.user_id !== profile.id) {
      return NextResponse.json({ error: 'Template is private' }, { status: 403 })
    }

    const config = (tpl.config || {}) as Record<string, any>

    // Premium gate - prefer stored premium_features but re-detect as a
    // backstop for templates saved before detection existed.
    const premiumFeatures: string[] =
      (tpl.premium_features && tpl.premium_features.length > 0)
        ? tpl.premium_features
        : detectPremiumFeatures(config)

    // Premium gate. Admins (is_admin or @rez) bypass it so staff can
    // QA premium templates without buying premium themselves. Match
    // the client-side check in template-card.tsx + preview/client.tsx.
    const isAdmin = !!(profile as any).is_admin || profile.username === 'rez'
    if (premiumFeatures.length > 0 && !profile.premium_active && !isAdmin) {
      return NextResponse.json(
        {
          error: `This template uses ${premiumFeatures.length} premium feature${premiumFeatures.length === 1 ? '' : 's'}. Buy premium to use it.`,
          premium_required: true,
          features: premiumFeatures,
        },
        { status: 402 },
      )
    }

    // Split scalar profile columns from snapshot keys (prefixed __)
    const profileUpdate: Record<string, any> = {}
    const snapSocialLinks: any[] = Array.isArray(config.__social_links) ? config.__social_links : []
    const snapButtons: any[] = Array.isArray(config.__custom_buttons) ? config.__custom_buttons : []
    const snapMusic: any[] = Array.isArray(config.__music_tracks) ? config.__music_tracks : []
    const snapWidgets: any[] = Array.isArray(config.__widgets) ? config.__widgets : []

    for (const [k, v] of Object.entries(config)) {
      if (k.startsWith('__')) continue
      // Hard allowlist - drops anything the template author injected that
      // isn't a known styling column (is_admin, premium_active, banned, etc.).
      if (!ALLOWED_PROFILE_KEYS.has(k)) continue
      // URL columns from a (possibly public) template must pass the same media
      // allowlist /api/profile enforces. Otherwise a template could inject an
      // off-allowlist or CSS-breaking string into background_url /
      // custom_cursor_url / custom_font_url / etc. Render-side cssUrl() escapes
      // it today; this is the hard floor so no future renderer can leak it.
      if (k.endsWith('_url') && typeof v === 'string' && v && !isAllowedMediaUrl(v)) continue
      profileUpdate[k] = v
    }

    // Strip premium-only columns before the write. Without this, a
    // template carrying a premium field that detectPremiumFeatures()
    // didn't catch (display_name, favicon_url, embed_*, etc.) would
    // get applied to a non-premium account, bypassing the same gate
    // /api/profile and /api/appearance enforce. The premium-features
    // detector above gives users the nice "this template requires
    // premium" error, but THIS is the hard floor that catches
    // anything the detector misses.
    //
    // Admins (is_admin or @rez) bypass per the same pattern used
    // above so staff can QA without owning premium.
    if (!isAdmin) {
      const freeEvent = await getFreeEventActive()
      const userIsPremium = profile.premium_active === true || freeEvent
      const stripped = stripPremiumFields(profileUpdate, userIsPremium)
      // stripPremiumFields returns the mutated copy in .updates; reassign
      // since we may have lost or coerced keys.
      Object.assign(profileUpdate, stripped.updates)
    }

    // Apply the profile styling
    if (Object.keys(profileUpdate).length > 0) {
      const { error: upErr } = await admin.from('profiles').update(profileUpdate).eq('id', profile.id)
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })
    }

    // Replace related rows - only if the snapshot contains non-empty arrays.
    // Empty arrays in snapshot mean the template author didn't set any, so
    // we leave the user's existing rows alone (per user spec).
    // Protocol guard helper: every social/button URL must be http(s).
    // The originating writers (/api/social-links, /api/custom-buttons)
    // enforce this on initial save, but a malicious template snapshot
    // can legitimately carry whatever the snapshot creator put in
    // their own row at snapshot time. Restoring it without
    // re-validating means a renderer that ever forgot to wrap its
    // <a href> through a protocol filter (HauntModern did until a
    // moment ago) would get a javascript:/data:/vbscript: URI
    // injected via a publicly-applyable template.
    const isHttpUrl = (u: unknown): boolean =>
      typeof u === 'string' && /^https?:\/\//i.test(u)

    if (snapSocialLinks.length > 0) {
      await admin.from('social_links').delete().eq('user_id', profile.id)
      const rows = snapSocialLinks
        .filter((r: any) => r && isHttpUrl(r.url))
        .map((r: any, i: number) => ({
          user_id: profile.id,
          platform: r.platform || 'website',
          url: String(r.url),
          label: r.label || null,
          // Re-validate restored media against the allowlist - the originating
          // /api/social-links route enforces this, so the apply path must too.
          icon_url: (r.icon_url && isAllowedMediaUrl(r.icon_url)) ? r.icon_url : null,
          display_order: typeof r.display_order === 'number' ? r.display_order : i,
        }))
      if (rows.length > 0) await admin.from('social_links').insert(rows)
    }

    if (snapButtons.length > 0) {
      await admin.from('custom_buttons').delete().eq('user_id', profile.id)
      const rows = snapButtons
        .filter((r: any) => r && isHttpUrl(r.url))
        .map((r: any, i: number) => ({
          user_id: profile.id,
          label: r.label || 'Link',
          url: String(r.url),
          media_url: (r.media_url && isAllowedMediaUrl(r.media_url)) ? r.media_url : null,
          media_type: r.media_type || null,
          bg_color: (typeof r.bg_color === 'string' && isValidHexColor(r.bg_color)) ? r.bg_color : null,
          text_color: (typeof r.text_color === 'string' && isValidHexColor(r.text_color)) ? r.text_color : null,
          disable_background: !!r.disable_background,
          display_order: typeof r.display_order === 'number' ? r.display_order : i,
        }))
      if (rows.length > 0) await admin.from('custom_buttons').insert(rows)
    }

    if (snapMusic.length > 0) {
      await admin.from('music_history').delete().eq('user_id', profile.id)
      const rows = snapMusic
        .filter((r: any) => r && r.track_url)
        .slice(0, 10)
        .map((r: any) => ({
          user_id: profile.id,
          track_title: r.track_title || null,
          track_artist: r.track_artist || null,
          track_url: String(r.track_url),
          track_type: r.track_type || 'direct',
        }))
      if (rows.length > 0) await admin.from('music_history').insert(rows)
    }

    if (snapWidgets.length > 0) {
      await admin.from('widgets').delete().eq('user_id', profile.id)
      const rows = snapWidgets
        .filter((r: any) => r && r.type && r.config)
        .map((r: any, i: number) => ({
          user_id: profile.id,
          type: r.type,
          config: r.config,
          display_order: typeof r.display_order === 'number' ? r.display_order : i,
          enabled: r.enabled !== false,
        }))
      if (rows.length > 0) await admin.from('widgets').insert(rows)
    }

    // Atomic increment so concurrent applies don't lose counts (was a
    // read-then-write off a value fetched earlier in the handler).
    await admin.rpc('increment_template_uses', { p_template_id: id })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })
  }
}
