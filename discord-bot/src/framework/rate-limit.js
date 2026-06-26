import supabase from '../utils/supabase.js'

/**
 * Postgres-backed sliding-window rate limiter.
 *
 * Each (bucket, ts) row counts how many requests landed in that
 * 60-second window. To check, we sum the last `windowSeconds` worth of
 * rows for the bucket and compare against `limit`.
 *
 * This survives bot restarts (in-memory counters reset on every deploy)
 * and works the same regardless of whether we ever scale to multiple
 * processes.
 *
 * Opportunistic cleanup: every increment also deletes rows older than 1h
 * with low probability so the table doesn't grow indefinitely without
 * any cron dependency.
 */

const WINDOW_SECONDS = 60

/**
 * Check then increment a rate-limit bucket atomically-ish.
 *
 * Returns { allowed: boolean, remaining: number, retryAfter: number }
 * where retryAfter is the seconds until the oldest counted hit expires
 * (used to compose a friendly "try again in 30 seconds" message).
 */
export async function checkAndIncrement(bucket, limit, windowSeconds = WINDOW_SECONDS) {
  const now = Math.floor(Date.now() / 1000)
  const since = now - windowSeconds
  const currentBucket = Math.floor(now / windowSeconds) * windowSeconds

  // Sum recent hits for this bucket.
  const { data: rows, error: selErr } = await supabase
    .from('bot_rate_limits')
    .select('ts, count')
    .eq('bucket', bucket)
    .gte('ts', since)
  if (selErr) {
    console.error('[rate-limit] Failed to read bucket:', selErr.message)
    // Fail open - we'd rather take an extra ban than block a real admin
    // when Postgres hiccups. Audit log still records the action.
    return { allowed: true, remaining: limit, retryAfter: 0 }
  }
  const used = (rows || []).reduce((sum, r) => sum + (r.count || 0), 0)
  if (used >= limit) {
    const oldest = (rows || []).reduce((min, r) => Math.min(min, r.ts), now)
    return { allowed: false, remaining: 0, retryAfter: Math.max(1, oldest + windowSeconds - now) }
  }

  // Increment the current 60s bucket. We use upsert + count=count+1 via
  // a follow-up update. Two callers racing might double-increment for the
  // first hit of a brand-new window - acceptable for our use case.
  const { error: upErr } = await supabase
    .from('bot_rate_limits')
    .upsert({ bucket, ts: currentBucket, count: 1 }, { onConflict: 'bucket,ts', ignoreDuplicates: false })
  if (upErr) {
    // Race: row already exists. Bump the count.
    const { data: existing } = await supabase
      .from('bot_rate_limits')
      .select('count')
      .eq('bucket', bucket)
      .eq('ts', currentBucket)
      .maybeSingle()
    const next = (existing?.count || 0) + 1
    await supabase
      .from('bot_rate_limits')
      .update({ count: next })
      .eq('bucket', bucket)
      .eq('ts', currentBucket)
  }

  // Opportunistic cleanup: 5% chance per call.
  if (Math.random() < 0.05) {
    void supabase
      .from('bot_rate_limits')
      .delete()
      .lt('ts', now - 3600)
      .then(() => {}, () => {})
  }

  return { allowed: true, remaining: Math.max(0, limit - used - 1), retryAfter: 0 }
}

/**
 * Tier-based shortcut. Defines the policy in one place so individual
 * commands just declare `meta.rateLimit = 'destructive'`.
 */
const POLICIES = {
  destructive: { limit: 5,  window: 60 },  // ban / delete / forcelogout / broadcast
  admin:       { limit: 30, window: 60 },  // general admin commands
  public:      { limit: 15, window: 60 },  // public-facing user commands
  cheap:       { limit: 60, window: 60 },  // /ping, /help
}

export async function checkPolicy(policyName, discordId) {
  const policy = POLICIES[policyName] || POLICIES.admin
  return checkAndIncrement(`${policyName}:${discordId}`, policy.limit, policy.window)
}
