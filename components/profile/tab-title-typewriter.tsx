'use client'

import { useEffect, useRef } from 'react'

interface TabTitleTypewriterProps {
  /** Full title to type out, e.g. "@rez". */
  title: string
  /**
   * Optional leading slice of `title` that is always visible - the loop
   * types from the end of this prefix and erases back down to it instead
   * of going fully empty. Example: title="@rez" + prefix="@" makes the
   * "@" sit there while only "rez" gets typed/erased.
   */
  prefix?: string
  /** ms per character while typing. Default 480. */
  typeMs?: number
  /** ms per character while erasing. Default 260. */
  eraseMs?: number
  /** ms to pause on the full title before erasing. Default 600. */
  holdMs?: number
  /** ms to pause at the prefix-only state before retyping. Default 1100. */
  emptyHoldMs?: number
}

/**
 * Animates the browser tab title with a typewriter loop:
 *   type → hold full → erase → hold empty → repeat.
 *
 * Mount once per profile page. Owns document.title for the lifetime of the
 * page; Next.js will overwrite it on the next navigation. Respects
 * prefers-reduced-motion (renders the static title, no loop).
 *
 * Implementation uses a single recursive setTimeout driven by refs so:
 *   - cleanup deterministically cancels the next tick (no zombie timers)
 *   - prop changes restart the loop cleanly from the start
 *   - no async/await race where a stale closure overwrites the new title
 */
export function TabTitleTypewriter({
  title,
  prefix = '',
  typeMs = 480,
  eraseMs = 260,
  holdMs = 600,
  emptyHoldMs = 1100,
}: TabTitleTypewriterProps) {
  // Only honor the prefix if it actually leads the title - otherwise ignore.
  const safePrefix = title.startsWith(prefix) ? prefix : ''

  // Hold props in a ref so the tick function reads current values without
  // having to be re-created (and the timer chain reset) on every prop tweak.
  const propsRef = useRef({ title, prefix: safePrefix, typeMs, eraseMs, holdMs, emptyHoldMs })
  propsRef.current = { title, prefix: safePrefix, typeMs, eraseMs, holdMs, emptyHoldMs }

  useEffect(() => {
    if (typeof document === 'undefined' || !title) return

    // Honor OS-level reduced-motion preference - render static, no loop.
    const prefersReduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduce) {
      document.title = title
      return
    }

    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    type Phase = 'typing' | 'holdFull' | 'erasing' | 'holdEmpty'
    let phase: Phase = 'typing'
    // Start with the prefix already visible (e.g. "@") and animate the rest.
    let i = propsRef.current.prefix.length

    const schedule = (ms: number) => {
      if (cancelled) return
      timer = setTimeout(tick, ms)
    }

    const tick = () => {
      if (cancelled) return
      const p = propsRef.current
      const floor = p.prefix.length

      switch (phase) {
        case 'typing': {
          i = Math.min(i + 1, p.title.length)
          document.title = p.title.slice(0, i)
          if (i >= p.title.length) {
            phase = 'holdFull'
            schedule(p.holdMs)
          } else {
            schedule(p.typeMs)
          }
          break
        }
        case 'holdFull': {
          phase = 'erasing'
          schedule(p.eraseMs)
          break
        }
        case 'erasing': {
          i = Math.max(i - 1, floor)
          document.title = p.title.slice(0, i)
          if (i <= floor) {
            phase = 'holdEmpty'
            schedule(p.emptyHoldMs)
          } else {
            schedule(p.eraseMs)
          }
          break
        }
        case 'holdEmpty': {
          phase = 'typing'
          schedule(p.typeMs)
          break
        }
      }
    }

    // Kick off - show the prefix (or nothing if there isn't one) immediately
    // and queue the first real character.
    document.title = propsRef.current.prefix
    schedule(60)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // Only re-run when the target title itself changes (e.g. user nav).
    // typeMs/eraseMs/holdMs/prefix changes are picked up live via propsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  return null
}
