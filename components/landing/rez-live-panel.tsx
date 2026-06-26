'use client'

import { useEffect, useState } from 'react'
import { GunsProfile } from '@/components/profile/guns-profile'

interface RezData {
  profile: any
  socialLinks: any[]
  customButtons: any[]
  badges: any[]
  badgeLoadout: any[]
  titleLoadout: any[]
  musicTracks: any[]
}

function useRezData(): RezData | null {
  const [data, setData] = useState<RezData | null>(null)

  useEffect(() => {
    const load = () =>
      fetch('/api/landing/rez-panel')
        .then((r) => r.json())
        .then((j) => j.profile && setData(j))
        .catch(() => {})
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  return data
}

export function RezLivePanel() {
  const data = useRezData()

  if (!data) {
    return (
      <div style={{ width: '100%', maxWidth: 480, minHeight: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,8,16,0.6)', borderRadius: 28, border: '1px solid rgba(255,255,255,0.08)', margin: '0 auto' }}>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading…</div>
      </div>
    )
  }

  const { profile, socialLinks, customButtons, badges, badgeLoadout, titleLoadout, musicTracks } = data

  return (
    <div style={{ width: '100%', maxWidth: 480, position: 'relative', overflow: 'visible', margin: '0 auto' }}>
      <GunsProfile
        profile={profile}
        socialLinks={socialLinks ?? []}
        badges={badges ?? []}
        badgeLoadout={badgeLoadout ?? []}
        titleLoadout={titleLoadout ?? []}
        customButtons={customButtons ?? []}
        musicTracks={musicTracks ?? []}
        previewMode
      />
    </div>
  )
}
