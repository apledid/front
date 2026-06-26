import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'

const VALID_POSITIONS = new Set(['above_username', 'below_username', 'above_links', 'below_links'])

export async function GET() {
  try {
    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = profile.id

    const admin = createAdminClient()

    const [{ data: badgeAssignments }, { data: titleAssignments }, { data: badgeLoadout }, { data: titleLoadout }] = await Promise.all([
      admin
        .from('profile_badges')
        .select('badge_id, badges(*)')
        .eq('user_id', userId),
      admin
        .from('profile_titles')
        .select('title_id, titles(*)')
        .eq('user_id', userId),
      admin
        .from('profile_badge_loadout')
        .select('badge_id, position, display_order, badges(*)')
        .eq('user_id', userId)
        .order('display_order', { ascending: true }),
      admin
        .from('profile_title_loadout')
        .select('title_id, position, display_order, titles(*)')
        .eq('user_id', userId)
        .order('display_order', { ascending: true }),
    ])

    return NextResponse.json({
      badges: (badgeAssignments || []).map((item: any) => item.badges).filter(Boolean),
      titles: (titleAssignments || []).map((item: any) => item.titles).filter(Boolean),
      badgeLoadout: (badgeLoadout || []).map((item: any) => ({
        badge_id: item.badge_id,
        position: item.position,
        display_order: item.display_order,
        badge: item.badges, // Include full badge data
      })),
      titleLoadout: (titleLoadout || []).map((item: any) => ({
        title_id: item.title_id,
        position: item.position,
        display_order: item.display_order,
        title: item.titles, // Include full title data
      })),
      positions: Array.from(VALID_POSITIONS),
    })
  } catch (error) {
    console.error('Loadout GET error:', error)
    return NextResponse.json({ error: 'Failed to load profile equipment' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = profile.id

    const { badges = [], titles = [] } = await request.json()
    const admin = createAdminClient()

    const sanitizedBadges = Array.isArray(badges)
      ? badges
          .filter((item: any) => item?.badge_id && VALID_POSITIONS.has(item?.position))
          .map((item: any, index: number) => ({
            user_id: userId,
            badge_id: item.badge_id,
            position: item.position,
            display_order: Number.isFinite(item.display_order) ? item.display_order : index,
          }))
      : []

    const sanitizedTitles = Array.isArray(titles)
      ? titles
          .filter((item: any) => item?.title_id && VALID_POSITIONS.has(item?.position))
          .map((item: any, index: number) => ({
            user_id: userId,
            title_id: item.title_id,
            position: item.position,
            display_order: Number.isFinite(item.display_order) ? item.display_order : index,
          }))
      : []

    // Ownership gate. Without this, anyone could send a `badge_id` they don't
    // own (e.g. a restricted/staff/owner badge ID scraped from a public
    // profile's HTML) and have it equipped on their own profile. The same
    // applies to titles.
    let safeBadges = sanitizedBadges
    if (sanitizedBadges.length > 0) {
      const incomingBadgeIds = sanitizedBadges.map((b) => b.badge_id)
      const { data: ownedRows } = await admin
        .from('profile_badges')
        .select('badge_id')
        .eq('user_id', userId)
        .in('badge_id', incomingBadgeIds)
      const ownedSet = new Set((ownedRows || []).map((r: any) => r.badge_id))
      safeBadges = sanitizedBadges.filter((b) => ownedSet.has(b.badge_id))
    }

    let safeTitles = sanitizedTitles
    if (sanitizedTitles.length > 0) {
      const incomingTitleIds = sanitizedTitles.map((t) => t.title_id)
      const { data: ownedRows } = await admin
        .from('profile_titles')
        .select('title_id')
        .eq('user_id', userId)
        .in('title_id', incomingTitleIds)
      const ownedSet = new Set((ownedRows || []).map((r: any) => r.title_id))
      safeTitles = sanitizedTitles.filter((t) => ownedSet.has(t.title_id))
    }

    // Snapshot the current loadout first. delete-then-insert isn't
    // transactional here, so if the insert fails we restore the snapshot
    // instead of leaving the user with an empty loadout.
    const { data: prevBadges } = await admin.from('profile_badge_loadout').select('*').eq('user_id', userId)
    const { data: prevTitles } = await admin.from('profile_title_loadout').select('*').eq('user_id', userId)

    await admin.from('profile_badge_loadout').delete().eq('user_id', userId)
    await admin.from('profile_title_loadout').delete().eq('user_id', userId)

    if (safeBadges.length > 0) {
      const { error } = await admin.from('profile_badge_loadout').insert(safeBadges)
      if (error) {
        if (prevBadges?.length) await admin.from('profile_badge_loadout').insert(prevBadges)
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    if (safeTitles.length > 0) {
      const { error } = await admin.from('profile_title_loadout').insert(safeTitles)
      if (error) {
        if (prevTitles?.length) await admin.from('profile_title_loadout').insert(prevTitles)
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Loadout PUT error:', error)
    return NextResponse.json({ error: 'Failed to save profile equipment' }, { status: 500 })
  }
}
