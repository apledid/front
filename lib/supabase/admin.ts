import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Module-level singleton - reused across calls within the same warm serverless instance.
// Each lambda invocation gets its own instance (no cross-process sharing), but this
// prevents re-constructing the client on every API call within one invocation.
let _admin: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  if (_admin) return _admin

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing SUPABASE_URL for admin operations')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for admin operations')

  _admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return _admin
}
