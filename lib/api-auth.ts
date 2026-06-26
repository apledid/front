import { cookies } from 'next/headers'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/lib/types'

/** Hash a raw session token before storing in the DB. Never store raw tokens. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/** Generate a cryptographically secure session token (64 hex chars = 256 bits). */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Constant-time comparison for short server-side secrets (6-digit
 * verification codes, etc.). Hashes both sides to fixed-length SHA-256
 * buffers so timingSafeEqual's equal-length requirement always holds and no
 * length info leaks. A plain `a === b` on codes short-circuits at the first
 * differing character, which can leak how many leading digits matched.
 */
export function constantTimeEqual(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

function isValidToken(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token)
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/**
 * Returns the authenticated user's profile, or null.
 *
 * Uses a single JOIN query instead of two sequential round-trips:
 *   sessions → profiles (was 2 queries, now 1)
 *
 * Security model:
 * - session_token cookie is hashed with SHA-256 and looked up in `sessions`.
 * - The sessions row must reference the same user_id as the cookie.
 * - If user_id ≠ session.user_id the request is rejected (IDOR prevention).
 * - Expired and revoked sessions are rejected.
 * - Banned profiles are rejected.
 */
export async function getApiUser(): Promise<Profile | null> {
  try {
    const jar = await cookies()
    const rawToken = jar.get('session_token')?.value
    const userId   = jar.get('user_id')?.value

    if (!rawToken || !userId) return null
    if (!isValidUUID(userId)) return null
    if (!isValidToken(rawToken) && !isValidUUID(rawToken)) return null

    const admin     = createAdminClient()
    const tokenHash = hashToken(rawToken)

    // Single JOIN - replaces the previous 2 sequential queries
    const { data: session } = await admin
      .from('sessions')
      .select(`
        user_id,
        expires_at,
        revoked_at,
        profile:profiles!inner (*)
      `)
      .eq('token_hash', tokenHash)
      .eq('user_id', userId)   // IDOR defence at the DB level
      .maybeSingle()

    if (!session) return null
    if (session.revoked_at) return null
    if (new Date(session.expires_at) < new Date()) return null

    const profile = Array.isArray(session.profile)
      ? session.profile[0]
      : session.profile

    if (!profile || profile.banned) return null

    return profile as Profile
  } catch {
    return null
  }
}

export interface ApiUserSummary {
  id: string
  username: string | null
  display_name: string | null
  premium_active: boolean | null
}

/**
 * Like getApiUser() but selects only the handful of profile columns the nav
 * needs, instead of the full ~150-column row. Same session validation (token
 * hash + user_id IDOR defence + expiry/revocation/ban). Use on the hot
 * per-request nav path so authed page renders don't serialize the whole row.
 */
export async function getApiUserSummary(): Promise<ApiUserSummary | null> {
  try {
    const jar = await cookies()
    const rawToken = jar.get('session_token')?.value
    const userId   = jar.get('user_id')?.value

    if (!rawToken || !userId) return null
    if (!isValidUUID(userId)) return null
    if (!isValidToken(rawToken) && !isValidUUID(rawToken)) return null

    const admin     = createAdminClient()
    const tokenHash = hashToken(rawToken)

    const { data: session } = await admin
      .from('sessions')
      .select(`user_id, expires_at, revoked_at, profile:profiles!inner (id, username, display_name, premium_active, banned)`)
      .eq('token_hash', tokenHash)
      .eq('user_id', userId)
      .maybeSingle()

    if (!session) return null
    if (session.revoked_at) return null
    if (new Date(session.expires_at) < new Date()) return null

    const profile: any = Array.isArray(session.profile) ? session.profile[0] : session.profile
    if (!profile || profile.banned) return null

    return {
      id: profile.id,
      username: profile.username ?? null,
      display_name: profile.display_name ?? null,
      premium_active: profile.premium_active ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Returns the authenticated user's ID, or null.
 * Reuses getApiUser() - call only one of the two per request.
 */
export async function getApiUserId(): Promise<string | null> {
  const profile = await getApiUser()
  return profile?.id ?? null
}
