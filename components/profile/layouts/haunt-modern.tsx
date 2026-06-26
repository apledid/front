'use client'

/**
 * Modern layout - Discord-style profile header (avatar overlapping a
 * banner image / accent gradient, identity to the right) on top of a
 * Classic-style content stack. Content order matches Classic so the
 * layouts feel like siblings:
 *
 *   identity → bio → socials → custom buttons → widgets → music card
 *
 * The distinguishing feature vs Classic is the banner header and the
 * avatar-on-seam shape; everything below uses the same primitives
 * Classic does.
 *
 * Banner sources: `bannerUrl` (uploaded via /dashboard/customize's
 * Modern-only Banner Image section) when present and non-video; an
 * accent→glow gradient otherwise. Always renders - never an empty
 * grey strip.
 */

import { IconExternalLink } from '@tabler/icons-react'
import { toast } from 'sonner'
import { hexToRgba, getButtonStyle } from '@/lib/profile-style'
import { AvatarWithDecoration } from '@/components/profile/parts/avatar-with-decoration'
import { AvatarMedia } from '@/components/profile/parts/avatar-media'
import { getAvatarShapeStyle, safeButtonHref } from '@/components/profile/parts/profile-helpers'
import { SocialIcon } from '@/components/profile/social-icon'
import { HoverTooltip } from '@/components/profile/parts/hover-tooltip'
import { SOCIAL_PLATFORMS } from '@/lib/types'
import type { HauntLayoutProps } from './haunt-types'

// Crypto wallet platforms. social_links.url for these is a wallet
// address (e.g. "LbP8x3z..."), not a URL, so the icon must render as a
// click-to-copy button instead of an <a href>. Same set Classic uses
// in guns-profile.tsx.
const CRYPTO_PLATFORMS = new Set(['btc', 'eth', 'ltc', 'sol', 'xmr'])

// Brand-colour map derived from the canonical SOCIAL_PLATFORMS table
// in lib/types.ts. Using this (instead of a hand-rolled subset) keeps
// the icon row in lockstep with Classic: every platform that Classic
// can colour, this layout can colour too. The old hand-rolled subset
// was missing gitlab / facebook / soundcloud / vk / linkedin / etc.,
// so those icons rendered in the fallback `iconColor` (white) while
// only a few (discord, tiktok, …) showed their brand colour.
const BRAND_COLOURS: Record<string, string> = Object.fromEntries(
  (SOCIAL_PLATFORMS as ReadonlyArray<{ id: string; color: string }>).map((p) => [p.id, p.color])
)

