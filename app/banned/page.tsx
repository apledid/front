import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/current-profile'
import { BannedScreen } from '@/components/app/banned-screen'

export default async function BannedPage() {
  const profile = await getCurrentProfile()
  
  if (!profile) redirect('/login')

  if (!profile.is_banned) redirect('/dashboard')

  return <BannedScreen reason={profile.ban_reason} staff={profile.banned_by_username} />
}
