import type { createAdminClient } from '@/lib/supabase/admin'

/**
 * Max accounts allowed per signup IP, shared across every account-creation
 * path (direct signup, email-verified signup, Discord OAuth). Keeping the cap
 * + the check in one place is what stops the farming: previously only the
 * direct-signup route enforced a limit, and the other two paths didn't even
 * record signup_ip, so accounts made through them were invisible to the count
 * and let one person collect unlimited usernames.
 */
export const MAX_ACCOUNTS_PER_IP = 5

type Admin = ReturnType<typeof createAdminClient>

/**
 * True when this IP has already reached the account cap. `unknown` IPs are
 * never capped - we can't attribute them to a person, and behind nginx every
 * real request carries an IP. Fails open (returns false) on a DB error so a
 * transient hiccup never blocks a legitimate signup.
 */
export async function isSignupIpAtLimit(admin: Admin, ip: string): Promise<boolean> {
  if (!ip || ip === 'unknown') return false
  try {
    const { count, error } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('signup_ip', ip)
    if (error) return false
    return count !== null && count >= MAX_ACCOUNTS_PER_IP
  } catch {
    return false
  }
}
