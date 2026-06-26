import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/current-profile'
import { getFreeEventActive } from '@/lib/get-free-event-active'
import MetadataClient from './client'

export default async function MetadataPage() {
  const [profile, freeEventActive] = await Promise.all([
    getCurrentProfile(),
    getFreeEventActive(),
  ])

  if (!profile) redirect('/login')

  const isPremium = profile.premium_active === true || freeEventActive
  // Premium-only feature - bounce non-premium users straight to the
  // upgrade page so they don't see an empty editor.
  if (!isPremium) redirect('/dashboard/premium')

  return <MetadataClient profile={profile} />
}
