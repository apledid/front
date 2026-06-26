import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import { ChannelType } from 'discord.js'
import supabase from '../utils/supabase.js'
import {
  statsEmbed,
  successEmbed,
  errorEmbed,
  logEmbed,
  BRAND_COLOR,
  WARN_COLOR,
} from '../utils/embeds.js'
import { sendLog } from '../utils/logger.js'
import { confirm } from '../framework/confirm.js'
import { checkPolicy } from '../framework/rate-limit.js'
import { rateLimitEmbed } from '../framework/embed-kit.js'
import { paginate } from '../framework/paginator.js'
import { formatAuditRow } from '../framework/audit.js'
import { TASKS, runTaskNow } from '../scheduled/index.js'

export const meta = { permission: 'admin', rateLimit: 'admin' }

export const data = new SlashCommandBuilder()
  .setName('staff')
  .setDescription('Staff-only system tools')
  .addSubcommand((sub) =>
    sub.setName('stats').setDescription('Platform statistics dashboard'))
  .addSubcommand((sub) =>
    sub
      .setName('cleanup')
      .setDescription('Delete unverified accounts older than 24 hours'))
  .addSubcommand((sub) =>
    sub
      .setName('broadcast')
      .setDescription('Post an announcement embed to a channel')
      .addStringOption((opt) => opt.setName('title').setDescription('Announcement title').setRequired(true))
      .addStringOption((opt) => opt.setName('message').setDescription('Announcement message').setRequired(true))
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Target channel (defaults to current)')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false)))
  .addSubcommand((sub) =>
    sub.setName('ping').setDescription('Bot latency / health check'))
  .addSubcommand((sub) =>
    sub.setName('audit-recent').setDescription('Show the most recent admin actions from the audit log'))
  .addSubcommand((sub) =>
    sub
      .setName('audit-by-executor')
      .setDescription('All audit log entries by a given admin')
      .addUserOption((opt) => opt.setName('admin').setDescription('Discord user').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('audit-by-target')
      .setDescription('All audit log entries targeting a halo.rip user')
      .addStringOption((opt) => opt.setName('username').setDescription('halo.rip username').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('audit-by-command')
      .setDescription('All audit log entries for a specific command')
      .addStringOption((opt) =>
        opt.setName('command').setDescription('Top-level command').setRequired(true).addChoices(
          { name: 'user', value: 'user' },
          { name: 'badge', value: 'badge' },
          { name: 'title', value: 'title' },
          { name: 'admin', value: 'admin' },
          { name: 'event', value: 'event' },
          { name: 'sessions', value: 'sessions' },
          { name: 'profile-tools', value: 'profile-tools' },
          { name: 'blacklist', value: 'blacklist' },
          { name: 'staff', value: 'staff' },
        )))
  .addSubcommand((sub) =>
    sub.setName('schedule-status').setDescription('Show when each scheduled task last ran'))
  .addSubcommand((sub) =>
    sub
      .setName('schedule-run-now')
      .setDescription('Run a scheduled task immediately (debug / one-off)')
      .addStringOption((opt) =>
        opt.setName('task').setDescription('Which task').setRequired(true).addChoices(
          // nightly_cleanup removed - the task is no longer registered
          // in scheduled/index.js. If you actually need to run it
          // manually, use /staff cleanup which deletes unverified
          // accounts without the scheduled-task ledger noise.
          { name: 'weekly_leaderboard', value: 'weekly_leaderboard' },
          { name: 'daily_stats',        value: 'daily_stats' },
        )))

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand()
  if (sub === 'ping') return ping(interaction)
  await interaction.deferReply()
  if (sub === 'stats')             return stats(interaction)
  if (sub === 'cleanup')           return cleanup(interaction)
  if (sub === 'broadcast')         return broadcast(interaction)
  if (sub === 'audit-recent')      return auditRecent(interaction)
  if (sub === 'audit-by-executor') return auditByExecutor(interaction)
  if (sub === 'audit-by-target')   return auditByTarget(interaction)
  if (sub === 'audit-by-command')  return auditByCommand(interaction)
  if (sub === 'schedule-status')   return scheduleStatus(interaction)
  if (sub === 'schedule-run-now')  return scheduleRunNow(interaction)
}

async function ping(interaction) {
  const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true })
  const latency = sent.createdTimestamp - interaction.createdTimestamp
  const wsLatency = interaction.client.ws.ping
  await interaction.editReply({
    content: '',
    embeds: [successEmbed(
      '🏓 Pong!',
      `**Round-trip:** ${latency}ms\n**WebSocket:** ${wsLatency}ms\n**Uptime:** ${Math.floor(process.uptime() / 60)}m`,
    )],
  })
}

