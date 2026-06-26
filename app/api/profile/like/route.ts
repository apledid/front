import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'

// Profile likes / dislikes.
//
// One reaction per (profile, user) - the composite PK on profile_reactions
// makes a user's stance mutually exclusive: liking clears a prior dislike and
// vice versa. Clicking the same stance again toggles it off. After every
// mutation we recompute the counts from the authoritative row count so rapid
// clicks can't drift the denormalized counters on `profiles`.

function sanitizeUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const u = raw.trim().toLowerCase()
  if (!/^[a-z0-9_]{1,30}$/.test(u)) return null
  return u
}

async function resolveProfile(username: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, likes_count, dislikes_count, show_likes')
    .eq('username', username)
    .maybeSingle()
  return data
}

async function recountAndPersist(profileId: string) {
  const admin = createAdminClient()
  const [{ count: likes }, { count: dislikes }] = await Promise.all([
    admin.from('profile_reactions').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).eq('reaction', 'like'),
    admin.from('profile_reactions').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).eq('reaction', 'dislike'),
  ])
  const likes_count = likes || 0
  const dislikes_count = dislikes || 0
  await admin.from('profiles').update({ likes_count, dislikes_count }).eq('id', profileId)
  return { likes_count, dislikes_count }
}

// "Liked" badge: auto-granted at 10 likes, auto-revoked below. Reconciled here
// (rather than via a cron) since likes only ever change through this route, so
// the badge appears/disappears the instant the count crosses the threshold.
const LIKE_BADGE_THRESHOLD = 10

async function reconcileLikeBadge(profileId: string, likesCount: number) {
  try {
    const admin = createAdminClient()
    const { data: badge } = await admin.from('badges').select('id').eq('name', 'Liked').maybeSingle()
    if (!badge) return
    const { data: owned } = await admin
      .from('profile_badges')
      .select('badge_id')
      .eq('user_id', profileId)
      .eq('badge_id', badge.id)
      .maybeSingle()
    const has = !!owned

    if (likesCount >= LIKE_BADGE_THRESHOLD && !has) {
      await admin
        .from('profile_badges')
        .upsert({ user_id: profileId, badge_id: badge.id }, { onConflict: 'user_id,badge_id', ignoreDuplicates: true })
      // Auto-equip below the username so it shows up without the owner having
      // to visit the badges page (mirrors the rank-badge cron behaviour).
      await admin
        .from('profile_badge_loadout')
        .upsert(
          { user_id: profileId, badge_id: badge.id, position: 'below_username', display_order: 800 },
          { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
        )
    } else if (likesCount < LIKE_BADGE_THRESHOLD && has) {
      await admin.from('profile_badges').delete().eq('user_id', profileId).eq('badge_id', badge.id)
      await admin.from('profile_badge_loadout').delete().eq('user_id', profileId).eq('badge_id', badge.id)
    }
  } catch {
    // Badge reconciliation is best-effort - never fail the like over it.
  }
}

// GET /api/profile/like?u=<username> - public counts + this viewer's vote.
export async function GET(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'general')
    if (rateLimit.response) return rateLimit.response

    const username = sanitizeUsername(new URL(request.url).searchParams.get('u'))
    if (!username) return NextResponse.json({ error: 'Invalid username' }, { status: 400 })

    const profile = await resolveProfile(username)
    if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let vote: 'like' | 'dislike' | null = null
    const me = await getApiUser()
    if (me) {
      const admin = createAdminClient()
      const { data: row } = await admin
        .from('profile_reactions')
        .select('reaction')
        .eq('profile_id', profile.id)
        .eq('user_id', me.id)
        .maybeSingle()
      vote = (row?.reaction as 'like' | 'dislike' | undefined) || null
    }

    return NextResponse.json({
      likes: profile.likes_count || 0,
      dislikes: profile.dislikes_count || 0,
      show: profile.show_likes !== false,
      vote,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })
  }
}

// POST /api/profile/like { u, action: 'like' | 'dislike' } - toggle (auth required).
export async function POST(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'general')
    if (rateLimit.response) return rateLimit.response

    const me = await getApiUser()
    if (!me) return NextResponse.json({ error: 'Sign in to react to profiles' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const username = sanitizeUsername(body.u)
    const action = body.action === 'dislike' ? 'dislike' : body.action === 'like' ? 'like' : null
    if (!username || !action) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const profile = await resolveProfile(username)
    if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (profile.id === me.id) return NextResponse.json({ error: "You can't react to your own profile" }, { status: 400 })

    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('profile_reactions')
      .select('reaction')
      .eq('profile_id', profile.id)
      .eq('user_id', me.id)
      .maybeSingle()

    let vote: 'like' | 'dislike' | null
    if (existing?.reaction === action) {
      // Same stance clicked again -> clear it.
      await admin.from('profile_reactions').delete().eq('profile_id', profile.id).eq('user_id', me.id)
      vote = null
    } else {
      // New / flipped stance. Upsert on the composite PK so a flip overwrites
      // the prior row instead of erroring, keeping the stance mutually exclusive.
      const { error: upErr } = await admin
        .from('profile_reactions')
        .upsert({ profile_id: profile.id, user_id: me.id, reaction: action }, { onConflict: 'profile_id,user_id' })
      if (upErr) { console.error('[like] upsert error:', upErr.message); return NextResponse.json({ error: 'Failed' }, { status: 400 }) }
      vote = action
    }

    const { likes_count, dislikes_count } = await recountAndPersist(profile.id)
    await reconcileLikeBadge(profile.id, likes_count)
    return NextResponse.json({ likes: likes_count, dislikes: dislikes_count, vote })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })
  }
}
