import { randomBytes } from 'crypto'
import { getCurrentProfile } from '@/lib/current-profile'

export type StaffContext = {
  userId: string | null
  username: string | null
  isStaff: boolean
  isOwner: boolean
}

export async function getStaffContext(): Promise<StaffContext> {
  try {
    const profile = await getCurrentProfile()

    if (!profile) {
      return { userId: null, username: null, isStaff: false, isOwner: false }
    }

    const isOwner = profile.username === 'rez'
    // @rez is always staff, or user has is_admin = true
    const hasAccess = isOwner || profile.is_admin === true

    return {
      userId: profile.id,
      username: profile.username || null,
      isStaff: hasAccess,
      isOwner,
    }
  } catch {
    return {
      userId: null,
      username: null,
      isStaff: false,
      isOwner: false,
    }
  }
}

// Simple check if a user ID is staff (admin)
// This checks hardcoded owner or is_admin flag
export function isStaff(userId: string, profile?: { username?: string | null; is_admin?: boolean }): boolean {
  if (!userId) return false
  // If profile provided, check directly
  if (profile) {
    return profile.username === 'rez' || profile.is_admin === true
  }
  return false
}

// Sync check for staff based on profile data
export function isStaffProfile(profile: { id: string; username?: string | null; is_admin?: boolean }): boolean {
  return profile.username === 'rez' || profile.is_admin === true
}

export function generateLicenseKey(planName: string) {
  const normalizedPlan = (planName || 'plan').replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'PLAN'
  // Crypto-strong randomness. The old version used Math.random()
  // which V8 implements with xorshift128+ - publicly available
  // tooling (v8-randomness-predictor) reconstructs the full PRNG
  // state from ~5 consecutive outputs, and each call to this
  // function burned three consecutive draws. Anyone who legitimately
  // received one key could forge every subsequent key our admins
  // generated. randomBytes() pulls from the OS CSPRNG and can't be
  // predicted from prior outputs.
  //
  // 3 bytes = 24 bits per block = 6 hex chars; three blocks give
  // 72 bits of entropy total. That's overkill for a redemption
  // code but matches the visual shape of the legacy format.
  const randomBlock = () => randomBytes(3).toString('hex').toUpperCase()
  return `HALO-${normalizedPlan}-${randomBlock()}-${randomBlock()}-${randomBlock()}`
}
