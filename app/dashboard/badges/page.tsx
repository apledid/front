import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/current-profile'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCryptoBadgesForUser, userHasCryptoBadges } from '@/lib/crypto-badges'
import BadgesClient from './client'

// Page output is per-user (filtered by current viewer's owned set) - never
// cache or pre-render across users. force-dynamic also keeps restricted
// badges from leaking via a CDN-cached HTML snapshot.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BadgesPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const admin = createAdminClient()
  const [{ data: badges }, { data: ownedRows }, { data: loadoutRows }] = await Promise.all([
    admin.from('badges').select('id, name, icon, icon_url, color, glow_color, glow_strength, description, restricted').order('name'),
    admin.from('profile_badges').select('badge_id').eq('user_id', profile.id),
    admin.from('profile_badge_loadout').select('badge_id').eq('user_id', profile.id),
  ])

  const ownedBadgeIds = (ownedRows || []).map((r: any) => r.badge_id)
  const equippedBadgeIds = (loadoutRows || []).map((r: any) => r.badge_id)
  const ownedSet = new Set(ownedBadgeIds)

  // Restricted badges (e.g. private/invite-only ones) are hidden from the
  // catalog for anyone who doesn't already own them. Owners still see + can
  // equip; everyone else can't see they exist.
  // @rez sees every badge in the catalog regardless of restricted/owned.
  const isRezViewer = profile.username === 'rez'
  const visibleBadges = (badges || []).filter((b: any) => isRezViewer || !b.restricted || ownedSet.has(b.id))

  // Owner-only crypto badges for @rez. They're not in the DB - they're
  // synthesized client-side at profile-render time, so we also synthesize
  // them here so they appear (Locked/Equipped) in the dashboard.
  let allBadges = visibleBadges
  let allOwned = ownedBadgeIds
  let allEquipped = equippedBadgeIds
  if (userHasCryptoBadges(profile.username)) {
    const defs = getCryptoBadgesForUser(profile.username)
    const crypto = defs.map((d) => ({
      id: `rez-crypto-${d.slug}`,
      slug: d.slug,
      name: d.name,
      icon: d.slug,
      color: d.color,
      glow_color: d.color,
      glow_strength: 12,
      description: d.description,
    }))
    const hidden = new Set<string>(((profile as any).rez_unequipped_crypto || []) as string[])
    allBadges = [...allBadges, ...crypto.map(({ slug: _s, ...c }) => c)]
    allOwned = [...allOwned, ...crypto.map((c) => c.id)]
    allEquipped = [...allEquipped, ...crypto.filter((c) => !hidden.has(c.slug)).map((c) => c.id)]
  }

  return <BadgesClient badges={allBadges} profile={profile} ownedBadgeIds={allOwned} equippedBadgeIds={allEquipped} />
}
