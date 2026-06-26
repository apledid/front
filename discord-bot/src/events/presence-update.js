/**
 * Discord presence tracker - the in-house Lanyard replacement.
 *
 * Subscribes to the discord.js `presenceUpdate` event and upserts
 * the latest state into `public.discord_presence`. The shape we
 * persist intentionally mirrors Lanyard's response so the existing
 * Discord widget renderer doesn't need to change.
 *
 * Requires the GuildPresences privileged intent in the Developer
 * Portal - without it Discord won't deliver these events. Pair with
 * GuildMembers so we can also fetch users who aren't yet in the
 * presence cache.
 *
 * Throttling: presenceUpdate fires very frequently (every typing,
 * every activity tick on some games). We dedupe by hashing the
 * relevant fields and skipping the write if nothing changed since
 * the last write for that user.
 */

import supabase from '../utils/supabase.js'

// In-memory hash of the last write per user - keeps us from spamming
// Supabase when Discord fires multiple identical presenceUpdates in a
// row (which happens a lot, especially for users with active
// games). Map<userId, hashString>.
const lastWriteHash = new Map()

// Cap the in-memory map so a long-running bot doesn't leak. Discord
// has tens of thousands of users - we shouldn't track everyone forever
// in RAM. Drop oldest entries past this size.
const MAX_HASH_CACHE = 10_000

function pruneCache() {
  if (lastWriteHash.size <= MAX_HASH_CACHE) return
  // Map preserves insertion order - drop the first N entries.
  const drop = lastWriteHash.size - MAX_HASH_CACHE
  let i = 0
  for (const key of lastWriteHash.keys()) {
    if (i++ >= drop) break
    lastWriteHash.delete(key)
  }
}

/**
 * Extract a Spotify activity (type 2 = LISTENING) into Lanyard's
 * shorthand object. Returns null when the user isn't listening.
 */
function extractSpotify(activities) {
  const sp = activities.find((a) => a.type === 2 && a.name === 'Spotify')
  if (!sp) return null
  return {
    song: sp.details ?? null,
    artist: sp.state ?? null,
    album: sp.assets?.largeText ?? null,
    album_art_url: sp.assets?.largeImage?.startsWith('spotify:')
      ? `https://i.scdn.co/image/${sp.assets.largeImage.replace('spotify:', '')}`
      : null,
    track_id: sp.syncId ?? null,
    timestamps: sp.timestamps
      ? { start: sp.timestamps.start ?? null, end: sp.timestamps.end ?? null }
      : null,
  }
}

/**
 * Convert a discord.js Activity to the Lanyard activity shape the
 * widget renderer expects. Strip the methods on the discord.js class
 * - Supabase only wants serialisable data.
 */
function serializeActivity(a) {
  return {
    name: a.name,
    type: a.type,
    state: a.state ?? null,
    details: a.details ?? null,
    emoji: a.emoji ? { name: a.emoji.name, id: a.emoji.id ?? null, animated: !!a.emoji.animated } : null,
    application_id: a.applicationId ?? null,
    timestamps: a.timestamps
      ? {
          start: a.timestamps.start ? new Date(a.timestamps.start).getTime() : null,
          end: a.timestamps.end ? new Date(a.timestamps.end).getTime() : null,
        }
      : null,
    assets: a.assets
      ? {
          largeImage: a.assets.largeImage ?? null,
          largeText: a.assets.largeText ?? null,
          smallImage: a.assets.smallImage ?? null,
          smallText: a.assets.smallText ?? null,
        }
      : null,
    sync_id: a.syncId ?? null,
    session_id: a.sessionId ?? null,
    flags: a.flags?.bitfield ?? 0,
    created_at: a.createdTimestamp ?? null,
  }
}

/**
 * Build the snapshot we persist for one user. Returns null when the
 * user has no User attached (some presenceUpdates from old caches
 * lack one - we just skip).
 */
