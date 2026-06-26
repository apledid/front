'use client'

/**
 * Spotify-style synced lyrics view. Parses LRC ("[mm:ss.xx] line") and, given
 * the audio's current time, highlights the active line and auto-scrolls it to
 * the centre. Falls back to a static read of plain lyrics when there are no
 * timestamps. Rendered only on rez's profile for now (gated in guns-profile).
 */

import { useEffect, useMemo, useRef } from 'react'

interface Line { time: number; text: string }

function parseLRC(lrc: string): Line[] {
  const out: Line[] = []
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    if (stamps.length === 0) continue
    const text = raw.replace(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g, '').trim()
    for (const m of stamps) {
      const min = parseInt(m[1], 10)
      const sec = parseInt(m[2], 10)
      const frac = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0
      if (!Number.isNaN(min) && !Number.isNaN(sec)) out.push({ time: min * 60 + sec + frac, text })
    }
  }
  return out.sort((a, b) => a.time - b.time)
}

export function SyncedLyrics({
  lrc, currentTime, accentColor = '#e87fa0',
}: {
  lrc: string
  currentTime: number
  accentColor?: string
}) {
  const lines = useMemo(() => parseLRC(lrc), [lrc])
  const activeRef = useRef<HTMLParagraphElement | null>(null)

  // The active line is the last one whose timestamp has passed. A small lead
  // (0.25s) flips the highlight a hair early so it feels in time, not behind.
  const activeIndex = useMemo(() => {
    let idx = -1
    const t = currentTime + 0.25
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= t) idx = i
      else break
    }
    return idx
  }, [lines, currentTime])

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex])

  // No timestamps: the lyrics are plain text, show them as a static block.
  if (lines.length === 0) {
    const plain = lrc.split(/\r?\n/).filter(l => l.trim())
    return (
      <div className="space-y-2 text-center">
        {plain.map((l, i) => (
          <p key={i} className="text-[15px] font-medium leading-relaxed text-white/70">{l}</p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3 py-[40%] text-center">
      {lines.map((ln, i) => {
        const active = i === activeIndex
        const done = i < activeIndex
        return (
          <p
            key={i}
            ref={active ? activeRef : null}
            className="px-2 leading-snug transition-all duration-300 ease-out"
            style={{
              color: active ? '#ffffff' : 'rgba(255,255,255,0.34)',
              fontWeight: active ? 700 : 600,
              fontSize: active ? '1.45rem' : '1.15rem',
              opacity: done ? 0.5 : 1,
              textShadow: active ? `0 0 22px ${accentColor}66` : 'none',
            }}
          >
            {ln.text || '♪'}
          </p>
        )
      })}
    </div>
  )
}
