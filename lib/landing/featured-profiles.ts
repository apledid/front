import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_cache } from 'next/cache'

// Curated list of featured profiles. Order here = display order on the
// landing page gallery.
const FEATURED_USERNAMES = [
  'rez',
  'fe4r',
  'kev',
  '777',
  'tanishwtf',
  'liar',
] as const

export interface FeaturedProfile {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  background_url: string | null
  background_color: string | null
  accent_color: string | null
  music_title: string | null
  cursor_effect: string | null
  username_effect: string | null
  font_family: string | null
  avatar_decoration_hash: string | null
  avatar_shape: string | null
  socials: Array<{ platform: string; url: string }>
  tag: string  // hand-picked one-liner shown on the card
}

// Hand-picked taglines per featured user - short and human, not auto-generated
const TAGS: Record<string, string> = {
  rez: 'the founder of the website >.<',
  fe4r: 'pretty tuff profile',
  kev: 'gay kitten',
  '777': 'hacker guy',
  tanishwtf: 'amazing profile',
  liar: 'W rich guy',
}

/**
 * Fetches the 6 featured profiles + their top social links in two queries.
 * Server-only - uses the admin client to bypass RLS so we get the same fields
 * the public profile page renders. Returns them in FEATURED_USERNAMES order.
 */
async function fetchFeaturedProfiles(): Promise<FeaturedProfile[]> {
  const admin = createAdminClient()

  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select(
      'id,username,display_name,bio,avatar_url,background_url,background_color,accent_color,music_title,cursor_effect,username_effect,font_family,avatar_decoration_hash,avatar_shape'
    )
    .in('username', FEATURED_USERNAMES as readonly string[])

  if (pErr || !profiles) return []

  const ids = profiles.map((p) => p.id)
  const { data: socials } = await admin
    .from('social_links')
    .select('user_id,platform,url,display_order')
    .in('user_id', ids)
    .order('display_order', { ascending: true })

  const socialsByUser = new Map<string, Array<{ platform: string; url: string }>>()
  for (const s of socials || []) {
    const arr = socialsByUser.get(s.user_id) ?? []
    if (arr.length < 6) arr.push({ platform: s.platform, url: s.url })
    socialsByUser.set(s.user_id, arr)
  }

  // Preserve curated display order
  const byUsername = new Map<string, (typeof profiles)[number]>()
  for (const p of profiles) byUsername.set(p.username, p)

  const out: FeaturedProfile[] = []
  for (const username of FEATURED_USERNAMES) {
    const p = byUsername.get(username)
    if (!p) continue
    out.push({
      ...p,
      socials: socialsByUser.get(p.id) ?? [],
      tag: TAGS[username] ?? '',
    })
  }
  return out
}

// The featured list is a hardcoded set of usernames + hand-picked taglines, so
// it changes ~weekly at most. Cache it for 5 min so the highest-traffic page
// doesn't run 2 DB queries per hit for effectively-static content. The homepage
// itself stays dynamic for the per-user nav (getCurrentProfileSummary).
export const getFeaturedProfiles = unstable_cache(
  fetchFeaturedProfiles,
  ['featured-profiles-v1'],
  { revalidate: 300, tags: ['featured-profiles'] },
)