function buildSnapshot(presence) {
  const user = presence?.user
  if (!user?.id) return null
  const activities = (presence.activities || []).map(serializeActivity)

  // user.flags is a UserFlagsBitField; .bitfield gives the raw int.
  // Encodes badge bits like HypeSquad, Bug Hunter, Active Developer,
  // Early Supporter, etc. The widget renderer maps individual bits
  // to CDN badge icons. Nitro / boosting badges aren't in this
  // bitfield (premium_type lives on the OAuth user object) - we
  // detect Nitro heuristically client-side via the animated avatar
  // hash prefix instead, since fetching premium_type for every
  // presenceUpdate would cost an extra REST call.
  const flags = typeof user.flags?.bitfield === 'number'
    ? user.flags.bitfield
    : (typeof user.flags === 'number' ? user.flags : 0)

  return {
    user_id: user.id,
    status: presence.status || 'offline',
    discord_user: {
      id: user.id,
      username: user.username,
      global_name: user.globalName ?? null,
      avatar: user.avatar,  // raw hash; the renderer builds the CDN URL
      bot: !!user.bot,
      flags,
      clan: extractClan(user),
    },
    activities,
    spotify: extractSpotify(activities),
    updated_at: new Date().toISOString(),
  }
}

/**
 * Extract the Discord "guild tag" (a.k.a. clan tag) - the short 1-4 char
 * tag a user displays next to their name from their primary guild, e.g.
 * "EXP". discord.js 14.26 exposes it as user.primaryGuild = {
 * identityGuildId, identityEnabled, tag, badge }. We only persist it when
 * the user is actually displaying it (identityEnabled !== false) and a tag
 * string exists. The renderer turns { guild_id, badge } into the CDN URL
 * https://cdn.discordapp.com/guild-tag-badges/<guild_id>/<badge>.png.
 */
function extractClan(user) {
  const pg = user?.primaryGuild
  if (!pg || pg.identityEnabled === false || !pg.tag) return null
  return {
    tag: pg.tag,
    badge: pg.badge ?? null,
    guild_id: pg.identityGuildId ?? null,
  }
}

/**
 * Stable hash of the snapshot fields we care about, used to skip
 * writes when nothing meaningful changed. Activity timestamps that
 * tick every second don't count as meaningful - we strip them.
 */
function snapshotHash(snap) {
  const stripped = {
    s: snap.status,
    u: snap.discord_user.username,
    g: snap.discord_user.global_name,
    a: snap.discord_user.avatar,
    f: snap.discord_user.flags ?? 0,
    c: snap.discord_user.clan ? `${snap.discord_user.clan.tag}:${snap.discord_user.clan.badge ?? ''}` : null,
    acts: snap.activities.map((a) => ({
      n: a.name,
      t: a.type,
      st: a.state,
      d: a.details,
      e: a.emoji?.name ?? null,
      // Strip created_at + timestamps; they tick constantly.
    })),
    sp: snap.spotify?.track_id ?? null,
  }
  return JSON.stringify(stripped)
}

export function registerPresenceTracker(client) {
  if (!client) return
  client.on('presenceUpdate', async (_oldPresence, newPresence) => {
    try {
      const snap = buildSnapshot(newPresence)
      if (!snap) return

      // Skip the DB write when nothing the widget cares about has
      // changed since the last write.
      const hash = snapshotHash(snap)
      if (lastWriteHash.get(snap.user_id) === hash) return
      lastWriteHash.set(snap.user_id, hash)
      pruneCache()

      const { error } = await supabase
        .from('discord_presence')
        .upsert(snap, { onConflict: 'user_id' })
      if (error) {
        console.error('[presenceUpdate] upsert error:', error.message || error)
      }
    } catch (err) {
      console.error('[presenceUpdate] handler crashed:', err?.message || err)
    }
  })
  console.log('[presence] ✅ presenceUpdate listener registered')
}
