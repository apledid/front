'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Styled hover tooltip that replaces the native `title=` bubble on profile
 * icons. Matches the badge + UID tooltips exactly (glassy pill, no caret) and
 * renders via a portal so it floats above any overflow-hidden /
 * stacking-context parent (social icon wrappers use overflow-hidden for their
 * rounded backgrounds). Shares the `haloTipIn` animation.
 */
export function HoverTooltip({
  label, children, className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  const [hovered, setHovered] = useState(false)
  const [coords, setCoords] = useState<{ x: number; top: number; bottom: number } | null>(null)
  const ref = useRef<HTMLSpanElement | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const update = () => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    // Clamp x to the viewport so the bubble never runs off the side.
    const vw = typeof window !== 'undefined' ? window.innerWidth : 9999
    const x = Math.min(Math.max(r.left + r.width / 2, 44), vw - 44)
    setCoords({ x, top: r.top, bottom: r.bottom })
  }

  // Flip below the trigger when there isn't room for the bubble above it -
  // otherwise icons near the top of the page/iframe push it off-screen and it
  // looks like the tooltip "doesn't show up".
  const below = coords ? coords.top < 44 : false

  return (
    <>
      <span
        ref={ref}
        className={`relative inline-flex ${className || ''}`}
        onMouseEnter={() => { update(); setHovered(true) }}
        onMouseLeave={() => setHovered(false)}
      >
        {children}
      </span>
      {mounted && hovered && coords && label ? createPortal(
        <span
          className="pointer-events-none fixed z-[2147483646] whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium text-white"
          style={{
            left: coords.x,
            top: below ? coords.bottom + 8 : coords.top - 8,
            transform: below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            backgroundColor: 'rgba(58,61,74,0.55)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 8px 22px -6px rgba(0,0,0,0.45)',
            animation: 'haloTipIn 130ms ease-out',
          }}
        >
          {label}
        </span>,
        document.body,
      ) : null}
    </>
  )
}
