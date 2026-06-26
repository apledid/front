'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * View count display with an optional count-up animation on first mount.
 * When `animate` is true the number eases from 0 to `target` over ~600-1800ms
 * (proportional to target size). When false the target renders immediately.
 */
export function AnimatedViewCount({ target, animate }: { target: number; animate: boolean }) {
  const [count, setCount] = useState(animate ? 0 : target)
  const started = useRef(false)

  useEffect(() => {
    if (!animate || started.current) return
    started.current = true
    if (target === 0) return
    const duration = Math.min(1800, Math.max(600, target * 0.8))
    const startTime = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setCount(Math.round(eased * target))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [animate, target])

  return <>{count.toLocaleString()}</>
}
