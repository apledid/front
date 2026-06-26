'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  IconUser as User, IconPhoto as ImageIcon, IconMusic as Music, IconPointer as MousePointer2,
  IconSettings as Settings2, IconPalette as Palette, IconSquare as Square, IconAlignLeft as AlignLeft, IconAdjustmentsHorizontal as Sliders,
  IconRotate2 as RotateCcw, IconUpload as Upload, IconLoader2 as Loader2, IconCrown as Crown, IconWand as Wand2, IconSun as Sun,
  IconPlus as Plus, IconTrash as Trash2, IconX as X, IconFileText as FileText, IconClock as Clock, IconEye as Eye, IconMapPin as MapPin, IconAperture as Aperture,
  IconBan as Ban, IconBolt as Zap, IconGhost as Ghost, IconSparkles as Sparkles, IconCat as Cat, IconDroplets as Droplets, IconRainbow as Rainbow, IconActivity as Activity,
  IconPlayerPlayFilled as Play, IconPlayerPauseFilled as Pause, IconScissors as Scissors, IconArrowBackUp as ArrowBackUp,
} from '@tabler/icons-react'

type IconComponent = React.ComponentType<{ className?: string; size?: number | string; color?: string; strokeWidth?: number | string; style?: React.CSSProperties }>
import { Mp3Encoder } from '@breezystack/lamejs'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { uploadFile } from '@/lib/upload'
import { RezAudioExtras } from '@/components/dashboard/rez-audio-extras'
import { SoundEffectsCard } from '@/components/dashboard/sound-effects-card'
import { getCardContainerStyles } from '@/lib/profile-style'
import { UploadingOverlay } from '@/components/ui/uploading-overlay'
import type { Profile } from '@/lib/types'
import { UsernameDisplay } from '@/components/profile/effect-overlays'
import { LivePreview } from '@/components/dashboard/live-preview'
import { PREMIUM_USERNAME_EFFECTS, PREMIUM_CURSOR_EFFECTS, PREMIUM_HOVER_EFFECTS } from '@/lib/premium-features'
import { LAYOUT_META, getLayoutMeta } from '@/lib/layout-meta'
import { LayoutCard } from '@/components/dashboard/layout-card'
import { ProfilePresets, ProfilePresetsIcon } from '@/components/dashboard/profile-presets'

/* ─── helpers ─────────────────────────────────────────────── */

// Wraps a premium-only section. When locked, renders children inert (no
// clicks, faded) with a "PRO" overlay across them. Lets non-premium users
// see what's available and what it would look like, instead of hiding.
function PremiumGate({
  locked,
  label = 'Premium',
  children,
}: {
  locked: boolean
  label?: string
  children: React.ReactNode
}) {
  if (!locked) return <>{children}</>
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none select-none opacity-40 [&_*]:!cursor-not-allowed">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30 backdrop-blur-[1px]">
        <div className="flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200 shadow-sm">
          <Crown className="h-3 w-3" />
          {label}
        </div>
      </div>
    </div>
  )
}


