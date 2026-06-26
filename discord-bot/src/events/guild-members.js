/**
 * Guild member tracker - keeps `discord_presence` in sync with
 * halo.rip's actual Discord server membership.
 *
 * Why this exists: Discord's `presenceUpdate` event only fires when
 * a user's status CHANGES. A user who's been offline (or idle, or
 * online without status changes) since the bot started tracking
 * has no presence row, even though they're in the server. That
 * produces false positives for the /dashboard/widgets nag banner
 * ("you aren't in halo.rip Discord") and for the widget renderer
 * itself.
 *
 * Fix: on bot ready, fetch every member of halo.rip's guild and
 * upsert a presence row with their current status (or 'offline'
 * if Discord has nothing on them). After that the existing
 * presenceUpdate listener keeps everyone up-to-date. The
 * guildMemberAdd / guildMemberRemove listeners below pick up
 * join/leave events without restarting the bot.
 *
 * Guild selection: uses process.env.DISCORD_GUILD_ID if set,
 * otherwise the first (and only) guild the bot is in. We log a
 * warning if multiple guilds exist and DISCORD_GUILD_ID isn't set,
 * since picking the wrong one would seed the wrong server.
 */

import supabase from '../utils/supabase.js'

const BATCH_SIZE = 100  // upserts per Supabase request

// Discord "guild tag" (clan tag) - the short tag shown next to a user's
// name from their primary guild. discord.js 14.26 exposes it as
// user.primaryGuild. Only persist when the user is displaying it and a
// tag string exists. Mirrors extractClan() in presence-update.js.
function extractClan(user) {
  const pg = user?.primaryGuild
  if (!pg || pg.identityEnabled === false || !pg.tag) return null
  return {
    tag: pg.tag,
    badge: pg.badge ?? null,
    guild_id: pg.identityGuildId ?? null,
  }
}

function snapshotForMember(member) {
  const user = member.user
  if (!user?.id) return null
  const presence = member.presence
  return {
    user_id: user.id,
    status: presence?.status || 'offline',
    discord_user: {
      id: user.id,
      username: user.username,
      global_name: user.globalName ?? null,
      avatar: user.avatar,
      bot: !!user.bot,
      clan: extractClan(user),
    },
    // We don't snapshot activities here - those come from
    // presenceUpdate. The seed is just about "user exists in
    // the server".
    activities: presence?.activities
      ? presence.activities.map((a) => ({
          name: a.name,
          type: a.type,
          state: a.state ?? null,
          details: a.details ?? null,
        }))
      : [],
    spotify: null,
    updated_at: new Date().toISOString(),
  }
}

async function upsertBatch(rows) {
  if (rows.length === 0) return 0
  const { error } = await supabase
    .from('discord_presence')
    .upsert(rows, { onConflict: 'user_id' })
  if (error) {
    console.error('[guild-members] batch upsert failed:', error.message || error)
    return 0
  }
  return rows.length
}

function pickGuild(client) {
  const configuredId = process.env.DISCORD_GUILD_ID?.trim()
  if (configuredId) {
    const g = client.guilds.cache.get(configuredId)
    if (!g) {
      console.warn(`[guild-members] DISCORD_GUILD_ID=${configuredId} not found in bot's guild list`)
      return null
    }
    return g
  }
  const guilds = client.guilds.cache
  if (guilds.size === 1) return guilds.first()
  if (guilds.size > 1) {
    console.warn(`[guild-members] bot is in ${guilds.size} guilds and DISCORD_GUILD_ID isn't set; skipping seed to avoid picking wrong server`)
    return null
  }
  return null
}

async function seedAllMembers(guild) {
  const start = Date.now()
  console.log(`[guild-members] seeding presence rows for ${guild.name} (${guild.id})…`)

  let members
  try {
    members = await guild.members.fetch()
  } catch (err) {
    console.error('[guild-members] fetch failed:', err?.message || err)
    return
  }

  // Skip bots - they don't need presence rows since halo.rip widgets
  // can't be configured to point at bot users.
  const human = [...members.values()].filter((m) => !m.user.bot)

  // Build snapshot rows and upsert in batches to keep request sizes
  // manageable.
  const rows = human.map(snapshotForMember).filter(Boolean)
  let written = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    written += await upsertBatch(rows.slice(i, i + BATCH_SIZE))
  }

  const ms = Date.now() - start
  console.log(`[guild-members] ✅ seeded ${written}/${human.length} member${human.length === 1 ? '' : 's'} in ${ms}ms`)
}

export function registerGuildMemberTracker(client) {
  if (!client) return

  // Initial seed once ready event has fired. The listener is wired
  // up in index.js after `registerPresenceTracker` so we share the
  // same guild-already-loaded state.
  ;(async () => {
    try {
      const guild = pickGuild(client)
      if (!guild) {
        console.warn('[guild-members] no guild to seed; skipping')
        return
      }
      await seedAllMembers(guild)
    } catch (err) {
      console.error('[guild-members] seed crashed:', err?.message || err)
    }
  })()

  // Live updates - keep the table in sync as people join/leave.
  client.on('guildMemberAdd', async (member) => {
    try {
      const snap = snapshotForMember(member)
      if (!snap) return
      await upsertBatch([snap])
    } catch (err) {
      console.error('[guild-members] add handler crashed:', err?.message || err)
    }
  })

  client.on('guildMemberRemove', async (member) => {
    try {
      if (!member?.user?.id) return
      const { error } = await supabase
        .from('discord_presence')
        .delete()
        .eq('user_id', member.user.id)
      if (error) {
        console.error('[guild-members] remove failed:', error.message)
      }
    } catch (err) {
      console.error('[guild-members] remove handler crashed:', err?.message || err)
    }
  })

  console.log('[guild-members] ✅ listeners registered')
}
