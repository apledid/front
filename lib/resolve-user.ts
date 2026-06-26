import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Resolves a user ID from various input formats:
 * - UUID (returned as-is)
 * - username (e.g., "john")
 * - @username (e.g., "@john")
 * - profile_uid (e.g., "john123")
 * - UID number (e.g., "1" or "123")
 */
export async function resolveUserId(
  admin: ReturnType<typeof createAdminClient>,
  input: string
): Promise<string | null> {
  if (!input) return null

  // Check if it's already a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(input)) {
    return input
  }

  // Remove @ prefix if present
  const cleanInput = input.startsWith('@') ? input.slice(1) : input

  // Try to find by username first (using profiles table, not users)
  const { data: profileByUsername } = await admin
    .from('profiles')
    .select('id')
    .eq('username', cleanInput.toLowerCase())
    .maybeSingle()

  if (profileByUsername?.id) return profileByUsername.id

  // Try to find by UID number
  const uidNumber = parseInt(cleanInput, 10)
  if (!isNaN(uidNumber)) {
    const { data: profileByUid } = await admin
      .from('profiles')
      .select('id')
      .eq('uid', uidNumber)
      .maybeSingle()

    if (profileByUid?.id) return profileByUid.id
  }

  // Try to find by profile_uid string
  const { data: profileByProfileUid } = await admin
    .from('profiles')
    .select('id')
    .eq('profile_uid', cleanInput)
    .maybeSingle()

  if (profileByProfileUid?.id) return profileByProfileUid.id

  return null
}
