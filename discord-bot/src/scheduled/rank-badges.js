import supabase from '../utils/supabase.js'
import { writeTaskResult } from './ledger.js'

export const taskKey = 'rank_badges'

// Global: anyone in the top 3 of all-time / monthly / weekly earns the
// matching badge, and it transfers automatically when someone is overtaken.
// @rez additionally always holds all three (owner showcase) - see below.

// Must match the badge names inserted by scripts/068_rank_badges_avatar_fx.sql.
// Index 0 = rank 1, etc.
const RANK_BADGE_NAMES = ['#1 Ranked', '#2 Ranked', '#3 Ranked']

// Loadout position for auto-equipped rank badges. 'below_username' matches
// the schema default; rez can drag it elsewhere and we won't clobber it
// (we only insert when missing, never overwrite position/display_order).
const LOADOUT_POSITION = 'below_username'

/** Top profiles all-time by effective views (views_override ?? view_count). */
async function topAllTime(limit = 25) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, view_count, views_override')
    .eq('flagged_for_review', false)
    .eq('views_locked', false)
    .order('view_count', { ascending: false })
    .limit(limit)
  if (error) throw error
  // Rank by the query order (view_count DESC) to match the public leaderboard
  // exactly - lib/leaderboard.ts ranks by view_count, NOT by the
  // override-adjusted value, so re-sorting here would award badges to
  // different users than the leaderboard shows as #1/#2/#3.
  return (data || [])
    .map((p) => ({ id: p.id, views: (p.views_override ?? p.view_count ?? 0) }))
    .filter((p) => p.views > 0)
}

/** Top profiles in a rolling window. */
async function topWindowed(days, limit = 25) {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  // Use the exact RPC the public leaderboard uses (lib/leaderboard.ts), so the
  // #1/#2/#3 badges always match what people see on the board. The RPC already
  // counts unique visitors, clamps each to the profile's total view_count,
  // drops flagged/locked profiles, and orders by the clamped value, all in SQL
  // (no 100k row pull, no id-list lookup).
  const { data: rows, error } = await supabase.rpc('leaderboard_window_counts', { p_since: since })
  if (error) throw error
  return (rows || [])
    .map((r) => ({ id: r.profile_id, views: Number(r.views) || 0 }))
    .filter((p) => p.views > 0)
    .slice(0, limit)
}

export async function run() {
  const startedAt = Date.now()
  try {
    // 1. Compute the top 3 of each window.
    const [allT, monthT, weekT] = await Promise.all([
      topAllTime(),
      topWindowed(30),
      topWindowed(7),
    ])

    // 2. Each user gets their BEST (lowest) rank across any window, so one
    //    person never holds two rank badges at once.
    const bestRank = new Map() // user_id -> 1 | 2 | 3
    for (const list of [allT, monthT, weekT]) {
      list.slice(0, 3).forEach((entry, i) => {
        const rank = i + 1
        const cur = bestRank.get(entry.id)
        if (cur == null || rank < cur) bestRank.set(entry.id, rank)
      })
    }

    // 3. Resolve the three badge ids.
    const { data: badgeRows, error: badgeErr } = await supabase
      .from('badges')
      .select('id, name')
      .in('name', RANK_BADGE_NAMES)
    if (badgeErr) throw badgeErr
    const badgeIdByRank = {}
    for (const b of badgeRows || []) {
      const idx = RANK_BADGE_NAMES.indexOf(b.name)
      if (idx >= 0) badgeIdByRank[idx + 1] = b.id
    }
    if (!badgeIdByRank[1] || !badgeIdByRank[2] || !badgeIdByRank[3]) {
      throw new Error('rank badges missing from badges table - run scripts/068')
    }

    // 4. Desired holders per rank.
    const desired = { 1: new Set(), 2: new Set(), 3: new Set() }
    for (const [userId, rank] of bestRank) desired[rank].add(userId)

    // 5. @rez always holds all three rank badges (owner showcase), on top of
    //    the real top-3. His views are locked so he never appears on the
    //    public leaderboard, but he keeps the badges regardless.
    {
      const { data: rez } = await supabase
        .from('profiles').select('id').eq('username', 'rez').maybeSingle()
      if (rez?.id) {
        desired[1].add(rez.id)
        desired[2].add(rez.id)
        desired[3].add(rez.id)
      }
    }

    // 6. Reconcile each rank badge: grant to new holders, revoke from the
    //    overtaken. Touch both profile_badges (ownership) and
    //    profile_badge_loadout (equipped) so the badge actually shows.
    let granted = 0
    let revoked = 0
    for (const rank of [1, 2, 3]) {
      const badgeId = badgeIdByRank[rank]
      const { data: current } = await supabase
        .from('profile_badges').select('user_id').eq('badge_id', badgeId)
      const currentSet = new Set((current || []).map((r) => r.user_id))
      const desiredSet = desired[rank]

      // Grant
      for (const userId of desiredSet) {
        if (currentSet.has(userId)) continue
        await supabase.from('profile_badges').insert({ user_id: userId, badge_id: badgeId })
        await supabase.from('profile_badge_loadout').upsert(
          { user_id: userId, badge_id: badgeId, position: LOADOUT_POSITION, display_order: 900 + rank },
          { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
        )
        granted++
      }
      // Revoke
      for (const userId of currentSet) {
        if (desiredSet.has(userId)) continue
        await supabase.from('profile_badges').delete().eq('badge_id', badgeId).eq('user_id', userId)
        await supabase.from('profile_badge_loadout').delete().eq('badge_id', badgeId).eq('user_id', userId)
        revoked++
      }
    }

    await writeTaskResult(taskKey, {
      status: 'success',
      details: { granted, revoked, duration_ms: Date.now() - startedAt },
    })
    return { granted, revoked }
  } catch (err) {
    await writeTaskResult(taskKey, { status: 'error', error: err.message })
    console.error('[rank_badges] failed:', err)
    throw err
  }
}