function renderBioMarkdownClient(raw: string): string {
  let s = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  s = s
    .replace(/&lt;left&gt;/gi, '<div style="text-align:left">').replace(/&lt;\/left&gt;/gi, '</div>')
    .replace(/&lt;center&gt;/gi, '<div style="text-align:center">').replace(/&lt;\/center&gt;/gi, '</div>')
    .replace(/&lt;right&gt;/gi, '<div style="text-align:right">').replace(/&lt;\/right&gt;/gi, '</div>')
  s = s.replace(/^#### (.+)$/gm, '<h4 style="font-size:1.05em;font-weight:600;margin:0.4em 0">$1</h4>')
  s = s.replace(/^### (.+)$/gm, '<h3 style="font-size:1.15em;font-weight:600;margin:0.4em 0">$1</h3>')
  s = s.replace(/^## (.+)$/gm, '<h2 style="font-size:1.3em;font-weight:700;margin:0.5em 0">$1</h2>')
  s = s.replace(/^# (.+)$/gm, '<h1 style="font-size:1.5em;font-weight:700;margin:0.5em 0">$1</h1>')
  s = s.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__([^_]+)__/g, '<u>$1</u>')
  s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>')
  s = s.replace(/(?<!\*)\*([^\*]+)\*(?!\*)/g, '<em>$1</em>')
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => {
    // Escape quotes in URL to prevent breaking out of href="..." attribute.
    const isSafe = /^(https?:\/\/|mailto:)/i.test(u)
    const safe = (isSafe ? u : '#').replace(/"/g, '%22').replace(/'/g, '%27')
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">${t}</a>`
  })
  s = s.replace(/\n/g, '<br />')
  return s
}

const BACKGROUND_EFFECTS = [
  { value: 'none', label: 'None' },
  { value: 'rain', label: 'Rain' },
  { value: 'aurora', label: 'Aurora Borealis' },
  { value: 'blurred', label: 'Blurred' },
  { value: 'snow', label: 'Snowflakes' },
  { value: 'old-tv', label: 'Old TV' },
  { value: 'dither', label: 'Dither' },
  { value: 'plasma', label: 'Plasma' },
  { value: 'matrix', label: 'Matrix' },
]

const USERNAME_EFFECTS = [
  { value: 'none', label: 'None' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'shuffle', label: 'Shuffle' },
  { value: 'white-sparkles', label: 'White Sparkles' },
  { value: 'red-sparkles', label: 'Red Sparkles' },
  { value: 'pink-sparkles', label: 'Pink Sparkles' },
  { value: 'blue-sparkles', label: 'Blue Sparkles' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'wave', label: 'Wave' },
]

const CURSOR_EFFECTS = [
  { value: 'none', label: 'None' },
  { value: 'glow', label: 'Glow' },
  { value: 'spark-trail', label: 'Spark Trail' },
  { value: 'ghost-trail', label: 'Ghost Trail' },
  { value: 'falling-spark', label: 'Falling Sparks' },
  { value: 'cat', label: 'Cat' },
  { value: 'splash', label: 'Splash' },
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'bubble', label: 'Bubbles' },
  { value: 'neon', label: 'Neon' },
]

// 6 card-style archetypes. Order is intentional - sorted from most-
// opaque (Classic / Solid) to most-transparent (Glass / Minimal) with
// Outline + Neon as the two "border-forward" variants between them.
// Previously the picker only exposed 5 and silently aliased Classic
// onto Glass; `lib/profile-style.ts` has a real `case 'classic'`
// branch now so the picker reflects what's actually renderable.
const CARD_STYLES = [
  { value: 'classic', label: 'Classic' },
  { value: 'glass',   label: 'Glass'   },
  { value: 'solid',   label: 'Solid'   },
  { value: 'outline', label: 'Outline' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'neon',    label: 'Neon'    },
]

/**
 * Tiny live preview of what each card_style looks like, rendered
 * inside the picker buttons. Re-uses the production
 * `getCardContainerStyles` so the swatch can't drift away from
 * the real renderer - if someone tweaks Classic's `boxShadow`,
 * the swatch updates automatically.
 *
 * `cardStyle` here drives the visible chrome; we pick a few
 * sensible defaults (accent pink, dark bg, small radius) and
 * give Glass/Minimal a non-zero blur so their backdrop-filter
 * actually has something to do against the picker's dark
 * background.
 */
function CardStyleSwatch({ cardStyle }: { cardStyle: string }) {
  const styles = getCardContainerStyles({
    accentColor: '#e87fa0',
    backgroundColor: '#0b0b12',
    cardStyle,
    borderStyle: 'none',
    profileOpacity: 100,
    profileBlur: cardStyle === 'glass' || cardStyle === 'minimal' ? 14 : 0,
    profileRadius: 8,
  })
  return <div className="mt-2 h-7 w-full" style={{ ...styles, overflow: 'hidden' }} />
}

/* ─── small UI atoms ──────────────────────────────────────── */

function SectionHeading({ icon: Icon, title }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  title: string
}) {
  // Previously: pink-gradient icon box + pink-glow heading text. Read as
  // AI-default "every section is a beacon" - and there are ~12 sections on
  // this page, so the page felt over-decorated. Now: plain icon, white
  // heading, tiny pink dot for brand presence. Heading switches to Inter
  // since the dashboard is the work surface, not the marketing page.
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <Icon className="h-4 w-4 text-foreground-secondary" />
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
        {title}
      </h2>
      <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary/80" aria-hidden />
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  // Previously: rounded-2xl + tri-stop gradient bg + backdrop-blur +
  // hover ring. That's the canonical "AI dashboard card" - we use this
  // primitive ~12 times on this page alone, so the gradient-glass treatment
  // multiplied into the whole page feeling templated. Now: rounded-xl
  // (12px instead of 16px), flat bg-surface, single hairline border,
  // no backdrop-blur. Hover gets a slightly brighter border, nothing
  // animating.
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong ${className}`}
    >
      {children}
    </div>
  )
}

function ResetBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-muted-foreground hover:text-foreground-secondary transition-colors">
      <RotateCcw className="h-3.5 w-3.5" />
    </button>
  )
}

function SliderRow({ label, value, min, max, step = 1, onChange, onReset, unit = '' }: {
  label: string; value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; onReset?: () => void; unit?: string
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground-secondary">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{value}{unit}</span>
          {onReset ? <ResetBtn onClick={onReset} /> : null}
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-primary"
      />
    </div>
  )
}

function ColorField({ label, value, onChange, onReset }: {
  label: string; value: string; onChange: (v: string) => void; onReset?: () => void
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground-secondary">{label}</span>
        {onReset ? <ResetBtn onClick={onReset} /> : null}
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-2 pr-3">
        <input
          type="color" value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0.5"
        />
        <input
          type="text" value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-mono"
        />
      </div>
    </div>
  )
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center"><span className="text-sm font-medium text-foreground-secondary">{label}</span></div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/40 transition-colors cursor-pointer"
        >
          {options.map((o) => <option key={o.value} value={o.value} className="bg-surface">{o.label}</option>)}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}

function TextField({ label, value, onChange, placeholder, maxLength, hint }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; maxLength?: number; hint?: string
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground-secondary">{label}</span>
        {maxLength ? <span className="text-xs text-muted-foreground">{value.length}/{maxLength}</span> : null}
      </div>
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength}
        className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 transition-colors"
      />
      {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

/* ─── quick-access manager card ──────────────────────────── */

function ManagerCard({ icon: Icon, label, onClick, preview, loading }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  preview?: string
  loading?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex aspect-[5/3] w-full flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-border-strong"
    >
      {preview ? (
        /\.(mp4|webm|mov)(\?|$)/i.test(preview)
          ? <video src={preview} autoPlay loop muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover opacity-50 transition-opacity group-hover:opacity-70" />
          : <img src={preview} alt={label} className="absolute inset-0 h-full w-full object-cover opacity-50 transition-opacity group-hover:opacity-70" />
      ) : null}
      {preview ? <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" /> : null}
      <div className="relative z-10 flex flex-col items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-2 transition-colors group-hover:border-primary/40">
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin text-foreground-secondary" />
            : <Icon className="h-[18px] w-[18px] text-muted-foreground transition-colors group-hover:text-primary" />}
        </span>
        <span className="text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">{label}</span>
      </div>
    </button>
  )
}

/* ─── banner upload (inline, no modal) ───────────────────── */

function BannerUploadRow({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  // Banner upload mirrors how avatar / background uploads work in this
  // page: do the upload, POST the new URL to /api/profile immediately
  // so it persists without waiting for the main "Save" button, and
  // mirror the new URL into form state via onChange so the local
  // preview swaps right away.
  async function upload(file: File) {
    setUploading(true)
    try {
      const r = await uploadFile(file, 'banner')
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner_url: r.url }),
      })
      onChange(r.url)
      toast.success('Banner uploaded')
    } catch (e: any) {
      // Stable toast id so rapid-fire failures (e.g. while the user is
      // hitting the rate limit) REPLACE the previous toast instead of
      // stacking into a wall of duplicates.
      toast.error(e?.message || 'Upload failed', { id: 'upload-error' })
    } finally {
      setUploading(false)
    }
  }

  async function remove() {
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner_url: null }),
      })
      onChange('')
      toast.success('Banner removed')
    } catch (e: any) {
      toast.error(e?.message || 'Remove failed')
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="group relative flex h-24 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border-strong bg-surface transition hover:bg-surface-2 hover:border-primary/35"
      >
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          // Reset value so the same banner image can be re-picked
          // after a remove cycle - see BackgroundManager for full
          // rationale.
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) upload(file)
          }}
        />
        {value ? (
          <img src={value} alt="banner" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <div className="relative z-10 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs text-foreground backdrop-blur-sm">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading…' : value ? 'Replace banner' : 'Upload banner'}
        </div>
      </button>
      {value ? (
        <button
          type="button"
          onClick={remove}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-xs text-foreground-secondary hover:bg-surface-2 hover:text-red-300 transition"
        >
          Remove
        </button>
      ) : null}
    </div>
  )
}

/* ─── form state ─────────────────────────────────────────── */

interface FormState {
  display_name: string
  bio: string
  location: string
  // Advanced per-element text colors ('' = inherit text_color)
  display_name_color: string
  username_handle_color: string
  bio_color: string
  location_color: string
  card_text_color: string
  music_text_color: string
  // Custom font + per-element targeting (legacy single-font fields)
  custom_font_url: string
  custom_font_name: string
  font_apply_displayname: boolean
  font_apply_username: boolean
  font_apply_bio: boolean
  font_apply_music: boolean
  // Multi-font (up to 4 slots)
  font_1_url: string; font_1_name: string
  font_2_url: string; font_2_name: string
  font_3_url: string; font_3_name: string
  font_4_url: string; font_4_name: string
  // Per-element slot assignment: 0 = system default, 1-4 = font slot N
  font_slot_displayname: number
  font_slot_username:    number
  font_slot_bio:         number
  font_slot_music:       number
  enter_title: string
  profile_opacity: number
  profile_blur: number
  background_effect: string
  background_effect_color: string
  username_effect: string
  accent_color: string
  text_color: string
  background_color: string
  icon_color: string
  profile_gradient_enabled: boolean
  profile_gradient_primary: string
  profile_gradient_secondary: string
  outline_enabled: boolean
  outline_color: string
  outline_width: number
  profile_radius: number
  card_style: string
  volume_control: boolean
  animated_title: boolean
  enter_enabled: boolean
  show_view_count: boolean
  animate_view_count: boolean
  tilt_effect: boolean
  show_badges: boolean
  badges_next_to_name: boolean
  monochrome_icons: boolean
  swap_box_colors: boolean
  show_likes: boolean
  // Badge settings
  badge_color: string
  monochrome_badges: boolean
  badge_glow_strength: number
  badge_accent_color: string
  badge_border_radius: number
  badge_opacity: number
  badge_border_enabled: boolean
  badge_border_color: string
  badge_border_width: number
  badge_border_opacity: number
  glow_username: boolean
  glow_socials: boolean
  socials_glow_mono: boolean
  socials_below_widgets: boolean
  glow_badges: boolean
  glow_description: boolean
  glow_intensity: number
  glow_color: string
  views_location_position: string
  // Avatar / background / banner
  avatar_url: string
  banner_url: string
  background_url: string
  use_discord_avatar: boolean
  // Avatar outline + glow (owner-only @rez)
  avatar_outline_enabled: boolean
  avatar_outline_color: string
  avatar_outline_size: number
  avatar_glow_enabled: boolean
  avatar_glow_color: string
  avatar_glow_size: number
  // Sound effects (premium)
  click_sound_url: string
  enter_sound_url: string
  click_sound_volume: number
  enter_sound_volume: number
  // Cursor
  cursor_effect: string
  cursor_color: string
  custom_cursor_url: string
  custom_cursor_hover_url: string
  // Music
  music_enabled: boolean
  music_show_title: boolean
  music_show_artist: boolean
  music_hide_panel: boolean
  music_show_cover: boolean
  music_volume: number
  music_shuffle: boolean
  // Avatar shape
  avatar_shape: string
  // Typewriter bio
  typing_bio: boolean
  typing_speed: number
  bio_texts: string[]
  // Enter page
  enter_subtitle: string
  enter_show_profile: boolean
  enter_show_title: boolean
  enter_show_subtitle: boolean
  // Animations
  entrance_animation: string
  hover_effect: string
  hover_effect_color: string
  // Layout
  layout_mode: string
  // bento was removed from the layout picker; keeping the form field as
  // `unknown[]` preserves any pre-existing `bento_tiles` JSON on the
  // profile (so a save doesn't wipe it) without forcing the dashboard
  // to depend on the now-defunct BentoTile type.
  bento_tiles: unknown[]
  panel_size: string
  avatar_position: string
  avatar_placement: string
  show_avatar: boolean
  // Info bar
  infobar_views_pos: string
  infobar_location_pos: string
}

function fromProfile(p: Profile): FormState {
  return {
    display_name: p.display_name || '',
    bio: p.bio || '',
    location: p.location || '',
    display_name_color:    (p as any).display_name_color    || '',
    username_handle_color: (p as any).username_handle_color || '',
    bio_color:             (p as any).bio_color             || '',
    location_color:        (p as any).location_color        || '',
    card_text_color:       (p as any).card_text_color       || '',
    music_text_color:      (p as any).music_text_color      || '',
    custom_font_url:       (p as any).custom_font_url       || '',
    custom_font_name:      (p as any).custom_font_name       || '',
    font_apply_displayname: (p as any).font_apply_displayname ?? true,
    font_apply_username:    (p as any).font_apply_username    ?? true,
    font_apply_bio:         (p as any).font_apply_bio         ?? true,
    font_apply_music:       (p as any).font_apply_music       ?? true,
    // 4 font slots (legacy custom_font_url is mirrored into slot 1 server-side
    // by migration 039, so both views stay coherent for existing users)
    font_1_url:  (p as any).font_1_url  || (p as any).custom_font_url  || '',
    font_1_name: (p as any).font_1_name || (p as any).custom_font_name || '',
    font_2_url:  (p as any).font_2_url  || '',
    font_2_name: (p as any).font_2_name || '',
    font_3_url:  (p as any).font_3_url  || '',
    font_3_name: (p as any).font_3_name || '',
    font_4_url:  (p as any).font_4_url  || '',
    font_4_name: (p as any).font_4_name || '',
    font_slot_displayname: (p as any).font_slot_displayname ?? 0,
    font_slot_username:    (p as any).font_slot_username    ?? 0,
    font_slot_bio:         (p as any).font_slot_bio         ?? 0,
    font_slot_music:       (p as any).font_slot_music       ?? 0,
    enter_title: p.enter_title || '',
    profile_opacity: p.profile_opacity ?? 100,
    profile_blur: p.profile_blur ?? 0,
    background_effect: p.background_effect || 'none',
    background_effect_color: (p as any).background_effect_color || '',
    username_effect: p.username_effect || 'none',
    accent_color: p.accent_color || '#e87fa0',
    text_color: p.text_color || '#ffffff',
    background_color: p.background_color || '#030306',
    icon_color: p.icon_color || '#ffffff',
    profile_gradient_enabled: p.profile_gradient_enabled ?? false,
    profile_gradient_primary: p.profile_gradient_primary || '#e87fa0',
    profile_gradient_secondary: p.profile_gradient_secondary || '#9b59b6',
    outline_enabled: p.outline_enabled ?? false,
    outline_color: p.outline_color || '#e87fa0',
    outline_width: (p as any).outline_width ?? 2,
    profile_radius: p.profile_radius ?? 16,
    card_style: p.card_style || 'classic',
    volume_control: p.volume_control ?? true,
    animated_title: p.animated_title ?? true,
    enter_enabled: p.enter_enabled ?? true,
    show_view_count: p.show_view_count ?? true,
    animate_view_count: (p as any).animate_view_count ?? false,
    tilt_effect: p.tilt_effect ?? true,
    show_badges: p.show_badges ?? true,
    badges_next_to_name: (p as any).badges_next_to_name ?? false,
    badge_color: (p as any).badge_color || '#ffffff',
    monochrome_badges: (p as any).monochrome_badges ?? false,
    badge_glow_strength: (p as any).badge_glow_strength ?? 50,
    badge_accent_color: (p as any).badge_accent_color || '#ffffff',
    badge_border_radius: (p as any).badge_border_radius ?? 50,
    badge_opacity: (p as any).badge_opacity ?? 100,
    badge_border_enabled: (p as any).badge_border_enabled ?? false,
    badge_border_color: (p as any).badge_border_color || '#ffffff',
    badge_border_width: (p as any).badge_border_width ?? 1,
    badge_border_opacity: (p as any).badge_border_opacity ?? 100,
    monochrome_icons: p.monochrome_icons ?? false,
    swap_box_colors: p.swap_box_colors ?? false,
    show_likes: p.show_likes ?? false,
    glow_username: p.glow_username ?? false,
    glow_socials: p.glow_socials ?? false,
    glow_badges: p.glow_badges ?? false,
    glow_description: (p as any).glow_description ?? false,
    socials_glow_mono: (p as any).socials_glow_mono ?? false,
    socials_below_widgets: (p as any).socials_below_widgets ?? false,
    glow_intensity: p.glow_intensity ?? 50,
    glow_color: p.glow_color || '#e87fa0',
    views_location_position: (p as any).views_location_position || 'top-right',
    avatar_url: p.avatar_url || '',
    background_url: p.background_url || '',
    banner_url: (p as any).banner_url || '',
    use_discord_avatar: p.use_discord_avatar ?? false,
    avatar_outline_enabled: (p as any).avatar_outline_enabled ?? false,
    avatar_outline_color: (p as any).avatar_outline_color || '#ffffff',
    avatar_outline_size: (p as any).avatar_outline_size ?? 3,
    avatar_glow_enabled: (p as any).avatar_glow_enabled ?? false,
    avatar_glow_color: (p as any).avatar_glow_color || '#e87fa0',
    avatar_glow_size: Math.min(40, (p as any).avatar_glow_size ?? 16),
    click_sound_url: (p as any).click_sound_url || '',
    enter_sound_url: (p as any).enter_sound_url || '',
    click_sound_volume: (p as any).click_sound_volume ?? 100,
    enter_sound_volume: (p as any).enter_sound_volume ?? 100,
    cursor_effect: p.cursor_effect || 'none',
    cursor_color: p.cursor_color || '#e87fa0',
    custom_cursor_url: p.custom_cursor_url || '',
    custom_cursor_hover_url: (p as any).custom_cursor_hover_url || '',
    music_enabled: p.music_enabled ?? false,
    music_show_title: p.music_show_title ?? true,
    music_show_artist: p.music_show_artist ?? true,
    music_hide_panel: p.music_hide_panel ?? false,
    music_show_cover: (p as any).music_show_cover ?? false,
    music_volume: (p as any).music_volume ?? 75,
    music_shuffle: (p as any).music_shuffle ?? false,
    avatar_shape: (p as any).avatar_shape || 'circle',
    typing_bio: (p as any).typing_bio ?? false,
    typing_speed: (p as any).typing_speed ?? 100,
    bio_texts: Array.isArray((p as any).bio_texts) ? (p as any).bio_texts : [],
    enter_subtitle: (p as any).enter_subtitle || '',
    enter_show_profile: (p as any).enter_show_profile ?? true,
    enter_show_title: (p as any).enter_show_title ?? true,
    enter_show_subtitle: (p as any).enter_show_subtitle ?? true,
    entrance_animation: (p as any).entrance_animation || 'fade',
    hover_effect: (p as any).hover_effect || 'none',
    hover_effect_color: (p as any).hover_effect_color || '#e87fa0',
    layout_mode: (p as any).layout_mode || 'default',
    bento_tiles: Array.isArray((p as any).bento_tiles) ? ((p as any).bento_tiles as unknown[]) : [],
    panel_size: (p as any).panel_size || 'medium',
    avatar_position: (p as any).avatar_position || 'center',
    avatar_placement: (p as any).avatar_placement || 'outside',
    show_avatar: (p as any).show_avatar ?? true,
    infobar_views_pos: (p as any).infobar_views_pos || 'left',
    infobar_location_pos: (p as any).infobar_location_pos || 'left',
  }
}

/* ═══════════════════════════════════════════════════════════
   USERNAME EFFECTS MODAL
   ═══════════════════════════════════════════════════════════ */

function UsernameEffectsModal({
  open, onOpenChange, value, onChange, username, isPremium = false,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  value: string; onChange: (v: string) => void
  username: string
  isPremium?: boolean
}) {
  const [picked, setPicked] = useState(value)

  useEffect(() => { if (open) setPicked(value) }, [open, value])

  const current = USERNAME_EFFECTS.find(e => e.value === picked) || USERNAME_EFFECTS[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">Username Effects</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-[1fr_240px]">
          {/* Effect grid */}
          <div className="grid grid-cols-3 gap-2">
            {USERNAME_EFFECTS.map((e) => {
              const locked = PREMIUM_USERNAME_EFFECTS.includes(e.value) && !isPremium
              return (
                <button
                  key={e.value}
                  type="button"
                  disabled={locked}
                  onClick={() => { if (!locked) setPicked(e.value) }}
                  className={`relative flex h-24 items-center justify-center overflow-hidden rounded-xl border transition ${locked ? 'cursor-not-allowed opacity-60' : ''} ${picked === e.value ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:bg-surface-2'}`}
                >
                  <UsernameDisplay
                    text={username}
                    effect={e.value}
                    accentColor="#e87fa0"
                    className="text-base font-semibold text-white"
                  />
                  {locked ? (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded bg-white/10">
                      <svg className="h-3 w-3 text-foreground-secondary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {/* Preview pane */}
          <div className="space-y-3">
            <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-xl bg-[#1a1a20] border border-border">
              <UsernameDisplay text={username} effect={picked} accentColor="#e87fa0" className="text-3xl font-bold text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{current.label}</p>
              <p className="text-xs text-muted-foreground">{PREMIUM_USERNAME_EFFECTS.includes(picked) ? 'Premium effect' : 'This is a free effect'}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl border border-border bg-surface py-2.5 text-sm text-foreground-secondary hover:bg-surface-2 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onChange(picked); onOpenChange(false) }}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
          >
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════
   CURSOR EFFECTS MODAL
   ═══════════════════════════════════════════════════════════ */

const CURSOR_EFFECT_ICONS: Record<string, IconComponent> = {
  none: Ban,
  glow: Sun,
  'spark-trail': Zap,
  'ghost-trail': Ghost,
  'falling-spark': Sparkles,
  cat: Cat,
  splash: Droplets,
  rainbow: Rainbow,
  neon: Activity,
}

function CursorEffectIcon({ value, active }: { value: string; active: boolean }) {
  const c = active ? '#e87fa0' : 'rgba(255,255,255,0.55)'
  if (value === 'bubble') {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
        <circle cx="8" cy="15" r="4" />
        <circle cx="16" cy="9" r="2.6" />
        <circle cx="18.5" cy="16.5" r="1.5" />
      </svg>
    )
  }
  const Icon = CURSOR_EFFECT_ICONS[value] || MousePointer2
  return <Icon size={26} color={c} strokeWidth={1.8} />
}

const PREVIEW_GHOST_SVG = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='34' viewBox='0 0 24 34'%3E%3Cpath d='M2 1 L2 27 L9.4 20.9 L12.8 31.2 L16.7 29.7 L13.1 19.9 L22 19.9 Z' fill='white' stroke='%230d0d0d' stroke-width='1.1' stroke-linejoin='round'/%3E%3C/svg%3E"

function CursorEffectPreview({ value, color }: { value: string; color: string }) {
  // Inline preview that mirrors the real CursorEffectsLayer behavior so users
  // can audition every effect without leaving the modal. Each branch is tuned
  // to match the live profile's particle physics, color palette, and visuals.
  const ref = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false })
  // Cat sprite state: position + which sprite frame to show. bgPos uses the
  // same convention as the production oneko sprite sheet (8 cols x 4 rows of
  // 32x32 sprites, written in [-col, -row] cells → multiplied by 32px).
  const [catPos, setCatPos] = useState<{ x: number; y: number; bgPos: string; tick: number }>({
    x: 24, y: 24, bgPos: '-96px -96px', tick: 0,
  })

  // Track pointer position for fake-cursor + glow + cat + ghost-trail UI
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      setPos({ x: e.clientX - r.left, y: e.clientY - r.top, visible: true })
    }
    const onLeave = () => setPos((p) => ({ ...p, visible: false }))
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  // Cat: chase the cursor and pick the right walking-direction sprite. This
  // mirrors `startOneko` from the production code (8-direction walk + idle).
  useEffect(() => {
    if (value !== 'cat') return
    let raf = 0
    // Walking sprites from the production sprite sheet (in -col, -row cells)
    const WALK = {
      N:  [[-1, -2], [-1, -3]],
      NE: [[ 0, -2], [ 0, -3]],
      E:  [[-3,  0], [-3, -1]],
      SE: [[-5, -1], [-5, -2]],
      S:  [[-6, -3], [-7, -2]],
      SW: [[-5, -3], [-6, -1]],
      W:  [[-4, -2], [-4, -3]],
      NW: [[-1,  0], [-1, -1]],
    } as const
    const IDLE: readonly [number, number] = [-3, -3] // sitting cat
    const tick = () => {
      setCatPos((c) => {
        const targetX = pos.visible ? pos.x : c.x
        const targetY = pos.visible ? pos.y : c.y
        const dx = targetX - c.x
        const dy = targetY - c.y
        const dist = Math.hypot(dx, dy)
        const speed = 0.08
        const nx = c.x + dx * speed
        const ny = c.y + dy * speed
        const nextTick = c.tick + 1

        // Pick direction sprite. Below ~6px it's basically still, so idle.
        let cell: readonly [number, number] = IDLE
        if (dist > 6) {
          const angle = Math.atan2(dy, dx) // -PI..PI, 0 = east
          // Map to 8 compass directions
          const sectors: Array<readonly [number, keyof typeof WALK]> = [
            [-Math.PI * 7 / 8, 'W'],  [-Math.PI * 5 / 8, 'NW'],
            [-Math.PI * 3 / 8, 'N'],  [-Math.PI * 1 / 8, 'NE'],
            [ Math.PI * 1 / 8, 'E'],  [ Math.PI * 3 / 8, 'SE'],
            [ Math.PI * 5 / 8, 'S'],  [ Math.PI * 7 / 8, 'SW'],
          ]
          let dir: keyof typeof WALK = 'W'
          for (const [thresh, name] of sectors) {
            if (angle <= thresh) { dir = name; break }
          }
          // Two-frame walk cycle (alternate every ~6 frames)
          const frame = Math.floor(nextTick / 6) % 2
          cell = WALK[dir][frame] as readonly [number, number]
        }
        const bgPos = `${cell[0] * 32}px ${cell[1] * 32}px`
        return { x: nx, y: ny, bgPos, tick: nextTick }
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, pos.visible, pos.x, pos.y])

  // Canvas-backed effects: spark-trail, falling-spark, ghost-trail, rainbow,
  // bubble, neon (splash gets its own dedicated WebGL preview path).
  useEffect(() => {
    const supportsCanvas = ['spark-trail', 'falling-spark', 'rainbow', 'ghost-trail', 'bubble', 'neon'].includes(value)
    const canvas = canvasRef.current
    // Wipe any frame a previous canvas effect left behind, so switching to
    // glow / none / cat / splash doesn't leave stale bubbles or sparks frozen
    // on the canvas under the new effect.
    if (canvas) {
      const c0 = canvas.getContext('2d')
      if (c0) { c0.setTransform(1, 0, 0, 1, 0, 0); c0.clearRect(0, 0, canvas.width, canvas.height) }
    }
    if (!supportsCanvas) return
    const wrap = ref.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      const r = wrap.getBoundingClientRect()
      canvas.width = r.width * dpr
      canvas.height = r.height * dpr
      canvas.style.width = `${r.width}px`
      canvas.style.height = `${r.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const particles: any[] = []
    const ghost: { x: number; y: number }[] = Array.from({ length: 14 }, () => ({ x: -50, y: -50 }))
    let mx = -50, my = -50, pmx = -50, pmy = -50

    const onMove = (e: MouseEvent) => {
      const r = wrap.getBoundingClientRect()
      pmx = mx; pmy = my
      mx = e.clientX - r.left
      my = e.clientY - r.top
      if (pmx < 0) { pmx = mx; pmy = my }
    }
    const onLeave = () => { mx = -50; my = -50; pmx = -50; pmy = -50 }
    wrap.addEventListener('mousemove', onMove)
    wrap.addEventListener('mouseleave', onLeave)

    const hex = (color || '#e87fa0').replace('#', '').padEnd(6, '0')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    const rainbowColors = ['#FE0000', '#FD8C00', '#FFE500', '#119F0B', '#0644B3', '#C22EDC']

    const tick = () => {
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.clearRect(0, 0, w, h)
      const moving = mx >= 0 && (Math.abs(mx - pmx) > 0.1 || Math.abs(my - pmy) > 0.1)

      if (value === 'spark-trail' || value === 'falling-spark') {
        if (moving) {
          const dx = mx - pmx, dy = my - pmy
          const steps = Math.max(1, Math.floor(Math.hypot(dx, dy) / 5))
          for (let i = 0; i <= steps; i++) {
            const t = i / steps
            const px = pmx + dx * t, py = pmy + dy * t
            if (value === 'falling-spark') {
              particles.push({ x: px, y: py, vx: (Math.random() - 0.5) * 0.4, vy: 1.2 + Math.random() * 1.4, life: 38, max: 38, size: 1.6 + Math.random() * 1.8, rotation: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.04, falling: true })
            } else {
              const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.9
              const spd = 0.8 + Math.random() * 1.6
              particles.push({ x: px, y: py, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, life: 24, max: 24, size: 1.2 + Math.random() * 1.5 })
            }
          }
        }
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]
          p.x += p.vx; p.y += p.vy
          if (p.falling) {
            p.vx *= 0.995; p.vy += 0.04; p.rotation += p.spin
          } else {
            p.vx *= 0.985; p.vy *= 0.985; p.vy += 0.012
          }
          p.life -= 1
          if (p.life <= 0) { particles.splice(i, 1); continue }
          const a = p.life / p.max
          if (p.falling) {
            ctx.save()
            ctx.translate(p.x, p.y)
            ctx.rotate(p.rotation)
            ctx.strokeStyle = `rgba(${r},${g},${b},${a * 0.95})`
            ctx.lineWidth = 1.6
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.moveTo(-p.size * 1.4, 0); ctx.lineTo(p.size * 1.4, 0)
            ctx.moveTo(0, -p.size * 1.4); ctx.lineTo(0, p.size * 1.4)
            ctx.stroke()
            ctx.restore()
          } else {
            ctx.beginPath()
            ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.95})`
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            ctx.fill()
            ctx.beginPath()
            ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.25})`
            ctx.arc(p.x, p.y, p.size * 2.6, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      if (value === 'ghost-trail') {
        let lx = mx, ly = my
        ghost.forEach((n, idx) => {
          const ease = Math.max(0.18, 0.42 - idx * 0.012)
          if (mx < 0) {
            n.x = -50; n.y = -50
            return
          }
          n.x += (lx - n.x) * ease
          n.y += (ly - n.y) * ease
          lx = n.x; ly = n.y
        })
      }

      if (value === 'rainbow') {
        if (!particles.length) for (let i = 0; i < 18; i++) particles.push({ x: mx < 0 ? w / 2 : mx, y: my < 0 ? h / 2 : my })
        let lx = mx < 0 ? particles[0].x : mx
        let ly = my < 0 ? particles[0].y : my
        particles.forEach((p, i) => {
          const next = particles[i + 1] || particles[0]
          p.x = lx; p.y = ly
          lx += (next.x - p.x) * 0.4
          ly += (next.y - p.y) * 0.4
        })
        rainbowColors.forEach((c, idx) => {
          ctx.beginPath()
          ctx.strokeStyle = c
          ctx.lineWidth = 2.6
          ctx.lineJoin = 'round'
          ctx.lineCap = 'round'
          particles.forEach((p, pi) => {
            if (pi === 0) ctx.moveTo(p.x, p.y + idx * 1.6)
            else ctx.lineTo(p.x, p.y + idx * 1.6)
          })
          ctx.stroke()
        })
      }

      // Bubble preview: spawn a small floating bubble on every detected
      // pointer movement, then update each particle's position + lifespan
      // and stroke/fill with the user's chosen color.
      if (value === 'bubble') {
        if (moving) {
          // Critical: life and max MUST be the same value. The growth
          // scale below is (max - life) / max, so if max != life the
          // bubble spawns at a random scale (often negative, which
          // produces an invisible arc). The production BubbleCursor in
          // cursor-effects.tsx already does it this way; this preview
          // diverged and silently rendered nothing.
          const lifeSpan = Math.floor(Math.random() * 60 + 60)
          particles.push({
            x: mx, y: my,
            vx: (Math.random() < 0.5 ? -1 : 1) * (Math.random() / 10),
            vy: -0.4 + Math.random() * -1,
            life: lifeSpan,
            max: lifeSpan,
            bubble: true,
          })
        }
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]
          if (!p.bubble) continue
          p.x += p.vx; p.y += p.vy
          p.vx += ((Math.random() < 0.5 ? -1 : 1) * 2) / 75
          p.vy -= Math.random() / 600
          p.life -= 1
          if (p.life <= 0) { particles.splice(i, 1); continue }
          const scale = 0.2 + (p.max - p.life) / p.max
          ctx.fillStyle = `rgba(${r},${g},${b},0.18)`
          ctx.strokeStyle = `rgba(${r},${g},${b},1)`
          ctx.beginPath()
          ctx.arc(p.x - 2 * scale, p.y - 2, 4 * scale, 0, Math.PI * 2)
          ctx.stroke()
          ctx.fill()
          ctx.closePath()
        }
      }

      // Neon preview: maintain a smoothed trail of recent pointer positions
      // and draw it as three stacked passes (broad-soft / mid / hot core)
      // to fake a bloomed neon-tube look in canvas 2D.
      if (value === 'neon') {
        // Use particles[] as the trail buffer; seed it on first frame.
        if (!particles.length) for (let i = 0; i < 16; i++) particles.push({ x: w / 2, y: h / 2 })
        const target = { x: mx < 0 ? w / 2 : mx, y: my < 0 ? h / 2 : my }
        particles[0].x += (target.x - particles[0].x) * 0.35
        particles[0].y += (target.y - particles[0].y) * 0.35
        for (let i = 1; i < particles.length; i++) {
          particles[i].x += (particles[i - 1].x - particles[i].x) * 0.45
          particles[i].y += (particles[i - 1].y - particles[i].y) * 0.45
        }
        const passes = [
          { width: 14, alpha: 0.22, blur: 22 },
          { width: 6,  alpha: 0.55, blur: 12 },
          { width: 2,  alpha: 0.95, blur: 6  },
        ]
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        for (const pass of passes) {
          ctx.strokeStyle = `rgba(${r},${g},${b},${pass.alpha})`
          ctx.lineWidth = pass.width
          ctx.shadowColor = color
          ctx.shadowBlur = pass.blur
          ctx.beginPath()
          ctx.moveTo(particles[0].x, particles[0].y)
          for (let i = 1; i < particles.length - 1; i++) {
            const xc = (particles[i].x + particles[i + 1].x) / 2
            const yc = (particles[i].y + particles[i + 1].y) / 2
            ctx.quadraticCurveTo(particles[i].x, particles[i].y, xc, yc)
          }
          ctx.stroke()
        }
        ctx.shadowBlur = 0
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // Push ghost-trail render outside the canvas (uses DOM imgs); kept here
    // only for movement integration.
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      wrap.removeEventListener('mousemove', onMove)
      wrap.removeEventListener('mouseleave', onLeave)
    }
  }, [value, color])

  // Ghost trail nodes - mirror the real component's DOM-based ghost SVG trail
  const [ghostNodes, setGhostNodes] = useState<{ x: number; y: number }[]>(
    () => Array.from({ length: 14 }, () => ({ x: -50, y: -50 }))
  )
  useEffect(() => {
    if (value !== 'ghost-trail') return
    let raf = 0
    const tick = () => {
      setGhostNodes((prev) => {
        const next = prev.map((n) => ({ ...n }))
        let lx = pos.visible ? pos.x : -50
        let ly = pos.visible ? pos.y : -50
        for (let i = 0; i < next.length; i++) {
          const ease = Math.max(0.18, 0.42 - i * 0.012)
          next[i].x += (lx - next[i].x) * ease
          next[i].y += (ly - next[i].y) * ease
          lx = next[i].x
          ly = next[i].y
        }
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, pos.visible, pos.x, pos.y])

  const showGlow = value === 'glow' && pos.visible
  const showCustomCursor = pos.visible && value !== 'none' && value !== 'cat' && value !== 'splash'
  // Only hide the user's real cursor for effects where we draw a replacement
  // SVG cursor on top. Cat and splash are companion effects (cat sprite
  // chases your cursor, splash ripples under it) - the real cursor stays
  // visible. This matches the live profile's behavior in `useCustomCursorOverlay`.
  const hideRealCursor = showCustomCursor

  return (
    <div
      ref={ref}
      className="relative h-44 overflow-hidden rounded-lg border border-border bg-[#15151a]"
      style={{ cursor: hideRealCursor ? 'none' : 'default' }}
    >
      {/* Idle hint - just text, no animation */}
      {!pos.visible && value !== 'splash' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] text-muted-foreground">move your cursor here</span>
        </div>
      )}

      {/* Splash uses a full-viewport WebGL fluid sim - we can't faithfully
          render it inside this small preview pane, so show a notice instead. */}
      {value === 'splash' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
          <span className="text-[12px] font-medium text-foreground-secondary">fluid splash effect</span>
          <span className="text-[10.5px] leading-relaxed text-muted-foreground">preview not available, visible on your live profile</span>
        </div>
      )}

      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />

      {/* Glow halo follows cursor */}
      {showGlow && (
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            left: pos.x - 40, top: pos.y - 40, width: 80, height: 80,
            background: `radial-gradient(circle, ${color}3D 0%, ${color}1F 48%, transparent 75%)`,
            filter: 'blur(6px)',
          }}
        />
      )}

      {/* Ghost trail uses DOM imgs to match the live look exactly */}
      {value === 'ghost-trail' && ghostNodes.map((n, i) => (
        <img
          key={i}
          src={PREVIEW_GHOST_SVG}
          alt=""
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: 0, top: 0,
            width: 14, height: 20,
            transform: `translate(${n.x - 2}px, ${n.y - 2}px)`,
            opacity: pos.visible && n.x > 0 ? 1 : 0,
          }}
        />
      ))}

      {/* Cat sprite - same 8x4 oneko sprite sheet used in production. The
          live `startOneko` swaps direction frames via backgroundPosition; we
          replicate that here so the preview shows a single animated cat
          instead of the whole sprite sheet rendered as a gif. */}
      {value === 'cat' && (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: 0, top: 0,
            width: 32, height: 32,
            transform: `translate(${catPos.x - 16}px, ${catPos.y - 16}px)`,
            backgroundImage: 'url(/cursor-buddy/oneko.gif)',
            backgroundPosition: catPos.bgPos,
            imageRendering: 'pixelated',
            opacity: pos.visible ? 1 : 0.6,
          }}
        />
      )}

      {/* Fake cursor (skipped for none/cat/splash - those keep the real cursor) */}
      {showCustomCursor && (
        <svg
          className="pointer-events-none absolute"
          style={{ left: pos.x - 2, top: pos.y - 2 }}
          width="20" height="22" viewBox="0 0 22 24" fill="none"
        >
          <path d="M2 2 L2 18 L7 14 L9.5 20 L12 19 L9.5 13 L16 13 Z" fill="white" stroke="#0d0d0d" strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
      )}

    </div>
  )
}

const CURSOR_EFFECT_DESCRIPTIONS: Record<string, string> = {
  none: 'just your normal cursor. nothing fancy.',
  glow: 'soft glow follows your cursor around. color is yours to pick.',
  'spark-trail': 'sparks shoot out behind your cursor when you move.',
  'ghost-trail': 'a chain of mini cursors trails behind the main one.',
  'falling-spark': 'sparkles fall from your cursor like stardust.',
  cat: 'tiny pixel cat that runs after your cursor. cute.',
  splash: 'fluid splash that ripples under your cursor.',
  rainbow: 'rainbow trail that follows you around the page.',
  bubble: 'tiny bubbles drift up from your cursor as you move.',
  neon: 'a glowing neon line trails behind your cursor like a light tube.',
}

function CursorEffectsModal({
  open, onOpenChange, value, onChange, color, onColorChange, isPremium = false,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  value: string; onChange: (v: string) => void
  color: string; onColorChange: (v: string) => void
  isPremium?: boolean
}) {
  const [picked, setPicked] = useState(value)
  const [pickedColor, setPickedColor] = useState(color)
  useEffect(() => { if (open) { setPicked(value); setPickedColor(color) } }, [open, value, color])

  const current = CURSOR_EFFECTS.find(e => e.value === picked) || CURSOR_EFFECTS[0]
  const colorAffects = !['cat', 'rainbow', 'none'].includes(picked)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface p-0 sm:max-w-3xl">
        {/* Simple header - no gradients, no glow, just text */}
        <div className="border-b border-border px-6 py-4">
          <DialogHeader>
            <DialogTitle className="text-[1.05rem] font-semibold tracking-tight text-foreground">cursor effects</DialogTitle>
            <p className="mt-0.5 text-[13px] text-muted-foreground">pick a vibe. preview on the right.</p>
          </DialogHeader>
        </div>

        <div className="grid grid-cols-1 gap-5 px-6 py-5 sm:grid-cols-[1fr_280px]">
          {/* Effect grid - flat, simple, no gradients/glows */}
          <div className="grid grid-cols-4 gap-2">
            {CURSOR_EFFECTS.map((e) => {
              const active = picked === e.value
              const locked = PREMIUM_CURSOR_EFFECTS.includes(e.value) && !isPremium
              return (
                <button
                  key={e.value}
                  type="button"
                  disabled={locked}
                  onClick={() => { if (!locked) setPicked(e.value) }}
                  className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border py-3.5 transition ${locked ? 'cursor-not-allowed opacity-60' : ''} ${
                    active
                      ? 'border-primary bg-primary/[0.06] text-primary'
                      : 'border-border bg-surface text-foreground-secondary hover:bg-surface-2 hover:text-foreground'
                  }`}
                >
                  <CursorEffectIcon value={e.value} active={active} />
                  <span className="text-[11px] font-medium">{e.label}</span>
                  {locked ? (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded bg-white/10">
                      <svg className="h-3 w-3 text-foreground-secondary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {/* Right rail: preview + color */}
          <div className="space-y-3">
            <CursorEffectPreview value={picked} color={pickedColor} />

            <p className="text-[12px] leading-relaxed text-foreground-secondary">
              {CURSOR_EFFECT_DESCRIPTIONS[picked] || ''}
            </p>

            {/* Color row - only shown for effects that use the color */}
            {colorAffects ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">color</span>
                  <button
                    type="button"
                    onClick={() => setPickedColor('#e87fa0')}
                    className="text-[11px] text-muted-foreground hover:text-foreground-secondary transition"
                  >
                    reset
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-1.5 pr-3">
                  <input
                    type="color"
                    value={pickedColor || '#000000'}
                    onChange={(e) => setPickedColor(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded-md border-0 bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={pickedColor || ''}
                    onChange={(e) => setPickedColor(e.target.value)}
                    placeholder="#e87fa0"
                    className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none font-mono"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Simple footer - no gradient button */}
        <div className="flex gap-2 border-t border-border px-6 py-4">
          <button type="button" onClick={() => onOpenChange(false)}
            className="flex-1 rounded-lg border border-border bg-transparent py-2 text-sm text-foreground-secondary hover:bg-surface-2 transition">
            cancel
          </button>
          <button type="button" onClick={() => { onChange(picked); onColorChange(pickedColor); onOpenChange(false) }}
            className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition">
            apply
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════
   AVATAR MANAGER MODAL
   ═══════════════════════════════════════════════════════════ */

function AvatarManagerModal({
  open, onOpenChange, avatarUrl, useDiscordAvatar, onAvatarChange, onDiscordToggle,
  discordLinked, discordAvatarUrl,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  avatarUrl: string; useDiscordAvatar: boolean
  onAvatarChange: (url: string) => void; onDiscordToggle: (v: boolean) => void
  /** True when the user has a linked Discord (profile.discord_id is set).
   *  Drives whether the "Use Discord Avatar" row renders the toggle vs.
   *  a Connect-Discord call-to-action. */
  discordLinked: boolean
  /** Stored Discord avatar URL from the OAuth callback. Even when
   *  Discord is linked we keep the toggle disabled if this is null
   *  (user has no custom Discord avatar to sync). */
  discordAvatarUrl: string | null
}) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const r = await uploadFile(file, 'avatar')
      onAvatarChange(r.url)
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: r.url }),
      })
      toast.success('Avatar updated!')
    } catch (e: any) {
      // Stable toast id so rapid-fire failures (e.g. while the user is
      // hitting the rate limit) REPLACE the previous toast instead of
      // stacking into a wall of duplicates.
      toast.error(e?.message || 'Upload failed', { id: 'upload-error' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <User className="h-5 w-5" /> Avatar Manager
          </DialogTitle>
          <p className="text-sm text-foreground-secondary">Upload and manage your avatar. You can upload a custom avatar or sync your Discord avatar.</p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Custom avatar */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground-secondary">Custom Avatar</p>
            <input
              ref={fileRef} type="file"
              accept="image/*,image/gif,video/mp4,video/webm" className="hidden"
              // See BackgroundManager: reset input value so the same
              // file can be re-picked after a remove cycle.
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) handleFile(file)
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="relative flex aspect-square w-full max-w-[260px] mx-auto items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border-strong bg-surface transition hover:border-primary/50 hover:bg-surface-2 disabled:cursor-wait"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="text-center">
                  <Upload className="mx-auto h-7 w-7 text-muted-foreground" />
                  <p className="mt-2 text-xs text-muted-foreground">Click or drop an avatar</p>
                </div>
              )}
              {/* Overlay covers both "first upload" and "replace existing"
                  cases - works whether avatarUrl was already set or not. */}
              {uploading && <UploadingOverlay />}
            </button>
          </div>

          {/* Discord avatar sync - three states:
              (1) Discord NOT linked: show a Connect-Discord button
                  that kicks off the OAuth flow. Clicking goes to
                  /api/auth/discord?action=connect which returns the
                  user here once linked. The toggle is hidden entirely
                  because flipping it would do nothing.
              (2) Discord linked but no avatar URL stored (user has
                  the default Discord avatar, or signed up before
                  this column existed): show the toggle disabled
                  with a hint to re-connect to refresh.
              (3) Discord linked + avatar URL present: show the
                  normal toggle which swaps the rendered avatar to
                  the cached Discord CDN URL. */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Use Discord Avatar</p>
                <p className="text-xs text-muted-foreground">
                  {discordLinked
                    ? (discordAvatarUrl
                        ? 'Sync your profile picture from Discord.'
                        : 'No Discord avatar found. Re-connect Discord in Settings to refresh.')
                    : 'Connect your Discord to use this option.'}
                </p>
              </div>
              {discordLinked ? (
                <Switch
                  checked={useDiscordAvatar}
                  onCheckedChange={onDiscordToggle}
                  disabled={!discordAvatarUrl}
                />
              ) : (
                <a
                  href="/api/auth/discord?action=connect"
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                  style={{ background: '#5865F2' }}
                >
                  Connect Discord
                </a>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════
   BACKGROUND MANAGER MODAL
   ═══════════════════════════════════════════════════════════ */

function BackgroundManagerModal({
  open, onOpenChange, backgroundUrl, onBackgroundChange,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  backgroundUrl: string; onBackgroundChange: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadPhase, setUploadPhase] = useState<'compressing' | 'uploading' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setUploadPhase(null)
    try {
      const r = await uploadFile(file, 'background', undefined, setUploadPhase)
      onBackgroundChange(r.url)
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ background_url: r.url }),
      })
      toast.success('Background updated!')
    } catch (e: any) {
      // Stable toast id so rapid-fire failures (e.g. while the user is
      // hitting the rate limit) REPLACE the previous toast instead of
      // stacking into a wall of duplicates.
      toast.error(e?.message || 'Upload failed', { id: 'upload-error' })
    } finally {
      setUploading(false)
    }
  }

  async function clearBg() {
    onBackgroundChange('')
    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ background_url: null }),
    })
    toast.success('Background removed')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <ImageIcon className="h-5 w-5" /> Background Manager
          </DialogTitle>
          <p className="text-sm text-foreground-secondary">Upload an image or video as your profile background.</p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <input
            ref={fileRef} type="file"
            accept=".png,.jpg,.jpeg,.gif,.webp,.mp4,.m4v,.webm,.mov,.mkv,image/png,image/jpeg,image/gif,image/webp,video/mp4,video/x-m4v,video/webm,video/quicktime,video/x-matroska"
            className="hidden"
            // Clear the input value as part of onChange so the same
            // filename can be re-selected later. Without this, after
            // Upload → Remove → Upload-the-same-file the browser would
            // short-circuit onChange because input.value hasn't
            // changed, and the user would see "nothing happens" when
            // they pick the file. Same fix mirrored in the avatar +
            // audio + cover inputs below.
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) handleFile(file)
            }}
          />

          {backgroundUrl ? (
            <div className="relative">
              <div className="relative overflow-hidden rounded-xl">
                {/\.(mp4|webm)(\?|$)/i.test(backgroundUrl) ? (
                  <video src={backgroundUrl} className="aspect-video w-full object-cover" autoPlay muted loop playsInline />
                ) : (
                  <img src={backgroundUrl} alt="background" className="aspect-video w-full object-cover" />
                )}
                {/* Re-upload overlay: shows a spinner on top of the existing
                    media when the user clicks Replace. Without this the UI
                    looks frozen because the old background keeps rendering
                    while the new one streams up. */}
                {uploading && <UploadingOverlay phase={uploadPhase} />}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button" onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 rounded-xl border border-border-strong bg-surface-2 py-2.5 text-sm text-foreground hover:bg-surface-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading…' : 'Replace'}
                </button>
                <button
                  type="button" onClick={clearBg}
                  disabled={uploading}
                  className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface transition hover:border-primary/50 hover:bg-surface-2"
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {uploadPhase === 'compressing'
                      ? 'Compressing video, this can take a sec...'
                      : uploadPhase === 'uploading'
                        ? 'Uploading...'
                        : null}
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Click to upload background</p>
                  <p className="mt-1 text-xs text-muted-foreground">Image, GIF or video</p>
                </div>
              )}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════
   AUDIO MANAGER MODAL
   ═══════════════════════════════════════════════════════════ */

