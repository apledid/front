// Pending password resets stored in Supabase - survives serverless restarts and works
// across all lambda instances (unlike the old globalThis Map).
import { createAdminClient } from '@/lib/supabase/admin'

export interface PendingReset {
  userId: string
  email: string
  code: string
  expiresAt: number
  attempts: number
}

const admin = createAdminClient()

export const pendingResets = {
  async get(userId: string): Promise<PendingReset | undefined> {
    const { data, error } = await admin
      .from('pending_resets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return undefined
    return {
      userId: data.user_id,
      email: data.email,
      code: data.code,
      expiresAt: data.expires_at,
      attempts: data.attempts,
    }
  },

  async set(userId: string, value: PendingReset): Promise<void> {
    const { error } = await admin.from('pending_resets').upsert({
      user_id: userId,
      email: value.email,
      code: value.code,
      expires_at: value.expiresAt,
      attempts: value.attempts,
    }, { onConflict: 'user_id' })
    if (error) throw new Error(`Failed to store pending reset: ${error.message}`)
  },

  async delete(userId: string): Promise<void> {
    await admin.from('pending_resets').delete().eq('user_id', userId)
  },

  async incrementAttempts(userId: string): Promise<void> {
    const { data } = await admin
      .from('pending_resets')
      .select('attempts')
      .eq('user_id', userId)
      .maybeSingle()
    if (data) {
      await admin
        .from('pending_resets')
        .update({ attempts: (data.attempts || 0) + 1 })
        .eq('user_id', userId)
    }
  },
}
