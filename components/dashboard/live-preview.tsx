'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { IconExternalLink, IconRefresh, IconEye, IconInfoCircle } from '@tabler/icons-react'
import { GunsProfile } from '@/components/profile/guns-profile'
import { BackgroundEffectsOverlay } from '@/components/profile/effect-overlays'
import { isVideoUrl } from '@/lib/profile-style'
import { SOCIAL_PLATFORMS, type Profile, type SocialLink, type CustomButton, type Badge, type MusicTrack } from '@/lib/types'

import type { AppearanceState } from '@/components/dashboard/enhanced-appearance-editor'
import type { EffectsState } from '@/components/dashboard/enhanced-effects-editor'

interface Props {
  appearanceOverride?: Partial<AppearanceState>
  effectsOverride?: Partial<EffectsState>
}

export function LivePreview({ appearanceOverride, effectsOverride }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([])
  const [customButtons, setCustomButtons] = useState<CustomButton[]>([])
  const [badges, setBadges] = useState<Badge[]>([])
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  // The "blocked-click" hint flashes for 1.3s whenever the user
  // clicks something inside the preview surface. It tells them WHY
  // their click did nothing instead of leaving them wondering.
  const [showClickHint, setShowClickHint] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) { setLoading(false); return }
        const { profile: profileData } = await res.json()
        if (!profileData) { setLoading(false); return }
        setProfile(profileData)

        // Fetch music tracks too so the preview shows the actual track that
        // would play (not just the legacy profile.music_title fallback). The
        // /api/music GET returns rows with shape {id, title, artist, url, ...}
        // which matches the MusicTrack type the renderer expects.
        const [linksRes, buttonsRes, badgesRes, musicRes] = await Promise.all([
          fetch('/api/social-links/list'),
          fetch('/api/custom-buttons/list'),
          fetch('/api/profile-badges/list'),
          fetch('/api/music'),
        ])
        if (linksRes.ok) setSocialLinks((await linksRes.json()).links || [])
        if (buttonsRes.ok) setCustomButtons((await buttonsRes.json()).buttons || [])
        if (badgesRes.ok) setBadges((await badgesRes.json()).badges || [])
        if (musicRes.ok) setMusicTracks((await musicRes.json()).tracks || [])
      } catch (error) {
        console.error('[LivePreview] fetch error:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [refreshKey])

  const previewProfile = useMemo(() => {
    if (!profile) return null
    const a = appearanceOverride || {}
    const e = effectsOverride || {} as any
    return {
      ...profile,
      // Profile content (display name, bio, location, avatar) - typing into
      // these fields on the customize page should reflect 1:1 in the preview
      // without needing a save first. Use undefined-checks so an explicit
      // empty string from the form clears the field in preview instead of
      // falling back to the saved value.
      display_name: (a as any).displayName !== undefined ? (a as any).displayName : profile.display_name,
      bio:          (a as any).bio          !== undefined ? (a as any).bio          : profile.bio,
      location:     (a as any).location     !== undefined ? (a as any).location     : profile.location,
      // Avatar resolution: when the owner toggled "Use Discord Avatar"
      // ON and we have a cached Discord avatar URL, swap that in as
      // the preview's avatar. Same logic mirrors app/[username]/page.tsx
      // so the dashboard live preview matches the public profile 1:1.
      avatar_url:   (a as any).useDiscordAvatar && (profile as any).discord_avatar_url
                       ? (profile as any).discord_avatar_url
                       : (a as any).avatarUrl    !== undefined ? (a as any).avatarUrl    : profile.avatar_url,
      use_discord_avatar: (a as any).useDiscordAvatar ?? (profile as any).use_discord_avatar,
      // appearance
      accent_color: a.accentColor ?? profile.accent_color,
      text_color: a.textColor ?? profile.text_color,
      background_color: a.backgroundColor ?? profile.background_color,
      icon_color: a.iconColor ?? profile.icon_color,
      font_family: a.fontFamily ?? profile.font_family,
      // For custom_font_url, an explicit `null` from the override means the
      // user just removed their font - we want to honor that immediately so
      // the preview reflects the un-fonted state without needing a save.
      // Only fall back to the saved profile value when the override is
      // `undefined` (i.e. the override doesn't mention font url at all).
      custom_font_url: a.customFontUrl !== undefined ? a.customFontUrl : profile.custom_font_url,
      background_effect: a.backgroundEffect ?? profile.background_effect,
      // Background-effect colour override (Advanced Text Colors row).
      // Use undefined-check so an explicit null/empty from the override
      // (user just cleared it) wipes the preview to inherit from
      // accent_color, instead of silently reverting to the saved value.
      background_effect_color: (a as any).backgroundEffectColor !== undefined ? (a as any).backgroundEffectColor : (profile as any).background_effect_color,
      background_type: a.backgroundType ?? profile.background_type,
      background_gradient: a.backgroundGradient ?? profile.background_gradient,
      background_url: a.backgroundUrl ?? profile.background_url,
      profile_opacity: a.profileOpacity ?? profile.profile_opacity,
      profile_blur: a.profileBlur ?? profile.profile_blur,
      profile_radius: (a as any).profileRadius ?? profile.profile_radius,
      // Advanced per-element text colors and font targeting. Use undefined-
      // checks so explicit `null` from the override (= "user just cleared
      // it") clears the value in preview instantly instead of falling back
      // to the saved value.
      display_name_color:    (a as any).displayNameColor    !== undefined ? (a as any).displayNameColor    : (profile as any).display_name_color,
      username_handle_color: (a as any).usernameHandleColor !== undefined ? (a as any).usernameHandleColor : (profile as any).username_handle_color,
      bio_color:             (a as any).bioColor            !== undefined ? (a as any).bioColor            : (profile as any).bio_color,
      location_color:        (a as any).locationColor       !== undefined ? (a as any).locationColor       : (profile as any).location_color,
      card_text_color:       (a as any).cardTextColor       !== undefined ? (a as any).cardTextColor       : (profile as any).card_text_color,
      music_text_color:      (a as any).musicTextColor      !== undefined ? (a as any).musicTextColor      : (profile as any).music_text_color,
      custom_font_name:      (a as any).customFontName      !== undefined ? (a as any).customFontName      : (profile as any).custom_font_name,
      font_apply_displayname: (a as any).fontApplyDisplayname ?? (profile as any).font_apply_displayname,
      font_apply_username:    (a as any).fontApplyUsername    ?? (profile as any).font_apply_username,
      font_apply_bio:         (a as any).fontApplyBio         ?? (profile as any).font_apply_bio,
      font_apply_music:       (a as any).fontApplyMusic       ?? (profile as any).font_apply_music,
      // 4 font slots
      font_1_url:  (a as any).font1Url  !== undefined ? (a as any).font1Url  : (profile as any).font_1_url,
      font_1_name: (a as any).font1Name !== undefined ? (a as any).font1Name : (profile as any).font_1_name,
      font_2_url:  (a as any).font2Url  !== undefined ? (a as any).font2Url  : (profile as any).font_2_url,
      font_2_name: (a as any).font2Name !== undefined ? (a as any).font2Name : (profile as any).font_2_name,
      font_3_url:  (a as any).font3Url  !== undefined ? (a as any).font3Url  : (profile as any).font_3_url,
      font_3_name: (a as any).font3Name !== undefined ? (a as any).font3Name : (profile as any).font_3_name,
      font_4_url:  (a as any).font4Url  !== undefined ? (a as any).font4Url  : (profile as any).font_4_url,
      font_4_name: (a as any).font4Name !== undefined ? (a as any).font4Name : (profile as any).font_4_name,
      // Per-element font slot (0 = no custom font)
      font_slot_displayname: (a as any).fontSlotDisplayname ?? (profile as any).font_slot_displayname ?? 0,
      font_slot_username:    (a as any).fontSlotUsername    ?? (profile as any).font_slot_username    ?? 0,
      font_slot_bio:         (a as any).fontSlotBio         ?? (profile as any).font_slot_bio         ?? 0,
      font_slot_music:       (a as any).fontSlotMusic       ?? (profile as any).font_slot_music       ?? 0,
      profile_gradient_enabled: a.profileGradientEnabled ?? profile.profile_gradient_enabled,
      profile_gradient_primary: a.profileGradientPrimary ?? profile.profile_gradient_primary,
      profile_gradient_secondary: a.profileGradientSecondary ?? profile.profile_gradient_secondary,
      glow_username: a.glowUsername ?? profile.glow_username,
      glow_socials: a.glowSocials ?? profile.glow_socials,
      glow_badges: a.glowBadges ?? profile.glow_badges,
      glow_intensity: a.glowIntensity ?? profile.glow_intensity,
      glow_color: a.glowColor ?? profile.glow_color,
      socials_glow_mono: (a as any).socialsGlowMono ?? (profile as any).socials_glow_mono ?? false,
      socials_below_widgets: (a as any).socialsBelowWidgets ?? (profile as any).socials_below_widgets ?? false,
      outline_enabled: a.outlineEnabled ?? profile.outline_enabled,
      outline_color: a.outlineColor ?? profile.outline_color,
      outline_width: a.outlineWidth ?? profile.outline_width,
      card_style: a.cardStyle ?? profile.card_style,
      layout_mode: (a as any).layoutMode ?? (profile as any).layout_mode,
      bento_tiles: (a as any).bentoTiles ?? (profile as any).bento_tiles,
      avatar_shape: (a as any).avatarShape ?? (profile as any).avatar_shape,
      panel_size: (a as any).panelSize ?? (profile as any).panel_size,
      avatar_position: (a as any).avatarPosition ?? (profile as any).avatar_position,
      avatar_placement: (a as any).avatarPlacement ?? (profile as any).avatar_placement,
      show_avatar: (a as any).showAvatar ?? (profile as any).show_avatar,
      // Avatar outline + glow (owner-only @rez). Mapped here so the ring in
      // the preview tracks the form live instead of the saved value.
      avatar_outline_enabled: (a as any).avatarOutlineEnabled ?? (profile as any).avatar_outline_enabled,
      avatar_outline_color:   (a as any).avatarOutlineColor   ?? (profile as any).avatar_outline_color,
      avatar_outline_size:    (a as any).avatarOutlineSize    ?? (profile as any).avatar_outline_size,
      avatar_glow_enabled:    (a as any).avatarGlowEnabled    ?? (profile as any).avatar_glow_enabled,
      avatar_glow_color:      (a as any).avatarGlowColor      ?? (profile as any).avatar_glow_color,
      avatar_glow_size:       (a as any).avatarGlowSize       ?? (profile as any).avatar_glow_size,
      // effects
      username_effect: e.usernameEffect ?? profile.username_effect,
      cursor_effect: e.cursorEffect ?? profile.cursor_effect,
      cursor_color: e.cursorColor ?? (profile as any).cursor_color,
      custom_cursor_url: e.customCursorUrl ?? profile.custom_cursor_url,
      tilt_effect: e.tiltEffect ?? profile.tilt_effect,
      hover_effect: e.hoverEffect ?? profile.hover_effect,
      hover_effect_color: e.hoverEffectColor ?? (profile as any).hover_effect_color,
      entrance_animation: e.entranceAnimation ?? profile.entrance_animation,
      show_view_count: e.showViewCount ?? profile.show_view_count,
      show_badges: e.showBadges ?? profile.show_badges,
      monochrome_icons: e.monochromeIcons ?? profile.monochrome_icons,
      animated_title: e.animatedTitle ?? profile.animated_title,
      swap_box_colors: e.swapBoxColors ?? profile.swap_box_colors,
      show_likes: e.showLikes ?? (profile as any).show_likes,
      volume_control: e.volumeControl ?? profile.volume_control,
      custom_cursor_hover_url: e.hoverCursorUrl ?? (profile as any).custom_cursor_hover_url,
      views_location_position: e.viewsLocationPosition ?? (profile as any).views_location_position ?? 'top-right',
      animate_view_count: e.animateViewCount ?? (profile as any).animate_view_count ?? false,
      typing_bio: e.typingBio ?? (profile as any).typing_bio,
      typing_speed: e.typingSpeed ?? (profile as any).typing_speed,
      bio_texts: e.bioTexts ?? (profile as any).bio_texts,
    } as Profile & Record<string, any>
  }, [appearanceOverride, effectsOverride, profile])

  // The CursorEffectsLayer is intentionally skipped in preview mode (we
  // don't want the preview to take over the user's actual cursor while
  // they're editing). Show the uploaded cursor + hover-cursor as small
  // thumbnails in the header so users get instant visual feedback that
  // their upload landed without having to open the live profile.
  const cursorThumbUrl = previewProfile?.custom_cursor_url
  const cursorHoverThumbUrl = (previewProfile as any)?.custom_cursor_hover_url

  // Header bar - title on the left, utility actions on the right.
  // No device-mode toggle anymore (the desktop/mobile toggle was
  // removed at the user's request - the panel renders a single
  // desktop-width preview).
  const headerBar = (
    <div className="flex items-center justify-between border-b border-border bg-surface-2/85 px-3 py-2 backdrop-blur-md">
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="relative flex h-5 w-5 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-primary/25 blur-[6px]" aria-hidden />
          <IconEye className="relative size-4 text-primary" />
        </span>
        Live Preview
      </span>

      <div className="flex items-center gap-1.5">
        {(cursorThumbUrl || cursorHoverThumbUrl) ? (
          <div
            className="flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-1"
            title="Uploaded cursor (only renders on the live profile, not in preview)"
          >
            {cursorThumbUrl ? (
              <img src={cursorThumbUrl} alt="cursor" className="h-4 w-4 object-contain" />
            ) : null}
            {cursorHoverThumbUrl ? (
              <img src={cursorHoverThumbUrl} alt="hover cursor" className="h-4 w-4 object-contain opacity-70" />
            ) : null}
          </div>
        ) : null}
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
          title="Refresh data"
        >
          <IconRefresh className="size-4" />
        </button>
        {previewProfile ? (
          <a
            href={`/${previewProfile.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            title="Open live profile"
          >
            <IconExternalLink className="size-4" />
          </a>
        ) : null}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)]">
        {headerBar}
        {/* Skeleton - vague profile-shape silhouette that pulses at
            the same rhythm as the brand pink. Way more informative
            than a centred spinner. */}
        <div className="flex flex-1 items-center justify-center overflow-hidden bg-background p-6">
          <div className="flex w-full max-w-sm flex-col items-center gap-3 opacity-60">
            <div className="h-24 w-24 animate-pulse rounded-full bg-surface-2" />
            <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-44 animate-pulse rounded bg-surface" />
            <div className="mt-2 flex gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-7 w-7 animate-pulse rounded bg-surface" />
              ))}
            </div>
            <div className="mt-2 h-10 w-full animate-pulse rounded-xl bg-surface" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-surface" />
          </div>
        </div>
      </div>
    )
  }

  if (!previewProfile) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)]">
        {headerBar}
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">No profile found</div>
      </div>
    )
  }

  const bgColor = previewProfile.background_color || '#0a0a0f'
  const bgUrl = previewProfile.background_url
  const bgEffect = previewProfile.background_effect
  const accentColor = previewProfile.accent_color || '#e87fa0'
  const glowColor = previewProfile.glow_color || accentColor
  const bgEffectColor = (previewProfile as any).background_effect_color || null
  const bgEffectStrength = (previewProfile as any).background_effect_strength ?? 50
  const isBlurredEffect = bgEffect === 'blurred'

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)]">
      {headerBar}
      <div className="relative flex-1 overflow-hidden bg-background">
        {/* Background image / video - previewMode disables this inside GunsProfile so we render here */}
        {bgUrl ? (
          isVideoUrl(bgUrl) ? (
            <video src={bgUrl} autoPlay loop muted playsInline preload="metadata"
              className={`pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.35] ${isBlurredEffect ? 'scale-110 blur-xl' : ''}`} />
          ) : (
            <div className={`pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.35] ${isBlurredEffect ? 'scale-110 blur-xl' : ''}`}
              style={{ backgroundImage: `url(${bgUrl})` }} />
          )
        ) : null}

        {/* Background effects overlay */}
        {bgEffect && bgEffect !== 'none' ? (
          <div className="pointer-events-none absolute inset-0">
            <BackgroundEffectsOverlay effect={bgEffect} accentColor={accentColor} glowColor={glowColor} effectColor={bgEffectColor} embedded strength={bgEffectStrength} />
          </div>
        ) : null}

        {/* Vignette to keep content readable over busy backgrounds */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />

        {/* Real GunsProfile renderer (1:1 fidelity). Pointer events
            stay on so hover effects fire, but clicks are blocked -
            we don't want the preview to actually navigate to external
            links / track clicks. The click-hint toast flashes briefly
            to tell the user why their click did nothing. */}
        <div className="absolute inset-0 overflow-y-auto scrollbar-hide">
          <div
            className="flex min-h-full items-center justify-center px-4 py-6"
            onClickCapture={(e) => {
              const target = e.target as HTMLElement
              if (target.closest('a, button')) {
                e.preventDefault()
                e.stopPropagation()
                setShowClickHint(true)
                window.setTimeout(() => setShowClickHint(false), 1300)
              }
            }}
          >
            <GunsProfile
              profile={previewProfile}
              socialLinks={socialLinks}
              badges={badges}
              customButtons={customButtons}
              musicTracks={musicTracks}
              previewMode
            />
          </div>
        </div>

        {/* Click-blocked hint - slides in from the bottom when the
            user clicks something inside the preview. */}
        <div
          aria-hidden={!showClickHint}
          className={`pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center transition-all duration-200 ${showClickHint ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
        >
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2/90 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-lg backdrop-blur-md">
            <IconInfoCircle className="size-3 text-primary" />
            Preview only - clicks are disabled. Open the live profile to use links.
          </div>
        </div>
      </div>
    </div>
  )
}
