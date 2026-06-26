/**
 * Feature gate for the Phase-2/3 layout work (Bento layout, the new
 * visual layout-archetype picker, the redesigned Portfolio button
 * cards). Anything new and not-yet-polished should branch on this so
 * the rest of the userbase keeps seeing the pre-existing UI exactly
 * as before while the new work bakes on a small allowlist.
 *
 * Move to a `profiles.feature_flags` column or a `feature_flags` table
 * once this needs to be more than one username. For now a hardcoded
 * Set is good enough - it's one line to update and a `git push` away.
 */

const TEST_USERS = new Set<string>([
  'rez',
])

export function isTestUser(profile: { username?: string | null } | null | undefined): boolean {
  if (!profile?.username) return false
  return TEST_USERS.has(profile.username.toLowerCase())
}
