'use client'

import { useState } from 'react'
import { DashboardHeader } from '@/components/dashboard/header'
import { MobileSidebar } from '@/components/dashboard/sidebar'
import type { Profile } from '@/lib/types'

interface MobileSidebarControllerProps {
  profile: Profile
}

export function MobileSidebarController({ profile }: MobileSidebarControllerProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <DashboardHeader profile={profile} onMenuClick={() => setMobileOpen(true)} />
      <MobileSidebar
        profile={profile}
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
    </>
  )
}
