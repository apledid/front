'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// Pages where we should never run the auth check
const SKIP_PATHS = ['/login', '/signup', '/banned', '/maintenance', '/forgot-password']

export function AccountStatusGuard() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Don't check on public/auth pages - they don't need it and would just
    // produce noisy 401s in the console for logged-out visitors.
    if (SKIP_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return

    let ignore = false

    async function checkStatus() {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' })
        if (!response.ok) return // 401 = not logged in, that's fine on public pages
        const data = await response.json().catch(() => ({}))
        if (!ignore && data?.profile?.banned) {
          router.replace('/banned')
        }
      } catch {
        // ignore network failures
      }
    }

    void checkStatus()
    return () => {
      ignore = true
    }
  }, [pathname, router])

  return null
}
