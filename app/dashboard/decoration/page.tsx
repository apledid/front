import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/current-profile'
import { AVATAR_DECORATIONS } from '@/lib/avatar-decorations'
import DecorationClient from './client'

export default async function DecorationPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const current = (profile as any).avatar_decoration_hash as string | null

  return <DecorationClient decorations={AVATAR_DECORATIONS} initialHash={current ?? null} />
}
