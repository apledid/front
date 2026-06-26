'use client'

import { useEffect, useRef } from 'react'

/**
 * Background video that handles iOS / mobile autoplay quirks. Browsers
 * sometimes ignore the `autoPlay` attribute (iOS low-power mode, focus
 * restrictions, etc.), so we also call `.play()` on mount, when the video
 * is ready, and when the page first becomes visible. Failures are silenced.
 */
export function BackgroundVideo({ src, className, restartOn }: { src: string; className?: string; restartOn?: unknown }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const tryPlay = () => {
      const p = v.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    }
    tryPlay()
    const onTouch = () => tryPlay()
    const onVis = () => { if (!document.hidden) tryPlay() }
    document.addEventListener('touchstart', onTouch, { passive: true, once: true })
    document.addEventListener('click', onTouch, { once: true })
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('touchstart', onTouch)
      document.removeEventListener('click', onTouch)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [src])
  // Restart from the top when restartOn changes - e.g. the visitor clicks
  // "enter" on the splash, so the background plays from the start instead of
  // wherever it reached while the splash was up. Skipped when unset (the
  // splash's own copy of this video doesn't pass it).
  useEffect(() => {
    if (restartOn === undefined) return
    const v = ref.current
    if (!v) return
    try { v.currentTime = 0 } catch {}
    const p = v.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  }, [restartOn])
  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      // @ts-expect-error - older iOS reads webkit-playsinline (kebab) too
      webkit-playsinline="true"
      preload="auto"
      disablePictureInPicture
      controls={false}
      className={className}
      onCanPlay={(e) => {
        const v = e.currentTarget
        const p = v.play()
        if (p && typeof p.catch === 'function') p.catch(() => {})
      }}
    />
  )
}
