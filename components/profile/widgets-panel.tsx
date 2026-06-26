'use client'

import { useEffect, useRef, useState } from 'react'
import { IconExternalLink } from '@tabler/icons-react'

type Widget = {
  id: string
  type: string
  config: any
  enabled: boolean
  display_order: number
}

// Platform badge meta
const PLATFORM: Record<string, { label: string; color: string }> = {
  github:   { label: 'GitHub',    color: '#e6edf3' },
  lastfm:   { label: 'Last.fm',   color: '#d51007' },
  roblox:   { label: 'Roblox',    color: '#ffffff' },
  valorant: { label: 'Valorant',  color: '#ff4655' },
  chess:    { label: 'Chess.com', color: '#81b64c' },
  weather:  { label: 'Weather',   color: '#fbbf24' },
  discord:  { label: 'Discord',   color: '#5865f2' },
  tiktok:           { label: 'TikTok',         color: '#ff0050' },
  'discord-server': { label: 'Server', color: '#5865f2' },
  tracker:          { label: 'Tracker.gg', color: '#ff5d23' },
  spotify:          { label: 'Spotify',   color: '#1db954' },
  minecraft:        { label: 'Minecraft', color: '#5fa44b' },
  time:             { label: 'Time',      color: '#60a5fa' },
  custom:           { label: 'Custom',    color: '#e87fa0' },
  twitch:           { label: 'Twitch',    color: '#9146ff' },
  overwatch:        { label: 'Overwatch', color: '#f99e1a' },
  genshin:          { label: 'Genshin',   color: '#4eb1e5' },
  statsfm:          { label: 'stats.fm',  color: '#1ed760' },
  youtube:          { label: 'YouTube',   color: '#ff0000' },
  pinterest:        { label: 'Pinterest', color: '#e60023' },
  clashofclans:     { label: 'Clash of Clans', color: '#f0c040' },
  clashroyale:      { label: 'Clash Royale',   color: '#3aa3e3' },
  brawlstars:       { label: 'Brawl Stars',    color: '#ffcc00' },
  twitter:          { label: 'Twitter/X', color: '#1d9bf0' },
  telegram:         { label: 'Telegram',  color: '#229ed9' },
}

// Tiny platform icons (inline SVG, no extra deps)
function PlatformIcon({ type, className = 'h-5 w-5' }: { type: string; className?: string }) {
  switch (type) {
    case 'roblox':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M5.263 0L0 18.868 18.737 24 24 5.132zm10.143 14.876l-5.794-1.553 1.553-5.794 5.794 1.553z"/></svg>
    case 'discord':
    case 'discord-server':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.114 18.1.132 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
    case 'github':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
    case 'lastfm':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M10.599 17.211l-.881-2.393s-1.433 1.596-3.579 1.596c-1.9 0-3.249-1.652-3.249-4.296 0-3.381 1.7-4.596 3.381-4.596 2.426 0 3.2 1.568 3.855 3.575l.88 2.755c.88 2.673 2.537 4.819 7.312 4.819 3.44 0 5.77-1.052 5.77-3.82 0-2.239-1.283-3.396-3.665-3.95l-1.768-.385c-1.227-.275-1.584-.77-1.584-1.594 0-.935.742-1.485 1.952-1.485 1.32 0 2.03.495 2.14 1.65l2.756-.33c-.22-2.485-1.94-3.51-4.73-3.51-2.48 0-4.84.935-4.84 3.925 0 1.87.907 3.05 3.18 3.6l1.88.44c1.39.33 1.92.88 1.92 1.76 0 1.046-1.01 1.485-2.95 1.485-2.865 0-4.064-1.513-4.75-3.564l-.908-2.78C12.22 7.647 10.598 5.5 6.34 5.5 2.54 5.5 0 8.1 0 12.2c0 3.97 2.43 6.3 6.01 6.3 3.1 0 4.589-1.289 4.589-1.289z"/></svg>
    case 'valorant':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12.217.002c-.141 0-.281.005-.422.013C5.715.406 1.003 5.913.182 13.006c-.053.456.365.832.822.732C3.655 13.1 5.77 11.03 6.408 8.38c.066-.275.373-.41.62-.264l5.16 3.07c.267.159.267.55 0 .708l-5.16 3.07c-.247.147-.554.01-.62-.264-.638-2.65-2.753-4.72-5.404-5.358a.65.65 0 0 0-.822.732c.82 7.093 5.533 12.6 11.613 12.992 6.657.42 12.205-4.845 12.205-11.033C24 5.515 18.708.002 12.217.002z"/></svg>
    case 'tiktok':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
    case 'chess':
      return (
        // Chess.com logo (knight)
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 2a1 1 0 0 0-1 1v1H7a1 1 0 0 0-1 1v2H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1v1l-2 4h12l-2-4v-1h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1V6a1 1 0 0 0-1-1h-1V3a1 1 0 0 0-1-1H9z"/>
        </svg>
      )
    case 'spotify':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
    case 'minecraft':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3V3zm2 2v6h6V5H5zm8 0v6h6V5h-6zm-8 8v6h6v-6H5zm8 0v6h6v-6h-6z"/></svg>
    case 'time':
      return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" strokeLinecap="round"/></svg>
    case 'custom':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.6 6.6L21 9.3l-5 4.3 1.6 6.4L12 16.9 6.4 20l1.6-6.4-5-4.3 6.4-.7z"/></svg>
    case 'twitch':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
    case 'youtube':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12z"/></svg>
    case 'pinterest':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/></svg>
    case 'twitter':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    case 'telegram':
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
    case 'overwatch':
    case 'genshin':
    case 'statsfm':
    case 'clashofclans':
    case 'clashroyale':
    case 'brawlstars':
      // Generic game/shield mark for the platforms without a bundled brand glyph.
      return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3zm0 4.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 5.5c2.2 0 4 1.2 4 2.7V16H8v-1.3c0-1.5 1.8-2.7 4-2.7z"/></svg>
    default:
      return null
  }
}

// Minutes that `tz` is offset from UTC at the instant `date` (handles DST).
function tzOffsetMinutes(tz: string, date: Date): number {
  try {
    const p = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date)
    const m: Record<string, number> = {}
    for (const part of p) if (part.type !== 'literal') m[part.type] = Number(part.value)
    const asUTC = Date.UTC(m.year, (m.month || 1) - 1, m.day, m.hour === 24 ? 0 : m.hour, m.minute, m.second)
    return Math.round((asUTC - date.getTime()) / 60000)
  } catch { return 0 }
}

function offsetLabel(min: number): string {
  const sign = min >= 0 ? '+' : '-'
  const a = Math.abs(min)
  const h = Math.floor(a / 60)
  const mm = a % 60
  return `UTC${sign}${h}${mm ? ':' + String(mm).padStart(2, '0') : ''}`
}