async function stats(interaction) {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [
      totalUsersRes, premiumRes, verifiedRes, viewsRes,
      recentViewsRes, newUsersRes, bannedRes, discordRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).or('is_premium.eq.true,premium_active.eq.true'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('email_verified', true),
      supabase.from('profiles').select('view_count'),
      supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('last_viewed_at', oneDayAgo),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('banned', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).not('discord_id', 'is', null),
    ])

    const totalViews = (viewsRes.data || []).reduce((sum, p) => sum + (p.view_count || 0), 0)
    return interaction.editReply({
      embeds: [statsEmbed({
        totalUsers:    totalUsersRes.count  || 0,
        premiumUsers:  premiumRes.count     || 0,
        verifiedUsers: verifiedRes.count    || 0,
        totalViews,
        recentViews:   recentViewsRes.count || 0,
        newUsers24h:   newUsersRes.count    || 0,
        bannedUsers:   bannedRes.count      || 0,
        discordLinked: discordRes.count     || 0,
      })],
    })
  } catch (err) {
    console.error('[/staff stats]', err)
    return interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to fetch platform statistics.')] })
  }
}

async function cleanup(interaction) {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: noEmail } = await supabase
      .from('profiles')
      .select('id, username')
      .is('email', null)
      .lt('created_at', cutoff)

    const { data: unverified } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('email_verified', false)
      .lt('created_at', cutoff)

    const seen = new Set()
    const toDelete = [...(noEmail || []), ...(unverified || [])].filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

    if (!toDelete.length) {
      return interaction.editReply({ embeds: [successEmbed('Cleanup', 'No unverified accounts to delete.')] })
    }

    const ids = toDelete.map((p) => p.id)
    const usernames = toDelete.map((p) => p.username || 'unknown')

    await Promise.all([
      supabase.from('social_links').delete().in('user_id', ids),
      supabase.from('custom_buttons').delete().in('user_id', ids),
      supabase.from('profile_badges').delete().in('user_id', ids),
      supabase.from('profile_badge_loadout').delete().in('user_id', ids),
      supabase.from('profile_title_loadout').delete().in('user_id', ids),
      supabase.from('music_history').delete().in('user_id', ids),
      supabase.from('page_views').delete().in('profile_id', ids),
      supabase.from('link_clicks').delete().in('user_id', ids),
      supabase.from('inbox_messages').delete().in('user_id', ids),
    ])

    await supabase.from('profiles').delete().in('id', ids)

    await sendLog(logEmbed(
      'Unverified Accounts Cleaned Up',
      `**Deleted:** ${toDelete.length} accounts\n**By:** ${interaction.user.tag}\n**Usernames:** ${usernames.slice(0, 20).join(', ')}${usernames.length > 20 ? '...' : ''}`,
      WARN_COLOR,
    ))

    return interaction.editReply({
      embeds: [successEmbed(
        'Cleanup Complete',
        `Deleted **${toDelete.length}** unverified accounts.\n\n**Usernames:**\n${usernames.map((u) => `\`${u}\``).join(', ')}`,
      )],
    })
  } catch (err) {
    console.error('[/staff cleanup]', err)
    return interaction.editReply({ embeds: [errorEmbed('Error', `Failed to cleanup: ${err.message}`)] })
  }
}

async function broadcast(interaction) {
  const rl = await checkPolicy('destructive', interaction.user.id)
  if (!rl.allowed) return interaction.editReply({ embeds: [rateLimitEmbed(rl.retryAfter)] })

  const title = interaction.options.getString('title')
  const message = interaction.options.getString('message')
  const target = interaction.options.getChannel('channel') || interaction.channel

  // Confirm with the exact preview embed that will be posted. Once an
  // announcement goes out it can't be quietly recalled - confirming up
  // front prevents typos in front of the whole community.
  const previewBody = `**Will post to <#${target.id}>:**\n\n**${title}**\n${message}`
  const ok = await confirm(interaction, {
    title: 'Send broadcast?',
    body: previewBody.slice(0, 4000),
    confirmLabel: 'Send',
    danger: false,
    timeoutMs: 30_000,
  })
  if (!ok) return

  try {
    await target.send({ embeds: [successEmbed(title, message)] })
    await sendLog(logEmbed('📢 Broadcast Sent', `**Channel:** <#${target.id}>\n**Title:** ${title}\n**By:** ${interaction.user.tag}`))
    return interaction.editReply({ embeds: [successEmbed('Done', `Announcement posted in <#${target.id}>`)] })
  } catch (err) {
    return interaction.editReply({ embeds: [errorEmbed('Failed', `Could not post to <#${target.id}>: ${err.message}`)] })
  }
}

// ── audit log queries ────────────────────────────────────────────────────────
// Read against discord_audit_log. Every admin command writes a row here
// via the framework's auditWrap middleware (Commit 1). target_username
// is null for now - we filter by-target via the captured args.username
// in the JSONB `details` column.

const AUDIT_PAGE_SIZE = 5

function renderAuditPage(pageItems, info, title) {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(title)
    .addFields(pageItems.map(formatAuditRow))
    .setFooter({ text: `Page ${info.page} of ${info.totalPages} · ${info.total} entries` })
    .setTimestamp()
}

async function auditRecent(interaction) {
  const { data: rows, error } = await supabase
    .from('discord_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })
  if (!rows?.length) return interaction.editReply({ embeds: [errorEmbed('Empty', 'No audit log entries yet.')] })
  await paginate(interaction, rows, (items, info) =>
    renderAuditPage(items, info, '📜 Audit Log - Recent'),
    { pageSize: AUDIT_PAGE_SIZE })
}

async function auditByExecutor(interaction) {
  const user = interaction.options.getUser('admin')
  const { data: rows, error } = await supabase
    .from('discord_audit_log')
    .select('*')
    .eq('executor_discord_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })
  if (!rows?.length) {
    return interaction.editReply({ embeds: [errorEmbed('Empty', `No audit entries for ${user.tag}.`)] })
  }
  await paginate(interaction, rows, (items, info) =>
    renderAuditPage(items, info, `📜 Audit Log - by ${user.tag}`),
    { pageSize: AUDIT_PAGE_SIZE })
}

async function auditByTarget(interaction) {
  const raw = interaction.options.getString('username').toLowerCase().trim()
  // PostgREST .or() takes a string that it parses for `,` (clause
  // separator) and `)` (group terminator). User input gets directly
  // interpolated, so a value like
  //   `foo),executor_discord_id.eq.SOMEID`
  // would extend the OR clause to pull audit rows for a totally
  // different executor. Reject anything that isn't a halo.rip
  // username before it ever hits the filter string.
  if (!/^[a-z0-9_]{1,32}$/.test(raw)) {
    return interaction.editReply({
      embeds: [errorEmbed('Invalid', 'Username must be 1-32 chars of a-z, 0-9, or underscore.')],
    })
  }
  const username = raw
  const { data: rows, error } = await supabase
    .from('discord_audit_log')
    .select('*')
    .or(`target_username.eq.${username},details->args->>username.eq.${username}`)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })
  if (!rows?.length) {
    return interaction.editReply({ embeds: [errorEmbed('Empty', `No audit entries targeting \`${username}\`.`)] })
  }
  await paginate(interaction, rows, (items, info) =>
    renderAuditPage(items, info, `📜 Audit Log - targeting @${username}`),
    { pageSize: AUDIT_PAGE_SIZE })
}

async function auditByCommand(interaction) {
  const command = interaction.options.getString('command')
  const { data: rows, error } = await supabase
    .from('discord_audit_log')
    .select('*')
    .eq('command', command)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })
  if (!rows?.length) {
    return interaction.editReply({ embeds: [errorEmbed('Empty', `No audit entries for \`/${command}\`.`)] })
  }
  await paginate(interaction, rows, (items, info) =>
    renderAuditPage(items, info, `📜 Audit Log - /${command}`),
    { pageSize: AUDIT_PAGE_SIZE })
}

