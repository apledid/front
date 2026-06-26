"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { IconCalendar, IconEye, IconExternalLink, IconMapPin, IconPlayerPause, IconPlayerPlay, IconPlayerSkipBack, IconPlayerSkipForward, IconPlaylist, IconVolume, IconVolumeOff, IconFileText, IconX } from '@tabler/icons-react'
import { BackgroundEffectsOverlay, CustomFontFace, UsernameDisplay } from '@/components/profile/effect-overlays'
// Lazy-load the cursor effects layer (canvas + RAF + ~550 lines) so it only
// downloads & mounts when the visited profile actually uses a cursor effect.
const CursorEffectsLayer = dynamic(
  () => import('@/components/profile/cursor-effects').then((m) => m.CursorEffectsLayer),
  { ssr: false },
)
import { WidgetsPanel } from '@/components/profile/widgets-panel'
import { SocialIcon } from '@/components/profile/social-icon'
import { SyncedLyrics } from '@/components/profile/synced-lyrics'
import { LinkConfirmDialog } from '@/components/profile/link-confirm-dialog'
import { toast } from 'sonner'
import {
  cssUrl,
  getButtonStyle,
  getCardContainerStyles,
  getPanelMaxWidth,
  getResolvedFontFamily,
  getSocialIconWrapperStyle,
  hexToRgba,
  isVideoUrl,
} from '@/lib/profile-style'
import { SOCIAL_PLATFORMS, type Badge, type CustomButton, type LoadoutPosition, type MusicTrack, type Profile, type ProfileBadgeLoadoutItem, type ProfileTitleLoadoutItem, type SocialLink } from '@/lib/types'
import { getCryptoBadgesForUser, userHasCryptoBadges } from '@/lib/crypto-badges'
// Phase-1 refactor: pure helpers + small isolated components that used to
// live inline in this file. Same behavior, just moved out so the layout
// branches can stay focused on layout. See `components/profile/parts/*`.
import { BackgroundVideo } from '@/components/profile/parts/background-video'
import { AvatarWithDecoration } from '@/components/profile/parts/avatar-with-decoration'
import { AvatarMedia } from '@/components/profile/parts/avatar-media'
import { BadgeTooltip } from '@/components/profile/parts/badge-tooltip'
import { HoverTooltip } from '@/components/profile/parts/hover-tooltip'
import { BadgeIcon } from '@/components/profile/parts/badge-icon'
import { HauntModern } from '@/components/profile/layouts/haunt-modern'
import { AnimatedViewCount } from '@/components/profile/parts/animated-view-count'
import { ViewsLocationChip } from '@/components/profile/parts/views-location-chip'
import { LikeDislike } from '@/components/profile/parts/like-dislike'
import { TypingBio, renderBioMarkdown } from '@/components/profile/parts/bio-block'
import {
  getAvatarShapeStyle,
  formatProfileUid,
  safeButtonHref,
  buildSocialHref,
  getViewsPositionStyle,
} from '@/components/profile/parts/profile-helpers'

interface GunsProfileProps {
  profile: Profile
  socialLinks: SocialLink[]
  badges: Badge[]
  badgeLoadout?: ProfileBadgeLoadoutItem[]
  titleLoadout?: ProfileTitleLoadoutItem[]
  customButtons?: CustomButton[]
  musicTracks?: MusicTrack[]
  previewMode?: boolean
}

const brandColors: Record<string, string> = Object.fromEntries(
  (SOCIAL_PLATFORMS as ReadonlyArray<{ id: string; color: string }>).map(p => [p.id, p.color])
)

// Custom SVG badge icons - each badge has its own polished icon