const TZ_ICONS = {
  cal: 'M7.75 2.5a.75.75 0 0 0-1.5 0v1.58c-1.44.115-2.384.397-3.078 1.092c-.695.694-.977 1.639-1.093 3.078h19.842c-.116-1.44-.398-2.384-1.093-3.078c-.694-.695-1.639-.977-3.078-1.093V2.5a.75.75 0 0 0-1.5 0v1.513C15.585 4 14.839 4 14 4h-4c-.839 0-1.585 0-2.25.013zM2 12c0-.839 0-1.585.013-2.25h19.974C22 10.415 22 11.161 22 12v2c0 3.771 0 5.657-1.172 6.828S17.771 22 14 22h-4c-3.771 0-5.657 0-6.828-1.172S2 17.771 2 14z',
  globe: 'M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20M4.06 13h3.16c.1 1.34.38 2.6.78 3.7A8.03 8.03 0 0 1 4.06 13m3.16-2H4.06a8.03 8.03 0 0 1 3.94-3.7c-.4 1.1-.68 2.36-.78 3.7m4.78 8.9c-.66-.7-1.4-2.06-1.7-3.9h3.4c-.3 1.84-1.04 3.2-1.7 3.9M9.96 13h4.08c-.1 1.2-.36 2.3-.72 3.18c-.4.96-.86 1.5-1.32 1.7c-.46-.2-.92-.74-1.32-1.7c-.36-.88-.62-1.98-.72-3.18m0-2c.1-1.2.36-2.3.72-3.18c.4-.96.86-1.5 1.32-1.7c.46.2.92.74 1.32 1.7c.36.88.62 1.98.72 3.18zm6.82 0c-.1-1.34-.38-2.6-.78-3.7A8.03 8.03 0 0 1 19.94 11zm0 2h3.16a8.03 8.03 0 0 1-3.94 3.7c.4-1.1.68-2.36.78-3.7',
}

// Analog-clock Time widget: dark clock face with live hands + a meta row
// (city/offset, date, local time, viewer's time + diff) and a time.is link.
function TimeWidget({ timezone, label, accent }: { timezone: string; label?: string; accent: string }) {
  const [now, setNow] = useState<Date | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scrollDx, setScrollDx] = useState(0)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const w = wrapRef.current, i = innerRef.current
    if (!w || !i) return
    const dx = i.scrollWidth - w.clientWidth
    setScrollDx(dx > 6 ? dx : 0)
  }, [now, timezone, label])

  const tz = timezone || 'UTC'
  const rawCity = tz.split('/').pop()?.replace(/_/g, ' ') || tz
  const city = label || rawCity.replace(/\b\w/g, (c) => c.toUpperCase())

  // Skeleton until the client clock mounts (avoids SSR/hydration mismatch).
  if (!now) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-[60px] w-[60px] shrink-0 animate-pulse rounded-full bg-white/[0.05]" />
        <div className="flex-1 space-y-2"><div className="h-3.5 w-2/3 animate-pulse rounded bg-white/[0.05]" /><div className="h-2.5 w-1/2 animate-pulse rounded bg-white/[0.04]" /></div>
      </div>
    )
  }

  let parts: Record<string, number> = { hour: 0, minute: 0, second: 0 }
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(now)
    for (const p of fmt) if (p.type !== 'literal') parts[p.type] = Number(p.value)
  } catch {}
  const hh = parts.hour % 12, mm = parts.minute, ss = parts.second
  const secDeg = ss * 6
  const minDeg = mm * 6 + ss * 0.1
  const hourDeg = hh * 30 + mm * 0.5

  const safeFmt = (opts: Intl.DateTimeFormatOptions) => {
    try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(now) } catch { return new Intl.DateTimeFormat('en-US', opts).format(now) }
  }
  const localTime = safeFmt({ hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
  const dateStr = safeFmt({ weekday: 'short', month: 'long', day: 'numeric' })
  const offStr = offsetLabel(tzOffsetMinutes(tz, now))
  const yourTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(now)
  const diffH = Math.round((-now.getTimezoneOffset() - tzOffsetMinutes(tz, now)) / 60)
  const diffStr = `${diffH >= 0 ? '+' : ''}${diffH}h`
  const timeIsHref = `https://time.is/${encodeURIComponent((tz.split('/').pop() || tz).replace(/ /g, '_'))}`

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const major = i % 5 === 0
    return <line key={i} x1="35" y1="5" x2="35" y2={major ? 12 : 8} stroke={major ? '#555' : '#2e2e2e'} strokeWidth={major ? 2 : 1} strokeLinecap="round" transform={`rotate(${i * 6} 35 35)`} />
  })

  return (
    <div className="flex items-center gap-3">
      <div className="grid shrink-0 place-items-center">
        <svg viewBox="0 0 70 70" width="60" height="60" role="img" aria-label={`Clock showing time in ${tz}`}>
          <circle cx="35" cy="35" r="33" fill="#141414" stroke="#303030" strokeWidth="1.5" />
          {ticks}
          <g style={{ transformBox: 'view-box', transformOrigin: '35px 35px', transform: `rotate(${hourDeg}deg)`, transition: 'transform 0.4s' }}>
            <line x1="35" y1="35" x2="35" y2="18" stroke="#f0f0f0" strokeWidth="3.5" strokeLinecap="round" />
          </g>
          <g style={{ transformBox: 'view-box', transformOrigin: '35px 35px', transform: `rotate(${minDeg}deg)`, transition: 'transform 0.3s' }}>
            <line x1="35" y1="35" x2="35" y2="11" stroke="#f0f0f0" strokeWidth="2.2" strokeLinecap="round" />
          </g>
          <g style={{ transformBox: 'view-box', transformOrigin: '35px 35px', transform: `rotate(${secDeg}deg)`, transition: ss === 0 ? 'none' : 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <line x1="35" y1="35" x2="35" y2="9" stroke="#f04040" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="35" y1="35" x2="35" y2="44" stroke="#f04040" strokeWidth="1.3" strokeLinecap="round" />
          </g>
          <circle cx="35" cy="35" r="3" fill="#f04040" />
          <circle cx="35" cy="35" r="1.5" fill="#f0f0f0" />
        </svg>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-y-0.5">
        <div className="inline-flex items-center text-[15px] font-semibold leading-tight text-white">
          <span className="truncate">{city}</span>
          <span className="ms-1.5 shrink-0 text-xs font-normal text-white/45">({offStr})</span>
        </div>
        <div ref={wrapRef} className="relative w-full overflow-hidden">
          <div
            ref={innerRef}
            className="inline-flex w-max items-center gap-x-3 whitespace-nowrap text-[11px] text-white/55"
            style={scrollDx ? { ['--scroll-dx' as any]: `-${scrollDx}px`, animation: 'widgetScrollPingPong 8s ease-in-out infinite' } : undefined}
          >
            <span className="inline-flex items-center gap-1"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5"><path fill="currentColor" d={TZ_ICONS.cal} /></svg>{dateStr}</span>
            <span className="inline-flex items-center gap-1 tabular-nums"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 1.8" /></svg>{localTime}</span>
            <span className="inline-flex items-center gap-1 tabular-nums"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5"><path fill="currentColor" d={TZ_ICONS.globe} /></svg>Your time: {yourTime} ({diffStr})</span>
          </div>
        </div>
        <a
          href={timeIsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 inline-flex w-fit items-center gap-1 self-start rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80"
          style={{ background: accent, color: '#fff' }}
        >
          View on time.is <IconExternalLink className="h-3 w-3 opacity-80" />
        </a>
      </div>
    </div>
  )
}

// Graceful fallback when an avatar / album-art / icon URL 404s. Hides the
// broken <img> and reveals its next sibling (the placeholder div). The
// pattern relies on the placeholder being rendered as `display: none`
// adjacent to the img - when this fires we flip it to flex.
function swapImageOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  img.style.display = 'none'
  const fb = img.nextElementSibling as HTMLElement | null
  if (fb) fb.style.display = 'flex'
}

// Format large numbers
function fmt(n: number | null | undefined): string {
  if (n == null) return '-'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000)    return `${(n / 1_000).toFixed(0)}K`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// Stat row item - icon + value + label
function Stat({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <span className="flex items-center gap-0.5 text-white/50">
      <span className="text-[11px] text-white/30">{icon}</span>
      <b className="text-white/75">{value}</b>
      <span className="ml-0.5">{label}</span>
    </span>
  )
}

function ViewBtn({ href, label = 'View Profile', compact = false }: { href: string; label?: string; compact?: boolean }) {
  if (compact) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-white/[0.10] bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-white/70 transition hover:bg-white/[0.12]"
      >
        View <IconExternalLink className="h-2.5 w-2.5 opacity-60" />
      </a>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/[0.10] bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-white/75 transition hover:bg-white/[0.12]"
    >
      {label} <IconExternalLink className="h-3 w-3 opacity-60" />
    </a>
  )
}

