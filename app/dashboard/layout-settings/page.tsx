import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/current-profile'
import { LayoutSettingsClient } from './client'

export default async function LayoutSettingsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  return <LayoutSettingsClient profile={profile} />
}
