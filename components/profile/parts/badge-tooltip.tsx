'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Badge name tooltip that escapes parent stacking contexts via a portal,
 * so it always floats above the avatar / card content on hover.
 */
export function BadgeTooltip({
  label, glowColor, children,
}: {
  label: string; glowColor: string; children: ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLSpanElement | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const update = () => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCoords({ x: r.left + r.width / 2, y: r.top })
  }

  return (
    <>
      <span
        ref={ref}
        className="group relative inline-flex"
        onMouseEnter={() => { update(); setHovered(true) }}
        onMouseLeave={() => setHovered(false)}
      >
        {children}
      </span>
      {mounted && hovered && coords ? createPortal(
        <span
          className="pointer-events-none fixed z-[2147483646] rounded-lg px-2.5 py-1 text-[11px] font-medium text-white"
          style={{
            left: coords.x,
            top: coords.y - 10,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'rgba(58,61,74,0.55)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 8px 22px -6px rgba(0,0,0,0.45)',
            whiteSpace: 'nowrap',
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
