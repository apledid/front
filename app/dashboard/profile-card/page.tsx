import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/current-profile'
import { ProfileCardClient } from './client'

export default async function ProfileCardPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  return <ProfileCardClient profile={profile} />
}
