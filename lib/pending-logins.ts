// Pending login verifications stored in Supabase so they survive service restarts
import { createAdminClient } from '@/lib/supabase/admin'

export interface PendingLogin {
  userId: string
  username: string
  email: string
  code: string
  expiresAt: number
  attempts: number
}

const admin = createAdminClient()

export const pendingLogins = {
  async get(userId: string): Promise<PendingLogin | undefined> {
    const { data, error } = await admin
      .from('pending_logins')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return undefined
    return {
      userId: data.user_id,
      username: data.username,
      email: data.email,
      code: data.code,
      expiresAt: data.expires_at,
      attempts: data.attempts,
    }
  },

  async set(userId: string, value: PendingLogin): Promise<void> {
    const { error } = await admin.from('pending_logins').upsert({
      user_id: userId,
      username: value.username,
      email: value.email,
      code: value.code,
      expires_at: value.expiresAt,
      attempts: value.attempts,
    }, { onConflict: 'user_id' })
    if (error) throw new Error(`Failed to store verification code: ${error.message}`)
  },

  async delete(userId: string): Promise<void> {
    await admin.from('pending_logins').delete().eq('user_id', userId)
  },

  async incrementAttempts(userId: string): Promise<void> {
    await admin.rpc('increment_pending_login_attempts', { p_user_id: userId })
      .catch(async () => {
        // Fallback if RPC not available: fetch + update
        const { data } = await admin.from('pending_logins').select('attempts').eq('user_id', userId).maybeSingle()
        if (data) {
          await admin.from('pending_logins').update({ attempts: (data.attempts || 0) + 1 }).eq('user_id', userId)
        }
      })
  },
}
