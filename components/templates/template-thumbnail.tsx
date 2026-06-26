'use client'

import { IconStack2 } from '@tabler/icons-react'

/**
 * Hint-style preview for a template card.
 *
 * - If `previewImage` is set, render it (object-cover, fills the slot).
 * - Otherwise, synthesize a gradient placeholder from the template's
 *   `accent_color` + `background_color` so blank cards still hint at the
 *   actual aesthetic. Templates with very different palettes look visually
 *   distinct without any server-side screenshot work.
 * - As a last resort (no accent + no image), show the generic Layers icon.
 *
 * The component is intentionally aspect-ratio-agnostic: the parent picks
 * the box (e.g. aspect-[16/10] on the card, aspect-square in a list view)
 * and this component fills it.
 */
export function TemplateThumbnail({
  previewImage,
  accentColor,
  backgroundColor,
  cardStyle,
  templateName,
  className = '',
}: {
  previewImage?: string | null
  accentColor?: string | null
  backgroundColor?: string | null
  /** Used to pick a faint texture variant - currently unused, reserved for v2. */
  cardStyle?: string | null
  templateName?: string
  className?: string
}) {
  if (previewImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={previewImage}
        alt={templateName || 'Template preview'}
        className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${className}`}
        loading="lazy"
        decoding="async"
      />
    )
  }

  // No preview image - synthesize one from the template's palette.
  const accent = (accentColor || '').trim()
  const bg = (backgroundColor || '').trim()

  // If we have neither colour we can't synthesize anything meaningful;
  // show the legacy Layers icon over a neutral dark gradient.
  if (!accent && !bg) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-black/30 ${className}`}
      >
        <IconStack2 className="size-14 text-muted-foreground/30" />
      </div>
    )
  }

  // Build a layered gradient: the accent colour glows from one corner, the
  // background colour fills the rest. If only one is set, the other becomes
  // a deep neutral. We rely on CSS color-mix only via opacity-suffixed hex
  // (Tailwind doesn't compile these dynamic colours), so all colours are
  // pushed through inline `style`.
  const accentSafe = accent || '#e87fa0'
  const bgSafe = bg || '#0b0b14'

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{
        // Base fill is the template's background colour.
        backgroundColor: bgSafe,
        // Overlay a soft accent glow from the top-left.
        backgroundImage: `radial-gradient(120% 90% at 18% 12%, ${accentSafe}66, transparent 55%), radial-gradient(80% 60% at 85% 90%, ${accentSafe}33, transparent 60%)`,
      }}
    >
      {/* Subtle dotted texture so flat gradients don't feel sterile. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.45) 1px, transparent 0)',
          backgroundSize: '14px 14px',
        }}
      />

      {/* Glowing accent orb - reads as the "avatar" position in the layout. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-[42%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: accentSafe,
          boxShadow: `0 0 32px 8px ${accentSafe}99, 0 0 8px 2px ${accentSafe}`,
          opacity: 0.85,
        }}
      />

      {/* Stylised card-strip below the orb - mimics the profile card silhouette. */}
      <div
        aria-hidden
        className="absolute inset-x-6 bottom-5 h-10 rounded-lg border border-white/10"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Top dim so overlay chips (visibility, PRO badge) stay legible. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/35 to-transparent"
      />
    </div>
  )
}
