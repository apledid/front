'use client'

import { useMemo, useRef, useState } from 'react'
import { IconLoader2, IconSearch, IconSticker, IconTrash, IconX } from '@tabler/icons-react'
import { toast } from 'sonner'
import { type AvatarDecoration, decorationUrl } from '@/lib/avatar-decorations'

const PAGE_SIZE = 25

export default function DecorationClient({
  decorations,
  initialHash,
}: {
  decorations: AvatarDecoration[]
  initialHash: string | null
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(initialHash)
  const saved = useRef<string | null>(initialHash)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return decorations
    return decorations.filter((d) => d.name.toLowerCase().includes(q))
  }, [decorations, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  )

  const dirty = (selected ?? null) !== (saved.current ?? null)

  // Reset to page 1 when query changes
  function onQueryChange(v: string) {
    setQuery(v)
    setPage(1)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_decoration_hash: selected || null }),
      })
      if (!res.ok) throw new Error()
      saved.current = selected
      toast.success('Decoration saved!')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setSelected(saved.current)
  }

  function handleClear() {
    setSelected(null)
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Decoration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse Discord-style avatar decorations and pick one for your profile picture.
        </p>
      </div>

      <div
        className="rounded-2xl border border-border bg-surface p-5"
        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.5)' }}
      >
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-accent-soft">
            <IconSticker className="size-4 text-primary" />
          </span>
          <h2 className="text-lg font-semibold text-foreground">Decorations</h2>
          <span className="text-xs text-muted-foreground/70">{filtered.length} total</span>

          <div className="ml-auto flex items-center gap-2">
            {selected ? (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/15 transition"
              >
                <IconTrash className="size-3.5" /> Remove
              </button>
            ) : null}

            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search decorations..."
                className="w-56 rounded-lg border border-border bg-surface-2 py-2 pl-8 pr-8 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-[color:var(--accent)]"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => onQueryChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground-secondary"
                  aria-label="Clear search"
                >
                  <IconX className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {pageItems.length === 0 ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {decorations.length === 0
                ? 'No decorations available yet. Populate the catalog (see lib/avatar-decorations.ts).'
                : 'No decorations match your search.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {pageItems.map((d) => {
              const active = selected === d.slug
              return (
                <button
                  key={d.slug}
                  type="button"
                  onClick={() => setSelected(d.slug)}
                  className={`group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all hover:-translate-y-0.5 ${
                    active
                      ? 'border-primary/60 bg-accent-soft'
                      : 'border-border bg-surface-2 hover:border-border-strong'
                  }`}
                  style={{
                    boxShadow: active
                      ? '0 0 0 1px rgba(232,127,160,0.4)'
                      : '0 6px 18px -10px rgba(0,0,0,0.5)',
                  }}
                >
                  <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={decorationUrl(d.slug, 240)}
                      alt={d.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.opacity = '0.2'
                      }}
                    />
                  </div>
                  <p className="line-clamp-1 w-full truncate text-center text-xs font-medium text-foreground-secondary">
                    {d.name}
                  </p>
                  {active ? (
                    <span className="pointer-events-none absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                        <path d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 111.4-1.4L9 11.6l6.3-6.3a1 1 0 011.4 0z" />
                      </svg>
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-foreground-secondary transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              ‹
            </button>
            <span className="rounded-full border border-border bg-surface-2 px-4 py-1.5 text-sm text-foreground-secondary">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-foreground-secondary transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      {/* Floating save bar */}
      {dirty ? (
        <div className="fixed bottom-0 left-0 right-0 z-[100] animate-in slide-in-from-bottom-6 fade-in duration-500">
          <div className="mx-auto max-w-3xl px-4 pb-4">
            <div
              className="flex items-center justify-between gap-4 rounded-2xl border border-border-strong bg-surface/90 px-5 py-3 backdrop-blur-2xl"
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 24px 48px -16px rgba(0,0,0,0.7)' }}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
                  <span className="relative h-2 w-2 rounded-full bg-primary" />
                </span>
                You have unsaved changes!
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving}
                  className="rounded-lg px-3 py-1.5 text-sm text-foreground-secondary hover:bg-white/[0.05] hover:text-foreground"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  {saving ? (
                    <>
                      <IconLoader2 className="size-3.5 animate-spin" /> Saving
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