// ── per-type content ──────────────────────────────────────────────────────────

function WidgetBody({ type, data, displayMode, accent = '#e87fa0' }: { type: string; data: any; displayMode?: string; accent?: string }) {
  if (!data) return null
  const isGrid = displayMode === 'grid'
  const av = isGrid ? 'h-[60px] w-[60px]' : 'h-[68px] w-[68px]'   // avatar size class
  const ic = isGrid ? 'h-7 w-7'  : 'h-8 w-8'      // icon inside avatar
  const nm = isGrid ? 'text-[15px]' : 'text-[16px]' // name size
  const st = isGrid ? 'text-[12px]' : 'text-[13px]' // stats size

  // SPOTIFY (track / album / playlist / artist) - oEmbed card
  if (type === 'spotify') {
    return (
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {data.thumbnail && (
            <img src={data.thumbnail} alt="" className={`${av} rounded-lg object-cover`} onError={swapImageOnError} />
          )}
          <div className={`${av} shrink-0 items-center justify-center rounded-lg bg-[#1db954]/15`} style={{ display: data.thumbnail ? 'none' : 'flex' }}>
            <PlatformIcon type="spotify" className={`${ic} text-[#1db954]`} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white`}>{data.title}</p>
          <p className={`mt-0.5 capitalize text-white/40 ${st}`}>{data.kind || 'track'}</p>
          <ViewBtn href={data.url} label="Open in Spotify" compact={isGrid} />
        </div>
      </div>
    )
  }

  // MINECRAFT
  if (type === 'minecraft') {
    return (
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {data.avatar && (
            <img src={data.avatar} alt="" className={`${av} rounded-lg object-cover`} style={{ imageRendering: 'pixelated' }} onError={swapImageOnError} />
          )}
          <div className={`${av} shrink-0 items-center justify-center rounded-lg bg-[#5fa44b]/15`} style={{ display: data.avatar ? 'none' : 'flex' }}>
            <PlatformIcon type="minecraft" className={`${ic} text-[#5fa44b]`} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white`}>{data.username}</p>
          <p className={`mt-0.5 truncate font-mono text-white/35 ${isGrid ? 'text-[9px]' : 'text-[10px]'}`}>{String(data.uuid || '').slice(0, 13)}…</p>
          <ViewBtn href={`https://namemc.com/profile/${data.username}`} compact={isGrid} />
        </div>
      </div>
    )
  }

  // TIME (live clock, no fetch)
  if (type === 'time') {
    return <TimeWidget timezone={data.timezone || 'UTC'} label={data.label} accent={accent} />
  }

  // CUSTOM (user-defined card)
  if (type === 'custom') {
    const inner = (
      <div className="flex items-center gap-3">
        {data.imageUrl ? (
          <img src={data.imageUrl} alt="" className={`${av} shrink-0 rounded-lg object-cover`} onError={swapImageOnError} />
        ) : (
          <div className={`${av} flex shrink-0 items-center justify-center rounded-lg`} style={{ background: `${accent}1a`, color: accent }}>
            <PlatformIcon type="custom" className={ic} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white`}>{data.title || 'Custom'}</p>
          {data.subtitle && <p className={`mt-0.5 line-clamp-2 text-white/50 ${st}`}>{data.subtitle}</p>}
          {data.link && <ViewBtn href={data.link} label="Open" compact={isGrid} />}
        </div>
      </div>
    )
    return inner
  }

  // TWITCH
  if (type === 'twitch') {
    return (
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {data.avatar && <img src={data.avatar} alt="" className={`${av} rounded-full object-cover`} onError={swapImageOnError} />}
          <div className={`${av} shrink-0 items-center justify-center rounded-full bg-[#9146ff]/15`} style={{ display: data.avatar ? 'none' : 'flex' }}>
            <PlatformIcon type="twitch" className={`${ic} text-[#9146ff]`} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white`}>{data.username}</p>
          <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${st}`}>
            {data.followers != null && <Stat icon="♥" value={fmt(data.followers)} label="Followers" />}
            {data.game && <span className="text-white/50">Playing <b className="text-white/80">{data.game}</b></span>}
          </div>
          <ViewBtn href={data.url} compact={isGrid} />
        </div>
      </div>
    )
  }

  // OVERWATCH
  if (type === 'overwatch') {
    return (
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {data.icon && <img src={data.icon} alt="" className={`${av} rounded-xl object-cover`} onError={swapImageOnError} />}
          <div className={`${av} shrink-0 items-center justify-center rounded-xl bg-[#f99e1a]/15`} style={{ display: data.icon ? 'none' : 'flex' }}>
            <PlatformIcon type="overwatch" className={`${ic} text-[#f99e1a]`} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white`}>{data.name}</p>
          <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${st}`}>
            {data.endorsement != null && <Stat icon="★" value={data.endorsement} label="Endorse" />}
            {data.rankName && <span className="flex items-center gap-1 text-white/60">{data.rankIcon && <img src={data.rankIcon} alt="" className="h-3.5 w-3.5" />}{data.rankName}{data.rankTier ? ` ${data.rankTier}` : ''}</span>}
          </div>
          <ViewBtn href={data.url} compact={isGrid} />
        </div>
      </div>
    )
  }

  // GENSHIN IMPACT
  if (type === 'genshin') {
    return (
      <div className="flex items-center gap-3">
        <div className={`${av} flex shrink-0 items-center justify-center rounded-xl bg-[#4eb1e5]/15`}>
          <PlatformIcon type="genshin" className={`${ic} text-[#4eb1e5]`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white`}>{data.nickname}</p>
          {data.signature && <p className={`truncate text-white/40 ${isGrid ? 'text-[9px]' : 'text-[11px]'}`}>{data.signature}</p>}
          <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${st}`}>
            {data.level != null && <Stat icon="✦" value={`AR ${data.level}`} label="" />}
            {data.achievements != null && <Stat icon="🏆" value={fmt(data.achievements)} label="Ach" />}
            {data.abyss && <Stat icon="⚔" value={data.abyss} label="Abyss" />}
          </div>
          <ViewBtn href={data.url} compact={isGrid} />
        </div>
      </div>
    )
  }

  // STATS.FM
  if (type === 'statsfm') {
    const np = data.nowPlaying
    return (
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {(np?.image || data.avatar) && <img src={np?.image || data.avatar} alt="" className={`${av} rounded-lg object-cover`} onError={swapImageOnError} />}
          <div className={`${av} shrink-0 items-center justify-center rounded-lg bg-[#1ed760]/15`} style={{ display: (np?.image || data.avatar) ? 'none' : 'flex' }}>
            <PlatformIcon type="spotify" className={`${ic} text-[#1ed760]`} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {np ? (
            <>
              <p className={`truncate ${nm} font-semibold leading-tight text-white`}>{np.title}</p>
              <p className={`truncate text-white/45 ${st}`}>{np.artist}</p>
            </>
          ) : (
            <p className={`truncate ${nm} font-semibold leading-tight text-white`}>{data.displayName}</p>
          )}
          <ViewBtn href={data.url} label="View stats.fm" compact={isGrid} />
        </div>
      </div>
    )
  }

  // YOUTUBE
  if (type === 'youtube') {
    return (
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {data.latestThumb && <img src={data.latestThumb} alt="" className={`${isGrid ? 'h-11 w-16' : 'h-14 w-20'} rounded-lg object-cover`} onError={swapImageOnError} />}
          <div className={`${av} shrink-0 items-center justify-center rounded-lg bg-[#ff0000]/15`} style={{ display: data.latestThumb ? 'none' : 'flex' }}>
            <PlatformIcon type="youtube" className={`${ic} text-[#ff0000]`} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white`}>{data.channel}</p>
          {data.latestTitle && <p className={`mt-0.5 line-clamp-2 text-white/50 ${st}`}>{data.latestTitle}</p>}
          <ViewBtn href={data.latestUrl || data.url} label={data.latestUrl ? 'Watch latest' : 'View channel'} compact={isGrid} />
        </div>
      </div>
    )
  }

  // PINTEREST
  if (type === 'pinterest') {
    const pins = (data.pins || []).filter((p: any) => p.image).slice(0, 4)
    return (
      <div className="flex items-center gap-3">
        {pins.length > 0 ? (
          <div className="grid shrink-0 grid-cols-2 gap-0.5">
            {pins.map((p: any, i: number) => (
              <img key={i} src={p.image} alt="" className="h-6 w-6 rounded object-cover" onError={swapImageOnError} />
            ))}
          </div>
        ) : (
          <div className={`${av} flex shrink-0 items-center justify-center rounded-xl bg-[#e60023]/15`}>
            <PlatformIcon type="pinterest" className={`${ic} text-[#e60023]`} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white`}>@{data.username}</p>
          <p className={`text-white/40 ${st}`}>{pins.length ? `${pins.length}+ recent pins` : 'Pinterest'}</p>
          <ViewBtn href={data.url} compact={isGrid} />
        </div>
      </div>
    )
  }

  // CLASH OF CLANS / CLASH ROYALE / BRAWL STARS
  if (type === 'clashofclans' || type === 'clashroyale' || type === 'brawlstars') {
    return (
      <div className="flex items-center gap-3">
        <div className={`${av} flex shrink-0 items-center justify-center rounded-xl`} style={{ background: `${accent}1a`, color: accent }}>
          <PlatformIcon type={type} className={ic} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white`}>{data.name}</p>
          <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${st}`}>
            {data.trophies != null && <Stat icon="🏆" value={fmt(data.trophies)} label="" />}
            {data.level != null && <Stat icon="★" value={data.level} label="Lvl" />}
            {data.clan && <span className="truncate text-white/50">{data.clan}</span>}
          </div>
        </div>
      </div>
    )
  }

  // TWITTER / TELEGRAM (profile card)
  if (type === 'twitter' || type === 'telegram') {
    return (
      <div className="flex items-center gap-3">
        <div className={`${av} flex shrink-0 items-center justify-center rounded-full`} style={{ background: `${accent}1a`, color: accent }}>
          <PlatformIcon type={type} className={ic} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white`}>@{data.username}</p>
          <p className={`text-white/40 ${st}`}>{type === 'twitter' ? 'Twitter / X' : 'Telegram'}</p>
          <ViewBtn href={data.url} label="Open profile" compact={isGrid} />
        </div>
      </div>
    )
  }

  // ROBLOX
  if (type === 'roblox') {
    const presColor: Record<string, string> = {
      'Online': '#22c55e', 'In Game': '#3b82f6',
      'In Studio': '#a855f7', 'Offline': '#475569', 'Invisible': '#475569',
    }
    const dot = presColor[data.presence?.type || 'Offline'] || '#475569'
    return (
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {data.avatar && (
            <img src={data.avatar} alt="" className={`${av} rounded-xl object-cover`} onError={swapImageOnError} />
          )}
          <div
            className={`${av} shrink-0 items-center justify-center rounded-xl bg-white/10 font-bold text-white`}
            style={{ display: data.avatar ? 'none' : 'flex' }}
          >
            {(data.displayName || data.name || '?')[0]}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-black/60" style={{ background: dot }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white`}>{data.name}</p>
          <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${st}`}>
            {data.friends   != null && <Stat icon="♟" value={fmt(data.friends)}   label="Friends"   />}
            {data.followers != null && <Stat icon="♟" value={fmt(data.followers)} label="Followers" />}
          </div>
          <ViewBtn href={data.profileUrl || `https://www.roblox.com/users/${data.id}/profile`} compact={isGrid} />
        </div>
      </div>
    )
  }

  // TIKTOK
  if (type === 'tiktok') {
    const profileUrl = data.url || `https://tiktok.com/@${data.username}`
    const isGrid = displayMode === 'grid'
    const avatarSize = isGrid ? 'h-[60px] w-[60px]' : 'h-[68px] w-[68px]'
    const iconSize  = isGrid ? 'h-7 w-7' : 'h-8 w-8'
    return (
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {data.avatar && (
            <img src={data.avatar} alt="" className={`${avatarSize} rounded-full object-cover`} onError={swapImageOnError} />
          )}
          <div
            className={`${avatarSize} shrink-0 items-center justify-center rounded-full bg-[#ff0050]/10`}
            style={{ display: data.avatar ? 'none' : 'flex' }}
          >
            <PlatformIcon type="tiktok" className={`${iconSize} text-[#ff0050]`} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className={`truncate font-semibold leading-tight text-white ${isGrid ? 'text-[12px]' : 'text-[14px]'}`}>
              {data.nickname || data.username}
            </p>
            {data.verified && (
              <svg className={`shrink-0 text-[#20d5ec] ${isGrid ? 'h-3 w-3' : 'h-4 w-4'}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5l-4-4 1.41-1.41L10 13.67l6.59-6.59L18 8.5l-8 8z"/>
              </svg>
            )}
          </div>
          <p className={`text-white/35 ${isGrid ? 'text-[9px]' : 'text-[11px]'}`}>@{data.username}</p>
          <div className={`mt-0.5 flex flex-wrap items-center gap-y-0.5 ${isGrid ? 'gap-x-1.5 text-[10px]' : 'gap-x-3 text-[12px]'}`}>
            {/* Same kerning-overshoot fix as the Discord-server widget
                below: use a no-break space between the bold value and
                its label so mobile rendering can't clip the first
                letter of the label. */}
            {data.followers != null && (
              <span className="text-white/50"><b className="text-white/85">{fmt(data.followers)}</b>{' '}Followers</span>
            )}
            {!isGrid && data.following != null && (
              <span className="text-white/50"><b className="text-white/85">{fmt(data.following)}</b>{' '}Following</span>
            )}
            {data.likes != null && (
              <span className="text-white/50"><b className="text-white/85">{fmt(data.likes)}</b>{' '}Likes</span>
            )}
          </div>
          <ViewBtn href={profileUrl} compact={isGrid} />
        </div>
      </div>
    )
  }

  // GITHUB
  if (type === 'github') {
    return (
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {data.avatar && (
            <img src={data.avatar} alt="" className={`${av} rounded-xl border border-white/[0.06] object-cover`} onError={swapImageOnError} />
          )}
          <div
            className={`${av} shrink-0 items-center justify-center rounded-xl bg-white/5`}
            style={{ display: data.avatar ? 'none' : 'flex' }}
          >
            <PlatformIcon type="github" className={`${ic} text-white/60`} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white`}>{data.name || data.username}</p>
          <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${st}`}>
            <Stat icon="♟" value={fmt(data.followers)}    label="Followers"    />
            <Stat icon="↗" value={data.public_repos ?? 0} label="Repositories" />
          </div>
          <ViewBtn href={`https://github.com/${data.username}`} compact={isGrid} />
        </div>
      </div>
    )
  }

  // DISCORD - custom status emoji
  // Render a Discord custom-status emoji. For unicode emojis (the
  // standard kind), Discord/Lanyard returns the unicode char in
  // `emoji.name` and a null `emoji.id` - we just render the name as
  // text. For SERVER custom emojis, `emoji.id` is the snowflake and
  // `emoji.name` is the slug (e.g. "knife_AE"). We render those as an
  // <img> from cdn.discordapp.com so the actual emoji image appears
  // instead of the literal text ":knife_AE:" / "knife_AE".
  //
  // Returns null when there's no emoji to render.
  function renderDiscordEmoji(emoji: any, sizePx = 14): React.ReactNode {
    if (!emoji?.name) return null
    // Defence-in-depth: only treat emoji.id as a custom-emoji snowflake
    // when it actually looks like one (17-20 digit numeric string).
    // JSX already attribute-escapes our img src so XSS isn't reachable,
    // and the host is fixed to cdn.discordapp.com so a malicious id
    // can't redirect off-host - but a malformed id could still produce
    // a confusing broken-image render. The format check makes us refuse
    // anything that isn't a real snowflake and fall back to the
    // unicode-name branch.
    if (typeof emoji.id === 'string' && /^\d{17,20}$/.test(emoji.id)) {
      const ext = emoji.animated === true ? 'gif' : 'png'
      return (
        <img
          src={`https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=32`}
          alt={typeof emoji.name === 'string' ? emoji.name : ''}
          loading="lazy"
          className="inline-block align-text-bottom"
          style={{ width: sizePx, height: sizePx }}
          onError={swapImageOnError}
        />
      )
    }
    // Unicode emoji - the char IS the name (👋, 🔥, etc.)
    return <span>{typeof emoji.name === 'string' ? emoji.name : ''}</span>
  }

  if (type === 'discord') {
    const statusColor: Record<string, string> = {
      online: '#22c55e', idle: '#f59e0b', dnd: '#ef4444', offline: '#64748b',
    }
    const statusLabel: Record<string, string> = {
      online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline',
    }
    const dot = statusColor[data.status] || '#64748b'

    const customStatus = data.activities?.find((a: any) => a.type === 4)
    // Surface the first real activity (Playing / Streaming / Watching /
    // Competing - everything except the type-4 custom status). Spotify is
    // a special case: when `data.spotify` is present, the user is
    // listening on Spotify and Lanyard gives us album art + track + artist
    // separately, which reads better than the generic "Listening to
    // Spotify" activity entry.
    const activity = data.activities?.find((a: any) =>
      a.type === 0 || a.type === 1 || a.type === 3 || a.type === 5,
    )
    const spotify = data.spotify || null
    const activityLabelByType: Record<number, string> = {
      0: 'Playing',
      1: 'Streaming',
      3: 'Watching',
      5: 'Competing in',
    }
    const isGrid = displayMode === 'grid'

    // Grid: tight half-width card. Show avatar + name + ONE secondary line.
    // Priority order for that secondary line: Spotify > non-custom activity >
    // custom status > online/offline label. Spotify wins because its
    // "Listening to <track>" is the most engaging signal.
    if (isGrid) {
      // Build the secondary line. Spotify and activity rows are
      // plain strings, but custom-status needs to render an emoji
      // image alongside the state text - so the priority chain
      // resolves to a ReactNode, not a string.
      const secondary: React.ReactNode =
        spotify
          ? `♪ ${spotify.song} · ${spotify.artist}`
          : activity
            ? `${activityLabelByType[activity.type] || ''} ${activity.name}`.trim()
            : customStatus?.state
              ? (
                  <>
                    {renderDiscordEmoji(customStatus.emoji, 12)}
                    {customStatus.emoji ? ' ' : ''}
                    {customStatus.state}
                  </>
                )
              : (statusLabel[data.status] || data.status)
      const secondaryColor = spotify ? '#1DB954' : activity ? '#a78bfa' : customStatus?.state ? 'rgba(255,255,255,0.55)' : dot
      return (
        <a
          href={data.id ? `https://discord.com/users/${data.id}` : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 group"
        >
          <div className="relative shrink-0">
            {data.avatar && (
              <img src={data.avatar} alt="" className="h-[60px] w-[60px] rounded-full object-cover ring-1 ring-white/10 transition group-hover:ring-white/30" onError={swapImageOnError} />
            )}
            <div
              className="h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-indigo-500/20"
              style={{ display: data.avatar ? 'none' : 'flex' }}
            >
              <PlatformIcon type="discord" className="h-7 w-7 text-indigo-400" />
            </div>
            <span className="absolute -bottom-0 -right-0 h-3 w-3 rounded-full border-2 border-[#0c0c10]" style={{ background: dot }} />
          </div>
          <div className="min-w-0 flex-1">
            {/* Clan tag intentionally omitted in grid mode - too cramped. */}
            <p className="min-w-0 truncate text-[15px] font-semibold leading-tight text-white">{data.global_name || data.username}</p>
            <p className="truncate text-[12px] text-white/30">@{data.username}</p>
            <p className="mt-0.5 truncate text-[12px] font-medium" style={{ color: secondaryColor }}>{secondary}</p>
          </div>
        </a>
      )
    }

    // Stack / carousel: the wider variant has room for richer activity info
    // alongside the identity. Show in this order if present:
    //   1. Custom status (top line, subtle)
    //   2. Spotify now-playing pill (album art + track/artist)
    //   3. Activity pill (Playing X / Streaming Y / Watching Z)
    //   4. Fall back to the online/offline label
    return (
      <div className="space-y-2">
        <a
          href={data.id ? `https://discord.com/users/${data.id}` : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 group"
        >
          <div className="relative shrink-0">
            {data.avatar && (
              <img src={data.avatar} alt="" className="h-[68px] w-[68px] rounded-full object-cover ring-1 ring-white/10 transition group-hover:ring-white/30" onError={swapImageOnError} />
            )}
            <div
              className="h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full bg-indigo-500/15 ring-1 ring-indigo-500/20"
              style={{ display: data.avatar ? 'none' : 'flex' }}
            >
              <PlatformIcon type="discord" className="h-8 w-8 text-indigo-300" />
            </div>
            <span className="absolute -bottom-0 -right-0 h-3.5 w-3.5 rounded-full border-[2.5px] border-[#0c0c10]" style={{ background: dot }} />
          </div>
          <div className="min-w-0 flex-1">
            {/* Identity: display name + guild tag on top, @username below. */}
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="min-w-0 truncate text-[14px] font-semibold leading-tight text-white">{data.global_name || data.username}</p>
              {data.clan?.tag && (
                <span className="flex shrink-0 items-center gap-0.5 rounded-[5px] bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white/90">
                  {data.clan.badge_url && (
                    <img src={data.clan.badge_url} alt="" className="h-3.5 w-3.5 shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  )}
                  <span className="max-w-[72px] truncate">{data.clan.tag}</span>
                </span>
              )}
            </div>
            <p className="truncate text-[11px] leading-tight text-white/35">@{data.username}</p>
            {customStatus?.state
              ? (
                  <p className="mt-1 truncate text-[11px] text-white/55">
                    {renderDiscordEmoji(customStatus.emoji, 14)}
                    {customStatus.emoji ? ' ' : ''}
                    {customStatus.state}
                  </p>
                )
              : (!spotify && !activity)
                ? <p className="mt-1 text-[11px] font-medium" style={{ color: dot }}>{statusLabel[data.status] || data.status}</p>
                : null}
          </div>
        </a>

        {/* Spotify now-playing - green pill with album art, song + artist.
            -mr-16 cancels enough of the parent's pr-20 (80px) right
            padding to let this pill stretch close to the right edge.
            The pill still leaves ~16px of breathing room past the
            badge column, so it never tucks under the DISCORD badge. */}
        {spotify && (
          <div className="-mr-16 flex items-center gap-2.5 rounded-xl border border-[#1DB954]/20 bg-[#1DB954]/[0.06] px-2.5 py-1.5">
            {spotify.album_art_url ? (
              <img src={spotify.album_art_url} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" onError={swapImageOnError} />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#1DB954]/15">
                <svg className="h-5 w-5 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.78-.179-.9-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/></svg>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-[#1DB954]">● Listening on Spotify</p>
              <p className="truncate text-[12px] font-semibold leading-tight text-white">{spotify.song}</p>
              <p className="truncate text-[10px] text-white/45">{spotify.artist}</p>
            </div>
          </div>
        )}

        {/* Non-Spotify activity (Playing/Streaming/Watching/Competing).
            Same -mr-16 trick as the Spotify pill so "PLAYING coding
            halo and a new project" stretches across the card width
            instead of leaving an empty gutter beside it. */}
        {!spotify && activity && (
          <div className="-mr-16 flex items-center gap-2 rounded-xl border border-indigo-500/15 bg-indigo-500/[0.06] px-2.5 py-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-300">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M21.58 16.09l-1.09-7.66C20.21 6.46 18.52 5 16.53 5H7.47C5.48 5 3.79 6.46 3.51 8.43l-1.09 7.66C2.2 17.63 3.39 19 4.94 19c.68 0 1.32-.27 1.8-.75L9 16h6l2.25 2.25c.48.48 1.13.75 1.8.75 1.56 0 2.75-1.37 2.53-2.91zM11 11H9v2H7v-2H5V9h2V7h2v2h2v2zm4-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm3 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-indigo-300/70">{activityLabelByType[activity.type] || 'Active'}</p>
              <p className="truncate text-[12px] font-semibold leading-tight text-white">{activity.name}</p>
              {(activity.details || activity.state) && (
                <p className="truncate text-[10px] text-white/45">{[activity.details, activity.state].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // LAST.FM
  if (type === 'lastfm') {
    const np = data.nowPlaying
    const recent = data.recent?.slice(0, 3) || []
    const fallbackTrack = !np && recent[0]

    // Album art: prefer now-playing, fallback to most recent track
    const artSrc = np?.image || fallbackTrack?.image || null
    const artValid = artSrc && artSrc.trim() !== ''

    if (isGrid) {
      // Grid: compact - art + now playing or last track
      const track = np || fallbackTrack
      return (
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            {artValid && (
              <img src={artSrc} alt="" className="h-11 w-11 rounded-xl object-cover" onError={swapImageOnError} />
            )}
            <div
              className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-900/25"
              style={{ display: artValid ? 'none' : 'flex' }}
            >
              <PlatformIcon type="lastfm" className="h-5 w-5 text-red-400" />
            </div>
            {np && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-black/60 bg-red-500">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-red-300" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {np
              ? <p className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-red-400">Now Playing</p>
              : <p className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-white/25">Last Played</p>}
            <p className="truncate text-[12px] font-semibold leading-tight text-white">{track?.title || data.username}</p>
            <p className="truncate text-[10px] text-white/45">{track?.artist || `${Number(data.playcount||0).toLocaleString()} scrobbles`}</p>
          </div>
        </div>
      )
    }

    // Stack / carousel: rich view with now-playing + recent tracks list
    return (
      <div className="space-y-2.5">
        {/* Main track */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {artValid && (
              <img src={artSrc} alt="" className="h-14 w-14 rounded-xl object-cover shadow-lg" onError={swapImageOnError} />
            )}
            <div
              className="h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-red-900/25"
              style={{ display: artValid ? 'none' : 'flex' }}
            >
              <PlatformIcon type="lastfm" className="h-6 w-6 text-red-400" />
            </div>
            {np && (
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-black/70 bg-red-500">
                <span className="h-2 w-2 animate-ping rounded-full bg-red-300 opacity-75" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {np
              ? <p className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-red-400">● Now Playing</p>
              : <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/25">Last Played</p>}
            <p className="truncate text-[14px] font-semibold leading-tight text-white">{np?.title || fallbackTrack?.title || data.username}</p>
            <p className="truncate text-[12px] text-white/50">{np?.artist || fallbackTrack?.artist || ''}</p>
            {data.playcount && (
              <p className="mt-0.5 text-[10px] text-white/30">
                <b className="text-white/50">{Number(data.playcount).toLocaleString()}</b> scrobbles
              </p>
            )}
          </div>
        </div>

        {/* Recent tracks (only if not now playing and there are extras) */}
        {!np && recent.length > 1 && (
          <div className="space-y-1 pt-0.5">
            {recent.slice(1, 3).map((t: any, i: number) => {
              const hasImg = !!(t.image && t.image.trim())
              return (
              <div key={i} className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-white/[0.03]">
                <div className="relative h-7 w-7 shrink-0">
                  {hasImg && (
                    <img src={t.image} alt="" className="h-7 w-7 rounded-lg object-cover opacity-70" onError={swapImageOnError} />
                  )}
                  <div
                    className="h-7 w-7 shrink-0 rounded-lg bg-white/[0.04]"
                    style={{ display: hasImg ? 'none' : 'block' }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-white/65">{t.title}</p>
                  <p className="truncate text-[10px] text-white/35">{t.artist}</p>
                </div>
              </div>
              )
            })}
          </div>
        )}

        <ViewBtn href={`https://last.fm/user/${data.username}`} label="View on Last.fm" compact={false} />
      </div>
    )
  }

  // VALORANT
  if (type === 'valorant') {
    const trackerUrl = `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(`${data.name}#${data.tag}`)}/overview`
    return (
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {data.rankIcon && (
            <img src={data.rankIcon} alt="" className={`${av} object-contain drop-shadow-sm`} onError={swapImageOnError} />
          )}
          <div
            className={`${av} shrink-0 items-center justify-center rounded-xl bg-[#ff4655]/10`}
            style={{ display: data.rankIcon ? 'none' : 'flex' }}
          >
            <PlatformIcon type="valorant" className={`${ic} text-[#ff4655]`} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white`}>{data.name}#{data.tag}</p>
          <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${st}`}>
            {data.rank  && <span className={`text-[#ff4655]/80 ${st}`}>{data.rank}</span>}
            {data.elo   != null && <Stat icon="↗" value={data.elo}   label="ELO"   />}
            {data.level != null && <Stat icon="♟" value={data.level} label="Level" />}
            {data.rr    != null && <Stat icon="↗" value={data.rr}    label="RR"    />}
          </div>
          <ViewBtn href={trackerUrl} compact={isGrid} />
        </div>
      </div>
    )
  }

  // CHESS
  if (type === 'chess') {
    const displayTitle = data.title || data.league ? `${data.title || data.league} Title` : null
    return (
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {data.avatar && (
            <img src={data.avatar} alt="" className={`${av} rounded-xl object-cover`} onError={swapImageOnError} />
          )}
          <div
            className={`${av} shrink-0 items-center justify-center rounded-xl bg-[#81b64c]/10`}
            style={{ display: data.avatar ? 'none' : 'flex' }}
          >
            <PlatformIcon type="chess" className={`${ic} text-[#81b64c]`} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white`}>{data.username}</p>
          <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${st}`}>
            {data.followers != null && <Stat icon="♟" value={fmt(data.followers)} label="Followers" />}
            {displayTitle           && <Stat icon="♟" value=""                    label={displayTitle} />}
            {data.blitz  != null    && <Stat icon="↗" value={data.blitz}          label="Blitz"  />}
            {data.rapid  != null    && <Stat icon="↗" value={data.rapid}          label="Rapid"  />}
          </div>
          <ViewBtn href={`https://chess.com/member/${data.username}`} compact={isGrid} />
        </div>
      </div>
    )
  }

  // WEATHER
  if (type === 'weather') {
    const wmoIcon: Record<number, string> = {
      0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',
      51:'🌦',61:'🌧',71:'🌨',80:'🌦',95:'⛈',99:'⛈',
    }
    const code = data.weather_code ?? 0
    const keys = Object.keys(wmoIcon).map(Number).sort((a, b) => a - b)
    const nearest = keys.reduce((prev, k) => (k <= code ? k : prev), 0)
    const icon = wmoIcon[nearest] || '🌡️'
    const condition = data.condition || 'Clear'
    const wttrUrl = `https://wttr.in/${encodeURIComponent((data.location || '').split(',')[0])}`
    return (
      <div className="flex items-center gap-3">
        <div className={`flex ${av} shrink-0 items-center justify-center rounded-xl bg-sky-900/30 leading-none ${isGrid ? 'text-2xl' : 'text-3xl'}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className={`${nm} font-semibold leading-tight text-white`}>{Math.round(data.temperature ?? 0)}°C Temperature</p>
          <p className={`mt-0.5 truncate ${st} text-white/50`}>{condition} Condition</p>
          <ViewBtn href={wttrUrl} label="View Details" compact={isGrid} />
        </div>
      </div>
    )
  }

  // DISCORD SERVER
  if (type === 'discord-server') {
    return (
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {data.icon && (
            <img src={data.icon} alt="" className={`${av} rounded-2xl object-cover`} onError={swapImageOnError} />
          )}
          <div
            className={`${av} shrink-0 items-center justify-center rounded-2xl bg-[#5865f2]/20`}
            style={{ display: data.icon ? 'none' : 'flex' }}
          >
            <span className={`font-bold text-[#5865f2] ${isGrid ? 'text-base' : 'text-xl'}`}>{data.name?.[0] ?? 'S'}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white/90`}>{data.name}</p>
          {!isGrid && data.description && (
            <p className="truncate text-[11px] text-white/40">{data.description}</p>
          )}
          <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${st}`}>
            {/* Members + Online stats. Each pair uses gap-1 between
                bold-value and label so the bolded number's subpixel
                overshoot can't clip into the first letter of the
                label - on mobile with the squeezed widget grid, the
                pattern `<b>22</b> Members` was rendering as
                "22embers" because the literal space between elements
                got eaten by tight kerning. Making the label its own
                <span> flex child guarantees the gap renders. */}
            <span className="flex items-center gap-1 text-white/60">
              <svg className="h-3 w-3 text-white/45" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-3.3 0-10 1.65-10 5v3h20v-3c0-3.35-6.7-5-10-5z"/></svg>
              <b className="text-white/85">{fmt(data.members)}</b>
              <span>Members</span>
            </span>
            <span className="flex items-center gap-1 text-white/60">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <b className="text-white/85">{fmt(data.online)}</b>
              <span>Online</span>
            </span>
          </div>
          <a
            href={data.inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${isGrid ? 'mt-1.5 px-2.5 py-1 text-[10px]' : 'mt-1.5 px-3 py-1.5 text-[12px]'} inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#5865f2] font-semibold text-white transition hover:bg-[#4752c4]`}
          >
            <svg className={isGrid ? 'h-3 w-3' : 'h-3.5 w-3.5'} viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>
            {isGrid ? 'Join' : 'Join Server'}
          </a>
        </div>
      </div>
    )
  }

  if (type === 'tracker') {
    // tracker.gg widget. Game-agnostic - the API normalises every
    // game's response into the same shape so we render the same
    // layout regardless of whether the user is RL / R6 / Apex / etc.
    const gameLabel: Record<string, string> = {
      'rocket-league': 'Rocket League',
      'r6siege': 'R6 Siege',
      'apex': 'Apex Legends',
      'halo-infinite': 'Halo Infinite',
      'fortnite': 'Fortnite',
      'modern-warfare': 'Modern Warfare',
      'mw2': 'MW2',
      'warzone-2': 'Warzone 2',
      'destiny-2': 'Destiny 2',
      'splitgate': 'Splitgate',
      'csgo': 'CS:GO',
      'cs2': 'CS2',
      'pubg': 'PUBG',
      'overwatch': 'Overwatch',
    }
    const game = gameLabel[data.game] || data.game

    return (
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {data.avatar ? (
            <img src={data.avatar} alt="" className={`${av} rounded-xl object-cover`} onError={swapImageOnError} />
          ) : (
            <div className={`${av} flex items-center justify-center rounded-xl bg-[#ff5d23]/15 text-[#ff5d23]`}>
              <svg viewBox="0 0 24 24" fill="currentColor" className={isGrid ? 'h-5 w-5' : 'h-6 w-6'}><path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7l-9-5zm0 4 6 3v4c0 3.3-2.7 6-6 6s-6-2.7-6-6V9l6-3z"/></svg>
            </div>
          )}
          {data.playlistRankIcon ? (
            <img
              src={data.playlistRankIcon}
              alt=""
              className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full ring-2 ring-[#0c0c10]"
              onError={swapImageOnError}
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${nm} font-semibold leading-tight text-white/90`}>{data.handle}</p>
          <p className="truncate text-[10px] text-white/40">{game}</p>
          <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${st}`}>
            {data.playlistRank ? (
              <span className="flex items-center gap-1 text-white/60">
                <b className="text-white/85">{data.playlistRank}</b>
                {data.playlistName && !isGrid ? (
                  <span className="text-white/35">· {data.playlistName}</span>
                ) : null}
              </span>
            ) : null}
            {!isGrid && Array.isArray(data.overviewStats)
              ? data.overviewStats.slice(0, 3).map((s: any) => (
                  <span key={s.key} className="flex items-center gap-0.5 text-white/55">
                    <b className="text-white/80">{s.value}</b>
                    <span className="text-white/40">{s.name}</span>
                  </span>
                ))
              : null}
          </div>
          {!isGrid && data.profileUrl ? <ViewBtn href={data.profileUrl} label="View on Tracker.gg" /> : null}
          {isGrid && data.profileUrl ? <ViewBtn href={data.profileUrl} compact /> : null}
        </div>
      </div>
    )
  }

  return null
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
// Badge is in-flow (flex row) NOT absolute - prevents overlap with content

// Each card receives its data from the parent's batched fetch via the
// `result` prop. result === undefined means we're still waiting for the
// batched fetch to resolve (loading state).
interface WidgetResult { data?: any; error?: string }

function WidgetCard({
  widget,
  displayMode,
  result,
}: {
  widget: Widget
  displayMode?: string
  result?: WidgetResult
}) {
  const loading = result === undefined
  const error = result?.error || null
  const data = result?.data ?? null

  const meta = PLATFORM[widget.type] || { label: widget.type, color: '#ffffff' }
  // Clamp the user-controlled accent to a 6-digit hex before it's interpolated
  // (with alpha suffixes) into inline gradients/box-shadows - otherwise a value
  // like `red),url(http://x)` becomes a valid CSS url() that beacons every
  // visitor's IP. 6-digit required so the appended alpha hex stays valid.
  const rawAccent = widget.config?.accentColor
  const accent = (typeof rawAccent === 'string' && /^#[0-9a-fA-F]{6}$/.test(rawAccent))
    ? rawAccent
    : (meta.color || '#e87fa0')

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent backdrop-blur-md transition-colors duration-200 hover:border-white/[0.16] text-left"
      style={{
        boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -14px rgba(0,0,0,0.55)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}99 50%, transparent 100%)` }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle at 100% 0%, ${accent}1F 0%, transparent 60%)` }}
      />

      {/* Platform badge - refined pill */}
      <div
        className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-black/55 px-2 py-[3px] backdrop-blur-md"
        style={{ boxShadow: `inset 0 0 0 1px ${accent}22` }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">{meta.label}</span>
      </div>

      {/* Widget content - pr-20 keeps the top identity row clear of
          the absolutely-positioned platform badge ("DISCORD",
          "SPOTIFY", etc.) at top-2.5 right-2.5. Sub-cards that sit
          BELOW the badge area (activity/now-playing pills in the
          Discord widget) override this with a negative right margin
          so they stretch the full card width instead of leaving an
          obvious empty gutter on the right. */}
      <div className="relative px-4 py-3.5 pr-14">
        {loading ? (
          // Match the height of a loaded widget card so the layout doesn't
          // jump when data arrives. Stack/carousel cards render ~68px,
          // grid cards ~58px. We approximate by adding a third faint row
          // representing the ViewBtn that lives below the meta line.
          <div className={`flex items-center gap-3 ${displayMode === 'grid' ? 'min-h-[72px]' : 'min-h-[80px]'}`}>
            <div className={`${displayMode === 'grid' ? 'h-[60px] w-[60px]' : 'h-[68px] w-[68px]'} shrink-0 animate-pulse rounded-xl bg-white/[0.05]`} />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-2 w-1/3 animate-pulse rounded bg-white/[0.03]" />
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-xl">⚠️</div>
            <div className="text-[12px] text-red-400/70">{error}</div>
          </div>
        ) : (
          <WidgetBody type={widget.type} data={data} displayMode={displayMode} accent={accent} />
        )}
      </div>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function WidgetsPanel({ userId, displayMode }: { userId: string; displayMode?: string }) {
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [results, setResults] = useState<Record<string, WidgetResult>>({})
  const [currentIndex, setCurrentIndex] = useState(0)

  // 1) Pull the widget LIST (cheap supabase query through our /api/widgets).
  useEffect(() => {
    fetch(`/api/widgets?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' })
      .then(r => r.json().catch(() => ({})))
      .then(j => setWidgets((j.widgets || []).filter((w: Widget) => w.enabled)))
      .catch(() => {})
  }, [userId])

  // 2) Once we have the list, fire ONE batched request to /api/widgets/fetch
  // with every widget's spec. Replaces the previous N-per-card waterfall.
  //
  // Polling: re-runs every POLL_INTERVAL_MS so Discord presence,
  // Last.fm now-playing, etc. stay close to live without forcing a
  // page reload. The initial fetch clears the result cache (shows
  // loading skeletons); subsequent polls update IN PLACE so cards
  // don't flash back to skeleton on every refresh.
  //
  // 10s feels live for Discord status changes (custom-status, dnd
  // toggle, etc.) without thrashing the upstream APIs because each
  // external fetch inside /api/widgets/fetch is cached at
  // revalidate:60 - clients polling at 10s just hit the Next.js
  // fetch cache 5/6 of the time. Discord is a direct DB read so
  // the cost is essentially zero per view.
  useEffect(() => {
    if (widgets.length === 0) {
      setResults({})
      return
    }
    let active = true
    let isFirstFetch = true
    const POLL_INTERVAL_MS = 10_000

    async function refetch() {
      if (!active) return
      // Only show the loading skeleton on the very first fetch.
      // Polls update in place so the UI doesn't flicker.
      if (isFirstFetch) setResults({})
      try {
        const r = await fetch('/api/widgets/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            widgets: widgets.map(w => ({ id: w.id, type: w.type, config: w.config || {} })),
          }),
        })
        const j: { results?: Array<{ id: string; data?: any; error?: string }> } = await r.json().catch(() => ({}))
        if (!active) return
        const next: Record<string, WidgetResult> = {}
        for (const result of j.results || []) {
          if (!result.id) continue
          if (result.error) next[result.id] = { error: result.error }
          else next[result.id] = { data: result.data }
        }
        // Any widget that didn't come back (network error) stays undefined
        // on first fetch (shows loading) or keeps its previous value on
        // re-poll (shows stale data, better than flickering to an error).
        for (const w of widgets) {
          if (!(w.id in next)) {
            next[w.id] = isFirstFetch ? { error: 'Network error' } : (results[w.id] ?? { error: 'Network error' })
          }
        }
        setResults(next)
      } catch {
        if (!active) return
        if (isFirstFetch) {
          // Whole batch failed on first try - mark every card as errored
          // so they stop spinning.
          const errored: Record<string, WidgetResult> = {}
          for (const w of widgets) errored[w.id] = { error: 'Network error' }
          setResults(errored)
        }
        // On poll failures we silently keep the last-known data.
      }
      isFirstFetch = false
    }

    refetch()
    const interval = setInterval(refetch, POLL_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgets])

  // Auto-rotation for carousel mode
  useEffect(() => {
    if (displayMode !== 'carousel' || widgets.length <= 1) return
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % widgets.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [displayMode, widgets.length])

  // Reset carousel index if widgets change
  useEffect(() => {
    setCurrentIndex(0)
  }, [widgets.length])

  if (!widgets.length) return null

  // Carousel mode: all cards stay mounted (never unmount) - only visibility toggles.
  // This prevents re-fetching every rotation, which breaks rate-limited APIs like TikTok.
  if (displayMode === 'carousel') {
    return (
      <div className="mt-3 text-left">
        <div className="grid grid-cols-1 gap-3">
          {widgets.map((w, i) => (
            <div key={w.id} style={{ display: i === currentIndex ? 'block' : 'none' }}>
              <WidgetCard widget={w} displayMode="carousel" result={results[w.id]} />
            </div>
          ))}
        </div>
        {widgets.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {widgets.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-6 bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.35)]' : 'w-1.5 bg-white/20 hover:bg-white/45'}`}
                aria-label={`Go to widget ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Stack mode: always single column
  if (displayMode === 'stack') {
    return (
      <div className="mt-3 grid grid-cols-1 gap-3 text-left">
        {widgets.map(w => <WidgetCard key={w.id} widget={w} displayMode="stack" result={results[w.id]} />)}
      </div>
    )
  }

  // Grid mode (default):
  //   - 1 widget: full-width single column
  //   - 2+ widgets: 1 col on narrow phones (<420px), 2 cols on wider.
  // Forcing 2-col on every screen size made widget cards too cramped
  // on small phones - the Discord-server stat row was clipping the
  // first letter of "Members" / "Online" because the bold value had
  // no horizontal breathing room. The grid switches to single-column
  // below the `xs` breakpoint via a custom utility.
  return (
    <div
      className={`mt-3 grid gap-3 text-left ${
        widgets.length === 1
          ? 'grid-cols-1'
          : 'grid-cols-1 [@media(min-width:420px)]:grid-cols-2'
      }`}
    >
      {widgets.map(w => <WidgetCard key={w.id} widget={w} displayMode="grid" result={results[w.id]} />)}
    </div>
  )
}
