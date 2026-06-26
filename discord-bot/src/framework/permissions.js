import supabase from '../utils/supabase.js'

// In-memory admin cache. Refreshed lazily when more than TTL_MS old.
// 60s TTL means /admin grant takes effect within a minute without redeploy.
const TTL_MS = 60 * 1000
let cache = { fetchedAt: 0, admins: new Map(), owner: null }
let inflight = null

async function refreshCache() {
  const { data, error } = await supabase
    .from('bot_admins')
    .select('discord_id, username, is_owner')
  if (error) {
    console.error('[permissions] Failed to load bot_admins:', error.message)
    // Keep the stale cache - better to be slightly out of date than to
    // lock everyone out if the DB hiccups.
    return cache
  }
  const admins = new Map()
  let owner = null
  for (const row of data || []) {
    admins.set(row.discord_id, row)
    if (row.is_owner) owner = row.discord_id
  }
  // BOT_OWNER_ID env fallback: if the DB ever ends up empty (migration not
  // applied, table truncated), this lets the configured Discord owner still
  // operate the bot.
  if (!owner && process.env.BOT_OWNER_ID) {
    owner = process.env.BOT_OWNER_ID
    if (!admins.has(owner)) {
      admins.set(owner, { discord_id: owner, username: 'env-owner', is_owner: true })
    }
  }
  cache = { fetchedAt: Date.now(), admins, owner }
  return cache
}

async function getCache() {
  if (Date.now() - cache.fetchedAt < TTL_MS && cache.admins.size > 0) return cache
  if (inflight) return inflight
  inflight = refreshCache().finally(() => { inflight = null })
  return inflight
}

/** Force-refresh the cache. Call after /admin grant or /admin revoke so the
 *  caller sees the change immediately instead of waiting up to 60s. */
export async function invalidateAdminCache() {
  cache = { fetchedAt: 0, admins: new Map(), owner: null }
  return getCache()
}

export async function isAdmin(discordId) {
  const c = await getCache()
  return c.admins.has(discordId)
}

export async function isOwner(discordId) {
  const c = await getCache()
  return c.owner === discordId
}

export async function getOwnerId() {
  const c = await getCache()
  return c.owner
}

export async function listAdmins() {
  const c = await getCache()
  return [...c.admins.values()]
}

/** Permission tiers, in ascending order of required privilege. */
export const PERMISSION_TIERS = ['public', 'admin', 'owner']

/** Check that the given Discord user satisfies the required tier.
 *  Returns { ok: true } or { ok: false, reason: <string> }. */
export async function checkPermission(discordId, tier) {
  if (!PERMISSION_TIERS.includes(tier)) {
    return { ok: false, reason: `Unknown permission tier: ${tier}` }
  }
  if (tier === 'public') return { ok: true }
  if (tier === 'owner') {
    if (await isOwner(discordId)) return { ok: true }
    return { ok: false, reason: 'This command is restricted to the bot owner.' }
  }
  // tier === 'admin'
  if (await isAdmin(discordId)) return { ok: true }
  return { ok: false, reason: 'This command is restricted to admins.' }
}
