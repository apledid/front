/**
 * Shared props for the haunt.gg-inspired layouts (Modern, etc.).
 *
 * Each layout file under components/profile/layouts/haunt-*.tsx accepts this
 * shape from the orchestrator (guns-profile.tsx). Centralising the type keeps
 * the call sites identical across all four layouts so swapping `layoutMode`
 * stays a one-line change.
 *
 * Only the colour / data the layouts need to render is included. Music
 * playback state stays in the orchestrator (audioRef must persist across
 * layout switches), so layouts only see `musicTracks` for the visual track-
 * info card, not the imperative play/pause API.
 */

import type { CSSProperties, ReactNode } from 'react'
import type {
  Badge as BadgeType,
  CustomButton,
  MusicTrack,
  Profile,
  SocialLink,
} from '@/lib/types'

export interface HauntLayoutProps {
  profile: Profile
  socialLinks: SocialLink[]
  badges: BadgeType[]
  customButtons: CustomButton[]
  musicTracks: MusicTrack[]
  /** Resolved theme colours from the orchestrator. */
  accentColor: string
  textColor: string
  iconColor: string
  glowColor: string
  glowIntensity: number
  /** Display name (falls back to username if not set). */
  displayName: string
  /** Ready-rendered identity block: name + badges + titles + UID tooltip.
   *  The orchestrator owns the UID-tooltip portal and font resolution, so
   *  the layouts just splice this node in wherever they want the name to
   *  appear. */
  identityBlock: ReactNode
  /** Bio fragment - typing animation or static markdown render. The
   *  orchestrator picks which based on `typing_bio`. */
  bioBlock: ReactNode | null
  /** True when the profile has a non-empty bio (drives "should the bio
   *  card render at all" branches in each layout). */
  hasBio: boolean
  /** Font family resolved for the bio paragraph - applied inline because
   *  the layouts can't see the multi-slot font resolution logic. */
  fontApplyBio: string
  /** Pre-rendered `<WidgetsPanel>` from the orchestrator. Each layout
   *  splices this into its content stack at the right spot. Keeping a
   *  single instance (vs constructing one per layout) lets the widget
   *  data fetch happen once even as the user switches between layouts
   *  in the live-preview iframe. */
  widgetsPanel: ReactNode
  /** Sanitized banner image URL. `null` when the user has no banner
   *  uploaded OR when the saved URL is a video (which `<img>` can't
   *  render). Modern uses this as its header image. Layouts that don't
   *  have a banner slot just ignore it. */
  bannerUrl: string | null
  /** Pre-rendered view-count + location pill, or `null` when all three
   *  of {show_view_count, location, show_join_date} resolve to hidden.
   *  The chip is already styled and absolutely-positioned via
   *  `getViewsPositionStyle(viewsLocationPosition)`; layouts just need
   *  to mount it in a `relative`-positioned ancestor (banner area for
   *  Modern, hero section for Portfolio, top-of-column for Minimal). */
  viewsPanel: ReactNode | null
  /** Pre-rendered like / dislike thumbs, or `null` when the owner has the
   *  Likes & Dislikes toggle off. Already absolutely-positioned at the
   *  card's bottom-right; layouts just mount it in their `relative` card. */
  likePanel: ReactNode | null
  /** Raw `views_location_position` setting - Modern only adds extra
   *  bottom padding for bottom-* positions so the chip has room to
   *  float beneath the widgets. Top positions get the compact
   *  padding (no wasted dead space). */
  viewsLocationPosition: string
  /** Pre-rendered inline music card, or `null` when `music_enabled` is
   *  off, no track is configured, or `music_hide_panel` is set. The
   *  card shares orchestrator-owned audio state via closure, so
   *  splicing the same node into multiple places would double-render
   *  and cause control desync - splice it once per layout. */
  musicCard: ReactNode | null
  /** Card chrome derived from the user's profile_opacity + profile_blur
   *  + card_style + outline settings. Layouts should apply these to the
   *  outer card wrapper so the chrome reacts to the customize panel -
   *  Modern's hardcoded glass effect (pre-pass-3) ignored the user's
   *  Profile Opacity / Profile Blur sliders entirely, which surprised
   *  users coming from Classic. Layouts can still layer per-layout
   *  polish (e.g. an accent inset highlight) on top of these. */
  panelShellStyle: CSSProperties
  /** Companion to `panelShellStyle` - the inner background-color/image
   *  surface that backdrop-filter samples through. Mount as an
   *  absolutely-positioned sibling underneath the card content. */
  panelSurfaceStyle: CSSProperties
}
