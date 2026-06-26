import { Client, GatewayIntentBits, AuditLogEvent, PermissionFlagsBits } from 'discord.js'
import { setLogChannel, sendLog } from './utils/logger.js'
import { logEmbed, BRAND_COLOR, ERROR_COLOR } from './utils/embeds.js'
import { BANNED_USER_IDS } from './utils/guard.js'
import { CommandHandler } from './framework/command-handler.js'
import { getOwnerId, invalidateAdminCache } from './framework/permissions.js'
import { registerSchedules } from './scheduled/index.js'
import { registerPresenceTracker } from './events/presence-update.js'
import { registerGuildMemberTracker } from './events/guild-members.js'
import { handleMigrateButton, isMigrateButtonId } from './events/migrate-buttons.js'

// Import the 9 consolidated admin command groups (Commit 2) plus the 5
// public commands added in Commit 5 of the bot rewrite.
import * as user from './commands/user.js'
import * as badge from './commands/badge.js'
import * as title from './commands/title.js'
import * as admin from './commands/admin.js'
import * as event from './commands/event.js'
import * as sessions from './commands/sessions.js'
import * as profileTools from './commands/profile-tools.js'
import * as blacklist from './commands/blacklist.js'
import * as staff from './commands/staff.js'
// Public commands
import * as profileCmd from './commands/profile.js'
import * as templateCmd from './commands/template.js'
import * as redeem from './commands/redeem.js'
import * as halo from './commands/halo.js'
import * as help from './commands/help.js'
import * as migratePresence from './commands/migrate-presence.js'

// ── Pre-flight env check ──────────────────────────────────────────────────────
const requiredEnv = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = requiredEnv.filter(k => !process.env[k])
if (missing.length > 0) {
  console.error(`[Bot] ❌ Missing required env vars: ${missing.join(', ')}`)
  process.exit(1)
}
console.log(`[Bot] ✅ All required env vars present (Node ${process.version})`)

// ── Global error handlers ─────────────────────────────────────────────────────
process.on('unhandledRejection', (err) => console.error('[Bot] Unhandled rejection:', err))
process.on('uncaughtException',  (err) => console.error('[Bot] Uncaught exception:', err))

// ── Build the command handler with the new middleware pipeline ────────────────
const handler = new CommandHandler()
const allCommands = [
  // admin groups
  user, badge, title, admin, event, sessions, profileTools, blacklist, staff,
  migratePresence,
  // public commands
  profileCmd, templateCmd, redeem, halo, help,
]
for (const cmd of allCommands) handler.register(cmd)

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    // PRIVILEGED - required for presenceUpdate events. Must also
    // be enabled in the Discord Developer Portal under the bot's
    // settings ("Presence Intent" toggle). Without it the bot
    // boots fine but the in-house Lanyard replacement gets no
    // updates and every widget shows as offline.
    GatewayIntentBits.GuildPresences,
  ],
})

// ── Interaction handler ───────────────────────────────────────────────────────
// Slash commands go through the middleware-driven CommandHandler.
// Button + select-menu interactions are dispatched separately so
// long-lived UIs (like the presence-migration DM with its Yes/No
// confirm flow) can register handlers by customId prefix.
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    return handler.dispatch(interaction)
  }
  if (interaction.isButton()) {
    if (isMigrateButtonId(interaction.customId)) {
      return handleMigrateButton(interaction)
    }
  }
})

// ── Ready ─────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`[Bot] ✅ Logged in as ${client.user.tag}`)
  console.log(`[Bot] Serving ${client.guilds.cache.size} guild(s)`)
  console.log(`[Bot] Commands: ${allCommands.map(c => c.data.name).join(', ')}`)
  // Verifying that the ban list reached production after a redeploy. If
  // this line is missing from Railway logs the bot is running stale code.
  console.log(`[Bot] BANNED_USER_IDS loaded (${BANNED_USER_IDS.size}): ${[...BANNED_USER_IDS].join(', ') || '(none)'}`)

  // Warm the admin cache so the first command has zero extra latency.
  await invalidateAdminCache().catch((err) => console.error('[Bot] Admin cache warm failed:', err.message))

  if (process.env.LOG_CHANNEL_ID) {
    try {
      const channel = await client.channels.fetch(process.env.LOG_CHANNEL_ID)
      if (channel) {
        setLogChannel(channel)
        console.log(`[Bot] ✅ Log channel set: #${channel.name}`)
        await sendLog(logEmbed(
          '🟢 Bot Online',
          `**Bot:** ${client.user.tag}\n**Commands:** ${allCommands.length}\n**Guilds:** ${client.guilds.cache.size}`,
          BRAND_COLOR,
        ))
      }
    } catch (err) {
      console.error('[Bot] ❌ Could not set log channel:', err.message)
    }
  } else {
    console.warn('[Bot] ⚠️  LOG_CHANNEL_ID not set - Discord logging disabled')
  }

  await handler.registerSlashCommands({
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID,
  })

  // Register the cron tasks (nightly cleanup, weekly leaderboard, daily stats).
  // Each writes a row to bot_scheduled_tasks so /staff schedule status can
  // show when it last ran. Channel-posting tasks no-op if their env var
  // (LEADERBOARD_CHANNEL_ID / STAFF_CHANNEL_ID) isn't configured.
  registerSchedules(client)

  // Register the in-house Lanyard replacement - presence tracking
  // for halo.rip's main Discord server. The widget renderer reads
  // from `public.discord_presence` via /api/discord-presence/[id].
  registerPresenceTracker(client)

  // Seed discord_presence with every current member of halo.rip's
  // Discord server so users who haven't fired a presenceUpdate
  // since the bot started still appear as "tracked". Also wires
  // guildMemberAdd / guildMemberRemove listeners to keep the
  // table live as people join / leave.
  registerGuildMemberTracker(client)

  client.user.setActivity('halo.rip', { type: 3 })
})

