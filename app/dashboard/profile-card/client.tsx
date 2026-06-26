'use client'

import { useRouter } from 'next/navigation'
import { ProfileCardSettings } from '@/components/dashboard/settings/profile-card-settings'
import type { Profile } from '@/lib/types'

interface Props {
  profile: Profile
}

export function ProfileCardClient({ profile }: Props) {
  const router = useRouter()

  async function handleSave(updates: Record<string, unknown>) {
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      throw new Error('Failed to save')
    }

    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile Card</h1>
        <p className="mt-1 text-sm text-white/40">
          Customize your profile card appearance and style
        </p>
      </div>
      <ProfileCardSettings profile={profile} onSave={handleSave} />
    </div>
  )
}
