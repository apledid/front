import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/current-profile'
import { getFreeEventActive } from '@/lib/get-free-event-active'
import CustomizeClient from './client'

export default async function CustomizePage() {
  const [profile, freeEventActive] = await Promise.all([
    getCurrentProfile(),
    getFreeEventActive(),
  ])

  if (!profile) redirect('/login')

  return (
    <CustomizeClient
      profile={profile}
      isPremium={profile.premium_active === true || freeEventActive}
    />
  )
}
