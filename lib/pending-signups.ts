// Pending signups stored in Supabase - survives serverless restarts and works
// across all lambda instances (unlike the old globalThis Map).
import { createAdminClient } from '@/lib/supabase/admin'

export interface PendingSignup {
  username: string
  passwordHash: string
  code: string
  expiresAt: number
  attempts: number
  ip: string
}

const admin = createAdminClient()

export const pendingSignups = {
  async get(email: string): Promise<PendingSignup | undefined> {
    const { data, error } = await admin
      .from('pending_signups')
      .select('*')
      .eq('email', email)
      .maybeSingle()
    if (error || !data) return undefined
    return {
      username: data.username,
      passwordHash: data.password_hash,
      code: data.code,
      expiresAt: data.expires_at,
      attempts: data.attempts,
      ip: data.ip,
    }
  },

  async set(email: string, value: PendingSignup): Promise<void> {
    const { error } = await admin.from('pending_signups').upsert({
      email,
      username: value.username,
      password_hash: value.passwordHash,
      code: value.code,
      expires_at: value.expiresAt,
      attempts: value.attempts,
      ip: value.ip,
    }, { onConflict: 'email' })
    if (error) throw new Error(`Failed to store pending signup: ${error.message}`)
  },

  async delete(email: string): Promise<void> {
    await admin.from('pending_signups').delete().eq('email', email)
  },

  async incrementAttempts(email: string): Promise<void> {
    const { data } = await admin
      .from('pending_signups')
      .select('attempts')
      .eq('email', email)
      .maybeSingle()
    if (data) {
      await admin
        .from('pending_signups')
        .update({ attempts: (data.attempts || 0) + 1 })
        .eq('email', email)
    }
  },
}