// ── Deleted message watcher ───────────────────────────────────────────────────
// Owner is resolved at startup from the bot_admins table (is_owner=true).
// Falls back to BOT_OWNER_ID env or the legacy hardcoded ID via permissions.js.
client.on('messageDelete', async (message) => {
  if (message.author?.id !== client.user?.id) return
  const channelMention = `<#${message.channelId}>`

  let content = message.content || ''
  if (!content && message.embeds.length > 0) {
    const embed = message.embeds[0]
    const parts = []
    if (embed.title) parts.push(`**${embed.title}**`)
    if (embed.description) parts.push(embed.description)
    if (embed.fields?.length) {
      for (const field of embed.fields) parts.push(`**${field.name}:** ${field.value}`)
    }
    content = parts.join('\n') || '[empty embed]'
  }
  if (!content) content = '[no content]'

  let deleter = 'Unknown'
  try {
    if (message.guild) {
      await new Promise((r) => setTimeout(r, 1500))
      const logs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 5 })
      const entry = logs.entries.find((e) =>
        e.target?.id === client.user.id &&
        e.extra?.channel?.id === message.channelId &&
        Date.now() - e.createdTimestamp < 10_000,
      )
      if (entry?.executor) deleter = `${entry.executor.username} (${entry.executor.id})`
    }
  } catch (err) {
    console.error('[messageDelete] Audit log error:', err.message)
  }

  try {
    const ownerId = await getOwnerId()
    if (!ownerId) {
      console.warn('[messageDelete] No owner configured - skipping DM')
      return
    }
    const owner = await client.users.fetch(ownerId)
    await owner.send({
      embeds: [{
        title: '🗑️ Bot Message Deleted',
        color: 0xff4444,
        fields: [
          { name: 'Content', value: content.slice(0, 1024), inline: false },
          { name: 'Channel', value: channelMention, inline: true },
          { name: 'Deleted by', value: deleter, inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'halo.rip bot' },
      }],
    })
  } catch (err) {
    console.error('[messageDelete] Failed to DM owner:', err.message)
  }
})

// ── Leak detection patterns ───────────────────────────────────────────────────
const LEAK_PATTERNS = [
  { regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, label: 'Email address' },
  { regex: /sb_(?:publishable|secret)_[A-Za-z0-9_\-]{20,}/g, label: 'Supabase API key' },
  { regex: /eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}/g, label: 'JWT token' },
  { regex: /(?:sk_live|sk_test|pk_live|pk_test|rk_live)_[A-Za-z0-9]{20,}/g, label: 'Stripe API key' },
  { regex: /re_[A-Za-z0-9]{20,}/g, label: 'Resend API key' },
  { regex: /postgres(?:ql)?:\/\/[^\s]+/gi, label: 'Postgres connection string' },
  { regex: /password[_\s]*hash/gi, label: 'Password hash reference' },
  { regex: /"email"\s*:\s*"[^"]+@[^"]+"/g, label: 'User data dump (email in JSON)' },
]

function detectLeak(content) {
  if (!content) return null
  for (const { regex, label } of LEAK_PATTERNS) {
    regex.lastIndex = 0
    if (regex.test(content)) return label
  }
  return null
}

// ── Auto-ban: .txt files or detected leaks ───────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author?.bot) return
  if (!message.guild) return

  // Staff/owner are exempt - they post legit exports (e.g. the username-
  // cleanup list). Without this the anti-leak rule deletes their message and
  // tries to ban them (the owner ban silently fails, the message still dies).
  const perms = message.member?.permissions
  if (
    message.author.id === message.guild.ownerId ||
    perms?.has(PermissionFlagsBits.Administrator) ||
    perms?.has(PermissionFlagsBits.ManageGuild)
  ) return

  const hasTxt   = message.attachments.some((a) => a.name?.toLowerCase().endsWith('.txt'))
  const leakType = detectLeak(message.content)
  if (!hasTxt && !leakType) return

  const reason = hasTxt ? 'Sent a .txt file' : `Leak detected: ${leakType}`

  try { await message.delete() } catch { /* ignore */ }

  try {
    const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null)
    if (member) {
      await member.ban({ reason, deleteMessageSeconds: 86400 })
      await sendLog(logEmbed(
        '🔨 Auto-Ban',
        `**User:** ${message.author.tag} (${message.author.id})\n**Reason:** ${reason}\n**Channel:** <#${message.channelId}>`,
        ERROR_COLOR,
      ))
    }
  } catch (err) {
    console.error('[AutoBan] Failed to ban:', err.message)
  }
})

// ── Login ─────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error('[Bot] ❌ Login failed:', err?.message || err)
  process.exit(1)
})

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`[Bot] ${signal} received - shutting down`)
  await sendLog(logEmbed('🔴 Bot Offline', `Received ${signal}. Shutting down.`, ERROR_COLOR)).catch(() => {})
  client.destroy()
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT',  () => void shutdown('SIGINT'))

// ── Heartbeat ─────────────────────────────────────────────────────────────────
setInterval(() => {
  const uptime = Math.floor(process.uptime() / 60)
  console.log(`[Bot] ♥ uptime ${uptime}m | guilds ${client.guilds.cache.size} | ws ping ${client.ws.ping}ms`)
}, 10 * 60 * 1000)