export function GunsProfile({ profile, socialLinks, badges, badgeLoadout = [], titleLoadout = [], customButtons = [], musicTracks = [], previewMode = false }: GunsProfileProps) {
  const enterConfig = profile as Profile & Record<string, any>
  // Use the enter_enabled field to determine if splash screen should show
  const enterEnabled = enterConfig.enter_enabled !== false && !previewMode
  const [entered, setEntered] = useState(!enterEnabled)
  const [splashFading, setSplashFading] = useState(false)
  // Bumped on enter so the background video restarts from the start.
  const [videoRestart, setVideoRestart] = useState(0)
  const [contentVisible, setContentVisible] = useState(!enterEnabled)
  // REZ-ONLY: toggles the Spotify-style synced-lyrics overlay.
  const [showLyrics, setShowLyrics] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [showUid, setShowUid] = useState(false)
  // Coords for the UID tooltip - portaled to document.body so it can never
  // be trapped behind the avatar's stacking context.
  const uidTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [uidCoords, setUidCoords] = useState<{ x: number; y: number } | null>(null)
  const showUidTooltip = () => {
    const el = uidTriggerRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      setUidCoords({ x: r.left + r.width / 2, y: r.top })
    }
    setShowUid(true)
  }
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [volume, setVolume] = useState(() => {
    const v = (profile as any).music_volume
    return typeof v === 'number' ? Math.max(0, Math.min(1, v / 100)) : 0.8
  })
  const [showVolumePanel, setShowVolumePanel] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  // External-link confirmation: custom links (profile owner-defined URLs) go
  // through this dialog before navigating. Regular socials (Twitter etc.)
  // skip it because the URL is built from a trusted template + username.
  const [linkConfirm, setLinkConfirm] = useState<{ url: string; linkId: string } | null>(null)

  // Per-link click throttle for the crypto copy buttons. Pure UX guard -
  // the copy action is 100% client-side (writeText + toast) so there's no
  // server resource to rate-limit. This just keeps an auto-clicker from
  // stacking thousands of toasts on the visitor's own screen. 1.2s is
  // long enough that a human can't trip it but short enough that double-
  // taps still feel responsive.
  const COPY_COOLDOWN_MS = 1200
  const lastCryptoCopyRef = useRef<Map<string, number>>(new Map())

  const cardRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const clickSoundRef = useRef<HTMLAudioElement>(null)
  const enterSoundRef = useRef<HTMLAudioElement>(null)

  const p = profile as Profile & Record<string, any>
  // Custom click + entrance SFX are a premium feature. The premium gate lives
  // server-side (app/[username]/page.tsx nulls these URLs for non-premium
  // profiles) because premium_active is stripped from the public profile by
  // sanitizeProfileForPublic and can't be read here.
  const clickSoundUrl = p.click_sound_url || ''
  const enterSoundUrl = p.enter_sound_url || ''
  const clickSoundVolume = Math.max(0, Math.min(1, Number(p.click_sound_volume ?? 100) / 100))
  const enterSoundVolume = Math.max(0, Math.min(1, Number(p.enter_sound_volume ?? 100) / 100))
  const accentColor = profile.accent_color || '#a855f7'
  const textColor = profile.text_color || '#ffffff'
  const iconColor = profile.icon_color || accentColor
  const bgColor = profile.background_color || '#09090f'
  const glowColor = profile.glow_color || accentColor
  const glowIntensity = p.glow_intensity ?? 50
  // Multi-font resolution. The user can upload up to 4 named fonts and
  // assign each text element (display name, @username, bio, music panel) to
  // any one of them - or to slot 0 (the system default fallback). Each
  // font slot becomes a unique @font-face name so multiple fonts can render
  // side-by-side without colliding.
  const fontSlots = [
    (p as any).font_1_url || (p as any).custom_font_url, // legacy fallback
    (p as any).font_2_url,
    (p as any).font_3_url,
    (p as any).font_4_url,
  ] as Array<string | null | undefined>
  const baseFontFallback = getResolvedFontFamily(profile.font_family, null)
  const slotFamily = (slot: number) => {
    if (!slot || slot < 1 || slot > 4) return baseFontFallback
    const url = fontSlots[slot - 1]
    if (!url) return baseFontFallback
    return `"ProfileCustomFont${slot}", ${baseFontFallback}`
  }
  // Backward-compat: existing profiles use font_apply_* booleans + a single
  // font_url. If a per-element slot isn't set (= 0), fall back to the legacy
  // toggle pattern so saved profiles render the same as before.
  const legacyFamily = getResolvedFontFamily(profile.font_family, profile.custom_font_url)
  const customFontUrl = (profile as any).custom_font_url
  const legacyFor = (key: 'displayname' | 'username' | 'bio' | 'music') => {
    const flag = (p as any)[`font_apply_${key}`]
    if (!customFontUrl) return baseFontFallback
    return (flag ?? true) ? legacyFamily : baseFontFallback
  }
  // font_slot_username drives the big username line at the top. The
  // separate "displayname" slot is left in the schema for backward compat
  // but the matching DOM element was removed when @handle was promoted.
  const fontApplyUsername    = (p as any).font_slot_username    ? slotFamily((p as any).font_slot_username)    : legacyFor('username')
  const fontApplyBio         = (p as any).font_slot_bio         ? slotFamily((p as any).font_slot_bio)         : legacyFor('bio')
  const fontApplyMusic       = (p as any).font_slot_music       ? slotFamily((p as any).font_slot_music)       : legacyFor('music')
  const fontFamily = legacyFamily
  // Per-element color overrides (NULL = inherit base). `display_name_color`
  // drives the big username line; `username_handle_color` is preserved in
  // the schema but unused now that the @handle is no longer a separate line.
  const displayNameColorOverride = p.display_name_color || null
  const bioColor                 = p.bio_color || textColor
  const locationColor            = p.location_color || textColor
  const cardTextColor            = p.card_text_color || textColor
  const musicTextColor           = p.music_text_color || textColor
  const usernameText = profile.username || 'profile'
  const displayName = (profile.display_name || '').trim() || profile.username
  const showBadges = profile.show_badges !== false
  const hoverEffect = p.hover_effect || 'none'
  const hoverEffectColor = p.hover_effect_color || accentColor
  const usernameEffect = p.username_effect || 'none'
  const entranceAnimation = p.entrance_animation || 'fade'
  const avatarPosition = p.avatar_position === 'left' ? 'left' : 'center'
  const avatarPlacement = p.avatar_placement === 'inside' ? 'inside' : 'outside'
  const showAvatar = p.show_avatar !== false
  const avatarShapeStyle = getAvatarShapeStyle(p.avatar_shape)
  // Avatar outline + glow (available to everyone). Layered box-shadow: solid
  // outline ring first so it paints on top, soft glow behind. Only renders
  // when the user enables it - the columns default to off. Box-shadow draws
  // outside the avatar and isn't clipped by its overflow:hidden.
  const avatarRingStyle: React.CSSProperties | undefined = (() => {
    const parts: string[] = []
    if ((p as any).avatar_outline_enabled) {
      const w = Math.max(0, Math.min(20, Number((p as any).avatar_outline_size) || 0))
      if (w > 0) parts.push(`0 0 0 ${w}px ${(p as any).avatar_outline_color || '#ffffff'}`)
    }
    if ((p as any).avatar_glow_enabled) {
      const s = Math.max(0, Math.min(40, Number((p as any).avatar_glow_size) || 0))
      if (s > 0) parts.push(`0 0 ${s}px ${Math.round(s / 5)}px ${(p as any).avatar_glow_color || '#e87fa0'}`)
    }
    return parts.length ? { boxShadow: parts.join(', ') } : undefined
  })()
  const showIdentity = p.show_name !== false
  const typingBio = p.typing_bio || false
  const bioTexts: string[] = Array.isArray(p.bio_texts) ? p.bio_texts : []
  const typingSpeed = p.typing_speed ?? 80
  const panelSize = p.panel_size || 'medium'
  const cursorEffect = p.cursor_effect || 'none'
  const cursorColor = p.cursor_color || accentColor
  const cursorClickEffect = p.cursor_click_effect || 'none'
  const cursorClickColor = p.cursor_click_color || cursorColor
  const customCursorUrl = p.custom_cursor_url || ''
  const hoverCursorUrl = p.custom_cursor_hover_url || ''
  const monochromeIcons = p.monochrome_icons || false
  // Default to TRUE (no background pill) when the field is null/undefined.
  // The pill background is now opt-in - set the column to false to enable it.
  const noBgIcons = (profile as any).social_icons_no_background !== false
  // h-9 (36px) matches Modern's icon glyph size when the user opts
  // out of the pill background. Pill mode keeps a smaller glyph
  // (h-5/20px) so the icon doesn't crowd the pill chrome.
  const socialIconClass = noBgIcons ? 'h-9 w-9' : 'h-5 w-5'
  const socialIconClassSmall = noBgIcons ? 'h-7 w-7' : 'h-4 w-4'
  const swapBoxColors = p.swap_box_colors || false
  const volumeControl = p.volume_control !== false
  const backgroundEffect = p.background_effect || 'none'
  const viewsLocationPosition = p.views_location_position || 'top-right'
  const animateViewCount = p.animate_view_count === true
  const viewsBadgeBackground = p.views_badge_background === true
  const uidText = formatProfileUid(profile)
  // Custom cursor image stays visible alongside any effect except 'cat' (own
  // sprite) and 'splash' (fluid sim takes over the cursor surface).
  const useCustomCursorOverlay = cursorEffect !== 'cat' && cursorEffect !== 'splash' && Boolean(customCursorUrl || hoverCursorUrl)
  // Two supported layouts: Classic (default) and Modern. Portfolio,
  // banner, bento, and minimal were all dropped. Any stale layout_mode
  // value in the DB falls back to 'default' at render time.
  const layoutMode = (() => {
    if (p.layout_mode === 'modern') return 'modern' as const
    return 'default' as const
  })()
  // Modern layout is now public - anyone who selects it in the
  // customize panel routes to HauntModern. (Was previously gated to
  // an `isTester` allowlist while the layout was being polished.)
  const useHauntLayout = layoutMode === 'modern'

  useEffect(() => {
    const syncMobile = () => setIsMobile(window.innerWidth < 640)
    syncMobile()
    window.addEventListener('resize', syncMobile)
    return () => window.removeEventListener('resize', syncMobile)
  }, [])
  const enterTitle = (p.enter_title || displayName || usernameText || '').trim() || usernameText
  const enterSubtitle = (p.enter_subtitle || 'Click anywhere to enter').trim() || 'Click anywhere to enter'
  const showEnterProfile = p.enter_show_profile !== false && showAvatar
  const showEnterTitle = p.enter_show_title !== false && showIdentity
  const showEnterSubtitle = p.enter_show_subtitle !== false

  const playlist = useMemo<MusicTrack[]>(() => {
    // Use musicTracks from music_history if available, capped at 3 (or 5 for
    // premium - the cap is enforced server-side, this just guards the UI).
    let base: MusicTrack[] = []
    if (musicTracks.length > 0) {
      base = musicTracks.filter((track) => track.url).slice(0, 5)
    } else if (profile.music_enabled && profile.music_url) {
      base = [{ id: 'legacy-track', title: profile.music_title || 'Track 1', artist: profile.music_artist || '', url: profile.music_url, type: 'direct' }]
    }
    // If shuffle is enabled, randomize order using Fisher-Yates so each
    // visitor gets a different starting track / play order.
    if (base.length > 1 && (profile as any).music_shuffle === true) {
      const arr = [...base]
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    }
    return base
  }, [musicTracks, profile.music_artist, profile.music_enabled, profile.music_title, profile.music_url, (profile as any).music_shuffle])

  const currentTrack = playlist[currentTrackIndex] || null
  const musicEnabled = Boolean(profile.music_enabled && currentTrack)

  // Tab title is now owned exclusively by <TabTitleTypewriter /> in
  // app/[username]/page.tsx. The old animated-title effect that lived here
  // (setting document.title to `<username> | halo.rip` and flipping ✦
  // frames) was fighting with the typewriter after the splash dismissed,
  // causing the tab to flash "rez | halo.rip" mid-animation. Removed.

  useEffect(() => {
    if (!contentVisible || !musicEnabled || !audioRef.current || !isPlaying) return
    // Apply the user's saved volume before each play() so first playback
    // always starts at the configured level. HTMLAudioElement defaults to
    // volume=1.0 and the separate volume-sync effect can race the play call.
    audioRef.current.volume = volume
    audioRef.current.play().catch(() => undefined)
  }, [contentVisible, currentTrackIndex, isPlaying, musicEnabled, volume])

  // Auto-play music when enter screen is disabled
  // Uses multiple strategies to bypass browser autoplay restrictions
  const autoplayAttemptedRef = useRef(false)

  useEffect(() => {
    // When enter screen is disabled, attempt autoplay once the audio is ready
    // Never autoplay in previewMode (landing page) - user must click play manually
    if (previewMode || enterEnabled || !contentVisible || !musicEnabled || autoplayAttemptedRef.current) return

    const audio = audioRef.current
    if (!audio) return

    const attemptPlay = async () => {
      if (autoplayAttemptedRef.current) return
      autoplayAttemptedRef.current = true

      // Apply saved volume *before* play() so the user's "Default Volume"
      // setting is respected from the very first frame of audio. Without
      // this the element's default of 1.0 would briefly blast at full
      // volume before the volume-sync effect lowered it.
      audio.volume = volume

      // Strategy 1: Try direct play first
      try {
        await audio.play()
        setIsPlaying(true)
        return
      } catch {
        // Continue to next strategy
      }

      // Strategy 2: Try muted play. Modern browsers (Chrome/Safari/FF)
      // enforce "no audible audio without user gesture" - muted autoplay
      // is allowed but flipping audio.muted=false WITHOUT a user gesture
      // gets silently no-op'd. So we set the audio to muted, start it,
      // and tell React the audio IS muted. The first user interaction
      // (the unmute-on-gesture effect below) will flip it back on.
      try {
        audio.muted = true
        await audio.play()
        setIsPlaying(true)
        setIsMuted(true)
      } catch {
        // Browser blocked even the muted attempt - rare, usually means
        // the audio element couldn't load the source.
        audio.muted = false
      }
    }

    // Wait for audio to be ready
    if (audio.readyState >= 2) {
      attemptPlay()
    } else {
      audio.addEventListener('canplay', () => attemptPlay(), { once: true })
    }
  }, [enterEnabled, contentVisible, musicEnabled])

  // ── First-interaction unmute ────────────────────────────────────────
  // If autoplay had to fall back to "play muted", flip the audio back
  // on the moment the user touches the page (click/tap/keypress). This
  // is what people expect from a music-enabled profile - they see the
  // player going, click anywhere, and hear it. The listeners self-
  // remove after the first hit so they cost nothing afterwards.
  useEffect(() => {
    if (previewMode || enterEnabled || !musicEnabled) return
    const audio = audioRef.current
    if (!audio) return

    const unmuteOnGesture = () => {
      const a = audioRef.current
      if (!a) return
      if (a.muted) {
        a.muted = false
        a.volume = volume
        setIsMuted(false)
        // If for any reason the audio paused (some browsers also
        // pause on gesture switch), kick it back on.
        if (a.paused) {
          a.play().then(() => setIsPlaying(true)).catch(() => {})
        }
      }
      window.removeEventListener('click', unmuteOnGesture, true)
      window.removeEventListener('touchstart', unmuteOnGesture, true)
      window.removeEventListener('keydown', unmuteOnGesture, true)
    }

    // Bubble phase (no capture) so the volume button's own onClick runs
    // first and toggleMute owns the state for that specific click. If
    // we captured, we'd unmute, then the button click would re-toggle
    // and re-mute - the opposite of what the user wanted.
    window.addEventListener('click', unmuteOnGesture)
    window.addEventListener('touchstart', unmuteOnGesture)
    window.addEventListener('keydown', unmuteOnGesture)
    return () => {
      window.removeEventListener('click', unmuteOnGesture)
      window.removeEventListener('touchstart', unmuteOnGesture)
      window.removeEventListener('keydown', unmuteOnGesture)
    }
  }, [previewMode, enterEnabled, musicEnabled, volume])

  // Entrance sound when there's NO "click to enter" splash. Try to start it
  // immediately, in sync with the background video + music. Browsers block
  // bare audio autoplay, so if that attempt is rejected we fall back to the
  // visitor's first interaction. Either path plays it exactly once.
  useEffect(() => {
    if (previewMode || enterEnabled || !enterSoundUrl) return
    let played = false
    function cleanup() {
      window.removeEventListener('click', play)
      window.removeEventListener('touchstart', play)
      window.removeEventListener('keydown', play)
    }
    function play() {
      if (played) return
      const el = enterSoundRef.current
      if (!el) return
      try { el.currentTime = 0 } catch { /* not seekable yet */ }
      el.volume = enterSoundVolume
      el.play().then(() => { played = true; cleanup() }).catch(() => { /* autoplay blocked - wait for a gesture */ })
    }
    // Fire on load (alongside the background video + music autoplay)...
    play()
    // ...and keep a one-shot gesture fallback for when autoplay is blocked.
    window.addEventListener('click', play)
    window.addEventListener('touchstart', play)
    window.addEventListener('keydown', play)
    return cleanup
  }, [previewMode, enterEnabled, enterSoundUrl, enterSoundVolume])

  const handleEnter = () => {
    setSplashFading(true)
    // Start the background video and the music together, both from the very
    // beginning, the instant the visitor enters. Previously the video
    // restarted on click but the music only kicked in ~0.7s later (after the
    // splash finished fading), so they played out of sync. Kicking the audio
    // off here also keeps the play() call inside the user's click gesture, so
    // the browser won't block it.
    setVideoRestart((n) => n + 1)
    if (enterSoundUrl && enterSoundRef.current) {
      const s = enterSoundRef.current
      try { s.currentTime = 0 } catch { /* not seekable yet */ }
      s.volume = enterSoundVolume
      s.play().catch(() => undefined)
    }
    if (musicEnabled && audioRef.current) {
      const audio = audioRef.current
      try { audio.currentTime = 0 } catch { /* not seekable yet */ }
      audio.volume = volume
      audio.play().catch(() => undefined)
      setIsPlaying(true)
    }
    window.setTimeout(() => {
      setEntered(true)
      requestAnimationFrame(() => {
        window.setTimeout(() => {
          setContentVisible(true)
        }, 40)
      })
    }, 300)
  }

  // Play the custom click sound on every click once entered (premium).
  // Each click spawns its own audio instance so rapid clicks overlap instead
  // of rewinding one element. Clips are capped at 5s on upload, so instances
  // finish fast; the cap below just guards against pathological spam.
  const clickSoundLiveRef = useRef(0)
  useEffect(() => {
    if (previewMode || !entered || !clickSoundUrl) return
    const onClick = () => {
      const base = clickSoundRef.current
      if (clickSoundLiveRef.current >= 24) return
      const inst = (base ? base.cloneNode(true) : new Audio(clickSoundUrl)) as HTMLAudioElement
      inst.volume = clickSoundVolume
      clickSoundLiveRef.current += 1
      const done = () => { clickSoundLiveRef.current = Math.max(0, clickSoundLiveRef.current - 1) }
      inst.addEventListener('ended', done, { once: true })
      inst.addEventListener('error', done, { once: true })
      inst.play().catch(done)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [previewMode, entered, clickSoundUrl, clickSoundVolume])

  const handleGlobalMouseMove = useCallback((event: MouseEvent) => {
    if (!entered || !cardRef.current) return
    if (profile.tilt_effect === false) return
    const rect = cardRef.current.getBoundingClientRect()
    const deltaX = (event.clientX - (rect.left + rect.width / 2)) / 34
    const deltaY = (event.clientY - (rect.top + rect.height / 2)) / 34
    setMousePos({ x: deltaX, y: deltaY })
  }, [entered, previewMode, profile.tilt_effect])

  useEffect(() => {
    const handleLeave = () => setMousePos({ x: 0, y: 0 })
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseleave', handleLeave)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseleave', handleLeave)
    }
  }, [handleGlobalMouseMove])

  // Reset tilt when effect is turned off so card snaps back immediately
  useEffect(() => {
    if (profile.tilt_effect === false) setMousePos({ x: 0, y: 0 })
  }, [profile.tilt_effect])

  useEffect(() => {
    if (!currentTrack) return
    setCurrentTime(0)
    setDuration(0)
  }, [currentTrack])

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume
  }, [volume])

  // Sync volume when profile.music_volume changes (e.g., dashboard preview updates)
  useEffect(() => {
    const v = (profile as any).music_volume
    if (typeof v !== 'number') return
    const next = Math.max(0, Math.min(1, v / 100))
    setVolume(next)
    if (audioRef.current) audioRef.current.volume = next
  }, [(profile as any).music_volume])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => undefined)
      setIsPlaying(true)
    } else {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    audioRef.current.muted = !audioRef.current.muted
    setIsMuted(audioRef.current.muted)
    setShowVolumePanel(true)
  }

  const updateVolume = (next: number) => {
    const safe = Math.max(0, Math.min(1, next))
    setVolume(safe)
    setIsMuted(safe === 0)
    if (audioRef.current) {
      audioRef.current.volume = safe
      audioRef.current.muted = safe === 0
    }
  }

  const handlePreviousTrack = () => {
    if (playlist.length <= 1) return
    setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length)
    setIsPlaying(true)
  }

  const handleNextTrack = useCallback(() => {
    if (playlist.length <= 1) return
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length)
    setIsPlaying(true)
  }, [playlist.length])

  const handleTrackEnd = () => {
    if (playlist.length > 1) {
      handleNextTrack()
      return
    }
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    setCurrentTime(audioRef.current.currentTime)
    setDuration(isFinite(audioRef.current.duration) ? audioRef.current.duration : 0)
  }

  // Click OR drag anywhere on the progress bar to seek. Captures the bar
  // rect at pointer-down and tracks pointermove on window so dragging past
  // the bar edges keeps scrubbing (clamped to [0,1]).
  const handleScrubStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = event.currentTarget.getBoundingClientRect()
    const seekTo = (clientX: number) => {
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      if (audioRef.current) audioRef.current.currentTime = ratio * duration
    }
    seekTo(event.clientX)
    const onMove = (e: PointerEvent) => seekTo(e.clientX)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const formatTime = (time: number) => {
    if (!time || Number.isNaN(time)) return '0:00'
    return `${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')}`
  }

  const hoverClass = (() => {
    switch (hoverEffect) {
      case 'glow': return 'hover-glow-card'
      case 'lift': return 'hover-lift-card'
      case 'scale': return 'hover-scale-card'
      case 'pulse': return 'hover-pulse-card'
      case 'shake': return 'hover-shake-card'
      default: return ''
    }
  })()

  const entranceClass = (() => {
    if (!contentVisible) return 'opacity-0 translate-y-8'
    switch (entranceAnimation) {
      case 'none': return 'opacity-100'
      case 'slide': return 'animate-slide-up'
      case 'scale':
      case 'zoom': return 'animate-scale-in'
      case 'bounce': return 'animate-bounce-in'
      default: return 'animate-fade-in'
    }
  })()

  const cardStyles = getCardContainerStyles({
    accentColor,
    backgroundColor: bgColor,
    cardStyle: profile.card_style,
    borderStyle: profile.border_style,
    profileOpacity: profile.profile_opacity,
    profileBlur: profile.profile_blur,
    profileRadius: profile.profile_radius,
    profileBorderColor: profile.profile_border_color,
    profileGradientEnabled: profile.profile_gradient_enabled,
    profileGradientPrimary: profile.profile_gradient_primary,
    profileGradientSecondary: profile.profile_gradient_secondary,
    outlineEnabled: profile.outline_enabled,
    outlineColor: profile.outline_color,
    outlineWidth: profile.outline_width,
    glowColor,
    glowIntensity,
    swapBoxColors,
  })

  // Honor profile_radius if the user explicitly set it; otherwise use responsive default.
  // Music panel mirrors the same setting so when the user picks sharp/pointy corners
  // (radius 0) on the main card, the music card below it doesn't stay rounded and
  // visually disagree with the main panel. Falls back to a slightly tighter default
  // when the user hasn't set a radius - the music card is smaller so a smaller
  // default looks more proportional.
  const panelRadius = profile.profile_radius != null ? profile.profile_radius : (isMobile ? 28 : 34)
  const musicPanelRadius = profile.profile_radius != null ? profile.profile_radius : (isMobile ? 24 : 28)
  const backgroundCardStyle: CSSProperties = { ...cardStyles, borderRadius: panelRadius }
  const {
    backgroundColor: cardBackgroundColor,
    backgroundImage: cardBackgroundImage,
    backdropFilter: cardBackdropFilter,
    WebkitBackdropFilter: cardWebkitBackdropFilter,
    backgroundOrigin: cardBackgroundOrigin,
    backgroundClip: cardBackgroundClip,
    ...cardFrameStyle
  } = backgroundCardStyle

  // backdrop-filter MUST live on the shell element itself (not an inner div) so it
  // samples through the actual page background/wallpaper.  Putting it on a child
  // inside an isolation:isolate parent makes it only see the transparent shell.
  const isBlurredEffect = !previewMode && backgroundEffect === 'blurred'
  const panelBlurFilter = isBlurredEffect
    ? 'blur(24px) saturate(1.8)'
    : ((cardBackdropFilter as string | undefined) || undefined)

  const panelShellStyle: CSSProperties = {
    ...cardFrameStyle,
    borderRadius: panelRadius,
    overflow: 'hidden',
    position: 'relative',
    background: 'transparent',
    // Apply backdrop-filter here so it blurs the actual wallpaper behind the card
    backdropFilter: panelBlurFilter,
    WebkitBackdropFilter: panelBlurFilter,
  }
  // Surface div carries only the background color/image - no backdrop-filter
  const panelSurfaceStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    borderRadius: panelRadius,
    backgroundColor: isBlurredEffect
      ? 'rgba(0, 0, 0, 0.4)'
      : ((cardBackgroundColor as string | undefined) || 'transparent'),
    backgroundImage: isBlurredEffect ? undefined : ((cardBackgroundImage as string | undefined) || undefined),
    backgroundOrigin: cardBackgroundOrigin as CSSProperties['backgroundOrigin'],
    backgroundClip: cardBackgroundClip as CSSProperties['backgroundClip'],
  }
  const musicShellStyle: CSSProperties = {
    ...cardFrameStyle,
    borderRadius: musicPanelRadius,
    overflow: 'hidden',
    position: 'relative',
    background: 'transparent',
    backdropFilter: (cardBackdropFilter as string | undefined) || undefined,
    WebkitBackdropFilter: (cardWebkitBackdropFilter as string | undefined) || undefined,
  }
  const musicSurfaceStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    borderRadius: musicPanelRadius,
    backgroundColor: (cardBackgroundColor as string | undefined) || 'transparent',
    backgroundImage: (cardBackgroundImage as string | undefined) || undefined,
    backgroundOrigin: cardBackgroundOrigin as CSSProperties['backgroundOrigin'],
    backgroundClip: cardBackgroundClip as CSSProperties['backgroundClip'],
  }
  const mainAvatarSize = isMobile ? 104 : 120
  const leftAvatarSize = isMobile ? 88 : 104
  const nameTextShadow = profile.glow_username
    ? `0 0 ${Math.max(10, glowIntensity / 3)}px ${hexToRgba(glowColor, 0.8)}, 0 0 ${Math.max(18, glowIntensity / 1.6)}px ${hexToRgba(glowColor, 0.45)}`
    : undefined
  // Bio glow - three layered text-shadows so the halo reads at
  // every distance:
  //
  //   1. Tight + high-alpha "ink-bleed" that brightens each letter's
  //      edge so the glyphs themselves look lit-from-within.
  //   2. Mid-range halo that gives the description body its colour
  //      cast.
  //   3. Wide, low-alpha bloom that paints the soft pool of light
  //      around the paragraph.
  //
  // Bio text is smaller than the username so the radii are scaled
  // down a touch - the bloom shouldn't overflow into the card
  // chrome. text-shadow inherits through children, so applying it
  // to the bio wrapper covers both <TypingBio> and the markdown-
  // rendered static bio without poking either component.
  const bioTextShadow = (profile as any).glow_description
    ? [
        `0 0 ${Math.max(2, glowIntensity / 16)}px ${hexToRgba(glowColor, 0.95)}`,
        `0 0 ${Math.max(8, glowIntensity / 5)}px ${hexToRgba(glowColor, 0.7)}`,
        `0 0 ${Math.max(18, glowIntensity / 2.2)}px ${hexToRgba(glowColor, 0.38)}`,
      ].join(', ')
    : undefined
  // Display name color: explicit override > swapBoxColors > accentColor
  const nameColor = displayNameColorOverride || (swapBoxColors ? '#ffffff' : accentColor)

  const leftOutsideAvatar = showAvatar && avatarPosition === 'left' && avatarPlacement === 'outside'
  const leftInsideAvatar = showAvatar && avatarPosition === 'left' && avatarPlacement === 'inside'
  const centerOutsideAvatar = showAvatar && avatarPosition === 'center' && avatarPlacement === 'outside'
  const centerInsideAvatar = showAvatar && avatarPosition === 'center' && avatarPlacement === 'inside'
  const hasBio = Boolean((typingBio && bioTexts.length > 0) || profile.bio)
  const equippedBadges = useMemo(() => {
    if (!showBadges) return [] as ProfileBadgeLoadoutItem[]
    const base = [...badgeLoadout].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    // Owner-only crypto loadout for @rez. Hardcoded so they can't be edited
    // off in the dashboard or copied by other users.
    if (userHasCryptoBadges(profile.username)) {
      const hidden = new Set<string>(((profile as any).rez_unequipped_crypto || []) as string[])
      const allowed = getCryptoBadgesForUser(profile.username).filter((c) => !hidden.has(c.slug))
      const lastOrder = base.length ? Math.max(...base.map((b) => b.display_order || 0)) : 0
      const position: LoadoutPosition = base.find((b) => b.position)?.position || 'below_username'
      allowed.forEach((c, i) => {
        base.push({
          badge_id: `rez-crypto-${c.slug}`,
          position,
          display_order: lastOrder + 100 + i,
          badge: {
            id: `rez-crypto-${c.slug}`,
            name: c.name,
            description: c.description,
            icon: c.slug,
            color: c.color,
            glow_color: c.color,
            glow_strength: 12,
            rarity: 'legendary',
          } as Badge,
        })
      })
    }
    return base
  }, [badgeLoadout, showBadges, profile.username, (profile as any).rez_unequipped_crypto])
  const equippedTitles = useMemo(() => {
    if (titleLoadout.length === 0) return [] as ProfileTitleLoadoutItem[]
    return [...titleLoadout].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  }, [titleLoadout])
  const hasContent = hasBio || socialLinks.length > 0 || customButtons.length > 0 || showIdentity || showAvatar || equippedBadges.length > 0 || equippedTitles.length > 0
  const dynamicMinHeight = `${showIdentity === false && showAvatar === false && !hasBio && socialLinks.length === 0 && customButtons.length === 0 ? 96 : leftOutsideAvatar ? (isMobile ? 168 : 200) : centerOutsideAvatar ? (isMobile ? 190 : 230) : hasContent ? (isMobile ? 150 : 190) : 110}px`

  // Avatar geometry - outside layouts now place the avatar's center exactly on
  // the top edge of the card (-translate-y-1/2). The card padding then leaves
  // enough room below the visible half so the name doesn't crash into the
  // avatar.
  const panelPaddingTop = centerOutsideAvatar
    ? (isMobile ? '4.25rem' : '5rem')       // avatarSize/2 (52-60px) + breathing
    : centerInsideAvatar
      ? (isMobile ? '1.35rem' : '1.5rem')
      : leftOutsideAvatar
        ? (isMobile ? '1.6rem' : '2rem')    // name aligns beside avatar's lower half
        : '1.5rem'
  const panelPaddingLeft = leftOutsideAvatar
    ? (isMobile ? '6.5rem' : '7.5rem')      // leftAvatarSize + 24-32px gap
    : '1.5rem'
  // Modern, Portfolio, Bento all use their own opinionated layouts that
  // place the avatar and identity in a specific arrangement regardless of
  // the user's avatar_position toggle. Force left-aligned for those so
  // the username doesn't drift to the center while the avatar is hard-
  // coded to a corner. Currently only Modern qualifies - its avatar is
  // Discord-style left-of-identity.
  // Modern uses a Discord-style header (avatar on the left, identity
  // text-left beside it). Force identityBlock left-aligned regardless
  // of the user's avatar_position setting so the name doesn't drift
  // centre while the avatar is hard-coded to the corner.
  const layoutForcesLeftIdentity = layoutMode === 'modern'
  const effectiveCenter = avatarPosition === 'center' && !layoutForcesLeftIdentity
  const identityAlign = effectiveCenter ? 'items-center text-center' : 'items-start text-left'
  const socialJustify = effectiveCenter ? 'justify-center' : 'justify-start'

  const renderTitleRow = (position: string, compact = false) => {
    const items = equippedTitles.filter((item) => item.position === position && item.title)
    if (items.length === 0) return null
    return (
      <div className={`flex flex-wrap gap-2 ${effectiveCenter ? 'justify-center' : 'justify-start'} ${compact ? '' : ''}`}>
        {items.map((item) => (
          <span
            key={`${position}-${item.title_id}`}
            className={`rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 font-semibold backdrop-blur-md ${compact ? 'text-[11px]' : 'text-xs'}`}
            style={{ color: item.title?.color || '#ffffff', boxShadow: `0 0 16px ${hexToRgba(item.title?.color || accentColor, 0.14)}` }}
          >
            {item.title?.name}
          </span>
        ))}
      </div>
    )
  }

  const renderBadgeRow = (position: string) => {
    const items = equippedBadges.filter((item) => item.position === position && item.badge)
    if (items.length === 0) return null
    // The opacity slider controls the PILL's transparency, not the icons.
    // 100% (default) keeps the original 0.58/0.12 alphas; 0% makes the pill
    // fully see-through while leaving the badge icons fully opaque.
    const pillOpacity = ((profile as any).badge_opacity ?? 100) / 100
    const showPill = pillOpacity > 0
    return (
      <div
        className={`inline-flex flex-wrap items-center gap-1.5 rounded-full px-2 py-1 ${showPill ? 'backdrop-blur-md' : ''} ${effectiveCenter ? 'justify-center self-center' : 'justify-start'}`}
        style={{
          backgroundColor: hexToRgba('#101015', 0.58 * pillOpacity),
          border: showPill ? `1px solid ${hexToRgba('#ffffff', 0.12 * pillOpacity)}` : 'none',
          boxShadow: profile.glow_badges && showPill ? `0 0 12px ${hexToRgba(glowColor, 0.14 * pillOpacity)}` : undefined,
        }}
      >
        {items.map((item) => {
          const badge = item.badge
          return (
            <BadgeTooltip key={`${position}-${badge.id}`} label={badge.name} glowColor={glowColor}>
              <span
                className={`inline-flex h-6 w-6 items-center justify-center ${badge.icon_url ? 'overflow-hidden' : ''}`}
                style={(() => {
                  const userBadgeColor = (profile as any).badge_color
                  const monochromeBadges = (profile as any).monochrome_badges === true
                  const badgeRadius = (profile as any).badge_border_radius ?? 50
                  const badgeBorderEnabled = (profile as any).badge_border_enabled === true
                  const badgeBorderColor = (profile as any).badge_border_color || '#ffffff'
                  const badgeBorderWidth = (profile as any).badge_border_width ?? 1
                  const badgeBorderOpacity = ((profile as any).badge_border_opacity ?? 100) / 100
                  const badgeGlowMult = ((profile as any).badge_glow_strength ?? 50) / 50
                  const finalColor = monochromeBadges ? userBadgeColor || '#ffffff' : (badge.color || '#ffffff')
                  const glowSize = (badge.glow_strength || 14) * badgeGlowMult
                  // Glow color falls back to the badge's display color so badges
                  // that never had a glow_color set (Rich, Inviter, ...) still
                  // glow when the user turns on badge glow. In monochrome mode
                  // everything glows in the user's badge color to match.
                  const glowColorFinal = monochromeBadges ? finalColor : (badge.glow_color || badge.color || finalColor)
                  return {
                    color: finalColor,
                    borderRadius: `${badgeRadius}%`,
                    border: badgeBorderEnabled ? `${badgeBorderWidth}px solid ${hexToRgba(badgeBorderColor, badgeBorderOpacity)}` : undefined,
                    filter: profile.glow_badges ? `drop-shadow(0 0 ${glowSize * 0.5}px ${glowColorFinal}) drop-shadow(0 0 ${glowSize}px ${hexToRgba(glowColorFinal, 0.6)})` : undefined,
                    textShadow: profile.glow_badges ? `0 0 ${glowSize * 0.6}px ${glowColorFinal}` : undefined,
                  } as React.CSSProperties
                })()}
              >
                {badge.icon_url ? <img loading="lazy" decoding="async" src={badge.icon_url} alt="" className="h-full w-full object-contain" /> : <BadgeIcon name={badge.icon || badge.name} className="h-5 w-5" />}
              </span>
            </BadgeTooltip>
          )
        })}
      </div>
    )
  }

  const renderPositionCluster = (position: string) => {
    const titleRow = renderTitleRow(position, true)
    const badgeRow = renderBadgeRow(position)
    if (!titleRow && !badgeRow) return null
    return (
      <div className={`flex flex-col gap-2 ${effectiveCenter ? 'items-center' : 'items-start'}`}>
        {titleRow}
        {badgeRow}
      </div>
    )
  }

  const badgesNextToName = (profile as any).badges_next_to_name === true
  const identityBlock = showIdentity ? (
    <div className={`relative overflow-visible ${identityAlign}`}>
      {/* Badges/titles above username (only when not inline-with-name) */}
      {!badgesNextToName && renderPositionCluster('above_username') ? <div className="relative z-40 mb-3">{renderPositionCluster('above_username')}</div> : null}
      {/* Single name line - promoted from the old small @handle. The big
          "display name" line that used to sit above this was removed (users
          asked for one name only, not display_name + @handle stacked).
          The Username Overlay value (`displayName` here - falls back to the
          raw username) shows after the @. URL/route never changes. */}
      {/* Name + inline-badges row. Grid layout so the username position is
          stable regardless of how many badges are attached:
            - center avatar: 3-col grid [spacer | name | badges] keeps the
              name dead-center and pushes badges into the right column
            - left avatar:   2-col grid [name | badges] anchors the name
              left, badges flow into the right column
          Without grid, flex+wrap+justify-center caused the username to
          shift left as badges were added on the same row. */}
      <div
        className={`grid items-center gap-3 overflow-visible ${
          badgesNextToName
            ? effectiveCenter
              ? 'grid-cols-[1fr_auto_1fr]'
              : 'grid-cols-[auto_1fr]'
            : effectiveCenter
              ? 'grid-cols-1 justify-items-center text-center'
              : 'grid-cols-1 justify-items-start text-left'
        }`}
        style={{ position: 'relative', zIndex: 60 }}
      >
        {/* Left spacer - only rendered for centered avatars with inline
            badges, so the 3-col grid balances visually and the name stays
            in the exact middle. */}
        {badgesNextToName && effectiveCenter ? <span aria-hidden /> : null}
        <button
          ref={uidTriggerRef}
          type="button"
          className="group relative inline-flex items-center gap-1 bg-transparent border-0 p-0 cursor-default"
          onMouseEnter={showUidTooltip}
          onMouseLeave={() => setShowUid(false)}
        >
          <UsernameDisplay
            text={displayName}
            effect={usernameEffect}
            accentColor={accentColor}
            glowUsername={profile.glow_username === true}
            className={isMobile ? 'text-[1.6rem] font-semibold leading-none tracking-tight' : 'text-[1.875rem] font-semibold leading-none tracking-tight'}
            style={{ color: nameColor, textShadow: nameTextShadow, fontFamily: fontApplyUsername }}
          />
        </button>
        {/* UID tooltip - portaled to document.body so it sits above every
            stacking context (avatar, decoration overlay, badges). Position
            comes from the trigger's getBoundingClientRect, captured on
            hover. Mirrors the BadgeTooltip portal pattern above. */}
        {showUid && uidCoords && typeof document !== 'undefined'
          ? createPortal(
              <span
                className="pointer-events-none fixed z-[2147483646] whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium text-white"
                style={{
                  left: uidCoords.x,
                  top: uidCoords.y - 10,
                  transform: 'translate(-50%, -100%)',
                  backgroundColor: 'rgba(58,61,74,0.55)',
                  backdropFilter: 'blur(20px) saturate(150%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  boxShadow: '0 8px 22px -6px rgba(0,0,0,0.45)',
                  animation: 'haloTipIn 130ms ease-out',
                }}
              >
                {uidText}
              </span>,
              document.body,
            )
          : null}
        {badgesNextToName ? (
          // flex-nowrap keeps the inline-with-name badges on a single
          // row. min-w-0 lets the column actually shrink past its
          // content's intrinsic size so a long loadout doesn't push the
          // name out of position; overflow-x-hidden clips anything that
          // doesn't fit instead of wrapping to a second row.
          <span className="relative z-40 inline-flex flex-nowrap items-center gap-1.5 justify-self-start min-w-0 overflow-x-hidden overflow-y-visible">
            {renderPositionCluster('above_username') || renderPositionCluster('below_username')}
          </span>
        ) : null}
      </div>
      {!badgesNextToName && renderPositionCluster('below_username') ? <div className="relative z-40 mt-3">{renderPositionCluster('below_username')}</div> : null}
    </div>
  ) : null

  // The "click to enter" splash. This used to early-return, which meant the
  // entire profile body never rendered on the server for the ~96% of profiles
  // that enable the enter screen: the server shipped only this splash and the
  // browser rebuilt the whole profile client-side after the click. Now it
  // renders as a z-50 overlay ON TOP of the server-rendered body (see the main
  // return below), so the body is in the initial HTML and the splash just fades
  // to reveal already-painted content. entered=false on the server and on the
  // first client render, so hydration matches; handleEnter flips entered.
  // True while the click-to-enter splash is covering the profile. The floating
  // overlays (cursor effects, volume control) belong to the profile body, which
  // now renders underneath the splash, so they must stay unmounted until the
  // visitor enters or they bleed on top of the enter screen.
  const splashActive = enterEnabled && !entered
  const splashScreen = splashActive ? (
      <div
        className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center"
        onClick={handleEnter}
        style={{
          backgroundColor: '#000000',
          fontFamily,
          opacity: splashFading ? 0 : 1,
          transform: splashFading ? 'scale(1.04)' : 'scale(1)',
          filter: splashFading ? 'blur(8px)' : 'blur(0)',
          transition: 'opacity 300ms cubic-bezier(0.22, 1, 0.36, 1), transform 300ms cubic-bezier(0.22, 1, 0.36, 1), filter 300ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <CustomFontFace url={profile.custom_font_url} slots={fontSlots} />
        {profile.background_url && (
          isVideoUrl(profile.background_url)
            ? <BackgroundVideo src={profile.background_url} className={`absolute inset-0 h-full w-full object-cover opacity-35 ${backgroundEffect === 'blurred' ? 'blur-xl scale-110' : ''}`} />
            : <div className={`absolute inset-0 bg-cover bg-center opacity-35 ${backgroundEffect === 'blurred' ? 'blur-xl scale-110' : ''}`} style={{ backgroundImage: cssUrl(profile.background_url) }} />
        )}
        <BackgroundEffectsOverlay effect={backgroundEffect} accentColor={accentColor} glowColor={glowColor} effectColor={profile.background_effect_color} strength={profile.background_effect_strength ?? 50} />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 px-6 text-center">
          {showEnterProfile && profile.avatar_url && (
            <div className="mx-auto mb-6 h-28 w-28 overflow-hidden rounded-full" style={{ ...avatarShapeStyle }}>
              <AvatarMedia src={profile.avatar_url} />
            </div>
          )}
          {showEnterTitle && (
            <UsernameDisplay text={enterTitle} effect={usernameEffect} accentColor={accentColor} glowUsername={profile.glow_username === true} className="text-3xl font-bold text-white" style={{ textShadow: nameTextShadow }} />
          )}
          {showEnterSubtitle ? <p className="mt-3 text-sm text-white/45 animate-pulse">{enterSubtitle}</p> : null}
        </div>
      </div>
  ) : null

  // Like / dislike thumbs, pinned to the card's bottom-right (opposite the
  // views chip). Defined once at the top level so both the Haunt layouts
  // (via sharedHauntProps) and the Classic/Modern card can mount it. Hidden
  // when the owner turned the Likes & Dislikes toggle off.
  const likePanel = (profile.show_likes === true) ? (
    <LikeDislike
      username={profile.username || ''}
      initialLikes={profile.likes_count || 0}
      initialDislikes={profile.dislikes_count || 0}
      accentColor={accentColor}
      previewMode={previewMode}
      isMobile={isMobile}
      style={{ right: isMobile ? 8 : 12, bottom: isMobile ? 8 : 12 }}
    />
  ) : null

  return (
    <div
      className={previewMode ? undefined : `fixed inset-0 overflow-hidden ${useCustomCursorOverlay ? 'custom-cursor-active' : ''}`}
      style={previewMode
        ? { fontFamily, position: 'relative', width: '100%' }
        : { backgroundColor: '#09090f', fontFamily }}
    >
      {/* Splash overlay (z-50) sits on top of the server-rendered body and
          fades out on click to reveal it. Null once entered / when disabled. */}
      {splashScreen}
      <CustomFontFace url={profile.custom_font_url} slots={fontSlots} />

      {musicEnabled && currentTrack && (
        <audio
          key={currentTrack.id}
          ref={audioRef}
          src={currentTrack.url}
          muted={isMuted}
          preload="auto"
          onLoadedMetadata={handleTimeUpdate}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleTrackEnd}
          loop={playlist.length === 1}
        />
      )}

      {!previewMode && enterSoundUrl && (
        <audio ref={enterSoundRef} src={enterSoundUrl} preload="auto" />
      )}
      {!previewMode && clickSoundUrl && (
        <audio ref={clickSoundRef} src={clickSoundUrl} preload="auto" />
      )}

      {!previewMode && profile.background_url && (
        isVideoUrl(profile.background_url)
          ? <BackgroundVideo src={profile.background_url} restartOn={videoRestart} className={`absolute inset-0 h-full w-full object-cover ${backgroundEffect === 'blurred' ? 'blur-xl scale-110' : ''}`} />
          : <div className={`absolute inset-0 bg-cover bg-center ${backgroundEffect === 'blurred' ? 'blur-xl scale-110' : ''}`} style={{ backgroundImage: cssUrl(profile.background_url) }} />
      )}
      {!previewMode && <BackgroundEffectsOverlay effect={backgroundEffect} accentColor={accentColor} glowColor={glowColor} effectColor={profile.background_effect_color} strength={profile.background_effect_strength ?? 50} />}
      {!previewMode && <div className="absolute inset-0 bg-black/28" />}

      {!previewMode && !splashActive && (
        (cursorEffect && cursorEffect !== 'none') ||
        customCursorUrl ||
        hoverCursorUrl ||
        (cursorClickEffect && cursorClickEffect !== 'none')
      ) ? (
        <CursorEffectsLayer
          cursorEffect={cursorEffect}
          cursorColor={cursorColor}
          clickEffect={cursorClickEffect}
          clickColor={cursorClickColor}
          customCursorUrl={customCursorUrl}
          hoverCursorUrl={hoverCursorUrl}
          ghostUseCustomCursor={true}
        />
      ) : null}

      {musicEnabled && volumeControl && !previewMode && !splashActive && (
        <div className={`fixed z-50 ${isMobile ? 'left-3 top-3' : 'left-6 top-6'}`} onMouseEnter={() => setShowVolumePanel(true)} onMouseLeave={() => setShowVolumePanel(false)}>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            aria-pressed={isMuted}
            className={`flex items-center justify-center rounded-xl border border-white/10 bg-black/50 text-white/70 backdrop-blur-sm transition hover:text-white ${isMobile ? 'h-10 w-10' : 'h-12 w-12'}`}
          >
            {isMuted ? <IconVolumeOff className="h-5 w-5" /> : <IconVolume className="h-5 w-5" />}
          </button>
          {showVolumePanel && (
            <div className="mt-2 w-28 rounded-2xl border border-white/10 bg-black/55 p-3 backdrop-blur-md">
              <input type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={(e) => updateVolume(Number(e.target.value) / 100)} className="w-full accent-white" aria-label="Volume" />
            </div>
          )}
        </div>
      )}

      {/* Synced lyrics: a Spotify-style overlay that highlights and
          auto-scrolls in time with the current track. Toggle button + overlay,
          shown only when the playing track actually carries lyrics. */}
      {!previewMode && contentVisible && currentTrack?.lyrics ? (
        <>
          <button
            type="button"
            onClick={() => setShowLyrics((v) => !v)}
            className={`fixed z-50 flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-medium text-white/70 backdrop-blur-sm transition hover:text-white ${isMobile ? 'bottom-3 left-3' : 'bottom-6 left-6'}`}
          >
            <IconFileText className="h-4 w-4" /> Lyrics
          </button>
          {showLyrics ? (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md" onClick={() => setShowLyrics(false)}>
              <div
                className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0f]/95 shadow-2xl"
                style={{ fontFamily }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 border-b border-white/[0.06] p-5">
                  {currentTrack.cover_url ? <img src={currentTrack.cover_url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{currentTrack.title || 'Untitled'}</p>
                    <p className="truncate text-xs text-white/50">{currentTrack.artist || ''}</p>
                  </div>
                  <button type="button" onClick={() => setShowLyrics(false)} className="text-white/40 transition hover:text-white" aria-label="Close lyrics"><IconX className="h-5 w-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-6">
                  <SyncedLyrics lrc={currentTrack.lyrics} currentTime={currentTime} accentColor={accentColor} />
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <div className={previewMode ? 'relative w-full' : 'absolute inset-0 overflow-y-auto'}>
        <div
          className={`relative z-20 flex justify-center ${previewMode ? '' : `min-h-full px-4 py-10`}`}
          style={{
            alignItems: 'center',
            paddingTop: previewMode ? 0 : (isMobile ? '1.5rem' : '2rem'),
            paddingBottom: previewMode ? 0 : (isMobile ? '2rem' : '2.5rem'),
          }}
        >
          <div
            ref={cardRef}
            className={`w-full ${layoutMode === 'modern' ? 'layout-modern' : 'layout-default'}`}
            style={{
              maxWidth: previewMode
                ? '100%'
                : isMobile
                  ? '100%'
                  : useHauntLayout
                    ? '780px'
                    : layoutMode === 'modern'
                      ? '780px'
                      : getPanelMaxWidth(panelSize),
              marginTop: centerOutsideAvatar ? (isMobile ? '1rem' : '1.5rem') : leftOutsideAvatar ? (isMobile ? '0.6rem' : '1rem') : '0',
              // NOTE: transformStyle:'preserve-3d' is intentionally omitted - it creates a 3D
              // rendering context that prevents backdrop-filter from working on child elements.
              // The tilt effect is a flat 2D rotation and does not need preserve-3d.
              transform: contentVisible && profile.tilt_effect !== false && (mousePos.x !== 0 || mousePos.y !== 0)
                ? `perspective(1200px) rotateY(${mousePos.x}deg) rotateX(${-mousePos.y}deg)`
                : undefined,
              transition: 'transform 120ms ease-out',
            }}
          >
            <div className={`relative z-20 ${entranceClass}`}>
              {/* Polished new layouts (test-user allowlist only). They
                  share a single props shape (HauntLayoutProps) so swapping
                  layoutMode is a one-line component swap. Identity + bio
                  are passed pre-rendered so the components don't have to
                  re-implement the UID tooltip + multi-font / typing-bio
                  fork. Classic (default) is intentionally NOT in this
                  set - it keeps its original render for everyone. */}
              {useHauntLayout && (() => {
                // text-shadow inherits to descendants, so wrapping the
                // bio node in a single span propagates the glow to
                // whichever variant we pick (typing or static markdown).
                // Span is inline so it doesn't disrupt the layout
                // Modern wraps this in.
                const bioInner = (typingBio && bioTexts.length > 0)
                  ? <TypingBio texts={bioTexts} speed={typingSpeed} color={hexToRgba(bioColor, 0.84)} />
                  : profile.bio
                    ? <div style={{ fontFamily: fontApplyBio }} dangerouslySetInnerHTML={{ __html: renderBioMarkdown(profile.bio) }} />
                    : null
                const bioBlock = bioInner
                  ? <span style={{ textShadow: bioTextShadow }}>{bioInner}</span>
                  : null
                // One WidgetsPanel instance shared across whichever
                // Haunt* layout we route to. Constructing it here (not
                // inside each layout component) lets the widget data
                // fetch happen once even as someone switches layout in
                // the live preview iframe.
                const widgetsPanel = (
                  <WidgetsPanel
                    userId={profile.id}
                    displayMode={profile.widget_display_mode ?? 'carousel'}
                  />
                )
                // Modern uses banner_url as its header image; the
                // others ignore it. Videos can't render as <img> so
                // we collapse them to null up here.
                const bannerUrl = profile.banner_url && !isVideoUrl(profile.banner_url) ? profile.banner_url : null
                // Views + location pill. Same JSX shape as Classic's
                // floating chip - already absolutely-positioned via
                // getViewsPositionStyle so the layout just needs to
                // splice this node into a relative-positioned
                // ancestor (banner area for Modern, hero for
                // Portfolio, top-of-column for Minimal). Null when
                // all three relevant fields resolve to hidden.
                const viewsPanel = (profile.show_view_count !== false || profile.location || (profile as any).show_join_date) ? (
                  <ViewsLocationChip
                    showViews={profile.show_view_count !== false}
                    viewCount={profile.view_count || 0}
                    animate={animateViewCount}
                    location={profile.location}
                    locationColor={(profile as any).location_color || undefined}
                    badgeBg={!!viewsBadgeBackground}
                    isMobile={isMobile}
                    style={getViewsPositionStyle(viewsLocationPosition, isMobile)}
                  />
                ) : null
                // Inline music card - same JSX shape Classic renders
                // (guns-profile.tsx music-card branch). All state
                // (audioRef, currentTrack, isPlaying, currentTime,
                // duration, handlers) is closed over from the
                // orchestrator scope so the card stays in sync with
                // the viewport-bottom audio bar.
                const musicCard = (musicEnabled && currentTrack && !(p as any).music_hide_panel) ? (
                  <div className={`relative z-20 transition-all duration-500 ${isMobile ? 'mt-5' : 'mt-8'}`} style={{ opacity: contentVisible ? 1 : 0, transform: contentVisible ? 'translateY(0)' : 'translateY(10px)' }}>
                    <div className="relative" style={{ ...musicShellStyle, minHeight: undefined }}>
                      <div aria-hidden className="absolute inset-0" style={musicSurfaceStyle} />
                      <div className="relative z-10 px-4 py-3">
                        <div className="flex items-center gap-3">
                          {(p as any).music_show_cover && currentTrack.cover_url && (
                            <div
                              className={`flex-shrink-0 overflow-hidden ${isMobile ? 'h-14 w-14' : 'h-16 w-16'} ${currentTrack.display_as_record ? 'rounded-full' : 'rounded-lg'} ${currentTrack.display_as_record && currentTrack.spin_record ? 'animate-spin' : ''}`}
                              style={currentTrack.display_as_record && currentTrack.spin_record ? { animationDuration: '3s' } : undefined}
                            >
                              {/\.(mp4|webm|mov)(\?|$)/i.test(currentTrack.cover_url) ? (
                                <BackgroundVideo src={currentTrack.cover_url} className="h-full w-full object-cover" />
                              ) : (
                                <img loading="lazy" decoding="async" src={currentTrack.cover_url} alt="cover" className="h-full w-full object-cover" />
                              )}
                            </div>
                          )}
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5" style={{ fontFamily: fontApplyMusic }}>
                            {(((p.music_show_title !== false) || (p.music_show_artist !== false)) || ((p as any).music_show_cover && currentTrack.cover_url)) && (
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  {p.music_show_title !== false ? <div className={`truncate font-semibold ${isMobile ? 'text-xs' : 'text-sm'}`} style={{ color: hexToRgba(musicTextColor, 0.92) }}>{currentTrack.title || profile.music_title || 'Track'}</div> : null}
                                  {p.music_show_artist !== false ? <div className="truncate text-xs" style={{ color: hexToRgba(musicTextColor, 0.6) }}>{currentTrack.artist || profile.music_artist || 'Unknown artist'}</div> : null}
                                </div>
                                <div className="flex shrink-0 items-center gap-1" style={{ color: hexToRgba(musicTextColor, 0.6) }}>
                                  <IconPlaylist className="h-3.5 w-3.5" />
                                  <span className="text-xs">{currentTrackIndex + 1}/{playlist.length}</span>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <div className="min-w-[32px] shrink-0 text-xs" style={{ color: hexToRgba(musicTextColor, 0.65) }}>{formatTime(currentTime)}</div>
                              <div
                                className={`group relative flex-1 cursor-pointer rounded-full bg-white/20 ${isMobile ? 'h-1.5' : 'h-1'}`}
                                style={isMobile ? { touchAction: 'none' } : undefined}
                                onPointerDown={handleScrubStart}
                              >
                                <div className="h-full rounded-full transition-all" style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%', backgroundColor: accentColor }} />
                                <div className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-[0_0_6px_rgba(0,0,0,0.4)] transition-opacity group-hover:opacity-100" style={{ left: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
                              </div>
                              <div className="min-w-[32px] shrink-0 text-right text-xs" style={{ color: hexToRgba(musicTextColor, 0.65) }}>{formatTime(duration)}</div>
                              <div className={`flex shrink-0 items-center ${isMobile ? 'gap-1.5' : 'gap-1'}`}>
                                <button type="button" onClick={handlePreviousTrack} aria-label="Previous track" className={`flex items-center justify-center text-white/50 hover:text-white disabled:opacity-40 ${isMobile ? 'h-8 w-8' : 'h-6 w-6'}`} disabled={playlist.length <= 1}><IconPlayerSkipBack className={isMobile ? 'h-3.5 w-3.5' : 'h-3 w-3'} /></button>
                                <button type="button" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} aria-pressed={isPlaying} className={`flex items-center justify-center text-white/70 hover:text-white ${isMobile ? 'h-8 w-8' : 'h-7 w-7'}`}>{isPlaying ? <IconPlayerPause className={isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} /> : <IconPlayerPlay className={isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} />}</button>
                                <button type="button" onClick={handleNextTrack} aria-label="Next track" className={`flex items-center justify-center text-white/50 hover:text-white disabled:opacity-40 ${isMobile ? 'h-8 w-8' : 'h-6 w-6'}`} disabled={playlist.length <= 1}><IconPlayerSkipForward className={isMobile ? 'h-3.5 w-3.5' : 'h-3 w-3'} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null
                const sharedHauntProps = {
                  profile,
                  socialLinks,
                  badges,
                  customButtons,
                  musicTracks,
                  accentColor,
                  textColor,
                  iconColor,
                  glowColor,
                  glowIntensity,
                  displayName,
                  identityBlock,
                  bioBlock,
                  hasBio,
                  fontApplyBio,
                  widgetsPanel,
                  bannerUrl,
                  viewsPanel,
                  likePanel,
                  viewsLocationPosition,
                  musicCard,
                  // Card chrome so haunt layouts react to the user's
                  // Profile Opacity / Profile Blur sliders. Modern
                  // previously hardcoded a fixed glass effect that
                  // ignored these settings entirely.
                  panelShellStyle,
                  panelSurfaceStyle,
                }
                if (layoutMode === 'modern') return <HauntModern {...sharedHauntProps} />
                return null
              })()}
              {!useHauntLayout && (
              <div className={`relative overflow-visible ${hoverClass}`} style={{ '--hover-effect-color': hoverEffectColor, borderRadius: panelRadius } as React.CSSProperties}>
                {likePanel}
                {centerOutsideAvatar && layoutMode === 'default' && (
                  <div
                    className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-1/2"
                    style={{ width: mainAvatarSize, height: mainAvatarSize }}
                  >
                    <AvatarWithDecoration
                      size={mainAvatarSize}
                      decorationSlug={(profile as any).avatar_decoration_hash}
                      avatarShapeStyle={avatarShapeStyle}
                      ringStyle={avatarRingStyle}
                    >
                      {profile.avatar_url ? <AvatarMedia src={profile.avatar_url} /> : <div className="flex h-full w-full items-center justify-center text-2xl font-bold" style={{ backgroundColor: hexToRgba(accentColor, 0.2), color: accentColor }}>{displayName[0]?.toUpperCase()}</div>}
                    </AvatarWithDecoration>
                  </div>
                )}

                {leftOutsideAvatar && layoutMode === 'default' && (
                  <div
                    className={`pointer-events-none absolute z-30 ${isMobile ? 'left-4 top-0 -translate-y-1/2' : 'left-6 top-0 -translate-y-1/2'}`}
                    style={{ width: leftAvatarSize, height: leftAvatarSize }}
                  >
                    <AvatarWithDecoration
                      size={leftAvatarSize}
                      decorationSlug={(profile as any).avatar_decoration_hash}
                      avatarShapeStyle={avatarShapeStyle}
                      ringStyle={avatarRingStyle}
                    >
                      {profile.avatar_url ? <AvatarMedia src={profile.avatar_url} /> : <div className="flex h-full w-full items-center justify-center text-2xl font-bold" style={{ backgroundColor: hexToRgba(accentColor, 0.2), color: accentColor }}>{displayName[0]?.toUpperCase()}</div>}
                    </AvatarWithDecoration>
                  </div>
                )}

                {/* View count badge - TOP positions only: floats at card corner at z-31 (above avatar at z-30) */}
                {layoutMode === 'default' && (viewsLocationPosition === 'top-left' || viewsLocationPosition === 'top-right') && (profile.show_view_count !== false || profile.location || (profile as any).show_join_date) && (
                  <ViewsLocationChip
                    showViews={profile.show_view_count !== false}
                    viewCount={profile.view_count || 0}
                    animate={animateViewCount}
                    location={profile.location}
                    locationColor={(profile as any).location_color || undefined}
                    badgeBg={!!viewsBadgeBackground}
                    isMobile={isMobile}
                    style={getViewsPositionStyle(viewsLocationPosition, isMobile)}
                  />
                )}

                <div className="relative" style={{ ...panelShellStyle, minHeight: dynamicMinHeight }}>
                  <div aria-hidden className="absolute inset-0" style={panelSurfaceStyle} />

                  {/* ── MODERN layout: full-width banner header + content below ── */}
                  {layoutMode === 'modern' && (
                    <div className="relative z-10">
                      {/* Banner - gradient by default (the previous blurred-
                          avatar trick produced a muddy dark area when the
                          avatar was small/dark). If the user uploaded a
                          dedicated banner_url, we render that; videos are
                          skipped because <img> can't display them. */}
                      <div className="relative h-28 w-full overflow-hidden" style={{ borderRadius: `${panelRadius}px ${panelRadius}px 0 0` }}>
                        {profile.banner_url && !isVideoUrl(profile.banner_url) ? (
                          <img decoding="async" src={profile.banner_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div
                            className="h-full w-full"
                            style={{
                              background: `linear-gradient(135deg, ${hexToRgba(accentColor, 0.55)} 0%, ${hexToRgba(glowColor, 0.28)} 60%, ${hexToRgba('#0b0b12', 0.6)} 100%)`,
                            }}
                          />
                        )}
                        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 40%, ${hexToRgba('#000000', 0.55)})` }} />
                        {/* View count + location pinned to the banner. */}
                        <ViewsLocationChip
                          showViews={profile.show_view_count !== false}
                          viewCount={profile.view_count || 0}
                          animate={animateViewCount}
                          location={profile.location}
                          locationColor={(profile as any).location_color || undefined}
                          badgeBg
                          isMobile
                          style={getViewsPositionStyle(viewsLocationPosition, true)}
                        />
                      </div>
                      {/* Avatar + identity row, Discord-style: avatar
                          overlaps the banner-content seam, identity sits
                          to the right. Always text-left here - the rest
                          of the layout has its own opinionated alignment
                          and ignores avatar_position. */}
                      <div className="flex items-end gap-4 px-5 -mt-9">
                        {showAvatar && (
                          <div
                            className="shrink-0 overflow-hidden rounded-full ring-4"
                            style={{ width: 80, height: 80, ...avatarShapeStyle, boxShadow: `0 0 0 4px ${hexToRgba('#0b0b12', 0.9)}` }}
                          >
                            {profile.avatar_url ? (
                              <AvatarMedia src={profile.avatar_url} />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-2xl font-bold" style={{ backgroundColor: hexToRgba(accentColor, 0.2), color: accentColor }}>{displayName[0]?.toUpperCase()}</div>
                            )}
                          </div>
                        )}
                        <div className="min-w-0 flex-1 pb-1 text-left">
                          {identityBlock}
                        </div>
                      </div>
                      {/* Bio + links + buttons + widgets, all left-aligned. */}
                      <div className="px-5 pb-5 pt-4 text-left">
                        {hasBio && (
                          <div className="mt-2 mb-4 text-lg leading-relaxed" style={{ color: hexToRgba(bioColor, 0.84), textShadow: bioTextShadow }}>
                            {typingBio && bioTexts.length > 0 ? <TypingBio texts={bioTexts} speed={typingSpeed} color={hexToRgba(bioColor, 0.84)} /> : profile.bio ? <div style={{ fontFamily: fontApplyBio }} dangerouslySetInnerHTML={{ __html: renderBioMarkdown(profile.bio) }} /> : null}
                          </div>
                        )}
                        {renderPositionCluster('above_links') ? <div className="mb-3">{renderPositionCluster('above_links')}</div> : null}
                        {socialLinks.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2.5 mt-3">
                            {socialLinks.map((link) => {
                              // Per-icon brand color drives the glow halo so
                              // Spotify glows green, Twitch purple, etc.
                              // Falls back to glow_color/accent when the
                              // platform has no brand entry, or when the
                              // user opts into `socials_glow_mono`.
                              const brand = brandColors[link.platform.toLowerCase()] || null
                              const wrapperStyle = getSocialIconWrapperStyle({
                                accentColor,
                                textColor,
                                glowSocials: profile.glow_socials,
                                glowColor,
                                glowIntensity,
                                swapBoxColors,
                                noBackground: (profile as any).social_icons_no_background,
                                iconGlowColor: brand,
                                monoGlow: (profile as any).socials_glow_mono === true,
                              })
                              const resolvedColor = monochromeIcons ? iconColor : (brand || iconColor)
                              const href = buildSocialHref(link.platform, link.url)
                              return (
                                <HoverTooltip key={link.id} label={link.label || link.platform}>
                                <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => fetch('/api/track-click', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({user_id:profile.id, link_type:'social', link_id:link.id}), keepalive:true }).catch(()=>{})} className="flex h-12 w-12 items-center justify-center rounded-lg transition-all hover:scale-110" style={wrapperStyle} aria-label={link.label || link.platform}>
                                  {link.platform === 'custom' && link.icon_url ? <img loading="lazy" decoding="async" src={link.icon_url} alt={link.label||''} className="max-h-full max-w-full rounded-md object-contain p-1.5" /> : <SocialIcon platform={link.platform} className={socialIconClass} style={{ color: resolvedColor }} />}
                                </a>
                                </HoverTooltip>
                              )
                            })}
                          </div>
                        )}
                        {customButtons.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {customButtons.map((button) => {
                              const buttonHref = safeButtonHref(button.url)
                              return (
                                <a key={button.id} href={buttonHref} aria-label={button.label} target="_blank" rel="noopener noreferrer" onClick={() => fetch('/api/track-click', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({user_id:profile.id, link_type:'button', link_id:button.id}), keepalive:true }).catch(()=>{})} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:scale-[1.02]" style={getButtonStyle(button, { accentColor, textColor, outlineEnabled: profile.outline_enabled, outlineColor: profile.outline_color, glowColor, glowIntensity, swapBoxColors })}>
                                  {button.media_url ? <img loading="lazy" decoding="async" src={button.media_url} alt="" className="h-6 w-6 rounded object-cover" /> : null}
                                  <span>{button.label}</span>
                                  <IconExternalLink className="h-3.5 w-3.5 opacity-70" />
                                </a>
                              )
                            })}
                          </div>
                        )}
                        {renderPositionCluster('below_links') ? <div className="mt-3">{renderPositionCluster('below_links')}</div> : null}
                        <WidgetsPanel userId={profile.id} displayMode={profile.widget_display_mode ?? 'carousel'} />
                      </div>
                    </div>
                  )}

                  {/* Portfolio layout fully removed. Stale `layout_mode === 'portfolio'`
                      values fall back to 'default' in the layoutMode resolver
                      above, so this branch never renders. */}

                  {/* ── DEFAULT layout (existing rendering) ── */}
                  {layoutMode === 'default' && <>

                  <div className={`relative z-10 p-6 ${avatarPosition === 'center' ? 'text-center' : 'text-left'}`} style={{ paddingTop: panelPaddingTop, paddingLeft: panelPaddingLeft, paddingRight: '1.5rem' }}>
                    {/* Left + Inside - avatar and identity side-by-side (Discord-style header).
                        Wraps the avatar in AvatarWithDecoration so the
                        equipped decoration (cat ears, butterflies, …)
                        survives a Position=left or Placement=inside
                        toggle - previously this branch rendered a plain
                        <img> and silently dropped the overlay. */}
                    {leftInsideAvatar ? (
                      <div className="mb-4 flex items-center gap-4">
                        <div className="shrink-0">
                          <AvatarWithDecoration
                            size={leftAvatarSize}
                            decorationSlug={(profile as any).avatar_decoration_hash}
                            avatarShapeStyle={avatarShapeStyle}
                      ringStyle={avatarRingStyle}
                          >
                            {profile.avatar_url ? <AvatarMedia src={profile.avatar_url} /> : <div className="flex h-full w-full items-center justify-center text-2xl font-bold" style={{ backgroundColor: hexToRgba(accentColor, 0.2), color: accentColor }}>{displayName[0]?.toUpperCase()}</div>}
                          </AvatarWithDecoration>
                        </div>
                        <div className="min-w-0 flex-1">
                          {identityBlock}
                        </div>
                      </div>
                    ) : (
                      <>
                        {centerInsideAvatar && (
                          <div className="mb-4 flex justify-center">
                            <AvatarWithDecoration
                              size={mainAvatarSize}
                              decorationSlug={(profile as any).avatar_decoration_hash}
                              avatarShapeStyle={avatarShapeStyle}
                      ringStyle={avatarRingStyle}
                            >
                              {profile.avatar_url ? <AvatarMedia src={profile.avatar_url} /> : <div className="flex h-full w-full items-center justify-center text-2xl font-bold" style={{ backgroundColor: hexToRgba(accentColor, 0.2), color: accentColor }}>{displayName[0]?.toUpperCase()}</div>}
                            </AvatarWithDecoration>
                          </div>
                        )}

                        {identityBlock}
                      </>
                    )}

                    {hasBio && (
                      <div className={`mt-3 mb-5 min-h-[1.5em] text-lg leading-relaxed ${avatarPosition === 'center' ? 'text-center' : 'text-left'}`} style={{ color: hexToRgba(bioColor, 0.84), textShadow: bioTextShadow }}>
                        {typingBio && bioTexts.length > 0 ? <TypingBio texts={bioTexts} speed={typingSpeed} color={hexToRgba(bioColor, 0.84)} /> : profile.bio ? <div style={{ fontFamily: fontApplyBio }} dangerouslySetInnerHTML={{ __html: renderBioMarkdown(profile.bio) }} /> : null}
                      </div>
                    )}

                    {renderPositionCluster('above_links') ? <div className="mb-4">{renderPositionCluster('above_links')}</div> : null}

                    {socialLinks.length > 0 && (
                      <div className={`flex flex-wrap items-center gap-3 mt-4 ${socialJustify}`}>
                        {socialLinks.map((link) => {
                          // Brand-color glow per icon (Spotify green,
                          // YouTube red, …). `socials_glow_mono`
                          // collapses every icon's glow back to a
                          // single Glow Color when the user prefers
                          // that legacy look.
                          const brand = brandColors[link.platform.toLowerCase()] || null
                          const wrapperStyle = getSocialIconWrapperStyle({
                            accentColor,
                            textColor,
                            glowSocials: profile.glow_socials,
                            glowColor,
                            glowIntensity,
                            swapBoxColors,
                            noBackground: (profile as any).social_icons_no_background,
                            iconGlowColor: brand,
                            monoGlow: (profile as any).socials_glow_mono === true,
                          })
                          const resolvedColor = monochromeIcons ? iconColor : (brand || iconColor)
                          const cryptoIds = ['btc','eth','ltc','sol','xmr']
                          const isCrypto = cryptoIds.includes(link.platform.toLowerCase())
                          const href = buildSocialHref(link.platform, link.url)

                          const iconNode = link.platform === 'custom' && link.icon_url ? (
                            <div className="flex h-full w-full items-center justify-center p-2">
                              <img loading="lazy" decoding="async" src={link.icon_url} alt={link.label || 'Custom link'} className="max-h-full max-w-full rounded-md object-contain" />
                            </div>
                          ) : (
                            <SocialIcon platform={link.platform} className={`${isMobile && !noBgIcons ? 'h-[18px] w-[18px]' : socialIconClass}`} style={{ color: resolvedColor }} />
                          )

                          if (isCrypto) {
                            return (
                              <HoverTooltip key={link.id} label={`Click to copy ${link.platform.toUpperCase()} address`}>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault()
                                  // Per-link throttle: silently ignore clicks
                                  // landing inside the cooldown window so an
                                  // auto-clicker can't stack toasts.
                                  const now = Date.now()
                                  const last = lastCryptoCopyRef.current.get(link.id) ?? 0
                                  if (now - last < COPY_COOLDOWN_MS) return
                                  lastCryptoCopyRef.current.set(link.id, now)
                                  try {
                                    await navigator.clipboard.writeText(link.url)
                                    // Stable `id` so the toast replaces itself
                                    // on rapid valid clicks instead of stacking.
                                    toast.success(`${link.platform.toUpperCase()} address copied`, {
                                      id: `crypto-copy-${link.id}`,
                                      description: link.url,
                                      duration: 2500,
                                    })
                                  } catch {
                                    toast.error('Could not copy to clipboard', {
                                      id: `crypto-copy-err-${link.id}`,
                                    })
                                  }
                                }}
                                data-label={link.platform.toUpperCase()}
                                className={`flex items-center justify-center rounded-lg transition-all hover:scale-110 ${isMobile ? 'h-12 w-12' : 'h-12 w-12'}`}
                                style={wrapperStyle}
                              >
                                {iconNode}
                              </button>
                              </HoverTooltip>
                            )
                          }

                          // Custom links go through the confirmation dialog
                          // because the URL is arbitrary user input. Regular
                          // platforms (Twitter, etc.) navigate directly since
                          // the URL is built from a trusted template + the
                          // username field.
                          const isCustom = link.platform === 'custom'

                          if (isCustom) {
                            return (
                              <HoverTooltip key={link.id} label={link.label || 'Custom link'}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  setLinkConfirm({ url: href, linkId: link.id })
                                }}
                                className={`flex items-center justify-center rounded-lg transition-all hover:scale-110 ${isMobile ? 'h-12 w-12' : 'h-12 w-12'}`}
                                style={wrapperStyle}
                                aria-label={link.label || 'Custom link'}
                              >
                                {iconNode}
                              </button>
                              </HoverTooltip>
                            )
                          }

                          return (
                            <HoverTooltip key={link.id} label={link.label || link.platform}>
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                // Fire-and-forget click tracking
                                fetch('/api/track-click', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ user_id: profile.id, link_type: 'social', link_id: link.id }),
                                  keepalive: true,
                                }).catch(() => {})
                              }}
                              className={`flex items-center justify-center rounded-lg transition-all hover:scale-110 ${isMobile ? 'h-12 w-12' : 'h-12 w-12'}`}
                              style={wrapperStyle}
                              aria-label={link.label || link.platform}
                            >
                              {iconNode}
                            </a>
                            </HoverTooltip>
                          )
                        })}
                      </div>
                    )}

                    {customButtons.length > 0 && (
                      <div className="mt-4 space-y-2.5">
                        {customButtons.map((button) => {
                          const buttonHref = safeButtonHref(button.url)
                          return (
                          <a
                            key={button.id}
                            href={buttonHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              fetch('/api/track-click', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ user_id: profile.id, link_type: 'button', link_id: button.id }),
                                keepalive: true,
                              }).catch(() => {})
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-center text-sm font-semibold transition hover:scale-[1.02]"
                            style={getButtonStyle(button, {
                              accentColor,
                              textColor,
                              outlineEnabled: profile.outline_enabled,
                              outlineColor: profile.outline_color,
                              glowColor,
                              glowIntensity,
                              swapBoxColors,
                            })}
                          >
                            {button.media_url ? <img loading="lazy" decoding="async" src={button.media_url} alt="" className="h-7 w-7 rounded object-cover" /> : null}
                            <span>{button.label}</span>
                            <IconExternalLink className="h-3.5 w-3.5 opacity-70" />
                          </a>
                        )})}
                      </div>
                    )}

                    {renderPositionCluster('below_links') ? <div className="mt-4">{renderPositionCluster('below_links')}</div> : null}
                    <WidgetsPanel userId={profile.id} displayMode={profile.widget_display_mode ?? 'carousel'} />

                    {/* BOTTOM view count - flows after all card content, styled as pill to match TOP */}
                    {(viewsLocationPosition === 'bottom-left' || viewsLocationPosition === 'bottom-right') && (profile.show_view_count !== false || profile.location) && (
                      <div className={`mt-4 flex ${viewsLocationPosition === 'bottom-right' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 ${isMobile ? 'text-xs' : 'text-sm'}`} style={{ color: viewsBadgeBackground ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.7)', background: viewsBadgeBackground ? 'rgba(0,0,0,0.38)' : 'transparent', backdropFilter: viewsBadgeBackground ? 'blur(10px)' : undefined, WebkitBackdropFilter: viewsBadgeBackground ? 'blur(10px)' : undefined }}>
                          {profile.show_view_count !== false && (
                            <span className="flex items-center gap-1">
                              <IconEye className="h-3 w-3" />
                              <AnimatedViewCount target={profile.view_count || 0} animate={animateViewCount} />
                            </span>
                          )}
                          {profile.location && (
                            // Match the top-pill behaviour (see
                            // the top variant ~340 lines up): only
                            // override when the user explicitly
                            // picked a Location colour so the pill
                            // wrapper's semi-transparent white wins
                            // by default.
                            <span className="flex items-center gap-1" style={{ color: profile.location_color || undefined }}>
                              <IconMapPin className="h-3 w-3" />
                              {profile.location}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  </>}

                  {/* Minimal layout fully removed. Stale `layout_mode === 'minimal'`
                      values fall back to 'default' in the layoutMode resolver
                      above, so this branch never needs to render. */}
                </div>
              </div>
              )}
            </div>

            {/* Inline music card. Gated on `!useHauntLayout` because
                HauntModern receives the same JSX via the `musicCard`
                prop and renders it inside its own content stack - if
                we let this branch fire too, Modern users see a
                duplicate player. Classic + any future legacy layout
                continues to use this path. */}
            {!useHauntLayout && musicEnabled && currentTrack && !(p as any).music_hide_panel && (
              <div className={`relative z-20 transition-all duration-500 ${isMobile ? 'mt-5' : 'mt-8'}`} style={{ opacity: contentVisible ? 1 : 0, transform: contentVisible ? 'translateY(0)' : 'translateY(10px)' }}>
                <div className="relative" style={{ ...musicShellStyle, minHeight: undefined }}>
                  <div aria-hidden className="absolute inset-0" style={musicSurfaceStyle} />
                  <div className="relative z-10 px-4 py-3">
                    {/* Player layout: cover art left (spans full height) + right column */}
                    <div className="flex items-center gap-3">
                      {/* Cover art - spans full player height */}
                      {(p as any).music_show_cover && currentTrack.cover_url && (
                        <div
                          className={`flex-shrink-0 overflow-hidden ${isMobile ? 'h-14 w-14' : 'h-16 w-16'} ${currentTrack.display_as_record ? 'rounded-full' : 'rounded-lg'} ${currentTrack.display_as_record && currentTrack.spin_record ? 'animate-spin' : ''}`}
                          style={currentTrack.display_as_record && currentTrack.spin_record ? { animationDuration: '3s' } : undefined}
                        >
                          {/\.(mp4|webm|mov)(\?|$)/i.test(currentTrack.cover_url) ? (
                            <BackgroundVideo src={currentTrack.cover_url} className="h-full w-full object-cover" />
                          ) : (
                            <img loading="lazy" decoding="async" src={currentTrack.cover_url} alt="cover" className="h-full w-full object-cover" />
                          )}
                        </div>
                      )}
                      {/* Right column: title row + progress+controls row */}
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5" style={{ fontFamily: fontApplyMusic }}>
                        {/* Title row */}
                        {(((p.music_show_title !== false) || (p.music_show_artist !== false)) || ((p as any).music_show_cover && currentTrack.cover_url)) && (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              {p.music_show_title !== false ? <div className={`truncate font-semibold ${isMobile ? 'text-xs' : 'text-sm'}`} style={{ color: hexToRgba(musicTextColor, 0.92) }}>{currentTrack.title || profile.music_title || 'Track'}</div> : null}
                              {p.music_show_artist !== false ? <div className="truncate text-xs" style={{ color: hexToRgba(musicTextColor, 0.6) }}>{currentTrack.artist || profile.music_artist || 'Unknown artist'}</div> : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-1" style={{ color: hexToRgba(musicTextColor, 0.6) }}>
                              <IconPlaylist className="h-3.5 w-3.5" />
                              <span className="text-xs">{currentTrackIndex + 1}/{playlist.length}</span>
                            </div>
                          </div>
                        )}
                        {/* Progress + controls row */}
                        <div className="flex items-center gap-2">
                          <div className="min-w-[32px] shrink-0 text-xs" style={{ color: hexToRgba(musicTextColor, 0.65) }}>{formatTime(currentTime)}</div>
                          <div
                            className={`group relative flex-1 cursor-pointer rounded-full bg-white/20 ${isMobile ? 'h-1.5' : 'h-1'}`}
                            style={isMobile ? { touchAction: 'none' } : undefined}
                            onPointerDown={handleScrubStart}
                          >
                            <div className="h-full rounded-full transition-all" style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%', backgroundColor: accentColor }} />
                            <div className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-[0_0_6px_rgba(0,0,0,0.4)] transition-opacity group-hover:opacity-100" style={{ left: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
                          </div>
                          <div className="min-w-[32px] shrink-0 text-right text-xs" style={{ color: hexToRgba(musicTextColor, 0.65) }}>{formatTime(duration)}</div>
                          {/* Controls - pushed to the far right */}
                          <div className={`flex shrink-0 items-center ${isMobile ? 'gap-1.5' : 'gap-1'}`}>
                            <button type="button" onClick={handlePreviousTrack} aria-label="Previous track" className={`flex items-center justify-center text-white/50 hover:text-white disabled:opacity-40 ${isMobile ? 'h-8 w-8' : 'h-6 w-6'}`} disabled={playlist.length <= 1}><IconPlayerSkipBack className={isMobile ? 'h-3.5 w-3.5' : 'h-3 w-3'} /></button>
                            <button type="button" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} aria-pressed={isPlaying} className={`flex items-center justify-center text-white/70 hover:text-white ${isMobile ? 'h-8 w-8' : 'h-7 w-7'}`}>{isPlaying ? <IconPlayerPause className={isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} /> : <IconPlayerPlay className={isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} />}</button>
                            <button type="button" onClick={handleNextTrack} aria-label="Next track" className={`flex items-center justify-center text-white/50 hover:text-white disabled:opacity-40 ${isMobile ? 'h-8 w-8' : 'h-6 w-6'}`} disabled={playlist.length <= 1}><IconPlayerSkipForward className={isMobile ? 'h-3.5 w-3.5' : 'h-3 w-3'} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* External-link confirmation dialog - only shown when the visitor
          clicks a custom link. Portaled into document.body so it can never
          be trapped beneath the background-video / cursor-effects layers. */}
      <LinkConfirmDialog
        open={!!linkConfirm}
        url={linkConfirm?.url || ''}
        onConfirm={() => {
          const target = linkConfirm
          if (!target) return
          // Track the click only when the visitor actually confirms - a
          // Cancel'd open shouldn't count toward the link's analytics.
          fetch('/api/track-click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: profile.id, link_type: 'social', link_id: target.linkId }),
            keepalive: true,
          }).catch(() => {})
          // Open in a new tab so the user doesn't lose the profile.
          window.open(target.url, '_blank', 'noopener,noreferrer')
          setLinkConfirm(null)
        }}
        onCancel={() => setLinkConfirm(null)}
      />
    </div>
  )

}
