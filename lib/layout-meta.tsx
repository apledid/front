/**
 * Layout archetype metadata. Single source of truth for the layout picker
 * in /dashboard/customize and any preview surfaces. Each entry maps a
 * `layout_mode` value (the column written to `profiles.layout_mode`) to
 * its display label, a one-line marketing description, and a stylised
 * preview generator that <LayoutCard> renders inside the picker tile.
 *
 * Adding a new layout: drop a new entry here, add a render branch to the
 * profile renderer (components/profile/guns-profile.tsx), and the picker
 * UI picks it up automatically.
 */

import type { ReactNode } from 'react'

export type LayoutMode = 'default' | 'modern'

export interface LayoutMeta {
  id: LayoutMode
  label: string
  /** One-line description shown under the title in the picker. */
  description: string
  /** Stylised SVG preview drawn at 132x100. */
  preview: () => ReactNode
  /** Whether the layout supports the Panel Width sub-control. */
  supportsPanelWidth: boolean
  /** Whether the layout uses the avatar position/placement sub-controls. */
  supportsAvatarPlacement: boolean
  /** Marked true for layouts not yet shipped (renders the card as "soon"). */
  comingSoon?: boolean
}

/* ── Preview shapes ────────────────────────────────────────────────────
   Each preview is a 132×100 SVG that suggests the layout's structure with
   pink-on-dark wireframe shapes. Avatar = filled circle, name/bio = thin
   pills, links/buttons = rounded rects.
   ─────────────────────────────────────────────────────────────────── */

const PINK = '#e87fa0'
const PINK_FAINT = 'rgba(232,127,160,0.35)'
const WHITE_FAINT = 'rgba(255,255,255,0.45)'

function ClassicPreview() {
  return (
    <svg viewBox="0 0 132 100" className="h-full w-full">
      <rect x="0" y="0" width="132" height="100" rx="8" fill="#0e0e11" />
      {/* Avatar centered top */}
      <circle cx="66" cy="22" r="9" fill={PINK} />
      {/* Name + bio pills */}
      <rect x="46" y="36" width="40" height="3" rx="1.5" fill={WHITE_FAINT} />
      <rect x="54" y="42" width="24" height="2" rx="1" fill={PINK_FAINT} />
      {/* Stacked buttons */}
      <rect x="22" y="54" width="88" height="9" rx="3" fill="rgba(255,255,255,0.08)" />
      <rect x="22" y="68" width="88" height="9" rx="3" fill="rgba(255,255,255,0.08)" />
      <rect x="22" y="82" width="88" height="9" rx="3" fill="rgba(255,255,255,0.08)" />
    </svg>
  )
}

function ModernPreview() {
  return (
    <svg viewBox="0 0 132 100" className="h-full w-full">
      <rect x="0" y="0" width="132" height="100" rx="8" fill="#0e0e11" />
      {/* Banner strip */}
      <rect x="6" y="6" width="120" height="22" rx="4" fill="rgba(232,127,160,0.15)" />
      {/* Avatar overlapping banner bottom-left */}
      <circle cx="22" cy="32" r="9" fill={PINK} stroke="#0e0e11" strokeWidth="2" />
      {/* Name + bio */}
      <rect x="36" y="32" width="44" height="3" rx="1.5" fill={WHITE_FAINT} />
      <rect x="36" y="38" width="32" height="2" rx="1" fill={PINK_FAINT} />
      {/* Buttons */}
      <rect x="8" y="50" width="116" height="8" rx="3" fill="rgba(255,255,255,0.08)" />
      <rect x="8" y="62" width="116" height="8" rx="3" fill="rgba(255,255,255,0.08)" />
      <rect x="8" y="74" width="116" height="8" rx="3" fill="rgba(255,255,255,0.08)" />
      <rect x="8" y="86" width="56" height="8" rx="3" fill="rgba(255,255,255,0.06)" />
    </svg>
  )
}

export const LAYOUT_META: LayoutMeta[] = [
  {
    id: 'default',
    label: 'Classic',
    description: 'Centered avatar, stacked links. The default expectation.',
    preview: ClassicPreview,
    supportsPanelWidth: true,
    supportsAvatarPlacement: true,
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Banner strip with avatar overlap, left-aligned identity.',
    preview: ModernPreview,
    supportsPanelWidth: false,
    supportsAvatarPlacement: false,
  },
]

/** Lookup helper for the picker's selected-card check. */
export function getLayoutMeta(id: string | null | undefined): LayoutMeta {
  return LAYOUT_META.find((m) => m.id === id) ?? LAYOUT_META[0]
}
