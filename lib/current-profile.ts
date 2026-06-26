import { getApiUser, getApiUserSummary } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import type { Profile } from '@/lib/types'

export interface CurrentProfileSummary {
  username: string | null
  display_name: string | null
  premium_active?: boolean
}

/**
 * Returns the current user's full profile, or null if not authenticated.
 * Uses the same session-token validation as getApiUser() - no IDOR possible.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  return getApiUser()
}

/**
 * Lightweight version for places that only need username/display_name/premium.
 * Still validates the full session to prevent IDOR.
 */
export async function getCurrentProfileSummary(): Promise<CurrentProfileSummary | null> {
  const profile = await getApiUserSummary()
  if (!profile) return null
  return {
    username: profile.username,
    display_name: profile.display_name,
    premium_active: profile.premium_active ?? undefined,
  }
}