interface MusicTrack {
  id: string
  // The /api/music GET endpoint returns { id, title, artist, url, ... }
  // (already mapped from track_title / track_artist in the database) so we
  // expose those as the primary fields. Legacy `track_*` keys are kept as
  // optional for any code path that still reads the raw DB shape.
  title?: string | null
  artist?: string | null
  url?: string
  track_title?: string | null
  track_artist?: string | null
  track_url?: string
  cover_url?: string | null
  display_as_record?: boolean
  spin_record?: boolean
}

function AudioManagerModal({
  open, onOpenChange, form, patch, isPremium = false, isOwner = false,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  form: FormState; patch: (u: Partial<FormState>) => void
  isPremium?: boolean
  isOwner?: boolean
}) {
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddPopup, setShowAddPopup] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editArtist, setEditArtist] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/music').then(r => r.json()).then(d => {
      setTracks(d.tracks || [])
    }).finally(() => setLoading(false))
    return () => {
      // stop playback when modal closes
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
      setPlayingId(null)
    }
  }, [open])

  async function deleteTrack(id: string) {
    try {
      const res = await fetch('/api/music', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      setTracks(tracks.filter(t => t.id !== id))
      if (playingId === id && audioRef.current) { audioRef.current.pause(); audioRef.current = null; setPlayingId(null) }
      toast.success('Track removed')
    } catch {
      toast.error('Failed to delete')
    }
  }

  // Read either the new mapped shape ({title,artist,url}) or the legacy raw
  // shape ({track_title,track_artist,track_url}) so older cached tracks still
  // render correctly during a transition.
  const trackTitle  = (t: MusicTrack) => t.title  ?? t.track_title  ?? ''
  const trackArtist = (t: MusicTrack) => t.artist ?? t.track_artist ?? ''
  const trackUrl    = (t: MusicTrack) => t.url    ?? t.track_url    ?? ''

  function togglePlay(t: MusicTrack) {
    const url = trackUrl(t)
    if (!url) return
    // Stop current playback unconditionally
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    // Clicking the same track again stops it - the user explicitly asked
    // for "click to play, click again to stop" behavior.
    if (playingId === t.id) {
      setPlayingId(null)
      return
    }
    // Play new track. We DON'T set crossOrigin here because the audio is
    // served from /api/file which doesn't include CORS headers - setting
    // crossOrigin='anonymous' would cause the browser to refuse playback.
    const a = new Audio()
    a.volume = Math.max(0, Math.min(1, (form.music_volume ?? 75) / 100))
    a.onended = () => { setPlayingId(null); audioRef.current = null }
    a.onerror = () => {
      toast.error('Could not play track - check the audio URL')
      setPlayingId(null)
      audioRef.current = null
    }
    a.src = url
    audioRef.current = a
    setPlayingId(t.id)
    a.play().catch((err) => {
      console.error('[AudioManager] play failed:', err)
      toast.error('Playback failed - browser blocked audio')
      setPlayingId(null)
      audioRef.current = null
    })
  }

  function beginEdit(t: MusicTrack) {
    setEditingId(t.id)
    setEditTitle(trackTitle(t))
    setEditArtist(trackArtist(t))
  }

  async function saveEdit() {
    if (!editingId) return
    try {
      const res = await fetch('/api/music', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, track_title: editTitle, track_artist: editArtist }),
      })
      if (!res.ok) throw new Error()
      // Update both the new (title/artist) and legacy (track_title/track_artist)
      // shapes so any reader sees the rename immediately.
      setTracks(prev => prev.map(t => t.id === editingId ? {
        ...t,
        title: editTitle, artist: editArtist,
        track_title: editTitle, track_artist: editArtist,
      } : t))
      setEditingId(null)
      toast.success('Saved')
    } catch {
      toast.error('Failed to save')
    }
  }

  // Featured (now-playing) track is the playing one, or the first track for preview
  const featured = tracks.find((t) => t.id === playingId) || tracks[0] || null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-border bg-surface sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Music className="h-5 w-5" /> Audio Manager
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Track list header */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Your Audios <span className="text-muted-foreground">({tracks.length}/{isPremium ? 5 : 3})</span></p>
              {tracks.length < (isPremium ? 5 : 3) ? (
                <button
                  type="button"
                  onClick={() => setShowAddPopup(true)}
                  className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Audio
                </button>
              ) : null}
            </div>

            {/* Tracks */}
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : tracks.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface py-10 text-center">
                <Music className="mx-auto h-7 w-7 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">You don't have any audio files yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tracks.map((t) => {
                  const isPlaying = playingId === t.id
                  const isEditing = editingId === t.id
                  return (
                    <div key={t.id} className="rounded-xl border border-border bg-surface p-2.5">
                      <div className="flex items-center gap-3">
                        {/* Cover + play toggle */}
                        <button
                          type="button"
                          title={isPlaying ? 'Stop' : 'Play preview'}
                          onClick={() => togglePlay(t)}
                          className={`group/play relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ${t.spin_record && t.display_as_record && isPlaying ? 'animate-spin [animation-duration:3s]' : ''}`}
                          style={{ background: t.cover_url ? undefined : 'rgba(232,127,160,0.10)' }}
                        >
                          {t.cover_url ? <img src={t.cover_url} alt="" className="h-full w-full object-cover" /> : <Music className="h-5 w-5 text-primary" />}
                          <span className={`absolute inset-0 flex items-center justify-center transition-all ${isPlaying ? 'bg-black/60 opacity-100' : 'bg-black/35 opacity-90 group-hover/play:bg-black/60 group-hover/play:opacity-100'}`}>
                            {isPlaying ? (
                              <svg className="h-4 w-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
                            ) : (
                              <svg className="h-4 w-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            )}
                          </span>
                        </button>

                        {/* Title / Artist (or edit fields) */}
                        {isEditing ? (
                          <div className="flex flex-1 flex-col gap-1.5 sm:flex-row">
                            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title"
                              className="flex-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/40" />
                            <input value={editArtist} onChange={(e) => setEditArtist(e.target.value)} placeholder="Artist"
                              className="flex-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/40" />
                          </div>
                        ) : (
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{trackTitle(t) || 'Untitled'}</p>
                            <p className="truncate text-xs text-muted-foreground">{trackArtist(t) || '-'}</p>
                          </div>
                        )}

                        {/* Actions */}
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={saveEdit} className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" title="Save">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                            </button>
                            <button onClick={() => setEditingId(null)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-foreground-secondary hover:bg-surface-3" title="Cancel">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button title="Edit name & artist" onClick={() => beginEdit(t)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-foreground-secondary hover:bg-surface-3 hover:text-foreground transition">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button title="Delete" onClick={() => deleteTrack(t.id)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Premium upgrade banner */}
            {!isPremium ? (
              <div className="rounded-xl border border-primary/15 bg-primary/[0.04] py-2.5 text-center">
                <p className="text-xs text-primary/80">With premium, you can upload up to 5 audio files. <a href="/pricing" className="underline hover:text-primary">Upgrade now here.</a></p>
              </div>
            ) : null}

            {/* Audio Settings */}
            <div>
              <p className="mb-3 text-sm font-medium text-foreground">Audio Settings</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button" onClick={() => patch({ music_shuffle: !form.music_shuffle })}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${form.music_shuffle ? 'border-primary/30 bg-primary/10' : 'border-border bg-surface'}`}
                >
                  <span className="flex items-center gap-2 text-sm text-foreground"><svg className="h-4 w-4 text-foreground-secondary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/></svg> Shuffle</span>
                  <span className={`relative h-5 w-9 rounded-full transition ${form.music_shuffle ? 'bg-primary' : 'bg-white/10'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${form.music_shuffle ? 'left-4' : 'left-0.5'}`} /></span>
                </button>
                <button
                  type="button" onClick={() => patch({ music_hide_panel: !form.music_hide_panel })}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${!form.music_hide_panel ? 'border-primary/30 bg-primary/10' : 'border-border bg-surface'}`}
                >
                  <span className="flex items-center gap-2 text-sm text-foreground"><svg className="h-4 w-4 text-foreground-secondary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg> Player</span>
                  <span className={`relative h-5 w-9 rounded-full transition ${!form.music_hide_panel ? 'bg-primary' : 'bg-white/10'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${!form.music_hide_panel ? 'left-4' : 'left-0.5'}`} /></span>
                </button>
                <button
                  type="button" onClick={() => patch({ volume_control: !form.volume_control })}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${form.volume_control ? 'border-primary/30 bg-primary/10' : 'border-border bg-surface'}`}
                >
                  <span className="flex items-center gap-2 text-sm text-foreground"><svg className="h-4 w-4 text-foreground-secondary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg> Volume</span>
                  <span className={`relative h-5 w-9 rounded-full transition ${form.volume_control ? 'bg-primary' : 'bg-white/10'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${form.volume_control ? 'left-4' : 'left-0.5'}`} /></span>
                </button>
              </div>
            </div>

            {/* Show on the player */}
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Show on the Player</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'music_show_title' as const, label: 'Title',  on: form.music_show_title },
                  { key: 'music_show_artist' as const, label: 'Artist', on: form.music_show_artist },
                  { key: 'music_show_cover' as const,  label: 'Cover',  on: form.music_show_cover  },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => patch({ [s.key]: !s.on } as any)}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${s.on ? 'border-primary/30 bg-primary/[0.10] text-primary' : 'border-border bg-surface text-foreground-secondary hover:bg-surface-2'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Volume */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Default Volume <span className="text-xs text-muted-foreground ml-1">{form.music_volume}%</span></p>
                <button onClick={() => patch({ music_volume: 75 })} className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20"><RotateCcw className="h-3.5 w-3.5" /></button>
              </div>
              <input type="range" min={0} max={100} value={form.music_volume} onChange={(e) => patch({ music_volume: Number(e.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-primary" />
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Add Audio popup */}
      <AddAudioPopup
        open={showAddPopup}
        onOpenChange={setShowAddPopup}
        isOwner={isOwner}
        onAdded={(t) => {
          setTracks((prev) => [...prev, t])
          if (!form.music_enabled) patch({ music_enabled: true })
        }}
      />
    </>
  )
}

function AddAudioPopup({
  open, onOpenChange, onAdded, isOwner = false,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  onAdded: (t: MusicTrack) => void
  isOwner?: boolean
}) {
  const [audioUrl, setAudioUrl] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [filename, setFilename] = useState('')
  const [trackTitle, setTrackTitle] = useState('')
  const [trackArtist, setTrackArtist] = useState('')
  const [displayAsRecord, setDisplayAsRecord] = useState(false)
  const [spinRecord, setSpinRecord] = useState(false)
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [adding, setAdding] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [importingPreview, setImportingPreview] = useState(false)
  const audioRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  function reset() {
    setAudioUrl(''); setCoverUrl(''); setFilename(''); setTrackTitle(''); setTrackArtist(''); setDisplayAsRecord(false); setSpinRecord(false)
    setCropFile(null); setCropOpen(false)
  }

  // A freshly picked audio file goes to the cropper first, so the user can
  // trim it to the exact section they want before anything is uploaded. The
  // cropper hands back the final clip (trimmed or whole) which we then upload.
  function handleAudioPicked(file: File) {
    setCropFile(file)
    setCropOpen(true)
  }

  // Quick Import: fetch the FULL track and drop it into the trim modal. A
  // SoundCloud pick passes its permalink (exact + fast); an iTunes pick passes
  // title/artist for a best-match lookup. Falls back to the iTunes 30s preview
  // when the full-song path is unavailable (e.g. Cobalt not configured).
  async function handleSongImport(song: { title: string; artist: string; scUrl?: string | null; preview?: string | null; duration?: number }) {
    setImportingPreview(true)
    const safe = (song.title || song.artist || 'song').replace(/[^a-zA-Z0-9._ -]/g, '').slice(0, 60) || 'song'
    // Hard client-side timeout so the modal can never hang on a slow resolve.
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 90_000)
    try {
      const res = await fetch('/api/music/import-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song.scUrl ? { url: song.scUrl } : { title: song.title, artist: song.artist, duration: song.duration || 0 }),
        signal: ctrl.signal,
      })
      if (res.ok) {
        const blob = await res.blob()
        handleAudioPicked(new File([blob], `${safe}.mp3`, { type: blob.type || 'audio/mpeg' }))
        return
      }
      // Full-song path unavailable - fall back to the 30s preview clip.
      if (song.preview) {
        const pr = await fetch(`/api/proxy-audio?url=${encodeURIComponent(song.preview)}`)
        if (pr.ok) {
          const blob = await pr.blob()
          handleAudioPicked(new File([blob], `${safe}.m4a`, { type: blob.type || 'audio/mp4' }))
          return
        }
      }
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error || 'Could not import that song')
    } catch (e: any) {
      toast.error(
        ctrl.signal.aborted ? 'Import took too long - try again' : (e?.message || 'Could not import that song. Try uploading a file instead.'),
        { id: 'song-import' },
      )
    } finally {
      clearTimeout(timeout)
      setImportingPreview(false)
    }
  }

  async function uploadAudio(file: File) {
    setUploadingAudio(true)
    try {
      const r = await uploadFile(file, 'music')
      setAudioUrl(r.url)
      setFilename(file.name.replace(/\.[^.]+$/, ''))
    } catch (e: any) {
      // Stable toast id so rapid-fire failures (e.g. while the user is
      // hitting the rate limit) REPLACE the previous toast instead of
      // stacking into a wall of duplicates.
      toast.error(e?.message || 'Upload failed', { id: 'upload-error' })
    } finally {
      setUploadingAudio(false)
    }
  }
  async function uploadCover(file: File) {
    setUploadingCover(true)
    try {
      const r = await uploadFile(file, 'badge-media')
      setCoverUrl(r.url)
    } catch (e: any) {
      // Stable toast id so rapid-fire failures (e.g. while the user is
      // hitting the rate limit) REPLACE the previous toast instead of
      // stacking into a wall of duplicates.
      toast.error(e?.message || 'Upload failed', { id: 'upload-error' })
    } finally {
      setUploadingCover(false)
    }
  }

  async function handleAdd() {
    if (!audioUrl) { toast.error('Upload audio first'); return }
    setAdding(true)
    try {
      const res = await fetch('/api/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_title: trackTitle || filename || 'Untitled',
          track_artist: trackArtist,
          track_url: audioUrl,
          track_type: 'direct',
          cover_url: coverUrl || null,
          display_as_record: displayAsRecord,
          spin_record: displayAsRecord ? spinRecord : false,
        }),
      })
      if (!res.ok) throw new Error()
      const { track } = await res.json()
      onAdded(track)
      reset()
      onOpenChange(false)
      toast.success('Track added')
    } catch {
      toast.error('Failed to add track')
    } finally {
      setAdding(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><Music className="h-5 w-5" /></span>
            <div>
              <p className="text-base font-semibold text-foreground">Add New Audio</p>
              <p className="text-xs font-normal text-muted-foreground">Upload an audio file and an optional cover image</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {isOwner ? (
            <RezAudioExtras
              importing={importingPreview}
              onImport={({ song, fields }) => {
                if (fields.title && song.title) { setTrackTitle(song.title); setFilename(song.title) }
                if (fields.artist && song.artist) setTrackArtist(song.artist)
                if (fields.cover && song.cover) setCoverUrl(song.cover)
                // Audio is fetched as the full track and opens the trim modal.
                if (fields.audio) handleSongImport(song)
              }}
            />
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-foreground-secondary">Audio File</p>
              {/* accept="audio/*" alone is too narrow on several Windows
                  and Android file pickers - MP3s with a stale/missing
                  MIME registration get greyed-out and can't be picked.
                  Listing the common extensions explicitly alongside the
                  wildcard makes the OS picker fall back to filename
                  matching when MIME-matching fails. */}
              <input
                ref={audioRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.opus,.aac,.flac"
                className="hidden"
                // See BackgroundManager: reset input value so the same
                // audio file can be re-picked after a remove cycle.
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) handleAudioPicked(file)
                }}
              />
              <button
                type="button" onClick={() => audioRef.current?.click()}
                className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface transition hover:bg-surface-2"
              >
                {uploadingAudio ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : audioUrl ? (
                  <div className="px-3 text-center">
                    <Music className="mx-auto h-7 w-7 text-primary" />
                    <p className="mt-1 truncate text-xs text-primary">{filename || 'Audio ready ✓'}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Click to replace</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Music className="mx-auto h-7 w-7 text-muted-foreground" />
                    <p className="mt-1 text-xs text-muted-foreground">Click or Drop an Audio File</p>
                  </div>
                )}
              </button>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-foreground-secondary">Cover Image <span className="text-muted-foreground">(optional)</span></p>
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                className="hidden"
                // See BackgroundManager: reset input value so the same
                // cover image can be re-picked after a remove cycle.
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) uploadCover(file)
                }}
              />
              <button
                type="button" onClick={() => coverRef.current?.click()}
                className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface transition hover:bg-surface-2"
              >
                {uploadingCover ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : coverUrl ? (
                  <img src={coverUrl} alt="cover" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-7 w-7 text-muted-foreground" />
                    <p className="mt-1 text-xs text-muted-foreground">Click or Drop a Cover Image</p>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Title / Artist */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-medium text-foreground-secondary">Title</p>
              <input value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)}
                placeholder={filename || 'Track title'} maxLength={120}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40" />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-foreground-secondary">Artist <span className="text-muted-foreground">(optional)</span></p>
              <input value={trackArtist} onChange={(e) => setTrackArtist(e.target.value)}
                placeholder="Artist name" maxLength={120}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40" />
            </div>
          </div>

          {/* Cover shape + spin (only relevant when there's a cover) */}
          {coverUrl ? (
            <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-foreground-secondary">Cover Shape</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setDisplayAsRecord(false); setSpinRecord(false) }}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${!displayAsRecord ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-surface text-foreground-secondary hover:text-foreground-secondary'}`}
                  >
                    <span className="text-base leading-none">▪</span> Square
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayAsRecord(true)}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${displayAsRecord ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-surface text-foreground-secondary hover:text-foreground-secondary'}`}
                  >
                    <span className="text-base leading-none">●</span> Circle
                  </button>
                </div>
              </div>
              {displayAsRecord ? (
                <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                  <div className="flex items-center gap-2">
                    <svg className={`h-4 w-4 text-foreground-secondary ${spinRecord ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                    <div>
                      <p className="text-xs font-medium text-foreground">Spin Animation</p>
                      <p className="text-[10px] text-muted-foreground">Rotate cover like a vinyl record</p>
                    </div>
                  </div>
                  <Switch checked={spinRecord} onCheckedChange={setSpinRecord} />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button" onClick={() => { reset(); onOpenChange(false) }}
              className="rounded-xl border border-border bg-surface px-5 py-2 text-sm text-foreground-secondary hover:bg-surface-2 transition"
            >
              Cancel
            </button>
            <button
              type="button" onClick={handleAdd} disabled={adding || !audioUrl}
              className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-5 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition disabled:opacity-50"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Audio
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <AudioCropper
      open={cropOpen}
      file={cropFile}
      onCancel={() => { setCropOpen(false); setCropFile(null) }}
      onConfirm={(finalFile) => { setCropOpen(false); setCropFile(null); uploadAudio(finalFile) }}
    />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   AUDIO CROPPER MODAL
   Trim an uploaded audio file to an exact section before it's
   saved. Decodes the file locally (Web Audio), draws a waveform,
   lets the user drag a selection + scrub-preview just that
   region, then encodes the selection to a 16-bit WAV that gets
   uploaded in place of the original. Nothing touches the network
   until the user confirms.
   ═══════════════════════════════════════════════════════════ */

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const t = Math.floor((s * 10) % 10)
  return `${m}:${sec.toString().padStart(2, '0')}.${t}`
}

const MP3_BITRATE_KBPS = 192

const toInt16 = (f: number): number => {
  const s = f < -1 ? -1 : f > 1 ? 1 : f
  return s < 0 ? s * 0x8000 : s * 0x7fff
}

// Encode a sub-region of a decoded AudioBuffer to MP3 (lamejs). MP3 keeps the
// trimmed clip ~10x smaller than PCM/WAV - a full song fits well under the
// upload cap instead of blowing past it - and plays everywhere. Encoding is
// CPU-bound, so we yield every so often to keep the modal responsive.
async function encodeMp3Region(buffer: AudioBuffer, startSec: number, endSec: number): Promise<Blob> {
  const sampleRate = buffer.sampleRate
  const numCh = Math.min(2, buffer.numberOfChannels)
  const startSample = Math.max(0, Math.floor(startSec * sampleRate))
  const endSample = Math.min(buffer.length, Math.floor(endSec * sampleRate))

  const enc = new Mp3Encoder(numCh, sampleRate, MP3_BITRATE_KBPS)
  const left = buffer.getChannelData(0)
  const right = numCh > 1 ? buffer.getChannelData(1) : left
  const BLOCK = 1152
  const l16 = new Int16Array(BLOCK)
  const r16 = new Int16Array(BLOCK)
  const parts: Uint8Array[] = []

  let blocks = 0
  for (let i = startSample; i < endSample; i += BLOCK) {
    const n = Math.min(BLOCK, endSample - i)
    for (let j = 0; j < n; j++) {
      l16[j] = toInt16(left[i + j])
      if (numCh > 1) r16[j] = toInt16(right[i + j])
    }
    const lv = l16.subarray(0, n)
    const chunk = numCh > 1 ? enc.encodeBuffer(lv, r16.subarray(0, n)) : enc.encodeBuffer(lv)
    if (chunk.length > 0) parts.push(chunk)
    if (++blocks % 120 === 0) await new Promise((r) => setTimeout(r, 0))
  }
  const tail = enc.flush()
  if (tail.length > 0) parts.push(tail)
  return new Blob(parts as BlobPart[], { type: 'audio/mpeg' })
}

// Rough byte size of the MP3 for the selected region (bitrate * duration), so
// we can warn before a selection that would exceed the upload cap.
function estimateMp3Bytes(startSec: number, endSec: number): number {
  return Math.max(0, endSec - startSec) * (MP3_BITRATE_KBPS * 1000 / 8)
}

const AUDIO_UPLOAD_CAP = 25 * 1024 * 1024
const MIN_SELECTION_SEC = 0.5

function AudioCropper({
  open, file, onConfirm, onCancel,
}: {
  open: boolean
  file: File | null
  onConfirm: (f: File) => void
  onCancel: () => void
}) {
  const [decoding, setDecoding] = useState(false)
  const [decodeError, setDecodeError] = useState<string | null>(null)
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [peaks, setPeaks] = useState<{ min: number; max: number }[]>([])
  const [duration, setDuration] = useState(0)
  const [selStart, setSelStart] = useState(0)
  const [selEnd, setSelEnd] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const [encoding, setEncoding] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const objUrlRef = useRef<string | null>(null)
  const rafRef = useRef<number | null>(null)
  // Live refs for the rAF loop so it always reads the latest bounds without
  // being re-created every render.
  const selStartRef = useRef(0)
  const selEndRef = useRef(0)
  useEffect(() => { selStartRef.current = selStart }, [selStart])
  useEffect(() => { selEndRef.current = selEnd }, [selEnd])

  const baseName = useMemo(
    () => (file?.name || 'audio').replace(/\.[^.]+$/, '').slice(0, 80) || 'audio',
    [file],
  )

  // Decode the picked file into an AudioBuffer + downsampled peak data the
  // moment the cropper opens. All local - no upload yet.
  useEffect(() => {
    if (!open || !file) return
    let cancelled = false
    let ctx: AudioContext | null = null

    setDecoding(true)
    setDecodeError(null)
    setBuffer(null)
    setPeaks([])
    setPlaying(false)
    setPlayhead(0)

    // Object URL drives the <audio> element used for region preview - playing
    // the original encoded file keeps full fidelity while scrubbing.
    const url = URL.createObjectURL(file)
    objUrlRef.current = url

    ;(async () => {
      try {
        const arrayBuf = await file.arrayBuffer()
        const AudioCtx: typeof AudioContext =
          (window as any).AudioContext || (window as any).webkitAudioContext
        if (!AudioCtx) throw new Error('no-webaudio')
        ctx = new AudioCtx()
        // decodeAudioData detaches its input, so hand it a copy.
        const decoded = await ctx.decodeAudioData(arrayBuf.slice(0))
        if (cancelled) return

        // Build ~1000 min/max buckets from the loudest channel content so the
        // waveform is crisp at any width without scanning every sample on draw.
        const BUCKETS = 1000
        const len = decoded.length
        const step = Math.max(1, Math.floor(len / BUCKETS))
        const chans: Float32Array[] = []
        for (let c = 0; c < decoded.numberOfChannels; c++) chans.push(decoded.getChannelData(c))
        const pk: { min: number; max: number }[] = []
        for (let i = 0; i < len; i += step) {
          let mn = 1
          let mx = -1
          const end = Math.min(i + step, len)
          for (let j = i; j < end; j++) {
            for (let c = 0; c < chans.length; c++) {
              const v = chans[c][j]
              if (v < mn) mn = v
              if (v > mx) mx = v
            }
          }
          pk.push({ min: mn, max: mx })
        }

        if (cancelled) return
        setBuffer(decoded)
        setPeaks(pk)
        setDuration(decoded.duration)
        setSelStart(0)
        setSelEnd(decoded.duration)
        selStartRef.current = 0
        selEndRef.current = decoded.duration
      } catch (e: any) {
        if (cancelled) return
        // Codecs the browser can't decode (some flac/opus) still upload fine -
        // just without the trim step. Surface a gentle fallback path.
        setDecodeError(e?.message === 'no-webaudio'
          ? "This browser can't preview audio for trimming."
          : "Couldn't read this file for trimming.")
      } finally {
        if (!cancelled) setDecoding(false)
        if (ctx) { try { await ctx.close() } catch { /* already closed */ } }
      }
    })()

    return () => {
      cancelled = true
      if (objUrlRef.current) { URL.revokeObjectURL(objUrlRef.current); objUrlRef.current = null }
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current = null }
    }
  }, [open, file])

  // Draw the waveform whenever peaks/selection change. Selection is drawn as a
  // brighter band over a dimmed full track so the trimmed region reads clearly.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || peaks.length === 0 || duration <= 0) return
    const dpr = Math.min(2, (window.devicePixelRatio || 1))
    const cssW = canvas.clientWidth || 480
    const cssH = canvas.clientHeight || 112
    canvas.width = Math.floor(cssW * dpr)
    canvas.height = Math.floor(cssH * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    const mid = cssH / 2
    const selA = (selStart / duration) * cssW
    const selB = (selEnd / duration) * cssW

    for (let x = 0; x < cssW; x++) {
      const idx = Math.min(peaks.length - 1, Math.floor((x / cssW) * peaks.length))
      const p = peaks[idx]
      const yMax = mid - p.max * mid * 0.92
      const yMin = mid - p.min * mid * 0.92
      const inSel = x >= selA && x <= selB
      ctx.strokeStyle = inSel ? 'rgba(232,127,160,0.95)' : 'rgba(255,255,255,0.14)'
      ctx.beginPath()
      ctx.moveTo(x + 0.5, Math.min(yMax, mid - 0.5))
      ctx.lineTo(x + 0.5, Math.max(yMin, mid + 0.5))
      ctx.stroke()
    }
  }, [peaks, duration, selStart, selEnd])

  // Drag handling for the two trim handles + the selection body. Pointer math
  // converts clientX into a time within [0, duration].
  const dragRef = useRef<null | { mode: 'start' | 'end' | 'move'; grabSec: number; spanStart: number; spanEnd: number }>(null)

  const xToSec = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el || duration <= 0) return 0
    const rect = el.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return frac * duration
  }, [duration])

  const onHandleDown = useCallback((mode: 'start' | 'end' | 'move') => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const sec = xToSec(e.clientX)
    dragRef.current = { mode, grabSec: sec, spanStart: selStart, spanEnd: selEnd }

    // Stop playback as soon as the user actually drags a handle - the preview
    // was for the old selection, so it shouldn't keep playing while they retrim.
    let stoppedForDrag = false

    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      if (!stoppedForDrag) { stopPreview(); stoppedForDrag = true }
      const at = xToSec(ev.clientX)
      if (d.mode === 'start') {
        setSelStart(Math.min(at, selEndRef.current - MIN_SELECTION_SEC))
      } else if (d.mode === 'end') {
        setSelEnd(Math.max(at, selStartRef.current + MIN_SELECTION_SEC))
      } else {
        const span = d.spanEnd - d.spanStart
        let ns = d.spanStart + (at - d.grabSec)
        ns = Math.min(Math.max(0, ns), duration - span)
        setSelStart(ns)
        setSelEnd(ns + span)
      }
    }
    const up = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [xToSec, selStart, selEnd, duration])

  // Click on the bare waveform to drop the playhead (and seek preview there).
  const onTrackDown = useCallback((e: React.PointerEvent) => {
    const at = xToSec(e.clientX)
    setPlayhead(at)
    const a = audioElRef.current
    if (a) { try { a.currentTime = Math.min(Math.max(at, selStartRef.current), selEndRef.current) } catch { /* not seekable */ } }
  }, [xToSec])

  function stopPreview() {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    const a = audioElRef.current
    if (a) { a.pause() }
    setPlaying(false)
  }

  function togglePreview() {
    if (playing) { stopPreview(); return }
    const url = objUrlRef.current
    if (!url) return
    let a = audioElRef.current
    if (!a) {
      a = new Audio(url)
      audioElRef.current = a
    }
    // Always (re)start at the selection head for a predictable preview.
    try { a.currentTime = selStartRef.current } catch { /* seek after metadata */ }
    setPlayhead(selStartRef.current)
    setPlaying(true)

    const tick = () => {
      const el = audioElRef.current
      if (!el) return
      const t = el.currentTime
      setPlayhead(t)
      if (t >= selEndRef.current - 0.01) {
        el.pause()
        setPlaying(false)
        rafRef.current = null
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    a.play().then(() => {
      rafRef.current = requestAnimationFrame(tick)
    }).catch(() => {
      setPlaying(false)
      toast.error('Browser blocked preview playback')
    })
  }

  async function handleConfirm() {
    if (!buffer) return
    if (estimateMp3Bytes(selStart, selEnd) > AUDIO_UPLOAD_CAP) {
      toast.error('Trimmed clip is too long. Select a shorter section.')
      return
    }
    stopPreview()
    setEncoding(true)
    try {
      // Yield a frame so the spinner paints before the encode starts.
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const blob = await encodeMp3Region(buffer, selStart, selEnd)
      const out = new File([blob], `${baseName}-trim.mp3`, { type: 'audio/mpeg' })
      onConfirm(out)
    } catch {
      toast.error('Could not process the trim. Try again.')
    } finally {
      setEncoding(false)
    }
  }

  function handleUseFull() {
    if (!file) return
    stopPreview()
    onConfirm(file)
  }

  const selDuration = Math.max(0, selEnd - selStart)
  const estBytes = estimateMp3Bytes(selStart, selEnd)
  const overCap = estBytes > AUDIO_UPLOAD_CAP

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { stopPreview(); onCancel() } }}>
      <DialogContent className="border-border bg-surface sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><Scissors className="h-5 w-5" /></span>
            <div>
              <p className="text-base font-semibold text-foreground">Trim Audio</p>
              <p className="text-xs font-normal text-muted-foreground">Drag the handles to pick the section, preview it, then confirm</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {decoding ? (
            <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Reading waveform...</p>
            </div>
          ) : decodeError ? (
            <div className="flex h-44 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface-2 px-6 text-center">
              <Music className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-foreground-secondary">{decodeError}</p>
              <p className="text-xs text-muted-foreground">You can still add the full track without trimming.</p>
            </div>
          ) : (
            <>
              {/* Waveform + selection */}
              <div
                ref={trackRef}
                onPointerDown={onTrackDown}
                className="relative h-28 w-full cursor-text select-none overflow-hidden rounded-xl border border-border bg-surface-2"
              >
                <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

                {duration > 0 && (
                  <>
                    {/* Dim the regions outside the selection */}
                    <div className="absolute inset-y-0 left-0 bg-black/55" style={{ width: `${(selStart / duration) * 100}%` }} />
                    <div className="absolute inset-y-0 right-0 bg-black/55" style={{ width: `${(1 - selEnd / duration) * 100}%` }} />

                    {/* Selection body - drag to move the whole window */}
                    <div
                      onPointerDown={onHandleDown('move')}
                      className="absolute inset-y-0 cursor-grab border-y border-primary/40 bg-primary/[0.06] active:cursor-grabbing"
                      style={{ left: `${(selStart / duration) * 100}%`, width: `${((selEnd - selStart) / duration) * 100}%` }}
                    />

                    {/* Start handle */}
                    <div
                      onPointerDown={onHandleDown('start')}
                      className="group absolute inset-y-0 z-10 -ml-1.5 w-3 cursor-ew-resize"
                      style={{ left: `${(selStart / duration) * 100}%` }}
                    >
                      <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-primary" />
                      <div className="absolute top-1/2 left-1/2 h-7 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-primary/60 bg-primary shadow" />
                    </div>

                    {/* End handle */}
                    <div
                      onPointerDown={onHandleDown('end')}
                      className="group absolute inset-y-0 z-10 -ml-1.5 w-3 cursor-ew-resize"
                      style={{ left: `${(selEnd / duration) * 100}%` }}
                    >
                      <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-primary" />
                      <div className="absolute top-1/2 left-1/2 h-7 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-primary/60 bg-primary shadow" />
                    </div>

                    {/* Playhead */}
                    {playing && (
                      <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-white" style={{ left: `${(playhead / duration) * 100}%` }} />
                    )}
                  </>
                )}
              </div>

              {/* Timeline ruler - absolute time at evenly-spaced points across
                  the track, so you can see what time any position maps to
                  (the middle label is the track's midpoint). */}
              {duration > 0 && (
                <div className="flex justify-between px-0.5 font-mono text-[10px] text-muted-foreground/70">
                  {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                    <span key={f}>{fmtTime(duration * f)}</span>
                  ))}
                </div>
              )}

              {/* Time readouts */}
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-md bg-surface-2 px-2 py-1 font-mono text-foreground-secondary">{fmtTime(selStart)}</span>
                <span className="flex items-center gap-1.5 font-medium text-primary">
                  <Scissors className="h-3.5 w-3.5" /> {fmtTime(selDuration)}
                </span>
                <span className="rounded-md bg-surface-2 px-2 py-1 font-mono text-foreground-secondary">{fmtTime(selEnd)}</span>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button" onClick={togglePreview}
                  className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {playing ? 'Stop' : 'Preview selection'}
                </button>
                <button
                  type="button"
                  onClick={() => { setSelStart(0); setSelEnd(duration) }}
                  className="ml-auto flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground-secondary transition hover:bg-surface-2"
                >
                  <ArrowBackUp className="h-4 w-4" /> Reset
                </button>
              </div>

              {overCap ? (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  This selection would be {(estBytes / 1024 / 1024).toFixed(0)}MB once trimmed - over the 25MB limit. Drag the handles in to shorten it.
                </p>
              ) : null}
            </>
          )}

          {/* Footer actions */}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button" onClick={() => { stopPreview(); onCancel() }}
              className="rounded-xl border border-border bg-surface px-5 py-2 text-sm text-foreground-secondary transition hover:bg-surface-2"
            >
              Cancel
            </button>
            {decodeError && !decoding ? (
              <button
                type="button" onClick={handleUseFull} disabled={encoding}
                className="rounded-xl border border-border bg-surface px-5 py-2 text-sm text-foreground-secondary transition hover:bg-surface-2 disabled:opacity-50"
              >
                Add full track
              </button>
            ) : null}
            {!decodeError && !decoding ? (
              <button
                type="button" onClick={handleConfirm} disabled={encoding || overCap || !buffer}
                className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-5 py-2 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:opacity-50"
              >
                {encoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                {encoding ? 'Processing...' : 'Confirm trim'}
              </button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════
   CURSOR MANAGER MODAL
   ═══════════════════════════════════════════════════════════ */

function CursorManagerModal({
  open, onOpenChange, form, patch,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  form: FormState; patch: (u: Partial<FormState>) => void
}) {
  const [uploadingDefault, setUploadingDefault] = useState(false)
  const [uploadingHover, setUploadingHover] = useState(false)
  const defaultRef = useRef<HTMLInputElement>(null)
  const hoverRef = useRef<HTMLInputElement>(null)

  async function uploadDefault(file: File) {
    setUploadingDefault(true)
    try {
      const r = await uploadFile(file, 'cursor')
      patch({ custom_cursor_url: r.url })
      toast.success('Cursor uploaded')
    } catch (e: any) {
      // Stable toast id so rapid-fire failures (e.g. while the user is
      // hitting the rate limit) REPLACE the previous toast instead of
      // stacking into a wall of duplicates.
      toast.error(e?.message || 'Upload failed', { id: 'upload-error' })
    } finally {
      setUploadingDefault(false)
    }
  }
  async function uploadHover(file: File) {
    setUploadingHover(true)
    try {
      const r = await uploadFile(file, 'cursor')
      patch({ custom_cursor_hover_url: r.url })
      toast.success('Hover cursor uploaded')
    } catch (e: any) {
      // Stable toast id so rapid-fire failures (e.g. while the user is
      // hitting the rate limit) REPLACE the previous toast instead of
      // stacking into a wall of duplicates.
      toast.error(e?.message || 'Upload failed', { id: 'upload-error' })
    } finally {
      setUploadingHover(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <MousePointer2 className="h-5 w-5" /> Cursor Manager
          </DialogTitle>
          <p className="text-sm text-foreground-secondary">Upload custom cursors.</p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Custom cursors render alongside your chosen Cursor Effect. Tip: PNG/GIF, ideally 32&times;32 with a transparent background.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Regular cursor */}
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground-secondary">Regular Cursor</p>
              <input
                ref={defaultRef}
                type="file"
                accept="image/*,image/gif"
                className="hidden"
                // Reset value so the same cursor image can be re-picked
                // after a remove cycle - see BackgroundManager.
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) uploadDefault(file)
                }}
              />
              <button
                type="button" onClick={() => defaultRef.current?.click()}
                className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface transition hover:bg-surface-2"
              >
                {uploadingDefault ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> :
                  form.custom_cursor_url ? <img src={form.custom_cursor_url} alt="cursor" className="max-h-12 max-w-12 object-contain" /> :
                  <div className="text-center"><Upload className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-1 text-xs text-muted-foreground">Click or drop</p></div>
                }
              </button>
              {form.custom_cursor_url ? (
                <button onClick={() => patch({ custom_cursor_url: '' })} className="mt-1 text-xs text-muted-foreground hover:text-red-400">Remove</button>
              ) : null}
            </div>

            {/* Hover/pointer cursor */}
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground-secondary">Pointer Cursor</p>
              <input
                ref={hoverRef}
                type="file"
                accept="image/*,image/gif"
                className="hidden"
                // Reset value so the same cursor image can be re-picked
                // after a remove cycle - see BackgroundManager.
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) uploadHover(file)
                }}
              />
              <button
                type="button" onClick={() => hoverRef.current?.click()}
                className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface transition hover:bg-surface-2"
              >
                {uploadingHover ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> :
                  form.custom_cursor_hover_url ? <img src={form.custom_cursor_hover_url} alt="hover" className="max-h-12 max-w-12 object-contain" /> :
                  <div className="text-center"><Upload className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-1 text-xs text-muted-foreground">Click or drop</p></div>
                }
              </button>
              {form.custom_cursor_hover_url ? (
                <button onClick={() => patch({ custom_cursor_hover_url: '' })} className="mt-1 text-xs text-muted-foreground hover:text-red-400">Remove</button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════
   MINIMAL PROFILE PREVIEW (sticky right panel)
   ═══════════════════════════════════════════════════════════ */

function MinimalProfilePreview({
  profile, form, viewCount,
}: {
  profile: Profile
  form: FormState
  viewCount: number
}) {
  const isVideoBg = form.background_url && /\.(mp4|webm|mov)(\?|$)/i.test(form.background_url)
  const displayName = (form.display_name || profile.username || 'user').trim()
  const handle = profile.username || 'user'

  return (
    <div className="sticky top-6">
      <div className="mb-3 text-right">
        <span className="text-xs font-medium text-primary">Minimal Profile Preview</span>
      </div>

      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-border shadow-2xl"
        style={{ backgroundColor: form.background_color || '#030306' }}
      >
        {/* Background - full opacity */}
        {form.background_url ? (
          isVideoBg ? (
            <video src={form.background_url} autoPlay loop muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <img src={form.background_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )
        ) : (
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at top, ${form.accent_color}30, transparent 60%)` }} />
        )}

        {/* Subtle dark overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />

        {/* View count pill (top right) */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[11px] text-foreground backdrop-blur-md">
          <Eye className="h-3 w-3" />
          {viewCount.toLocaleString()}
        </div>

        {/* Profile content centered */}
        <div className="relative flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
          {/* Avatar */}
          <div
            className="overflow-hidden ring-2"
            style={{
              width: 96, height: 96,
              borderRadius: '50%',
              // Owner-only (@rez) avatar outline + glow ring layered before
              // the default accent shadow. Mirrors buildAvatarRing in
              // guns-profile.tsx (glow spread = size/5, capped at 40).
              boxShadow: [
                ...(form.avatar_outline_enabled && form.avatar_outline_size > 0
                  ? [`0 0 0 ${form.avatar_outline_size}px ${form.avatar_outline_color}`] : []),
                ...(form.avatar_glow_enabled && form.avatar_glow_size > 0
                  ? [`0 0 ${Math.min(40, form.avatar_glow_size)}px ${Math.round(Math.min(40, form.avatar_glow_size) / 5)}px ${form.avatar_glow_color}`] : []),
                `0 0 24px ${form.accent_color}55`,
                `0 6px 20px rgba(0,0,0,0.4)`,
              ].join(', '),
              ['--tw-ring-color' as any]: `${form.accent_color}66`,
            }}
          >
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-bold" style={{ background: `${form.accent_color}30`, color: form.accent_color }}>
                {displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>

          {/* Username */}
          <div>
            <div className="text-2xl font-bold leading-tight" style={{
              color: form.accent_color,
              textShadow: form.glow_username ? `0 0 ${Math.max(10, form.glow_intensity / 3)}px ${form.glow_color}, 0 0 ${Math.max(18, form.glow_intensity / 1.6)}px ${form.glow_color}80` : undefined,
            }}>
              <UsernameDisplay text={displayName} effect={form.username_effect} accentColor={form.accent_color} className="text-2xl font-bold" />
            </div>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wider" style={{ color: `${form.text_color}b3` }}>
              @{handle}
            </p>
          </div>

          {/* Bio (short, no markdown) */}
          {form.bio ? (
            <p className="line-clamp-2 max-w-[200px] text-[11px]" style={{ color: `${form.text_color}cc` }}>
              {form.bio.replace(/[*_~`#\[\]()]/g, '').replace(/<[^>]+>/g, '').trim()}
            </p>
          ) : null}

          {/* Location pill */}
          {form.location ? (
            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider" style={{ color: form.accent_color }}>
              <MapPin className="h-3 w-3" />
              {form.location}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   ADVANCED TEXT COLORS - granular per-element overrides
   ═══════════════════════════════════════════════════════════ */

// NOTE: the `display_name_color` column drives the big username line at
// the top of the profile (since the separate display-name block was removed
// and @handle was promoted). `username_handle_color` is left in the DB
// schema but no longer surfaced - the two used to be two visually distinct
// lines, now they collapse to one.
// `inheritKey` names the FormState field this override falls back to
// when left empty. Most text colours inherit from text_color; the
// background-effect colour inherits from accent_color since it tints
// particles / rain / aurora / etc. which use the accent by default.
const ADVANCED_COLOR_TARGETS: { key: keyof FormState; label: string; desc: string; inheritKey: keyof FormState }[] = [
  { key: 'display_name_color',     label: 'Username',          desc: 'The big name at the top of your profile.',         inheritKey: 'text_color' },
  { key: 'bio_color',              label: 'Bio',               desc: 'Your description and typewriter texts.',           inheritKey: 'text_color' },
  { key: 'location_color',         label: 'Location',          desc: 'The city / location pill.',                        inheritKey: 'text_color' },
  { key: 'card_text_color',        label: 'Card Text',         desc: 'View count, secondary labels.',                    inheritKey: 'text_color' },
  { key: 'music_text_color',       label: 'Music Panel',       desc: 'Track title, artist, time.',                       inheritKey: 'text_color' },
  { key: 'background_effect_color',label: 'Background Effects',desc: 'Particles, rain, snow, aurora, plasma, fireflies.', inheritKey: 'accent_color' },
]

function AdvancedTextColors({ form, patch }: { form: FormState; patch: (u: Partial<FormState>) => void }) {
  // "Enabled" means the user has toggled this section open. We treat any
  // active override as also implicitly enabled so existing users with
  // overrides set don't suddenly see the section collapsed.
  const activeOverrides = ADVANCED_COLOR_TARGETS.filter(t => (form as any)[t.key]).length
  const [enabled, setEnabled] = useState(activeOverrides > 0)

  function disableAndClear() {
    // Disabling clears every override so the section truly turns off, just
    // like Profile Gradient turning off resets the gradient colors.
    const cleared: Record<string, null> = {}
    for (const t of ADVANCED_COLOR_TARGETS) cleared[t.key as string] = null
    patch(cleared as any)
    setEnabled(false)
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium text-foreground-secondary">Advanced Text Colors</span>
        {activeOverrides > 0 && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {activeOverrides} active
          </span>
        )}
      </div>
      {enabled ? (
        <>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            Override the color of specific elements. Leave empty to inherit from the base Text color.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ADVANCED_COLOR_TARGETS.map((t) => {
            const val = (form[t.key] as string) || ''
            const inherit = ((form as any)[t.inheritKey] as string) || '#ffffff'
            const isInheriting = !val
            return (
              <div
                key={t.key}
                className={`rounded-xl border p-3 transition-colors ${isInheriting ? 'border-border bg-surface' : 'border-primary/20 bg-primary/[0.04]'}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">{t.label}</p>
                    <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{t.desc}</p>
                  </div>
                  {!isInheriting && (
                    <button
                      type="button"
                      onClick={() => patch({ [t.key]: '' } as any)}
                      title={`Clear (inherit from ${t.inheritKey === 'accent_color' ? 'Accent' : 'Text'})`}
                      className="text-muted-foreground transition hover:text-foreground-secondary"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-1.5 pr-3">
                  <input
                    type="color"
                    value={val || inherit}
                    onChange={(e) => patch({ [t.key]: e.target.value } as any)}
                    className="h-7 w-9 cursor-pointer rounded-md border-0 bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => patch({ [t.key]: e.target.value } as any)}
                    placeholder={`Inherit (${inherit.toUpperCase()})`}
                    className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none"
                  />
                </div>
              </div>
            )
          })}
          </div>
          <button type="button" onClick={disableAndClear}
            className="mt-3 w-full rounded-xl border border-primary/30 bg-primary/10 py-2.5 text-sm font-medium text-primary hover:bg-primary/15 transition-colors">
            Advanced Text Colors Enabled - click to disable
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setEnabled(true)}
          className="w-full rounded-xl border border-dashed border-primary/30 py-3 text-sm text-primary/60 hover:border-primary/60 hover:text-primary transition-colors">
          Advanced Text Colors Disabled - click to enable
        </button>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   FONT UPLOADER - custom font + per-element targeting
   ═══════════════════════════════════════════════════════════ */

type SlotIdx = 1 | 2 | 3 | 4

const FONT_SLOT_KEYS: ReadonlyArray<{ slot: SlotIdx; urlKey: keyof FormState; nameKey: keyof FormState }> = [
  { slot: 1, urlKey: 'font_1_url', nameKey: 'font_1_name' },
  { slot: 2, urlKey: 'font_2_url', nameKey: 'font_2_name' },
  { slot: 3, urlKey: 'font_3_url', nameKey: 'font_3_name' },
  { slot: 4, urlKey: 'font_4_url', nameKey: 'font_4_name' },
]

// NOTE: `font_slot_username` drives the big username line (the renderer
// applies it to the promoted @handle/Username Overlay). `font_slot_displayname`
// is left in the DB schema for backward compat but no longer surfaced - the
// two former lines collapsed into one when @handle was promoted.
const FONT_TARGETS: ReadonlyArray<{ slotKey: keyof FormState; label: string; desc: string }> = [
  { slotKey: 'font_slot_username',    label: 'Username',     desc: 'The big name at the top' },
  { slotKey: 'font_slot_bio',         label: 'Bio',          desc: 'Description / typewriter text' },
  { slotKey: 'font_slot_music',       label: 'Music Panel',  desc: 'Track title + artist' },
]

/** Inject @font-face for every uploaded slot so previews can use them. */
function useSlotFontFaces(form: FormState) {
  useEffect(() => {
    const styleId = 'customize-font-preview-slots'
    let el = document.getElementById(styleId) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = styleId
      document.head.appendChild(el)
    }
    const decls: string[] = []
    FONT_SLOT_KEYS.forEach(({ slot, urlKey }) => {
      const url = form[urlKey] as string
      if (!url) return
      decls.push(`@font-face { font-family: 'CustomFontSlot${slot}'; src: url('${url}'); font-display: swap; }`)
    })
    el.textContent = decls.join('\n')
  }, [form.font_1_url, form.font_2_url, form.font_3_url, form.font_4_url])
}

function FontUploader({ form, patch }: { form: FormState; patch: (u: Partial<FormState>) => void }) {
  useSlotFontFaces(form)
  const [uploadingSlot, setUploadingSlot] = useState<SlotIdx | null>(null)
  const fileRefs = useRef<Record<SlotIdx, HTMLInputElement | null>>({ 1: null, 2: null, 3: null, 4: null })

  async function handleFile(slot: SlotIdx, file: File) {
    if (!/\.(woff2?|ttf|otf)$/i.test(file.name)) { toast.error('Use .woff2, .woff, .ttf, or .otf'); return }
    setUploadingSlot(slot)
    try {
      // Size check happens inside uploadFile() per the per-type limit map.
      const r = await uploadFile(file, 'font')
      const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
      const urlKey = `font_${slot}_url` as keyof FormState
      const nameKey = `font_${slot}_name` as keyof FormState
      patch({ [urlKey]: r.url, [nameKey]: (form[nameKey] as string) || cleanName } as any)
      // Slot 1 also fills the legacy `custom_font_url` field for backwards
      // compat with anything still reading the old single-font column.
      if (slot === 1) patch({ custom_font_url: r.url, custom_font_name: (form.custom_font_name || cleanName) })
      toast.success(`font uploaded to slot ${slot}`)
    } catch (e: any) {
      // Stable toast id so rapid-fire failures (e.g. while the user is
      // hitting the rate limit) REPLACE the previous toast instead of
      // stacking into a wall of duplicates.
      toast.error(e?.message || 'Upload failed', { id: 'upload-error' })
    } finally {
      setUploadingSlot(null)
    }
  }

  function clearSlot(slot: SlotIdx) {
    const urlKey = `font_${slot}_url` as keyof FormState
    const nameKey = `font_${slot}_name` as keyof FormState
    patch({ [urlKey]: '', [nameKey]: '' } as any)
    if (slot === 1) patch({ custom_font_url: '', custom_font_name: '' })
    // Any element pointing at this slot falls back to system default
    const fallback: Partial<FormState> = {}
    FONT_TARGETS.forEach((t) => {
      if ((form[t.slotKey] as number) === slot) fallback[t.slotKey] = 0 as any
    })
    if (Object.keys(fallback).length > 0) patch(fallback)
  }

  const slotFamily = (slot: number) => slot >= 1 && slot <= 4 && form[`font_${slot}_url` as keyof FormState] ? `'CustomFontSlot${slot}', system-ui, sans-serif` : 'system-ui, sans-serif'
  const filledSlots = FONT_SLOT_KEYS.filter(({ urlKey }) => Boolean(form[urlKey]))

  return (
    <div className="space-y-5">
      {/* 4 font slots */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-secondary">your fonts ({filledSlots.length}/4)</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FONT_SLOT_KEYS.map(({ slot, urlKey, nameKey }) => {
            const url = form[urlKey] as string
            const name = form[nameKey] as string
            const isUploading = uploadingSlot === slot
            return (
              <div key={slot} className="rounded-lg border border-border bg-surface p-3">
                <input
                  ref={(el) => { fileRefs.current[slot] = el }}
                  type="file"
                  accept=".woff,.woff2,.ttf,.otf"
                  className="hidden"
                  // Reset value so the same font file can be re-picked
                  // after a remove cycle - see BackgroundManager.
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) handleFile(slot, file)
                  }}
                />
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">slot {slot}</span>
                  {url ? (
                    <button onClick={() => clearSlot(slot)} className="text-muted-foreground hover:text-red-400 transition" title="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                {url ? (
                  <>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => patch({ [nameKey]: e.target.value } as any)}
                      placeholder={`Font ${slot}`}
                      maxLength={40}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
                    />
                    <p className="mt-1.5 truncate text-base text-foreground" style={{ fontFamily: slotFamily(slot) }}>
                      {name || `Font ${slot}`} - The quick brown fox
                    </p>
                    <button
                      onClick={() => fileRefs.current[slot]?.click()}
                      disabled={isUploading}
                      className="mt-2 w-full rounded-md border border-border bg-surface py-1.5 text-xs text-foreground-secondary hover:bg-surface-2 hover:text-foreground transition disabled:opacity-50"
                    >
                      {isUploading ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'replace'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRefs.current[slot]?.click()}
                    disabled={isUploading}
                    className="flex h-[78px] w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-muted-foreground transition hover:border-primary/40 hover:text-foreground-secondary"
                  >
                    {isUploading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /><span className="text-[11px]">uploading…</span></>
                    ) : (
                      <><Upload className="h-4 w-4" /><span className="text-[11px]">upload .woff2 / .ttf / .otf</span></>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-element font assignment */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-secondary">use which font where</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FONT_TARGETS.map((t) => {
            const currentSlot = Number(form[t.slotKey]) || 0
            return (
              <div key={t.slotKey as string} className="rounded-lg border border-border bg-surface p-3">
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                <div className="mt-2 grid grid-cols-5 gap-1">
                  <button
                    type="button"
                    onClick={() => patch({ [t.slotKey]: 0 } as any)}
                    className={`rounded-md border px-2 py-1 text-[11px] transition ${currentSlot === 0 ? 'border-primary bg-primary/[0.08] text-primary' : 'border-border bg-surface text-foreground-secondary hover:text-foreground'}`}
                  >
                    default
                  </button>
                  {FONT_SLOT_KEYS.map(({ slot, urlKey }) => {
                    const filled = Boolean(form[urlKey])
                    const active = currentSlot === slot
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={!filled}
                        onClick={() => patch({ [t.slotKey]: slot } as any)}
                        className={`rounded-md border px-2 py-1 text-[11px] transition disabled:opacity-30 ${active ? 'border-primary bg-primary/[0.08] text-primary' : 'border-border bg-surface text-foreground-secondary hover:text-foreground'}`}
                        title={filled ? (form[`font_${slot}_name` as keyof FormState] as string || `Slot ${slot}`) : 'Empty slot'}
                      >
                        {slot}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Live preview */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">preview</p>
        {/* Single username line, matches the actual profile layout - the
            separate "display name" line was removed when @handle was
            promoted to be the primary name. */}
        <p className="mt-2 text-2xl font-bold text-white" style={{ fontFamily: slotFamily(form.font_slot_username) }}>
          {form.display_name || 'username'}
        </p>
        <p className="mt-2 text-sm text-foreground-secondary" style={{ fontFamily: slotFamily(form.font_slot_bio) }}>
          {form.bio || 'Your bio renders here. The quick brown fox jumps over the lazy dog. 0123456789!?'}
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-black/30 px-3 py-2" style={{ fontFamily: slotFamily(form.font_slot_music) }}>
          <Music className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-foreground">Track title</span>
          <span className="text-xs text-muted-foreground">- Artist</span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   DISCORD JOIN POPUP - shown once per user account on /customize
   ═══════════════════════════════════════════════════════════ */

// Storage key is scoped to the user's id so brand-new accounts always see
// the popup once even on a browser where another account already dismissed
// it. A returning user on a fresh browser/device may see it again, which is
// acceptable for a marketing prompt.
const DISCORD_POPUP_KEY_PREFIX = 'halo-discord-popup-dismissed:'

function DiscordJoinPopup({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const storageKey = `${DISCORD_POPUP_KEY_PREFIX}${userId}`

  useEffect(() => {
    // Show on first visit for this account, remember dismissal forever.
    try {
      if (typeof window === 'undefined') return
      const dismissed = window.localStorage.getItem(storageKey)
      if (!dismissed) {
        // Small delay so the page paints first, popup feels intentional
        const t = window.setTimeout(() => setOpen(true), 700)
        return () => window.clearTimeout(t)
      }
    } catch { /* localStorage unavailable - just don't show */ }
  }, [storageKey])

  function dismiss() {
    try { window.localStorage.setItem(storageKey, '1') } catch {}
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss() }}>
      <DialogContent className="overflow-hidden border-border bg-surface p-0 sm:max-w-md">
        {/* Header band with discord-color accent */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#5865F2]/15 via-transparent to-primary/10 px-6 pt-6 pb-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(88,101,242,0.32) 0%, transparent 70%)' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -left-12 h-32 w-32 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(232,127,160,0.25) 0%, transparent 70%)' }}
          />

          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-2.5 text-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#5865F2]/40 bg-[#5865F2]/15">
                {/* Discord glyph */}
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#fff" style={{ filter: 'drop-shadow(0 0 6px rgba(88,101,242,0.6))' }}>
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </span>
              <span className="text-[1.05rem] font-bold tracking-tight">come hang in the discord</span>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="space-y-3 px-6 pb-2 pt-3">
          <p className="text-sm leading-relaxed text-foreground">
            wanna know when new stuff drops? or get a shot at <span className="font-semibold text-primary">free premium</span>?
          </p>
          <p className="text-sm leading-relaxed text-foreground-secondary">
            we drop updates, run giveaways, and help fix stuff over there. way better than the website telling you nothing.
          </p>

          {/* Perks list */}
          <ul className="space-y-1.5 pt-1">
            {[
              { icon: '🎁', text: 'free premium giveaways' },
              { icon: '🚀', text: 'first look at new features' },
              { icon: '💬', text: 'help straight from us' },
            ].map((perk) => (
              <li key={perk.text} className="flex items-center gap-2 text-[13px] text-foreground-secondary">
                <span className="text-base leading-none">{perk.icon}</span>
                <span>{perk.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col-reverse gap-2 border-t border-border bg-black/20 px-6 py-4 sm:flex-row">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-xl border border-border bg-surface py-2.5 text-sm font-medium text-foreground-secondary hover:bg-surface-2 transition"
          >
            already joined / later
          </button>
          <a
            href="https://discord.gg/NgVh45gXbD"
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5865F2] to-[#7B6FF6] py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(88,101,242,0.6)] hover:opacity-95 transition"
          >
            sure, take me there
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

interface Props { profile: Profile; isPremium?: boolean }

export default function CustomizeClient({ profile, isPremium = false }: Props) {
  const [form, setForm] = useState<FormState>(() => fromProfile(profile))
  const savedForm = useRef<FormState>(fromProfile(profile))
  const [saving, setSaving] = useState(false)

  // Modal state
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [bgOpen, setBgOpen] = useState(false)
  const [audioOpen, setAudioOpen] = useState(false)
  const [cursorOpen, setCursorOpen] = useState(false)
  const [cursorFxOpen, setCursorFxOpen] = useState(false)
  const [usernameFxOpen, setUsernameFxOpen] = useState(false)

  const patch = useCallback((u: Partial<FormState>) => {
    setForm((p) => ({ ...p, ...u }))
  }, [])

  // Live preview reflects every change immediately. Earlier this used
  // useDeferredValue to throttle the heavy GunsProfile re-render to
  // idle time, but the lag between editing a field and seeing the
  // result was confusing - users would tweak a value, see nothing
  // change for a few hundred ms, and tweak again. Direct binding to
  // `form` keeps the preview in sync per-keystroke.
  const deferredForm = form

  // Below xl the desktop preview aside is hidden; this drives a mobile/tablet
  // preview overlay so users aren't editing their profile blind on a phone.
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)

  // Stable override objects keyed off the deferred form. Stable references
  // mean LivePreview's internal useMemo + GunsProfile rendering only run
  // when the deferred snapshot actually changes.
  const appearanceOverride = useMemo(() => ({
    // Profile content - typed into General Customization
    displayName: deferredForm.display_name,
    bio: deferredForm.bio,
    location: deferredForm.location,
    avatarUrl: deferredForm.avatar_url || null,
    // Surface the Discord-avatar toggle to the preview so flipping it
    // in the Avatar Manager modal immediately swaps the rendered
    // avatar to the cached discord_avatar_url without a save.
    useDiscordAvatar: deferredForm.use_discord_avatar,
    accentColor: deferredForm.accent_color,
    textColor: deferredForm.text_color,
    backgroundColor: deferredForm.background_color,
    iconColor: deferredForm.icon_color,
    backgroundEffect: deferredForm.background_effect === 'none' ? null : deferredForm.background_effect,
    backgroundEffectColor: deferredForm.background_effect_color || null,
    backgroundUrl: deferredForm.background_url || null,
    profileOpacity: deferredForm.profile_opacity,
    profileBlur: deferredForm.profile_blur,
    profileRadius: deferredForm.profile_radius,
    profileGradientEnabled: deferredForm.profile_gradient_enabled,
    profileGradientPrimary: deferredForm.profile_gradient_primary,
    profileGradientSecondary: deferredForm.profile_gradient_secondary,
    outlineEnabled: deferredForm.outline_enabled,
    outlineColor: deferredForm.outline_color,
    outlineWidth: deferredForm.outline_width,
    cardStyle: deferredForm.card_style,
    glowUsername: deferredForm.glow_username,
    glowSocials: deferredForm.glow_socials,
    glowBadges: deferredForm.glow_badges,
    glowIntensity: deferredForm.glow_intensity,
    glowColor: deferredForm.glow_color,
    socialsGlowMono: deferredForm.socials_glow_mono,
    socialsBelowWidgets: deferredForm.socials_below_widgets,
    layoutMode: deferredForm.layout_mode,
    bentoTiles: deferredForm.bento_tiles,
    avatarShape: deferredForm.avatar_shape,
    panelSize: deferredForm.panel_size,
    avatarPosition: deferredForm.avatar_position,
    avatarPlacement: deferredForm.avatar_placement,
    showAvatar: deferredForm.show_avatar,
    // Avatar outline + glow (owner-only @rez) - pass through so the live
    // preview ring updates per-keystroke instead of showing the saved value.
    avatarOutlineEnabled: deferredForm.avatar_outline_enabled,
    avatarOutlineColor: deferredForm.avatar_outline_color,
    avatarOutlineSize: deferredForm.avatar_outline_size,
    avatarGlowEnabled: deferredForm.avatar_glow_enabled,
    avatarGlowColor: deferredForm.avatar_glow_color,
    avatarGlowSize: deferredForm.avatar_glow_size,
    customFontUrl: deferredForm.custom_font_url || null,
    customFontName: deferredForm.custom_font_name || null,
    // Advanced per-element text colors (empty string = inherit)
    displayNameColor:    deferredForm.display_name_color    || null,
    usernameHandleColor: deferredForm.username_handle_color || null,
    bioColor:            deferredForm.bio_color             || null,
    locationColor:       deferredForm.location_color        || null,
    cardTextColor:       deferredForm.card_text_color       || null,
    musicTextColor:      deferredForm.music_text_color      || null,
    fontApplyDisplayname: deferredForm.font_apply_displayname,
    fontApplyUsername:    deferredForm.font_apply_username,
    fontApplyBio:         deferredForm.font_apply_bio,
    fontApplyMusic:       deferredForm.font_apply_music,
    // 4 font slots + per-element slot assignment
    font1Url: deferredForm.font_1_url || null, font1Name: deferredForm.font_1_name || null,
    font2Url: deferredForm.font_2_url || null, font2Name: deferredForm.font_2_name || null,
    font3Url: deferredForm.font_3_url || null, font3Name: deferredForm.font_3_name || null,
    font4Url: deferredForm.font_4_url || null, font4Name: deferredForm.font_4_name || null,
    fontSlotDisplayname: deferredForm.font_slot_displayname,
    fontSlotUsername:    deferredForm.font_slot_username,
    fontSlotBio:         deferredForm.font_slot_bio,
    fontSlotMusic:       deferredForm.font_slot_music,
  }), [deferredForm])

  const effectsOverride = useMemo(() => ({
    usernameEffect: deferredForm.username_effect,
    cursorEffect: deferredForm.cursor_effect,
    cursorColor: deferredForm.cursor_color,
    customCursorUrl: deferredForm.custom_cursor_url,
    hoverCursorUrl: deferredForm.custom_cursor_hover_url,
    tiltEffect: deferredForm.tilt_effect,
    showViewCount: deferredForm.show_view_count,
    animateViewCount: deferredForm.animate_view_count,
    viewsLocationPosition: deferredForm.views_location_position,
    showBadges: deferredForm.show_badges,
    monochromeIcons: deferredForm.monochrome_icons,
    animatedTitle: deferredForm.animated_title,
    swapBoxColors: deferredForm.swap_box_colors,
    showLikes: deferredForm.show_likes,
    volumeControl: deferredForm.volume_control,
    entranceAnimation: deferredForm.entrance_animation,
    hoverEffect: deferredForm.hover_effect,
    hoverEffectColor: deferredForm.hover_effect_color,
    typingBio: deferredForm.typing_bio,
    typingSpeed: deferredForm.typing_speed,
    bioTexts: deferredForm.bio_texts,
  }), [deferredForm])

  const hasChanges = JSON.stringify(form) !== JSON.stringify(savedForm.current)

  async function handleSave() {
    setSaving(true)
    try {
      const profilePayload = {
        display_name: form.display_name,
        bio: form.bio, location: form.location,
        enter_title: form.enter_title, enter_enabled: form.enter_enabled,
        enter_subtitle: form.enter_subtitle,
        enter_show_profile: form.enter_show_profile,
        enter_show_title: form.enter_show_title,
        enter_show_subtitle: form.enter_show_subtitle,
        typing_bio: form.typing_bio,
        typing_speed: form.typing_speed,
        bio_texts: form.bio_texts,
        profile_opacity: form.profile_opacity, profile_blur: form.profile_blur,
        background_effect: form.background_effect === 'none' ? null : form.background_effect,
        background_effect_color: form.background_effect_color || null,
        // Without this the Avatar Manager's "Use Discord Avatar"
        // toggle would round-trip but never persist - the form state
        // updates locally, but on Save we'd drop the field, so a page
        // refresh would revert it to whatever was in the DB.
        use_discord_avatar: form.use_discord_avatar,
        music_enabled: form.music_enabled,
        music_show_title: form.music_show_title,
        music_show_artist: form.music_show_artist,
        music_hide_panel: form.music_hide_panel,
        music_show_cover: form.music_show_cover,
        music_volume: form.music_volume,
        music_shuffle: form.music_shuffle,
        click_sound_volume: form.click_sound_volume,
        enter_sound_volume: form.enter_sound_volume,
      }
      const appearancePayload = {
        accent_color: form.accent_color, text_color: form.text_color,
        background_color: form.background_color, icon_color: form.icon_color,
        display_name_color:    form.display_name_color    || null,
        username_handle_color: form.username_handle_color || null,
        bio_color:             form.bio_color             || null,
        location_color:        form.location_color        || null,
        card_text_color:       form.card_text_color       || null,
        music_text_color:      form.music_text_color      || null,
        custom_font_url:  form.custom_font_url || null,
        custom_font_name: form.custom_font_name || null,
        font_apply_displayname: form.font_apply_displayname,
        font_apply_username:    form.font_apply_username,
        font_apply_bio:         form.font_apply_bio,
        font_apply_music:       form.font_apply_music,
        // 4 font slots
        font_1_url: form.font_1_url || null, font_1_name: form.font_1_name || null,
        font_2_url: form.font_2_url || null, font_2_name: form.font_2_name || null,
        font_3_url: form.font_3_url || null, font_3_name: form.font_3_name || null,
        font_4_url: form.font_4_url || null, font_4_name: form.font_4_name || null,
        // Per-element slot assignment (0 = system default)
        font_slot_displayname: form.font_slot_displayname,
        font_slot_username:    form.font_slot_username,
        font_slot_bio:         form.font_slot_bio,
        font_slot_music:       form.font_slot_music,
        card_style: form.card_style,
        profile_gradient_enabled: form.profile_gradient_enabled,
        profile_gradient_primary: form.profile_gradient_primary,
        profile_gradient_secondary: form.profile_gradient_secondary,
        outline_enabled: form.outline_enabled, outline_color: form.outline_color,
        outline_width: form.outline_width, profile_radius: form.profile_radius,
        glow_username: form.glow_username, glow_socials: form.glow_socials,
        glow_description: form.glow_description,
        socials_glow_mono: form.socials_glow_mono,
        socials_below_widgets: form.socials_below_widgets,
        // glow_badges intentionally omitted - that field is owned by the
        // Badges page now. Including it here meant any customize save
        // would overwrite a badges-page change made in a different tab.
        glow_intensity: form.glow_intensity,
        glow_color: form.glow_color,
        avatar_shape: form.avatar_shape,
        layout_mode: form.layout_mode,
        bento_tiles: form.bento_tiles,
        panel_size: form.panel_size,
        avatar_position: form.avatar_position,
        avatar_placement: form.avatar_placement,
        show_avatar: form.show_avatar,
        avatar_outline_enabled: form.avatar_outline_enabled,
        avatar_outline_color: form.avatar_outline_color,
        avatar_outline_size: form.avatar_outline_size,
        avatar_glow_enabled: form.avatar_glow_enabled,
        avatar_glow_color: form.avatar_glow_color,
        avatar_glow_size: form.avatar_glow_size,
      }
      const effectsPayload = {
        username_effect: form.username_effect === 'none' ? null : form.username_effect,
        cursor_effect: form.cursor_effect === 'none' ? null : form.cursor_effect,
        cursor_color: form.cursor_color,
        custom_cursor_url: form.custom_cursor_url,
        custom_cursor_hover_url: form.custom_cursor_hover_url,
        volume_control: form.volume_control,
        animated_title: form.animated_title,
        show_view_count: form.show_view_count,
        animate_view_count: form.animate_view_count,
        tilt_effect: form.tilt_effect,
        show_badges: form.show_badges,
        badges_next_to_name: form.badges_next_to_name,
        badge_color: form.badge_color,
        monochrome_badges: form.monochrome_badges,
        badge_glow_strength: form.badge_glow_strength,
        badge_accent_color: form.badge_accent_color,
        badge_border_radius: form.badge_border_radius,
        badge_opacity: form.badge_opacity,
        badge_border_enabled: form.badge_border_enabled,
        badge_border_color: form.badge_border_color,
        badge_border_width: form.badge_border_width,
        badge_border_opacity: form.badge_border_opacity,
        monochrome_icons: form.monochrome_icons,
        swap_box_colors: form.swap_box_colors,
        show_likes: form.show_likes,
        views_location_position: form.views_location_position,
        entrance_animation: form.entrance_animation,
        hover_effect: form.hover_effect === 'none' ? null : form.hover_effect,
        hover_effect_color: form.hover_effect_color,
      }

      // Single PUT to /api/profile - it has the comprehensive whitelist and
      // applies the premium gate / URL validation that used to be split
      // across appearance + effects.
      const merged = { ...profilePayload, ...appearancePayload, ...effectsPayload }
      const r1 = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      })
      if (!r1.ok) throw new Error((await r1.json().catch(() => ({}))).error || 'save failed')

      savedForm.current = { ...form }
      toast.success('Changes saved!')
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="-mx-2 xl:pr-[480px]">
    {/* pb leaves room for the floating unsaved-changes save bar + iOS safe-area */}
    <div className="space-y-8 sm:space-y-10 min-w-0 px-2 pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {/* First-visit Discord join popup, dismissed forever per account */}
      <DiscordJoinPopup userId={profile.id} />

      {/* Modals */}
      <AvatarManagerModal
        open={avatarOpen} onOpenChange={setAvatarOpen}
        avatarUrl={form.avatar_url} useDiscordAvatar={form.use_discord_avatar}
        onAvatarChange={(url) => patch({ avatar_url: url })}
        onDiscordToggle={(v) => patch({ use_discord_avatar: v })}
        // discord_id is server-managed (set by the OAuth callback) so
        // we read it directly off the loaded profile. discord_avatar_url
        // is populated by the same callback. Cast through `any` because
        // both fields are server-side only and not declared on Profile
        // (matches how settings/page.tsx accesses discord_id).
        discordLinked={!!(profile as any).discord_id}
        discordAvatarUrl={(profile as any).discord_avatar_url ?? null}
      />
      <BackgroundManagerModal
        open={bgOpen} onOpenChange={setBgOpen}
        backgroundUrl={form.background_url}
        onBackgroundChange={(url) => patch({ background_url: url })}
      />
      <AudioManagerModal
        open={audioOpen} onOpenChange={setAudioOpen}
        form={form} patch={patch}
        isPremium={isPremium}
        isOwner={true}
      />
      <CursorManagerModal
        open={cursorOpen} onOpenChange={setCursorOpen}
        form={form} patch={patch}
      />
      <UsernameEffectsModal
        open={usernameFxOpen} onOpenChange={setUsernameFxOpen}
        value={form.username_effect}
        onChange={(v) => patch({ username_effect: v })}
        username={(form.display_name || profile.username || 'username').trim()}
        isPremium={isPremium}
      />
      <CursorEffectsModal
        open={cursorFxOpen} onOpenChange={setCursorFxOpen}
        value={form.cursor_effect}
        onChange={(v) => patch({ cursor_effect: v })}
        color={form.cursor_color}
        isPremium={isPremium}
        onColorChange={(v) => patch({ cursor_color: v })}
      />

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customize</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile appearance, effects, and settings</p>
      </div>

      {/* ─── 4 quick-access manager cards ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Avatar thumbnail respects the Use Discord Avatar toggle -
            when on AND we have a cached Discord avatar URL, the
            preview tile shows the Discord avatar so users get
            immediate feedback that the toggle is working without
            having to open the live preview. */}
        <ManagerCard
          icon={User}
          label="Click to open avatar manager"
          onClick={() => setAvatarOpen(true)}
          preview={
            (form.use_discord_avatar && (profile as any).discord_avatar_url)
              ? (profile as any).discord_avatar_url
              : (form.avatar_url || undefined)
          }
        />
        <ManagerCard icon={ImageIcon} label="Click to open background manager" onClick={() => setBgOpen(true)} preview={form.background_url || undefined} />
        <ManagerCard icon={Music} label="Click to open audio manager" onClick={() => setAudioOpen(true)} />
        <ManagerCard icon={MousePointer2} label="Click to open cursor manager" onClick={() => setCursorOpen(true)} preview={form.custom_cursor_url || undefined} />
      </div>

      {/* ─── General Customization ─── */}
      <section>
        <SectionHeading icon={Settings2} title="General Customization" />
        <Card>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            <PremiumGate locked={!isPremium} label="Premium">
              <TextField
                label="Username Overlay"
                value={form.display_name}
                onChange={(v) => patch({ display_name: v })}
                placeholder={profile.username || 'Your @handle'}
                maxLength={32}
                hint={`Replaces what's shown on your profile instead of @${profile.username || 'handle'}. Your URL stays the same.`}
              />
            </PremiumGate>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground-secondary">Description</span>
                <span className="text-xs text-muted-foreground">{form.bio.length}/100</span>
              </div>
              <input
                type="text"
                value={form.bio} onChange={(e) => patch({ bio: e.target.value })}
                maxLength={100}
                placeholder="Enter your description"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 transition-colors"
              />
            </div>
            <SliderRow label="Profile Opacity" value={form.profile_opacity} min={0} max={100} unit="%" onChange={(v) => patch({ profile_opacity: v })} onReset={() => patch({ profile_opacity: 100 })} />
            <SliderRow label="Profile Blur" value={form.profile_blur} min={0} max={80} unit="px" onChange={(v) => patch({ profile_blur: v })} onReset={() => patch({ profile_blur: 0 })} />
            <SelectField label="Background Effects" value={form.background_effect} options={BACKGROUND_EFFECTS} onChange={(v) => patch({ background_effect: v })} />
            <div>
              <div className="mb-1.5 text-sm font-medium text-foreground-secondary">Username Effects</div>
              <button
                type="button"
                onClick={() => setUsernameFxOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground-secondary hover:bg-surface-2 hover:border-primary/30 transition"
              >
                <Wand2 className="h-4 w-4 text-primary" />
                {form.username_effect === 'none' ? 'Username Effects' : (USERNAME_EFFECTS.find(e => e.value === form.username_effect)?.label || 'Username Effects')}
              </button>
            </div>
            <div>
              <div className="mb-1.5 text-sm font-medium text-foreground-secondary">Cursor Effects</div>
              <button
                type="button"
                onClick={() => setCursorFxOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground-secondary hover:bg-surface-2 hover:border-primary/30 transition"
              >
                <MousePointer2 className="h-4 w-4 text-primary" />
                {form.cursor_effect === 'none' ? 'Cursor Effects' : (CURSOR_EFFECTS.find(e => e.value === form.cursor_effect)?.label || 'Cursor Effects')}
              </button>
            </div>
            <TextField label="Location" value={form.location} onChange={(v) => patch({ location: v })} placeholder="Enter your location" maxLength={32} />
          </div>
        </Card>
      </section>

      {/* ─── Sound Effects (premium) ─── */}
      <PremiumGate locked={!isPremium}>
        <SoundEffectsCard form={form} patch={patch} />
      </PremiumGate>

      {/* ─── Color Customization ─── */}
      <section>
        <SectionHeading icon={Palette} title="Color Customization" />
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">Base Palette</span>
            <span className="text-[11px] text-muted-foreground">Applies wherever a specific override is empty</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { key: 'accent_color', label: 'Accent', def: '#e87fa0' },
              { key: 'text_color', label: 'Text', def: '#ffffff' },
              { key: 'background_color', label: 'Background', def: '#030306' },
              { key: 'icon_color', label: 'Icon', def: '#ffffff' },
            ].map((c) => {
              const val = (form as any)[c.key] || c.def
              return (
                <div key={c.key} className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-3 transition-all hover:border-primary/30">
                  <div className="flex items-center gap-3">
                    <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border-strong" style={{ background: val, boxShadow: `0 0 18px ${val}55, inset 0 0 0 1px rgba(255,255,255,0.08)` }}>
                      <input type="color" value={val} onChange={(e) => patch({ [c.key]: e.target.value } as any)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    </label>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">{c.label}</p>
                      <input type="text" value={val} onChange={(e) => patch({ [c.key]: e.target.value } as any)}
                        className="-ml-0.5 w-full bg-transparent text-sm font-mono text-foreground outline-none" />
                    </div>
                    <button type="button" onClick={() => patch({ [c.key]: c.def } as any)} title="Reset" className="opacity-0 text-muted-foreground transition group-hover:opacity-100 hover:text-foreground-secondary">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <PremiumGate locked={!isPremium}><div className="mt-4 rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 text-sm font-medium text-foreground-secondary">Profile Gradient</div>
            {form.profile_gradient_enabled ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <ColorField label="Primary" value={form.profile_gradient_primary} onChange={(v) => patch({ profile_gradient_primary: v })} />
                  <ColorField label="Secondary" value={form.profile_gradient_secondary} onChange={(v) => patch({ profile_gradient_secondary: v })} />
                </div>
                <button type="button" onClick={() => patch({ profile_gradient_enabled: false })}
                  className="mt-3 w-full rounded-xl border border-primary/30 bg-primary/10 py-2.5 text-sm font-medium text-primary hover:bg-primary/15 transition-colors">
                  Profile Gradient Enabled - click to disable
                </button>
              </>
            ) : (
              <button type="button" onClick={() => patch({ profile_gradient_enabled: true })}
                className="w-full rounded-xl border border-dashed border-primary/30 py-3 text-sm text-primary/60 hover:border-primary/60 hover:text-primary transition-colors">
                Profile Gradient Disabled - click to enable
              </button>
            )}
          </div></PremiumGate>

          {/* Advanced per-element text colors */}
          <AdvancedTextColors form={form} patch={patch} />
        </Card>
      </section>

      {/* ─── Typography & Fonts ─── */}
      <section>
        <SectionHeading icon={FileText} title="Typography & Fonts" />
        <Card>
          <PremiumGate locked={!isPremium}><FontUploader form={form} patch={patch} /></PremiumGate>
        </Card>
      </section>

      {/* ─── Avatar Outline & Glow ─── */}
      <section>
        <SectionHeading icon={Aperture} title="Avatar Outline & Glow" />
          <Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ToggleRow label="Avatar Outline" checked={form.avatar_outline_enabled} onChange={(v) => patch({ avatar_outline_enabled: v })} />
              <ToggleRow label="Avatar Glow" checked={form.avatar_glow_enabled} onChange={(v) => patch({ avatar_glow_enabled: v })} />
            </div>
            {form.avatar_outline_enabled ? (
              <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <ColorField label="Outline Color" value={form.avatar_outline_color} onChange={(v) => patch({ avatar_outline_color: v })} />
                <SliderRow label="Outline Size" value={form.avatar_outline_size} min={0} max={20} unit="px"
                  onChange={(v) => patch({ avatar_outline_size: v })} onReset={() => patch({ avatar_outline_size: 3 })} />
              </div>
            ) : null}
            {form.avatar_glow_enabled ? (
              <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <ColorField label="Glow Color" value={form.avatar_glow_color} onChange={(v) => patch({ avatar_glow_color: v })} />
                <SliderRow label="Glow Size" value={form.avatar_glow_size} min={0} max={40} unit="px"
                  onChange={(v) => patch({ avatar_glow_size: v })} onReset={() => patch({ avatar_glow_size: 16 })} />
              </div>
            ) : null}
          </Card>
        </section>

      {/* ─── Border Customization ─── */}
      <section>
        <SectionHeading icon={Square} title="Border Customization" />
        <Card>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <PremiumGate locked={!isPremium}><div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3 text-sm font-medium text-foreground-secondary">Profile Border</div>
              {form.outline_enabled ? (
                <div className="space-y-3">
                  <ColorField label="Border Color" value={form.outline_color} onChange={(v) => patch({ outline_color: v })} />
                  <SliderRow label="Border Width" value={form.outline_width} min={1} max={12} unit="px"
                    onChange={(v) => patch({ outline_width: v })} onReset={() => patch({ outline_width: 2 })} />
                  <button type="button" onClick={() => patch({ outline_enabled: false })}
                    className="w-full rounded-xl border border-dashed border-red-500/30 py-2 text-xs text-red-400/60 hover:border-red-500/60 hover:text-red-400 transition-colors">
                    Disable Border
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => patch({ outline_enabled: true })}
                  className="w-full rounded-xl border border-dashed border-red-500/30 py-2.5 text-sm text-red-400/60 hover:border-red-500/60 hover:text-red-400 transition-colors">
                  Border Disabled - click to enable
                </button>
              )}
            </div></PremiumGate>
            <div className="rounded-xl border border-border bg-surface p-4">
              <SliderRow label="Border Radius" value={form.profile_radius} min={0} max={50} unit="px"
                onChange={(v) => patch({ profile_radius: v })} onReset={() => patch({ profile_radius: 16 })} />
              <div className="mt-3 flex gap-2">
                {[0, 8, 16, 24, 50].map((r) => (
                  <button key={r} type="button" onClick={() => patch({ profile_radius: r })}
                    className={`flex h-8 w-8 items-center justify-center text-xs border transition-colors ${form.profile_radius === r ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border bg-surface text-muted-foreground hover:border-border-strong'}`}
                    style={{ borderRadius: r === 50 ? '50%' : `${Math.min(r, 8)}px` }}>{r}</button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* ─── Card Style ─── */}
      <section>
        <SectionHeading icon={AlignLeft} title="Card Style" />
        <Card>
          {/* 6-option grid. 2 cols on phones, 3 on small tablets,
              6 across on desktop so each card chrome shows
              side-by-side with its neighbours. Each button has a
              live swatch under the label rendered with the same
              `getCardContainerStyles` the profile uses, so users
              see exactly what they're picking. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {CARD_STYLES.map((s) => (
              <button key={s.value} type="button" onClick={() => patch({ card_style: s.value })}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition-all ${form.card_style === s.value ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-surface text-foreground-secondary hover:bg-surface-2 hover:text-foreground-secondary'}`}>
                {s.label}
                <CardStyleSwatch cardStyle={s.value} />
              </button>
            ))}
          </div>
        </Card>
      </section>

      {/* ─── Glow Settings ─── */}
      <section>
        <SectionHeading icon={Sun} title="Glow Settings" />
        <Card>
          {/* The Glow Badges toggle used to live here too, but it's already
              on the Badges page right next to Badge Color. Having the same
              toggle in two places was confusing - turning it on in one place
              made people think the other was broken. Keep it on Badges only.
              The shared Glow Color + Intensity still control all three glows
              (username / socials / badges) - the panel still appears when
              glow_badges is enabled elsewhere so users can pick the color. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ToggleRow label="Glow Username" checked={form.glow_username} onChange={(v) => patch({ glow_username: v })} />
            <ToggleRow label="Glow Socials" checked={form.glow_socials} onChange={(v) => patch({ glow_socials: v })} />
            <ToggleRow label="Glow Description" checked={form.glow_description} onChange={(v) => patch({ glow_description: v })} />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Glow Badges moved to the <a href="/dashboard/badges" className="text-primary hover:underline">Badges page</a>. The color + intensity below control all three.
          </p>
          {/* Glow Socials sub-option - when Glow Socials is on, the
              default is per-platform brand-coloured glows (Spotify
              green, YouTube red, etc.). Flipping this on collapses
              every social icon's glow to the single Glow Color
              picker below - the legacy mono behaviour. */}
          {form.glow_socials ? (
            <div className="mt-4">
              <ToggleRow
                label="Mono Socials Glow"
                description="Use one glow color for every social icon instead of each platform's brand color"
                checked={form.socials_glow_mono}
                onChange={(v) => patch({ socials_glow_mono: v })}
              />
            </div>
          ) : null}
          {(form.glow_username || form.glow_socials || form.glow_badges || form.glow_description) ? (
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ColorField label="Glow Color" value={form.glow_color} onChange={(v) => patch({ glow_color: v })} />
              <SliderRow label="Glow Intensity" value={form.glow_intensity} min={0} max={100} unit="%"
                onChange={(v) => patch({ glow_intensity: v })} onReset={() => patch({ glow_intensity: 50 })} />
            </div>
          ) : null}
        </Card>
      </section>

      {/* Banner Image lives INSIDE the Layout card below now (only
          renders when Modern is selected). The old standalone
          section here is removed so the customize page doesn't have
          a disappearing top-level Banner section every time the user
          flips away from Modern. */}

      {/* ─── Profile Presets ─── */}
      <section>
        <SectionHeading icon={ProfilePresetsIcon} title="Profile Presets" />
        <Card>
          <ProfilePresets />
        </Card>
      </section>

      {/* ─── Layout ─── */}
      <section>
        <SectionHeading icon={Square} title="Layout" />
        <Card>
          <p className="-mt-3 mb-4 text-xs text-muted-foreground">
            Pick the structure of your profile. Sub-controls below adapt to the layout.
          </p>

          {/* Layout picker - visual archetype cards. Public to all
              users; was previously gated to a test-user allowlist. */}
          {/* Two-up grid (was sm:grid-cols-3 with a permanent empty
              third column). With Classic + Modern as the only
              layouts, the cards split the row evenly. */}
          <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {LAYOUT_META.map((meta) => (
              <LayoutCard
                key={meta.id}
                meta={meta}
                active={form.layout_mode === meta.id}
                onClick={() => patch({ layout_mode: meta.id })}
              />
            ))}
          </div>

          {/* Banner Image upload - Modern-only sub-control, sits right
              under the layout picker so it's visually connected to the
              Modern card the user just selected. Hidden when Classic
              is active. */}
          {form.layout_mode === 'modern' && (
            <div className="mb-5 rounded-xl border border-primary/15 bg-primary/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Banner Image</span>
              </div>
              <p className="mb-3 text-[11px] leading-snug text-muted-foreground">
                Header strip on the Modern card. Recommended size 1600&nbsp;×&nbsp;400. PNG / JPG / WebP.
              </p>
              <BannerUploadRow
                value={form.banner_url}
                onChange={(url) => patch({ banner_url: url })}
              />
            </div>
          )}

          {/* Panel Width - shown only for layouts that support it.
              Modern hardcodes its own width so the buttons hide there;
              Classic always shows them. */}
          {getLayoutMeta(form.layout_mode).supportsPanelWidth && (
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-secondary">Panel Width</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { value: 'small', label: 'Small' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'large', label: 'Large' },
                  { value: 'xlarge', label: 'X-Large' },
                ].map((w) => (
                  <button key={w.value} type="button" onClick={() => patch({ panel_size: w.value })}
                    className={`relative overflow-hidden rounded-xl border px-4 py-3 text-sm font-medium transition-all ${form.panel_size === w.value ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-surface text-foreground-secondary hover:border-border-strong hover:bg-surface-2 hover:text-foreground'}`}>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Show Avatar (always available) + Avatar Mode (Classic
              only). The Mode toggle collapses the old Position +
              Placement pair into a single binary choice - the two
              fields never made sense independently:

                Mode 1 (default) = position 'center' + placement 'outside'
                Mode 2           = position 'left'   + placement 'inside'

              Both `avatar_position` and `avatar_placement` are still
              saved underneath so existing renderers keep working
              without any code path changes. Modern layouts hide the
              Mode toggle entirely (Modern hardcodes its avatar slot). */}
          <div className={`grid grid-cols-1 gap-4 ${getLayoutMeta(form.layout_mode).supportsAvatarPlacement ? 'lg:grid-cols-2' : ''}`}>
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Show Avatar</p>
                  <p className="text-xs text-muted-foreground">Display on card</p>
                </div>
                <Switch checked={form.show_avatar} onCheckedChange={(v) => patch({ show_avatar: v })} />
              </div>
            </div>

            {getLayoutMeta(form.layout_mode).supportsAvatarPlacement && (() => {
              // Mode 2 fires iff BOTH legacy fields match the Mode 2
              // pair. Any other combination (including the historical
              // center+inside or left+outside) is treated as Mode 1
              // so the toggle has a clean default.
              const isModeTwo = form.avatar_position === 'left' && form.avatar_placement === 'inside'
              const setMode = (mode: 1 | 2) => {
                if (mode === 2) patch({ avatar_position: 'left',   avatar_placement: 'inside' })
                else            patch({ avatar_position: 'center', avatar_placement: 'outside' })
              }
              return (
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-secondary">Avatar Mode</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 1 as const, label: 'Mode 1', hint: 'Centred · outside the card' },
                      { value: 2 as const, label: 'Mode 2', hint: 'Left · inside the card' },
                    ].map((m) => {
                      const active = (m.value === 2) === isModeTwo
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setMode(m.value)}
                          title={m.hint}
                          className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-all ${active ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-surface text-foreground-secondary hover:bg-surface-2'}`}
                        >
                          <span className="text-sm font-medium">{m.label}</span>
                          <span className={`text-[10px] leading-snug ${active ? 'text-primary/70' : 'text-muted-foreground'}`}>{m.hint}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Avatar Shape */}
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-secondary">Avatar Shape</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { value: 'circle', label: 'Circle', radius: '50%' },
                { value: 'soft', label: 'Soft', radius: '35%' },
                { value: 'squircle', label: 'Squircle', radius: '22%' },
                { value: 'rounded', label: 'Rounded', radius: '14%' },
                { value: 'square', label: 'Square', radius: '2px' },
              ].map((s) => (
                <button key={s.value} type="button" onClick={() => patch({ avatar_shape: s.value })}
                  className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-4 transition-all ${form.avatar_shape === s.value ? 'border-primary/60 bg-primary/10' : 'border-border bg-surface hover:bg-surface-2'}`}>
                  <div className="h-10 w-10 bg-gradient-to-br from-white/30 to-white/10" style={{ borderRadius: s.radius }} />
                  <span className={`text-xs font-medium ${form.avatar_shape === s.value ? 'text-primary' : 'text-foreground-secondary'}`}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Socials Position - where the social-icon row sits in the
              content stack. Default (off) = between bio and custom
              buttons (the Classic order). On = below the widgets
              panel, after everything else. */}
          {/* Socials Below Widgets is only implemented in the Modern
              layout renderer (components/profile/layouts/haunt-modern.tsx).
              The Classic / default layout doesn't read the flag, so the
              toggle silently does nothing for Classic users - confusing.
              Hide it unless the user has picked Modern. */}
          {form.layout_mode === 'modern' ? (
            <div className="mt-5">
              <ToggleRow
                label="Socials Below Widgets"
                description="Move the social-icon row below the widgets panel instead of above the buttons"
                checked={form.socials_below_widgets}
                onChange={(v) => patch({ socials_below_widgets: v })}
              />
            </div>
          ) : null}
        </Card>
      </section>

      {/* ─── Typewriter Bio ─── */}
      <section>
        <SectionHeading icon={FileText} title="Typewriter Bio" />
        <Card>
          <div className="space-y-4">
            <ToggleRow
              label="Enable Typewriter"
              description="Cycle through bio texts with a typing animation"
              checked={form.typing_bio}
              onChange={(v) => patch({ typing_bio: v })}
            />
            {form.typing_bio ? (
              <>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <SliderRow label="Typing Speed" value={form.typing_speed} min={20} max={300} unit="ms"
                    onChange={(v) => patch({ typing_speed: v })} onReset={() => patch({ typing_speed: 100 })} />
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">Bio Texts ({form.bio_texts.length}/10)</span>
                    <button type="button"
                      disabled={form.bio_texts.length >= 10}
                      onClick={() => { if (form.bio_texts.length < 10) patch({ bio_texts: [...form.bio_texts, ''] }) }}
                      className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed">
                      <Plus className="h-3 w-3" /> Add Text
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.bio_texts.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border-strong px-3 py-6 text-center text-xs text-muted-foreground">No texts yet - add up to 10 to cycle through.</p>
                    ) : null}
                    {form.bio_texts.map((t, i) => (
                      <div key={i} className="group flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-[10px] font-mono text-muted-foreground">{i + 1}</span>
                        <div className="relative flex-1">
                          <input type="text" value={t}
                            maxLength={60}
                            onChange={(e) => {
                              const arr = [...form.bio_texts]; arr[i] = e.target.value.slice(0, 60)
                              patch({ bio_texts: arr })
                            }}
                            placeholder={`Text ${i + 1}`}
                            className="w-full rounded-lg border border-border bg-surface px-3 py-2 pr-12 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
                          />
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">
                            {t.length}/60
                          </span>
                        </div>
                        <button type="button" onClick={() => {
                          const arr = form.bio_texts.filter((_, j) => j !== i)
                          patch({ bio_texts: arr })
                        }} className="rounded-lg border border-border bg-surface p-2 text-muted-foreground transition hover:border-red-500/40 hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </Card>
      </section>

      {/* ─── Enter Page ─── */}
      <section>
        <SectionHeading icon={MousePointer2} title="Enter Page" />
        <Card>
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            {/* Controls */}
            <div className="space-y-4">
              <div className={`rounded-xl border p-4 transition-colors ${form.enter_enabled ? 'border-primary/40 bg-primary/[0.04]' : 'border-border bg-surface'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Enable Enter Page</p>
                    <p className="text-xs text-muted-foreground">Show a click-to-enter splash before the profile</p>
                  </div>
                  <Switch checked={form.enter_enabled} onCheckedChange={(v) => patch({ enter_enabled: v })} />
                </div>
              </div>

              {form.enter_enabled ? (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField label="Title" value={form.enter_title} onChange={(v) => patch({ enter_title: v })}
                      placeholder="click to enter..." maxLength={60} />
                    <TextField label="Subtitle" value={form.enter_subtitle} onChange={(v) => patch({ enter_subtitle: v })}
                      placeholder="(optional)" maxLength={120} />
                  </div>

                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-secondary">Visibility</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {[
                        { key: 'enter_show_profile', label: 'Avatar' },
                        { key: 'enter_show_title', label: 'Title' },
                        { key: 'enter_show_subtitle', label: 'Subtitle' },
                      ].map((c) => {
                        const on = (form as any)[c.key]
                        return (
                          <button key={c.key} type="button" onClick={() => patch({ [c.key]: !on } as any)}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${on ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-surface text-foreground-secondary hover:bg-surface-2'}`}>
                            <span>{c.label}</span>
                            <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${on ? 'border-primary bg-primary' : 'border-border-strong'}`}>
                              {on ? <svg className="h-2.5 w-2.5 text-black" viewBox="0 0 20 20" fill="currentColor"><path d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 111.4-1.4L9 11.6l6.3-6.3a1 1 0 011.4 0z"/></svg> : null}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Live preview */}
            <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-black to-[#0a0a10] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-secondary">Preview</p>
              {form.enter_enabled ? (
                <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-black/40 px-4 py-6 text-center">
                  {form.enter_show_profile && form.avatar_url ? (
                    <img src={form.avatar_url} alt="" className="mb-1 h-12 w-12 rounded-full border border-border-strong object-cover" />
                  ) : null}
                  {form.enter_show_title ? (
                    <p className="text-base font-semibold text-foreground">{form.enter_title || 'click to enter...'}</p>
                  ) : null}
                  {form.enter_show_subtitle && form.enter_subtitle ? (
                    <p className="text-xs text-foreground-secondary">{form.enter_subtitle}</p>
                  ) : null}
                </div>
              ) : (
                <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border-strong px-4 py-6 text-xs text-muted-foreground">
                  Enter page is disabled
                </div>
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* ─── Entrance & Hover Animations ─── */}
      <section>
        <SectionHeading icon={Wand2} title="Entrance & Hover Animations" />
        <Card>
          <div className="space-y-5">
            {/* Entrance */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-secondary">Entrance Animation</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  { value: 'none', label: 'None' },
                  { value: 'fade', label: 'Fade' },
                  { value: 'slide', label: 'Slide' },
                  { value: 'scale', label: 'Scale' },
                  { value: 'bounce', label: 'Bounce' },
                ].map((o) => (
                  <button key={o.value} type="button" onClick={() => patch({ entrance_animation: o.value })}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${form.entrance_animation === o.value ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border bg-surface text-foreground-secondary hover:bg-surface-2'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hover */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-secondary">Hover Effect</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { value: 'none', label: 'None' },
                  { value: 'lift', label: 'Lift' },
                  { value: 'glow', label: 'Glow' },
                  { value: 'tilt', label: 'Tilt' },
                  { value: 'pulse', label: 'Pulse' },
                  { value: 'shake', label: 'Shake' },
                ].map((o) => {
                  const locked = PREMIUM_HOVER_EFFECTS.includes(o.value) && !isPremium
                  return (
                  <button key={o.value} type="button" disabled={locked}
                    onClick={() => { if (!locked) patch({ hover_effect: o.value }) }}
                    className={`relative rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${locked ? 'cursor-not-allowed opacity-60' : ''} ${form.hover_effect === o.value ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border bg-surface text-foreground-secondary hover:bg-surface-2'}`}>
                    {o.label}
                    {locked ? (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-300/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-200 align-middle">
                        <Crown className="h-2.5 w-2.5" />Pro
                      </span>
                    ) : null}
                  </button>
                  )
                })}
              </div>
            </div>

            {form.hover_effect !== 'none' ? (
              <div className="rounded-xl border border-border bg-surface p-4">
                <ColorField label="Hover Effect Color" value={form.hover_effect_color}
                  onChange={(v) => patch({ hover_effect_color: v })} />
              </div>
            ) : null}
          </div>
        </Card>
      </section>

      {/* ─── Other Customization ─── */}
      <section>
        <SectionHeading icon={Sliders} title="Other Customization" />
        <Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ToggleRow label="Volume Control" description="Show music volume button" checked={form.volume_control} onChange={(v) => patch({ volume_control: v })} />
            <ToggleRow label="Title Animation" description="Animate the browser tab title" checked={form.animated_title} onChange={(v) => patch({ animated_title: v })} />
            <ToggleRow label="Profile Views" description="Show visit counter" checked={form.show_view_count} onChange={(v) => patch({ show_view_count: v })} />
            <ToggleRow label="Profile Views Animation" description="Count up from 0 on load" checked={form.animate_view_count} onChange={(v) => patch({ animate_view_count: v })} />
            <ToggleRow label="Tilt Effect" description="Card tilts with mouse" checked={form.tilt_effect} onChange={(v) => patch({ tilt_effect: v })} />
            <ToggleRow label="Likes & Dislikes" description="Let visitors like or dislike your profile" checked={form.show_likes} onChange={(v) => patch({ show_likes: v })} />
          </div>
        </Card>
      </section>

      {/* ─── Info Bar Layout ─── */}
      <section>
        <SectionHeading icon={AlignLeft} title="Info Bar Layout" />
        <Card>
          <p className="-mt-3 mb-4 text-xs text-muted-foreground">Where the views and location pills appear on your card</p>

          {/* Position picker - visual 4-quadrant */}
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-secondary">Pill Position</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { value: 'top-left', label: 'Top Left', cls: 'items-start justify-start' },
                { value: 'top-right', label: 'Top Right', cls: 'items-start justify-end' },
                { value: 'bottom-left', label: 'Bottom Left', cls: 'items-end justify-start' },
                { value: 'bottom-right', label: 'Bottom Right', cls: 'items-end justify-end' },
              ].map((p) => {
                const active = form.views_location_position === p.value
                return (
                  <button key={p.value} type="button" onClick={() => patch({ views_location_position: p.value })}
                    className={`group flex flex-col items-stretch gap-2 rounded-xl border p-2 transition-all ${active ? 'border-primary/60 bg-primary/10' : 'border-border bg-surface hover:border-border-strong'}`}>
                    <div className={`flex h-12 rounded-md border border-border bg-black/30 p-1 ${p.cls}`}>
                      <div className={`h-2 w-6 rounded-full ${active ? 'bg-primary' : 'bg-white/30'}`} />
                    </div>
                    <span className={`text-xs font-medium ${active ? 'text-primary' : 'text-foreground-secondary'}`}>{p.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

        </Card>
      </section>

      {/* ─── Floating Save Bar ─── */}
      {hasChanges ? (
        <div className="fixed bottom-0 left-0 right-0 z-[100] animate-in slide-in-from-bottom-6 fade-in duration-500 xl:right-[480px]">
          <div className="mx-auto max-w-3xl px-4 pb-4">
            <div
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface/85 px-5 py-3 backdrop-blur-2xl"
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 24px 48px -16px rgba(0,0,0,0.7), 0 0 0 1px rgba(232,127,160,0.06)' }}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
                  <span className="relative h-2 w-2 rounded-full bg-primary" />
                </span>
                Unsaved changes
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setForm(savedForm.current)} disabled={saving}
                  className="rounded-lg px-3 py-1.5 text-sm text-foreground-secondary hover:bg-surface-2 hover:text-foreground disabled:opacity-50">
                  Reset
                </button>
                <button
                  type="button" onClick={handleSave} disabled={saving}
                  className="group flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving</> : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>

    {/* Fixed full-height live profile preview */}
    {/* Sticky preview panel. 640px wide - there's a chunk of room on
        wide screens that was just empty page background before, and
        a bigger preview is more honest about what the actual profile
        will look like. lg breakpoint keeps it visible on most
        desktops; smaller screens fall back to the linear form. */}
    <aside className="hidden xl:block fixed top-4 right-4 bottom-4 w-[460px] z-30 overflow-y-auto rounded-2xl">
      <div className="h-full">
        <LivePreview
          appearanceOverride={appearanceOverride as any}
          effectsOverride={effectsOverride as any}
        />
      </div>
    </aside>

    {/* Mobile/tablet preview (<xl): a floating button opens the same LivePreview
        full-screen so phone/tablet users can see their changes. */}
    <button
      type="button"
      onClick={() => setMobilePreviewOpen(true)}
      className="xl:hidden fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/40"
      style={{ boxShadow: '0 8px 28px -6px rgba(0,0,0,0.6)' }}
      aria-label="Preview profile"
    >
      <Eye className="size-4" />
      Preview
    </button>

    {mobilePreviewOpen ? (
      <div className="xl:hidden fixed inset-0 z-[60] flex flex-col bg-black/80 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-sm font-semibold text-white">Live preview</span>
          <button
            type="button"
            onClick={() => setMobilePreviewOpen(false)}
            className="flex size-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white"
            aria-label="Close preview"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <LivePreview
            appearanceOverride={appearanceOverride as any}
            effectsOverride={effectsOverride as any}
          />
        </div>
      </div>
    ) : null}
    </div>
  )
}
