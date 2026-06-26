import type { Profile } from '@/lib/types'

/**
 * Fields that must NEVER be sent to any client.
 * These are stripped from every profile response.
 */
const SENSITIVE_FIELDS = [
  'password_hash',
  'signup_ip',
  'verification_code',
  'verification_expires_at',
  'session_invalidated_at',
  'stripe_customer_id',
  'stripe_payment_id',
  'email_deadline',
  'spotify_access_token',
  'spotify_refresh_token',
  'admin_access',
] as const

/**
 * Fields only visible to the profile owner (not in public responses).
 */
const OWNER_ONLY_FIELDS = [
  'email',
  'email_verified',
  'is_admin',
  // Identity + internal state that must never reach an anonymous visitor.
  // The public profile renderer (guns-profile) reads none of these, and the
  // only client consumers of discord_id are dead bento tiles, so stripping
  // them from public responses is safe. Kept for the OWNER (this list is not
  // applied by sanitizeProfileForOwner) so the dashboard still sees them.
  'discord_id',
  'banned',
  'banned_at',
  'ban_reason',
  'banned_by_username',
  'flagged_for_review',
  'support_blacklisted',
  'views_override',
  'views_locked',
  'is_premium',
  'premium_active',
  'premium_type',
  'premium_activated_at',
  'can_give_premium',
] as const

/**
 * Strips sensitive fields from a profile before returning it to the owner.
 * Keeps email and admin status visible to the user themselves.
 */
export function sanitizeProfileForOwner(profile: any): Partial<Profile> {
  if (!profile) return profile
  const cleaned = { ...profile }
  for (const field of SENSITIVE_FIELDS) {
    delete cleaned[field]
  }
  return cleaned
}

/**
 * Strips sensitive AND owner-only fields from a profile before returning it publicly.
 * Used for public profile pages and any endpoint where the viewer is not the profile owner.
 */
export function sanitizeProfileForPublic(profile: any): Partial<Profile> {
  if (!profile) return profile
  const cleaned = { ...profile }
  for (const field of SENSITIVE_FIELDS) {
    delete cleaned[field]
  }
  for (const field of OWNER_ONLY_FIELDS) {
    delete cleaned[field]
  }
  return cleaned
}
