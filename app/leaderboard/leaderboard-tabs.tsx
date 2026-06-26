'use client'

import { useState } from 'react'
import Link from 'next/link'
import { IconCrown, IconDiamondFilled } from '@tabler/icons-react'
import type { Leaderboards, LeaderboardRange } from '@/lib/leaderboard'

const RANGES: { key: LeaderboardRange; label: string }[] = [
  { key: 'all', label: 'all time' },
  { key: 'month', label: 'monthly' },
  { key: 'week', label: 'weekly' },
]

// Strip zero-width / bidi / soft-hyphen chars some users stuff into display
// names, then fall back to the handle.
const cleanName = (s: string | null, fallback: string): string =>
  (s ?? '').replace(/[​-‏﻿⁠­]/g, '').trim() || fallback

/**
 * All three ranges live in one response and switch client-side, so the tabs
 * always reflect the same snapshot. (The old version navigated to a separate
 * `?range=` URL per tab; those pages were cached independently and could show
 * an impossible "weekly > monthly" when one tab was staler than the other.)
 */
export default function LeaderboardTabs({
  boards,
  initialRange,
}: {
  boards: Leaderboards
  initialRange: LeaderboardRange
}) {
  const [range, setRange] = useState<LeaderboardRange>(initialRange)
  const rows = boards[range] ?? []

  const selectRange = (key: LeaderboardRange) => {
    setRange(key)
    // Keep the URL shareable without a server round-trip (no refetch keeps the
    // data on the same snapshot we already rendered).
    if (typeof window !== 'undefined') {
      const url = key === 'all' ? '/leaderboard' : `/leaderboard?range=${key}`
      window.history.replaceState(null, '', url)
    }
  }

  return (
    <>
      <div
        className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface p-1"
        role="tablist"
        aria-label="time range"
      >
        {RANGES.map((r) => {
          const active = range === r.key
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => selectRange(r.key)}
              className={
                active
                  ? 'rounded-lg bg-accent-soft px-4 py-1.5 text-sm font-medium text-foreground transition-colors'
                  : 'rounded-lg px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
              }
              role="tab"
              aria-selected={active}
            >
              {r.label}
            </button>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-border bg-surface py-16 text-center">
          <IconCrown className="size-8 text-primary/70" />
          <p className="text-sm text-foreground-secondary">no ranked profiles in this window yet.</p>
          <p className="text-xs text-muted-foreground">check back tomorrow.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 border-b border-border px-5 py-3 text-eyebrow uppercase text-muted-foreground">
            <span>#</span>
            <span>profile</span>
            <span className="justify-self-end">views</span>
          </div>
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const isTop = row.rank <= 3
              return (
                <li key={row.username}>
                  <Link
                    href={`/${row.username}`}
                    className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <span
                      className={
                        isTop
                          ? 'font-display text-base font-semibold text-primary tabular-nums'
                          : 'font-display text-base font-semibold text-muted-foreground tabular-nums'
                      }
                    >
                      {row.rank}
                    </span>

                    <span className="flex min-w-0 items-center gap-3">
                      <span className="relative size-9 shrink-0">
                        <span
                          className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-foreground-secondary"
                          aria-hidden
                        >
                          {row.username.slice(0, 1).toUpperCase()}
                        </span>
                        {row.avatar_url && (
                          <span
                            className="absolute inset-0 rounded-full bg-cover bg-center"
                            role="img"
                            aria-label={`${row.username} avatar`}
                            style={{ backgroundImage: `url("${row.avatar_url.replace(/"/g, '%22')}")` }}
                          />
                        )}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                          {cleanName(row.display_name, row.username)}
                          {row.is_premium && (
                            <IconDiamondFilled className="size-3 shrink-0 text-primary" aria-label="premium" />
                          )}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">@{row.username}</span>
                      </span>
                    </span>

                    <span className="justify-self-end text-sm font-medium tabular-nums text-foreground">
                      {row.views.toLocaleString()}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
