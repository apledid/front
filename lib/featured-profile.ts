/**
 * Profile of the Day picker.
 *
 * Shared by `/api/landing/featured/route.ts` (used by client widgets
 * if anything needs the JSON) and `components/landing/featured-profile.tsx`
 * (used directly by the landing-page server component, no HTTP hop).
 *
 * Both pathways agree on the same fallback chain:
 *   1. cached row for today in `featured_profile`
 *   2. yesterday's top-unique-visitor profile (via the
 *      top_viewed_profile_for_day RPC)
 *   3. all-time top-viewed profile (so the landing section is never
 *      empty)
 *   4. null (homepage section hides itself)
 *
 * Lazy population: the first hit each UTC day inserts the chosen
 * profile_id into `featured_profile` keyed by today's date. Later
 * hits the same day read the cached row.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface FeaturedProfile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  view_count: number | null
  avatar_decoration_hash: string | null
  accent_color: string | null
}

const PROFILE_SHAPE =
  'id, username, display_name, avatar_url, view_count, avatar_decoration_hash, accent_color'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function getFeaturedProfile(): Promise<FeaturedProfile | null> {
  const admin = createAdminClient()
  const today = isoDate(new Date())

  try {
    // Cached row for today.
    const { data: existing } = await admin
      .from('featured_profile')
      .select('profile_id')
      .eq('date', today)
      .maybeSingle()

    if (existing?.profile_id) {
      const { data: profile } = await admin
        .from('profiles')
        .select(PROFILE_SHAPE)
        .eq('id', existing.profile_id)
        .maybeSingle()
      if (profile) return profile as FeaturedProfile
      // Cached row points at a deleted profile - fall through.
    }

    // Yesterday's top viewer (RPC handles the public + non-banned
    // filtering so we don't repeat it here).
    const yesterday = isoDate(new Date(Date.now() - 86_400_000))
    const { data: topRows } = await admin.rpc('top_viewed_profile_for_day', { p_date: yesterday })
    const topId = Array.isArray(topRows) && topRows[0]?.profile_id
      ? (topRows[0].profile_id as string)
      : null

    let chosenId: string | null = topId

    // Fallback: all-time top-viewed profile.
    if (!chosenId) {
      const { data: fallback } = await admin
        .from('profiles')
        .select('id')
        .order('view_count', { ascending: false })
        .limit(1)
        .maybeSingle()
      chosenId = fallback?.id ?? null
    }

    if (!chosenId) return null

    // Cache the pick - concurrent first-of-day requests race, but
    // the UNIQUE PK on `date` means one row wins via ON CONFLICT
    // (upsert handles the conflict for us).
    await admin
      .from('featured_profile')
      .upsert({ date: today, profile_id: chosenId }, { onConflict: 'date' })

    const { data: profile } = await admin
      .from('profiles')
      .select(PROFILE_SHAPE)
      .eq('id', chosenId)
      .maybeSingle()

    return (profile as FeaturedProfile) ?? null
  } catch (error) {
    console.error('[getFeaturedProfile] error:', error)
    return null
  }
}
