'use client'

import type { CSSProperties } from 'react'
import { AnimatedViewCount } from '@/components/profile/parts/animated-view-count'
import { HoverTooltip } from '@/components/profile/parts/hover-tooltip'

// Icon glyphs (MDI eye + map-marker, 24x24) requested for the views/location chip.
const EYE_PATH = 'M12 9a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3m0 8a5 5 0 0 1-5-5a5 5 0 0 1 5-5a5 5 0 0 1 5 5a5 5 0 0 1-5 5m0-12.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5'
const PIN_PATH = 'M12 12q.825 0 1.413-.587T14 10t-.587-1.412T12 8t-1.412.588T10 10t.588 1.413T12 12m0 10q-4.025-3.425-6.012-6.362T4 10.2q0-3.75 2.413-5.975T12 2t5.588 2.225T20 10.2q0 2.5-1.987 5.438T12 22'

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

/**
 * The little views + location chip pinned to the profile (top corner / banner).
 * Glassy rounded pill with a thin divider between the two, and a hover tooltip
 * ("Views" / "Location") on each. Shared across the Classic / default / Modern
 * layouts so they all look the same.
 */
export function ViewsLocationChip({
  showViews, viewCount, animate, location, locationColor, badgeBg, isMobile, style,
}: {
  showViews: boolean
  viewCount: number
  animate: boolean
  location?: string | null
  locationColor?: string
  badgeBg: boolean
  isMobile: boolean
  style?: CSSProperties
}) {
  if (!showViews && !location) return null
  return (
    <div
      className={`pointer-events-none absolute z-[31] flex flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-full ${badgeBg ? (isMobile ? 'px-2.5 py-1' : 'px-3 py-1.5') : 'px-2.5 py-1'} ${isMobile ? 'text-xs' : 'text-[13px]'} font-medium`}
      style={{
        color: 'rgba(255,255,255,0.82)',
        background: badgeBg ? 'rgba(0,0,0,0.42)' : 'transparent',
        backdropFilter: badgeBg ? 'blur(12px) saturate(140%)' : undefined,
        WebkitBackdropFilter: badgeBg ? 'blur(12px) saturate(140%)' : undefined,
        border: badgeBg ? '1px solid rgba(255,255,255,0.12)' : undefined,
        boxShadow: badgeBg ? '0 6px 18px -8px rgba(0,0,0,0.55)' : undefined,
        maxWidth: 'calc(50% - 36px)',
        ...style,
      }}
    >
      {showViews && (
        <HoverTooltip label="Views" className="pointer-events-auto">
          <span className="flex items-center gap-1.5">
            <Glyph d={EYE_PATH} />
            <AnimatedViewCount target={viewCount} animate={animate} />
          </span>
        </HoverTooltip>
      )}
      {showViews && location ? <span aria-hidden className="h-3 w-px shrink-0 bg-white/25" /> : null}
      {location ? (
        <HoverTooltip label="Location" className="pointer-events-auto">
          <span className="flex items-center gap-1.5" style={{ color: locationColor }}>
            <Glyph d={PIN_PATH} />
            <span className="truncate">{location}</span>
          </span>
        </HoverTooltip>
      ) : null}
    </div>
  )
}
