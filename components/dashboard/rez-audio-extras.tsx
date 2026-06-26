'use client'

/**
 * Quick-import for the Audio Manager's "Add New Audio" modal: search a track
 * (iTunes + SoundCloud), pick one, then choose which parts to import (title,
 * artist, cover, full audio, source link) before confirming. Gated by isOwner
 * in app/dashboard/customize/client.tsx; to go public, drop that guard.
 */

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { IconSearch, IconLoader2, IconX, IconCheck } from '@tabler/icons-react'
import { SocialIcon } from '@/components/profile/social-icon'

interface Hit {
  title: string
  artist: string
  album?: string
  cover: string | null
  preview: string | null
  external?: string | null
  scUrl?: string | null
  source?: 'itunes' | 'soundcloud'
  duration?: number
}

export type ImportField = 'title' | 'artist' | 'cover' | 'audio'

export interface ImportSelection {
  song: Hit
  fields: Record<ImportField, boolean>
}

const CHIPS: { key: ImportField; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
  { key: 'cover', label: 'Cover' },
  { key: 'audio', label: 'Audio' },
]

export function RezAudioExtras({
  onImport, importing = false,
}: {
  onImport: (selection: ImportSelection) => void
  importing?: boolean
}) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Hit | null>(null)
  const [fields, setFields] = useState<Record<ImportField, boolean>>({
    title: true, artist: true, cover: true, audio: true,
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = (q: string) => {
    setQuery(q)
    if (timer.current) clearTimeout(timer.current)
    if (!q.trim()) { setHits([]); setSearching(false); return }
    setSearching(true)
    timer.current = setTimeout(() => {
      fetch(`/api/music/search?q=${encodeURIComponent(q.trim())}`)
        .then(r => r.json())
        .then(d => setHits(Array.isArray(d.results) ? d.results : []))
        .catch(() => setHits([]))
        .finally(() => setSearching(false))
    }, 300)
  }

  const isAvailable = (h: Hit, k: ImportField): boolean => {
    if (k === 'title') return !!h.title
    if (k === 'artist') return !!h.artist
    if (k === 'cover') return !!h.cover
    return true // audio
  }

  const pick = (h: Hit) => {
    setSelected(h)
    setHits([])
    setQuery('')
    setFields({
      title: isAvailable(h, 'title'),
      artist: isAvailable(h, 'artist'),
      cover: isAvailable(h, 'cover'),
      audio: true,
    })
  }

  const clear = () => { if (!importing) setSelected(null) }
  const toggle = (k: ImportField) => { if (!importing) setFields(f => ({ ...f, [k]: !f[k] })) }
  const doImport = () => { if (selected && !importing) onImport({ song: selected, fields }) }

  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-accent-soft p-3">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-foreground-secondary">
        <SocialIcon platform="spotify" className="size-4 text-[#1DB954]" /> Quick import
      </p>

      {selected ? (
        <div className="space-y-3">
          {/* Selected song */}
          <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-2.5">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/5">
              {selected.cover ? <img src={selected.cover} alt="" className="h-full w-full object-cover" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{selected.title || 'Untitled'}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[selected.artist, selected.album].filter(Boolean).join(' · ') || '-'}
              </p>
            </div>
            <button type="button" onClick={clear} disabled={importing}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-white/10 hover:text-foreground disabled:opacity-40">
              <IconX className="size-4" />
            </button>
          </div>

          {/* Field toggles */}
          <div className="flex flex-wrap gap-2">
            {CHIPS.map(({ key, label }) => {
              const available = isAvailable(selected, key)
              const on = available && fields[key]
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!available || importing}
                  onClick={() => available && toggle(key)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    on
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'border-border bg-surface text-muted-foreground hover:text-foreground-secondary'
                  } ${!available ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  {on ? <IconCheck className="size-3.5" /> : null} {label}
                </button>
              )
            })}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={doImport}
              disabled={importing}
              className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-5 py-2 text-sm font-semibold text-primary transition hover:bg-primary/25 disabled:opacity-60"
            >
              {importing ? <IconLoader2 className="size-4 animate-spin" /> : null}
              {importing ? 'Importing' : 'Import'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Search a song, pick it, then choose what to bring in. Audio is pulled
            as the full track and opens the trimmer.
          </p>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={e => runSearch(e.target.value)}
              placeholder="Search a song to import..."
              className="w-full rounded-lg border border-border bg-surface-2 py-2 pl-9 pr-9 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/40"
            />
            {searching ? <IconLoader2 className="absolute right-3 top-2.5 size-4 animate-spin text-muted-foreground" /> : null}
            {hits.length > 0 && (
              <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-surface-2 p-1 shadow-2xl">
                {hits.map((h, i) => (
                  <button key={i} type="button" onClick={() => pick(h)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.06]">
                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-white/5">{h.cover ? <img src={h.cover} alt="" className="h-full w-full object-cover" /> : null}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">{h.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{h.artist}{h.album ? ` · ${h.album}` : ''}</span>
                    </span>
                    {h.source === 'soundcloud'
                      ? <SocialIcon platform="soundcloud" className="size-3.5 shrink-0 text-[#ff5500]" />
                      : <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">iTunes</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