export function HauntModern(props: HauntLayoutProps) {
  const {
    profile, socialLinks, customButtons, accentColor, textColor, iconColor,
    glowColor, glowIntensity, displayName, identityBlock, bioBlock, hasBio,
    fontApplyBio, widgetsPanel, bannerUrl, viewsPanel, likePanel, viewsLocationPosition, musicCard,
    panelShellStyle, panelSurfaceStyle,
  } = props

  // The views/location chip is `position: absolute` at `bottom: 16px`
  // for bottom-* positions. We reserve extra bottom padding on the
  // card content ONLY when the chip lives at the bottom, so the
  // widgets above it get a clean ~24px gap before the chip starts.
  // Top-position chips get the compact pb-6 (no wasted space). Same
  // when the chip is hidden entirely (e.g. show_view_count = false +
  // no location + no join date).
  const isBottomChip =
    viewsLocationPosition === 'bottom-left' || viewsLocationPosition === 'bottom-right'
  const contentBottomPadding = isBottomChip && viewsPanel ? 'pb-12' : 'pb-6'

  const avatarShapeStyle = getAvatarShapeStyle((profile as any).avatar_shape)
  const showAvatar = (profile as any).show_avatar !== false
  const panelRadius = (profile as any).border_radius ?? 24
  const swapBoxColors = (profile as any).swap_box_colors === true
  const monochromeIcons = (profile as any).monochrome_icons === true
  const bgColor = (profile as any).background_color || '#0b0b12'
  // User-controlled toggles that affect the social-icon row:
  //   socials_below_widgets - when true, the social row renders AFTER
  //     widgets + music card instead of between bio and buttons.
  //   socials_glow_mono     - when true, the drop-shadow uses one
  //     `glow_color` for every icon. When false (default), each
  //     icon's glow uses its platform brand colour (Spotify green,
  //     YouTube red, …).
  const socialsBelow = (profile as any).socials_below_widgets === true
  const monoGlow = (profile as any).socials_glow_mono === true
  // The card's border (from panelShellStyle) + overflow:hidden + the full-bleed
  // banner leaves anti-aliased gaps at the rounded corners. Draw the border as a
  // pointer-events-none overlay on top instead (a plain bordered rounded box has
  // crisp corners), and drop the base border so it isn't doubled.
  const shellBorder = (panelShellStyle as any)?.border as string | undefined
  // Both above and below slots render the same big + centred row -
  // the compact left-aligned variant felt deflated next to the
  // bigger buttons, and a centred feature row reads cleaner in both
  // positions.
  const socialsRow = (() => {
    if (socialLinks.length === 0) return null
    return (
      <div className="flex flex-wrap items-center justify-center gap-4">
        {socialLinks.map((link) => {
          const brand = BRAND_COLOURS[link.platform.toLowerCase()] || iconColor
          const resolved = monochromeIcons ? iconColor : brand
          // Per-icon glow colour resolution. Mono mode collapses
          // every icon's glow to the single Glow Color setting,
          // which is what the legacy renderer did. Non-mono
          // (default) uses the platform brand colour so e.g.
          // Spotify glows green.
          const glowSource = monoGlow ? (glowColor || accentColor) : brand
          const glowFilter = profile.glow_socials
            ? `drop-shadow(0 0 ${4 + (glowIntensity / 100) * 4}px ${hexToRgba(glowSource, 0.5)}) drop-shadow(0 0 ${8 + (glowIntensity / 100) * 12}px ${hexToRgba(glowSource, 0.22)})`
            : undefined
          const iconNode = link.platform === 'custom' && link.icon_url ? (
            <img loading="lazy" decoding="async" src={link.icon_url} alt={link.label || ''} className="h-9 w-9 rounded object-contain" />
          ) : (
            <SocialIcon platform={link.platform} className="h-9 w-9" style={{ color: resolved }} />
          )

          // Crypto links: copy address to clipboard instead of navigating.
          // Without this, the browser treats the wallet address as a
          // relative URL and goes to halo.rip/<address> -> 404.
          if (CRYPTO_PLATFORMS.has(link.platform.toLowerCase())) {
            return (
              <HoverTooltip key={link.id} label={`Click to copy ${link.platform.toUpperCase()} address`}>
              <button
                type="button"
                aria-label={`Copy ${link.platform.toUpperCase()} address`}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link.url)
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
                className="flex h-12 w-12 items-center justify-center transition hover:scale-110"
                style={{ filter: glowFilter }}
              >
                {iconNode}
              </button>
              </HoverTooltip>
            )
          }

          // Protocol guard: /api/social-links already rejects
          // non-http/https on write, but /api/templates/apply
          // restores the same column with only `String(r.url)` and
          // no protocol re-check (`app/api/templates/apply/route.ts`
          // L91). Defence in depth so a template-restore can't
          // sneak a javascript:/data:/vbscript: URI past the writer
          // and end up in this <a href>. The classic layout already
          // does this via guns-profile.tsx's buildSocialHref - this
          // matches that behaviour.
          const safeHref = /^https?:\/\//i.test(link.url) ? link.url : '#'
          return (
            <HoverTooltip key={link.id} label={link.label || link.platform}>
            <a
              href={safeHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label || link.platform}
              onClick={() => fetch('/api/track-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: profile.id, link_type: 'social', link_id: link.id }), keepalive: true }).catch(() => {})}
              className="flex h-12 w-12 items-center justify-center transition hover:scale-110"
              style={{ filter: glowFilter }}
            >
              {iconNode}
            </a>
            </HoverTooltip>
          )
        })}
      </div>
    )
  })()

  return (
    <div
      style={{
        // Card chrome derived from the user's Profile Opacity +
        // Profile Blur + card_style + outline settings. Modern used
        // to hardcode a fixed glass effect that ignored these sliders
        // entirely; now the user's customize panel actually drives
        // the look. Modern's per-layout polish (accent inset
        // highlight, layered drop shadow) is layered on top via
        // `boxShadow` so the brand touch survives even when the user
        // pushes opacity to 0 / blur to 0.
        ...panelShellStyle,
        // Override the user's radius with Modern's panel radius so
        // the avatar-on-seam shape still works at any radius the user
        // sets - Modern needs a corner radius the avatar can rest on.
        borderRadius: panelRadius,
        boxShadow: [
          `0 24px 60px -28px ${hexToRgba('#000000', 0.7)}`,
          `0 2px 0 ${hexToRgba(accentColor, 0.08)} inset`,
          `0 1px 0 ${hexToRgba('#ffffff', 0.06)} inset`,
        ].join(', '),
        // Base border removed - the outline is drawn by the overlay below so
        // the rounded corners stay crisp (border + overflow:hidden + banner
        // leaves corner gaps).
        border: 'none',
      }}
    >
      {/* Inner surface div carries the user's background-color /
          background-image (their Profile Opacity setting drives the
          alpha). This sits beneath the banner + content so the
          backdrop-filter on the shell samples the page background
          (wallpaper) before this surface paints. Matches Classic's
          pattern at guns-profile.tsx:1160 (aria-hidden absolute
          inset-0 surface). */}
      <div aria-hidden className="absolute inset-0" style={{ ...panelSurfaceStyle, borderRadius: panelRadius }} />
      {/* Banner header - uses banner_url (uploaded) when present,
          else a richer 3-stop accent gradient with subtle radial
          highlight so the strip reads intentional even without a
          custom image. The bottom fade uses two layered gradients
          (one fast, one slow) for a smoother transition into the
          card body. The viewsPanel splices in here (relative
          ancestor) so the chip floats at the user-configured corner
          of the banner. */}
      <div className="relative h-40 w-full overflow-hidden">
        {bannerUrl ? (
          <img decoding="async" src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${hexToRgba(accentColor, 0.65)} 0%, ${hexToRgba(glowColor, 0.32)} 50%, ${hexToRgba('#0b0b12', 0.55)} 100%)`,
              }}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 20% 30%, ${hexToRgba('#ffffff', 0.14)} 0%, transparent 55%)`,
              }}
            />
          </>
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: [
              `linear-gradient(to bottom, transparent 40%, ${hexToRgba(bgColor, 0.55)} 80%, ${hexToRgba(bgColor, 0.8)} 100%)`,
              `linear-gradient(to bottom, transparent 70%, ${hexToRgba(accentColor, 0.06)} 100%)`,
            ].join(', '),
          }}
        />
        {/* The views/location chip was anchored here, but that
            scoped its `absolute bottom: …` positioning to the
            banner instead of the whole card - bottom-left /
            bottom-right ended up pinned to the bottom of the banner
            strip. The chip now lives as a sibling of this banner
            div (see {viewsPanel} below the content block), so all
            four corners resolve against the outer card. */}
      </div>

      {/* Card content padding. Bottom padding switches based on
          whether the views/location chip lives at the bottom - see
          `contentBottomPadding` above. Horizontal padding is tighter
          on mobile (px-4) so social icons + widget grid don't get
          squeezed to half-width on narrow phones; bumps back to
          px-6 on sm+ for the original spacing. */}
      <div className={`relative z-10 px-4 sm:px-6 ${contentBottomPadding}`}>
        {/* Discord-style header: avatar on the left overlapping the
            banner seam (-mt-14 so half a 112px avatar sits inside the
            banner), identity sits beside it text-left. The avatar
            gets a soft accent-coloured halo so it pops off the
            banner without needing an opaque ring. */}
        {/* Avatar + identity row.
            Mobile: -mt-12 + 88px avatar + gap-3 so the name has room.
            Desktop (sm+): -mt-14 + 112px avatar + gap-5 (original look).
            The 112px avatar was eating ~30% of a 375px-wide phone
            viewport, leaving the identity column cramped and making
            long names truncate aggressively. */}
        <div className="-mt-12 mb-5 flex items-end gap-3 sm:-mt-14 sm:gap-5">
          {showAvatar && (
            <div
              className="shrink-0 transition-transform duration-300 hover:scale-[1.03]"
              style={{
                filter: `drop-shadow(0 6px 18px ${hexToRgba('#000000', 0.45)}) drop-shadow(0 0 16px ${hexToRgba(accentColor, 0.25)})`,
              }}
            >
              {/* Responsive size: 88px on mobile, 112px on sm+. The
                  AvatarWithDecoration component takes a number prop;
                  use a CSS-based pattern by passing the larger size
                  and scaling visually via Tailwind. Simpler: render
                  one of two sizes based on a media query through a
                  wrapper-class trick. */}
              <div className="origin-bottom-left scale-[0.785] sm:scale-100">
                <AvatarWithDecoration
                  size={112}
                  decorationSlug={(profile as any).avatar_decoration_hash}
                  avatarShapeStyle={avatarShapeStyle}
                >
                  {profile.avatar_url ? (
                    <AvatarMedia src={profile.avatar_url} />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-3xl font-bold"
                      style={{ backgroundColor: hexToRgba(accentColor, 0.2), color: accentColor }}
                    >
                      {displayName?.[0]?.toUpperCase()}
                    </div>
                  )}
                </AvatarWithDecoration>
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1 pb-1">
            {identityBlock}
          </div>
        </div>

        {hasBio && bioBlock && (
          <div
            className="mb-5 rounded-xl px-3 py-2 text-sm leading-relaxed"
            style={{
              color: hexToRgba(textColor, 0.9),
              backgroundColor: hexToRgba('#ffffff', 0.025),
              border: `1px solid ${hexToRgba('#ffffff', 0.05)}`,
              fontFamily: fontApplyBio,
            }}
          >
            {bioBlock}
          </div>
        )}

        {/* Socials row - same big + centred shape in both slots.
            Per-icon brand-coloured glow when `glow_socials` is on;
            collapses to mono `glow_color` when `socials_glow_mono`
            is on. */}
        {!socialsBelow && socialsRow && <div className="mb-5">{socialsRow}</div>}

        {/* Custom buttons - Classic's centered-pill style, slightly
            taller (py-3) so they read as substantial CTAs instead
            of inline chips. */}
        {customButtons.length > 0 && (
          <div className="mb-5 space-y-2.5">
            {customButtons.map((button) => {
              const buttonHref = safeButtonHref(button.url)
              return (
                <a
                  key={button.id}
                  href={buttonHref}
                  aria-label={button.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => fetch('/api/track-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: profile.id, link_type: 'button', link_id: button.id }), keepalive: true }).catch(() => {})}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:scale-[1.02] hover:brightness-110"
                  style={getButtonStyle(button, { accentColor, textColor, outlineEnabled: profile.outline_enabled, outlineColor: profile.outline_color, glowColor, glowIntensity, swapBoxColors })}
                >
                  {button.media_url ? <img loading="lazy" decoding="async" src={button.media_url} alt="" className="h-6 w-6 rounded object-cover" /> : null}
                  <span>{button.label}</span>
                  <IconExternalLink className="h-3.5 w-3.5 opacity-70" />
                </a>
              )
            })}
          </div>
        )}

        {/* Widgets - the carousel / stack lives here, mirroring Classic. */}
        <div className="mb-5">{widgetsPanel}</div>

        {/* Inline music card - same JSX shape Classic uses. Null when
            music is disabled or hide-panel is set. */}
        {musicCard}

        {/* Socials may also live below widgets/music when the user
            toggles `socials_below_widgets`. */}
        {socialsBelow && socialsRow && <div className="mt-6">{socialsRow}</div>}
      </div>

      {/* Views + location chip - anchored to the OUTER card (this
          `relative overflow-hidden` wrapper) so absolute top-* and
          bottom-* positioning resolves against the card corners.
          When the chip was inside the banner div above, bottom-left
          / bottom-right ended up pinned to the bottom of the banner
          strip instead of the bottom of the whole card. */}
      {viewsPanel}
      {likePanel}

      {/* Outline overlay - drawn on top so the border-radius corners stay crisp
          (a plain bordered rounded box has no corner gaps, unlike a bordered
          overflow-hidden card with a full-bleed banner). */}
      {shellBorder && shellBorder !== '1px solid transparent' ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ borderRadius: panelRadius, border: shellBorder }}
        />
      ) : null}
    </div>
  )
}
