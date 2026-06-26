import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Returns true when the /freeevent is currently active in site_config.
 * Used server-side to suppress premium lock icons on the effects/appearance editors.
 */
export async function getFreeEventActive(): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('site_config')
      .select('value')
      .eq('key', 'free_event')
      .maybeSingle()
    return data?.value?.active === true
  } catch {
    return false
  }
}
