'use client'

import Link from 'next/link'
import { IconCrown, IconLock } from '@tabler/icons-react'

interface PremiumLockProps {
  isPremium: boolean
  children: React.ReactNode
  featureName?: string
  variant?: 'overlay' | 'inline' | 'badge'
}

export function PremiumLock({ isPremium, children, featureName, variant = 'overlay' }: PremiumLockProps) {
  if (isPremium) {
    return <>{children}</>
  }

  if (variant === 'badge') {
    return (
      <div className="relative">
        {children}
        <div className="absolute -right-1 -top-1 z-10">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600">
            <IconCrown className="h-3 w-3 text-white" />
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <Link
        href="/pricing"
        className="flex items-center gap-2 rounded-xl border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-sm text-purple-300 transition hover:bg-purple-500/10"
      >
        <IconCrown className="h-4 w-4" />
        <span>Unlock {featureName || 'this feature'}</span>
      </Link>
    )
  }

  // Default overlay variant
  return (
    <div className="relative">
      <div className="pointer-events-none opacity-50 blur-[1px]">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Link
          href="/pricing"
          className="flex items-center gap-2 rounded-2xl border border-purple-500/30 bg-black/80 px-4 py-3 backdrop-blur-sm transition hover:border-purple-500/50 hover:bg-black/90"
        >
          <IconLock className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium text-white">Unlock with Lifetime</span>
        </Link>
      </div>
    </div>
  )
}

// Simple badge to show on premium options
export function PremiumBadge() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-600/20 to-fuchsia-600/20 px-2 py-0.5 text-[10px] font-medium text-purple-300">
      <IconCrown className="h-2.5 w-2.5" />
      PRO
    </span>
  )
}
