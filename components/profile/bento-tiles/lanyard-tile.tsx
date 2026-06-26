'use client'

import { useEffect, useState } from 'react'

/**
 * Bento tile that fetches and renders the profile owner's live Discord
 * presence via Lanyard. Reads `profile.discord_id`, hits the same
 * `/api/widgets/fetch` endpoint the WidgetsPanel already uses (so we
 * inherit the 60s server cache and rate limit for free), and renders a
 * tight status + activity + Spotify summary.
 *
 * Graceful fallbacks at every step:
 *   - no discord_id      → "Connect Discord" hint
 *   - lanyard 4xx        → "Join discord.gg/lanyard" hint
 *   - lanyard offline    → grey dot + "Offline"
 *   - listening on spotify → green pill with track + artist
 *   - playing a game     → indigo activity row
 */

interface LanyardData {
  id?: string
  username?: string
  global_name?: string
  avatar?: string | null
  status?: 'online' | 'idle' | 'dnd' | 'offline'
  activities?: Array<{ type: number; name: string; details?: string; state?: string; emoji?: { name?: string } }>
  spotify?: { song: string; artist: string; album?: string; album_art_url?: string } | null
}

const STATUS_COLOR: Record<string, string> = {
  online: '#22c55e',
  idle:   '#f59e0b',
  dnd:    '#ef4444',
  offline:'#64748b',
}
const STATUS_LABEL: Record<string, string> = {
  online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline',
}
const ACTIVITY_VERB: Record<number, string> = {
  0: 'Playing', 1: 'Streaming', 3: 'Watching', 5: 'Competing in',
}

export function LanyardTile({ discordId }: { discordId: string | null | undefined }) {
  const [data, setData] = useState<LanyardData | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!discordId) { setErrMsg('not-linked'); return }
    let cancelled = false
    // Use the existing widgets-panel fetch pipe so we get the server's
    // 60-second cache + rate limit for free. Type 'discord' triggers the
    // Lanyard fetcher on the server side.
    fetch('/api/widgets/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'discord', config: { userId: discordId } }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (cancelled) return
        if (j?.data) setData(j.data)
        else setErrMsg(j?.error || 'fetch-failed')
      })
      .catch(() => { if (!cancelled) setErrMsg('network') })
    // Refresh every 30s so status changes show up live without a websocket.
    const interval = window.setInterval(() => {
      fetch('/api/widgets/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'discord', config: { userId: discordId } }),
      })
        .then(async (r) => {
          const j = await r.json().catch(() => ({}))
          if (cancelled) return
          if (j?.data) setData(j.data)
        })
        .catch(() => undefined)
    }, 30_000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [discordId])

  if (errMsg === 'not-linked') {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#e87fa0]/80">Discord Presence</p>
        <p className="mt-1 text-[10px] text-white/40">Connect Discord in Settings</p>
      </div>
    )
  }
  if (errMsg && !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#e87fa0]/80">Discord Presence</p>
        <p className="mt-1 text-[10px] text-white/40">Join discord.gg/lanyard to enable</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#e87fa0]" />
      </div>
    )
  }

  const dot = STATUS_COLOR[data.status || 'offline'] || '#64748b'
  const customStatus = data.activities?.find((a) => a.type === 4)
  const activity = data.activities?.find((a) => a.type === 0 || a.type === 1 || a.type === 3 || a.type === 5)

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Header: avatar + name + status */}
      <a
        href={data.id ? `https://discord.com/users/${data.id}` : '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 group"
      >
        <div className="relative shrink-0">
          {data.avatar ? (
            <img src={data.avatar} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10 transition group-hover:ring-white/30" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/15">
              <svg className="h-5 w-5 text-indigo-300" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.114 18.1.132 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            </div>
          )}
          <span className="absolute -bottom-0 -right-0 h-3 w-3 rounded-full border-2 border-[#0c0c10]" style={{ background: dot }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-white">{data.global_name || data.username || 'Discord'}</p>
          {customStatus?.state
            ? <p className="mt-0.5 truncate text-[10px] text-white/55">{customStatus.emoji?.name ? `${customStatus.emoji.name} ` : ''}{customStatus.state}</p>
            : <p className="mt-0.5 truncate text-[10px] font-medium" style={{ color: dot }}>{STATUS_LABEL[data.status || 'offline']}</p>}
        </div>
      </a>

      {/* Spotify pill */}
      {data.spotify && (
        <div className="flex items-center gap-2 rounded-lg border border-[#1DB954]/20 bg-[#1DB954]/[0.06] px-2 py-1.5">
          {data.spotify.album_art_url ? (
            <img src={data.spotify.album_art_url} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
          ) : (
            <div className="h-8 w-8 shrink-0 rounded bg-[#1DB954]/15" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-bold uppercase tracking-widest text-[#1DB954]">● Spotify</p>
            <p className="truncate text-[11px] font-semibold leading-tight text-white">{data.spotify.song}</p>
            <p className="truncate text-[10px] text-white/45">{data.spotify.artist}</p>
          </div>
        </div>
      )}

      {/* Other activity */}
      {!data.spotify && activity && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-500/15 bg-indigo-500/[0.06] px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-wider text-indigo-300/70">{ACTIVITY_VERB[activity.type] || 'Active'}</p>
            <p className="truncate text-[11px] font-semibold leading-tight text-white">{activity.name}</p>
            {(activity.details || activity.state) && (
              <p className="truncate text-[9px] text-white/45">{[activity.details, activity.state].filter(Boolean).join(' · ')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Spotify-only variant. Same fetch + cache (browser will dedupe), but
 * only renders when the user is currently listening. Returns null when
 * nothing's playing - the bento layout falls back to an EmptyTile.
 */
export function SpotifyTile({ discordId }: { discordId: string | null | undefined }) {
  const [data, setData] = useState<LanyardData | null>(null)

  useEffect(() => {
    if (!discordId) return
    let cancelled = false
    const load = () => {
      fetch('/api/widgets/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'discord', config: { userId: discordId } }),
      })
        .then(async (r) => {
          const j = await r.json().catch(() => ({}))
          if (!cancelled && j?.data) setData(j.data)
        })
        .catch(() => undefined)
    }
    load()
    const interval = window.setInterval(load, 30_000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [discordId])

  if (!discordId) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#1DB954]/80">Spotify</p>
        <p className="mt-1 text-[10px] text-white/40">Connect Discord to enable</p>
      </div>
    )
  }
  if (!data?.spotify) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#1DB954]/80">Spotify</p>
        <p className="mt-1 text-[10px] text-white/40">Nothing playing right now</p>
      </div>
    )
  }

  const sp = data.spotify
  return (
    <div className="flex h-full items-center gap-3">
      {sp.album_art_url ? (
        <img src={sp.album_art_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover shadow-lg" />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#1DB954]/15">
          <svg className="h-7 w-7 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.78-.179-.9-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/></svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-[#1DB954]">● Listening on Spotify</p>
        <p className="truncate text-sm font-semibold leading-tight text-white">{sp.song}</p>
        <p className="truncate text-xs text-white/50">{sp.artist}</p>
        {sp.album && <p className="mt-0.5 truncate text-[10px] text-white/30">on {sp.album}</p>}
      </div>
    </div>
  )
}