// ── scheduled tasks ──────────────────────────────────────────────────────────

async function scheduleStatus(interaction) {
  const { data: rows, error } = await supabase
    .from('bot_scheduled_tasks')
    .select('task_key, last_run_at, last_run_status, last_run_details, last_error')
    .order('task_key', { ascending: true })
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  const taskRows = (rows || []).map((r) => {
    const meta = TASKS[r.task_key]
    const last = r.last_run_at
      ? `<t:${Math.floor(new Date(r.last_run_at).getTime() / 1000)}:R>`
      : 'never'
    const statusIcon = r.last_run_status === 'success'
      ? '✅'
      : r.last_run_status === 'skipped'
        ? '⏭️'
        : r.last_run_status === 'error'
          ? '❌'
          : '⏳'
    const detailText = r.last_run_details && Object.keys(r.last_run_details).length > 0
      ? Object.entries(r.last_run_details).slice(0, 4).map(([k, v]) =>
          `\`${k}\`: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' · ')
      : '(no details)'
    const errLine = r.last_error ? `\n**Error:** ${r.last_error}` : ''
    return {
      name: `${statusIcon} ${r.task_key}`,
      value:
        `**Schedule:** ${meta?.cronExpr || 'unregistered'} UTC\n` +
        `**Last run:** ${last} (${r.last_run_status || 'never'})\n` +
        `**Details:** ${detailText}${errLine}`,
      inline: false,
    }
  })

  return interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('⏱️ Scheduled Tasks')
      .setDescription('Each task is also runnable on demand via `/staff schedule-run-now`.')
      .addFields(taskRows)
      .setTimestamp()],
  })
}

async function scheduleRunNow(interaction) {
  const taskKey = interaction.options.getString('task')
  if (!TASKS[taskKey]) {
    return interaction.editReply({ embeds: [errorEmbed('Unknown task', `No task named \`${taskKey}\`.`)] })
  }
  try {
    const result = await runTaskNow(taskKey, interaction.client)
    return interaction.editReply({
      embeds: [successEmbed(
        `Ran ${taskKey}`,
        `Returned:\n\`\`\`\n${JSON.stringify(result, null, 2).slice(0, 1800)}\n\`\`\``,
      )],
    })
  } catch (err) {
    return interaction.editReply({ embeds: [errorEmbed('Error', `${taskKey} threw: ${err.message}`)] })
  }
}

