import { createAdminClient } from '@/lib/supabase/admin'

export type LeaderboardRange = 'all' | 'month' | 'week'

export interface LeaderboardEntry {
  rank: number
  username: string
  display_name: string | null
  avatar_url: string | null
  avatar_decoration_hash: string | null
  views: number
  is_premium: boolean
}

export interface Leaderboards {
  all: LeaderboardEntry[]
  month: LeaderboardEntry[]
  week: LeaderboardEntry[]
}

const EMPTY: Leaderboards = { all: [], month: [], week: [] }

function rankAllTime(rows: any[]): LeaderboardEntry[] {
  return (rows ?? [])
    .map((p) => ({
      username: p.username as string,
      display_name: p.display_name as string | null,
      avatar_url: p.avatar_url as string | null,
      avatar_decoration_hash: p.avatar_decoration_hash as string | null,
      views: (p.views_override as number | null) ?? (p.view_count as number | null) ?? 0,
      is_premium: Boolean(p.premium_active),
    }))
    .filter((e) => e.views > 0)
    .map((e, i) => ({ rank: i + 1, ...e }))
}

/**
 * Computes all three leaderboards from a SINGLE point in time.
 *
 * Both windowed ranges (week = last 7 days, month = last 30 days) are derived
 * from one `now` value, so the week window is always a strict subset of the
 * month window and `weekly <= monthly` holds for every profile. The page then
 * renders all three from this one blob in a single response, so the tabs can
 * never disagree.
 *
 * This is what fixed the "weekly > monthly" report: the old code cached each
 * `?range=` page independently (revalidate = 86400), so the weekly and monthly
 * tabs were frozen at different times and a fresher weekly snapshot could
 * exceed a staler monthly one.
 *
 * - `all`   -> profiles.view_count (or views_override if an admin pinned it)
 * - `month` -> unique visitors from page_views in the last 30 days, capped at
 *              the profile's all-time total so monthly can never exceed it
 * - `week`  -> same, last 7 days
 *
 * The cap (see migration 075, LEAST in the RPC) keeps view_count as the single
 * source of truth: every profile reads all-time >= monthly >= weekly, and the
 * windowed numbers line up with the count shown on the profile itself.
 *
 * Profiles with views_locked or flagged_for_review are dropped, as are zero
 * counts. Top 50 per range.
 */
async function computeLeaderboards(): Promise<Leaderboards> {
  const admin = createAdminClient()
  const now = Date.now()
  const weekSince = new Date(now - 7 * 86400_000).toISOString()
  const monthSince = new Date(now - 30 * 86400_000).toISOString()

  const [allRes, weekRes, monthRes] = await Promise.all([
    admin
      .from('profiles')
      .select(
        'username, display_name, avatar_url, avatar_decoration_hash, view_count, views_override, premium_active'
      )
      .eq('flagged_for_review', false)
      .eq('views_locked', false)
      .order('view_count', { ascending: false })
      .limit(50),
    admin.rpc('leaderboard_window_counts', { p_since: weekSince }),
    admin.rpc('leaderboard_window_counts', { p_since: monthSince }),
  ])

  // Surface query failures in logs. We intentionally fall back to empty arrays
  // (a half-rendered leaderboard beats a 500), but silently swallowing errors
  // is how a windowed tab can quietly go blank, so make it visible.
  if (allRes.error) console.error('[leaderboard] all-time query failed:', allRes.error.message)
  if (weekRes.error) console.error('[leaderboard] week rpc failed:', weekRes.error.message)
  if (monthRes.error) console.error('[leaderboard] month rpc failed:', monthRes.error.message)

  const all = rankAllTime(allRes.data ?? [])

  // The RPC already joins profiles, drops flagged/locked rows, and limits to
  // 50, so each window maps straight to entries. No second profiles lookup -
  // unioning both windows' ids overflowed the request URI and blanked the tab.
  const buildWindow = (rows: any[]): LeaderboardEntry[] =>
    (rows ?? [])
      .map((r) => ({
        username: r.username as string,
        display_name: (r.display_name ?? null) as string | null,
        avatar_url: (r.avatar_url ?? null) as string | null,
        avatar_decoration_hash: (r.avatar_decoration_hash ?? null) as string | null,
        views: Number(r.views) || 0,
        is_premium: Boolean(r.premium_active),
      }))
      .filter((e) => e.views > 0)
      .slice(0, 50)
      .map((e, i) => ({ rank: i + 1, ...e }))

  return { all, week: buildWindow(weekRes.data ?? []), month: buildWindow(monthRes.data ?? []) }
}

/**
 * All three leaderboards from one consistent snapshot.
 *
 * Computed live per request (the page is force-dynamic). No caching layer sits
 * in front of this on purpose: the original "weekly > monthly" bug came from
 * caching the ranges independently, and a stale cache also hid a blank window
 * tab right after a migration. Three indexed queries per render is cheap for a
 * page with this traffic, and it can never drift.
 */
export async function getLeaderboards(): Promise<Leaderboards> {
  try {
    return await computeLeaderboards()
  } catch (e) {
    console.error('[leaderboard] compute threw:', e)
    return EMPTY
  }
}

/** Back-compat single-range accessor. Reads the same unified snapshot. */
export async function getLeaderboard(range: LeaderboardRange): Promise<LeaderboardEntry[]> {
  const boards = await getLeaderboards()
  return boards[range] ?? []
}
