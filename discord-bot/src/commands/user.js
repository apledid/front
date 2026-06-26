import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import supabase from '../utils/supabase.js'
import {
  profileEmbed,
  userInfoEmbed,
  successEmbed,
  errorEmbed,
  logEmbed,
  BRAND_COLOR,
  WARN_COLOR,
  SUCCESS_COLOR,
  ERROR_COLOR,
} from '../utils/embeds.js'
import { sendLog } from '../utils/logger.js'
import { confirm } from '../framework/confirm.js'
import { paginate } from '../framework/paginator.js'
import { checkPolicy } from '../framework/rate-limit.js'
import { rateLimitEmbed } from '../framework/embed-kit.js'

export const meta = { permission: 'admin', rateLimit: 'admin' }

export const data = new SlashCommandBuilder()
  .setName('user')
  .setDescription('User management commands')
  .addSubcommand((sub) =>
    sub
      .setName('lookup')
      .setDescription('Public profile lookup (links + clicks)')
      .addStringOption((opt) => opt.setName('username').setDescription('Username').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('info')
      .setDescription('Full admin-level user info')
      .addStringOption((opt) => opt.setName('username').setDescription('Username').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('search')
      .setDescription('Search profiles by username or display name')
      .addStringOption((opt) => opt.setName('query').setDescription('Search query').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('recent')
      .setDescription('View recent signups / views / bans')
      .addStringOption((opt) =>
        opt.setName('type').setDescription('What to view').setRequired(true).addChoices(
          { name: 'Signups', value: 'signups' },
          { name: 'Views',   value: 'views' },
          { name: 'Bans',    value: 'bans' },
        ))
      .addIntegerOption((opt) => opt.setName('count').setDescription('Number of entries (default 10)').setRequired(false)))
  .addSubcommand((sub) =>
    sub
      .setName('ban')
      .setDescription('Ban a user (blocks all features)')
      .addStringOption((opt) => opt.setName('username').setDescription('Username').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Ban reason').setRequired(false)))
  .addSubcommand((sub) =>
    sub
      .setName('unban')
      .setDescription('Unban a user')
      .addStringOption((opt) => opt.setName('username').setDescription('Username').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('warn')
      .setDescription('Issue a warning to a user')
      .addStringOption((opt) => opt.setName('username').setDescription('Username').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Warning reason').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('delete')
      .setDescription('Permanently delete a user account (irreversible) - confirm via button')
      .addStringOption((opt) => opt.setName('username').setDescription('Username').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription("Override a user's profile field")
      .addStringOption((opt) => opt.setName('username').setDescription('Username').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('field').setDescription('Which field').setRequired(true).addChoices(
          { name: 'bio',          value: 'bio' },
          { name: 'display_name', value: 'display_name' },
          { name: 'avatar_url',   value: 'avatar_url' },
          { name: 'username',     value: 'username' },
        ))
      .addStringOption((opt) => opt.setName('value').setDescription('New value (blank to clear)').setRequired(false)))
  .addSubcommand((sub) =>
    sub
      .setName('message')
      .setDescription('Send a staff inbox message to a user')
      .addStringOption((opt) => opt.setName('username').setDescription('Target username').setRequired(true))
      .addStringOption((opt) => opt.setName('body').setDescription('Message body').setRequired(true))
      .addStringOption((opt) => opt.setName('subject').setDescription('Subject line').setRequired(false)))
  .addSubcommand((sub) =>
    sub
      .setName('resetpassword')
      .setDescription("Force-reset a user's password (logs them out)")
      .addStringOption((opt) => opt.setName('username').setDescription('Username').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('premium')
      .setDescription('Grant or revoke premium for a user')
      .addStringOption((opt) => opt.setName('username').setDescription('Username').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('action').setDescription('What to do').setRequired(true).addChoices(
          { name: 'Grant (monthly)',  value: 'grant-monthly' },
          { name: 'Grant (lifetime)', value: 'grant-lifetime' },
          { name: 'Revoke',           value: 'revoke' },
        )))
  .addSubcommand((sub) =>
    sub
      .setName('site-admin')
      .setDescription("Toggle a user's website admin (profiles.is_admin)")
      .addStringOption((opt) => opt.setName('username').setDescription('Username').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('action').setDescription('Grant or revoke').setRequired(true).addChoices(
          { name: 'Grant',  value: 'grant' },
          { name: 'Revoke', value: 'revoke' },
        )))
  .addSubcommand((sub) =>
    sub
      .setName('magic-login')
      .setDescription('Issue a one-time recovery link for a user who lost email + Discord-OAuth access')
      .addStringOption((opt) => opt.setName('username').setDescription('Target username').setRequired(true)))

export async function execute(interaction) {
  // magic-login replies ephemerally because the token is a secret.
  // Every other subcommand gets the normal public reply.
  const sub = interaction.options.getSubcommand()
  if (sub === 'magic-login') {
    await interaction.deferReply({ ephemeral: true })
  } else {
    await interaction.deferReply()
  }
  switch (sub) {
    case 'lookup':        return userLookup(interaction)
    case 'info':          return userInfo(interaction)
    case 'search':        return userSearch(interaction)
    case 'recent':        return userRecent(interaction)
    case 'ban':           return userBan(interaction)
    case 'unban':         return userUnban(interaction)
    case 'warn':          return userWarn(interaction)
    case 'delete':        return userDelete(interaction)
    case 'edit':          return userEdit(interaction)
    case 'message':       return userMessage(interaction)
    case 'resetpassword': return userResetPassword(interaction)
    case 'premium':       return userPremium(interaction)
    case 'site-admin':    return userSiteAdmin(interaction)
    case 'magic-login':   return userMagicLogin(interaction)
  }
}

async function resolveProfile(interaction, username, selectCols = 'id, username') {
  const { data, error } = await supabase
    .from('profiles').select(selectCols).eq('username', username).maybeSingle()
  if (error || !data) {
    await interaction.editReply({ embeds: [errorEmbed('Not Found', `No user \`${username}\``)] })
    return null
  }
  return data
}

async function userLookup(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, view_count, is_premium, premium_active, premium_type, banned, ban_reason, uid, created_at, email_verified, discord_id')
    .eq('username', username)
    .maybeSingle()
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', `Database error: ${error.message}`)] })
  if (!profile) return interaction.editReply({ embeds: [errorEmbed('Not Found', `No profile for \`${username}\``)] })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [linksRes, clicksRes] = await Promise.all([
    supabase.from('social_links').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
    supabase.from('link_clicks').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).gte('clicked_at', thirtyDaysAgo),
  ])
  return interaction.editReply({
    embeds: [profileEmbed(profile, { links: linksRes.count ?? 0, clicks: clicksRes.count ?? 0 })],
  })
}

async function userInfo(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, email, email_verified, uid, view_count, is_premium, premium_active, premium_type, premium_activated_at, banned, ban_reason, banned_at, discord_id, created_at, session_invalidated_at, warnings')
    .eq('username', username)
    .maybeSingle()
  if (error || !profile) return interaction.editReply({ embeds: [errorEmbed('Not Found', `No profile for \`${username}\``)] })

  const now = new Date().toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [sessionRes, linksRes, clicksRes] = await Promise.all([
    supabase.from('sessions').select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id).is('revoked_at', null).gt('expires_at', now),
    supabase.from('social_links').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
    supabase.from('link_clicks').select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id).gte('clicked_at', thirtyDaysAgo),
  ])

  return interaction.editReply({
    embeds: [userInfoEmbed(profile, {
      sessions: sessionRes.count ?? 0,
      links: linksRes.count ?? 0,
      clicks: clicksRes.count ?? 0,
    })],
  })
}

async function userSearch(interaction) {
  const raw = interaction.options.getString('query')
  // PostgREST .or() filter injection: raw user input was being
  // interpolated into the filter string, and `,` is the clause
  // separator and `)` closes groups. Restrict to safe search
  // chars (letters, digits, underscore, hyphen, space) and cap
  // length so an admin can't pivot the query to leak admin-only
  // columns from another table via crafted .or() clauses.
  const query = String(raw || '').replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 64).trim()
  if (!query) {
    return interaction.editReply({
      embeds: [errorEmbed('Invalid', 'Search must contain letters, digits, underscores, hyphens, or spaces.')],
    })
  }
  // Cap at 50 results so the paginator stays responsive on broad queries.
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('username, display_name, view_count, is_premium, premium_active, banned')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .order('view_count', { ascending: false })
    .limit(50)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to search profiles.')] })
  if (!profiles?.length) return interaction.editReply({ embeds: [errorEmbed('No Results', `No profiles matching \`${query}\``)] })

  await paginate(interaction, profiles, (pageItems, info) => {
    const start = (info.page - 1) * info.pageSize
    const lines = pageItems.map((p, i) => {
      const flags = [(p.is_premium || p.premium_active) ? '⭐' : '', p.banned ? '⛔' : ''].filter(Boolean).join(' ')
      return `\`${start + i + 1}.\` [**${p.username}**](https://halo.rip/${p.username}) ${flags} - ${(p.view_count || 0).toLocaleString()} views`
    })
    return new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle(`🔎 Search: "${query}"`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Page ${info.page} of ${info.totalPages} · ${info.total} result${info.total === 1 ? '' : 's'}` })
      .setTimestamp()
  }, { pageSize: 5 })
}

async function userRecent(interaction) {
  const type = interaction.options.getString('type')
  // Up to 50 entries paginated 10-at-a-time. The old command capped at 25
  // and printed all of them in one embed; pagination lets us go wider.
  const count = Math.min(interaction.options.getInteger('count') || 25, 50)

  try {
    if (type === 'signups') {
      const { data: rows, error } = await supabase
        .from('profiles').select('username, display_name, email_verified, is_premium, created_at')
        .order('created_at', { ascending: false }).limit(count)
      if (error) throw error
      if (!rows?.length) return interaction.editReply({ embeds: [errorEmbed('Empty', 'No signups found.')] })
      await paginate(interaction, rows, (pageItems, info) => {
        const start = (info.page - 1) * info.pageSize
        const lines = pageItems.map((u, i) => {
          const time = `<t:${Math.floor(new Date(u.created_at).getTime() / 1000)}:R>`
          const verified = u.email_verified ? '✅' : '❌'
          const premium = u.is_premium ? ' ⭐' : ''
          return `\`${start + i + 1}.\` **${u.username}** ${verified}${premium} - ${time}`
        })
        return new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle('🆕 Recent Signups')
          .setDescription(lines.join('\n'))
          .setFooter({ text: `Page ${info.page} of ${info.totalPages} · ${info.total} total` })
          .setTimestamp()
      }, { pageSize: 10 })
      return
    }
    if (type === 'views') {
      const { data: rows, error } = await supabase
        .from('profiles').select('username, view_count').order('view_count', { ascending: false }).limit(count)
      if (error) throw error
      if (!rows?.length) return interaction.editReply({ embeds: [errorEmbed('Empty', 'No data.')] })
      await paginate(interaction, rows, (pageItems, info) => {
        const start = (info.page - 1) * info.pageSize
        const lines = pageItems.map((v, i) =>
          `\`${start + i + 1}.\` **${v.username}** - ${(v.view_count || 0).toLocaleString()} views`)
        return new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle('👁️ Top Profiles by Views')
          .setDescription(lines.join('\n'))
          .setFooter({ text: `Page ${info.page} of ${info.totalPages} · ${info.total} total` })
          .setTimestamp()
      }, { pageSize: 10 })
      return
    }
    if (type === 'bans') {
      const { data: rows, error } = await supabase
        .from('profiles').select('username, ban_reason, banned_at').eq('banned', true)
        .order('banned_at', { ascending: false }).limit(count)
      if (error) throw error
      if (!rows?.length) return interaction.editReply({ embeds: [errorEmbed('Empty', 'No banned users.')] })
      await paginate(interaction, rows, (pageItems, info) => {
        const start = (info.page - 1) * info.pageSize
        const lines = pageItems.map((b, i) =>
          `\`${start + i + 1}.\` **${b.username}** - ${b.ban_reason || 'No reason'}`)
        return new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle('🔨 Banned Users')
          .setDescription(lines.join('\n'))
          .setFooter({ text: `Page ${info.page} of ${info.totalPages} · ${info.total} total` })
          .setTimestamp()
      }, { pageSize: 10 })
      return
    }
  } catch (err) {
    console.error('[/user recent]', err)
    return interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to fetch data.')] })
  }
}

/** Apply the 'destructive' rate-limit policy on top of the group's
 *  default 'admin' policy. Returns true if the call is allowed. */
async function destructiveGate(interaction) {
  const rl = await checkPolicy('destructive', interaction.user.id)
  if (rl.allowed) return true
  await interaction.editReply({ embeds: [rateLimitEmbed(rl.retryAfter)] })
  return false
}

async function userBan(interaction) {
  if (!(await destructiveGate(interaction))) return
  const username = interaction.options.getString('username').toLowerCase().trim()
  const reason = interaction.options.getString('reason') || 'No reason provided'

  const profile = await resolveProfile(interaction, username, 'id, username, banned')
  if (!profile) return
  if (profile.banned) {
    return interaction.editReply({ embeds: [errorEmbed('Already Banned', `\`${username}\` is already banned.`)] })
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('profiles')
    .update({ banned: true, ban_reason: reason, banned_at: now, session_invalidated_at: now })
    .eq('id', profile.id)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', `Failed to ban: ${error.message}`)] })

  await supabase.from('sessions').delete().eq('user_id', profile.id)

  await sendLog(logEmbed(
    '🔨 User Banned',
    `**User:** \`${username}\`\n**Reason:** ${reason}\n**By:** ${interaction.user.tag}`,
    WARN_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed('User Banned', `\`${username}\` has been banned.\n**Reason:** ${reason}`)],
  })
}

async function userUnban(interaction) {
  if (!(await destructiveGate(interaction))) return
  const username = interaction.options.getString('username').toLowerCase().trim()
  const profile = await resolveProfile(interaction, username, 'id, username, banned, ban_reason')
  if (!profile) return
  if (!profile.banned) {
    return interaction.editReply({ embeds: [errorEmbed('Not Banned', `\`${username}\` is not currently banned.`)] })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ banned: false, ban_reason: null, banned_at: null })
    .eq('id', profile.id)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', `Failed: ${error.message}`)] })

  await sendLog(logEmbed(
    '✅ User Unbanned',
    `**User:** \`${username}\`\n**Previous reason:** ${profile.ban_reason || 'None'}\n**By:** ${interaction.user.tag}`,
    SUCCESS_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed('User Unbanned', `\`${username}\` has been unbanned successfully.`)],
  })
}

async function userWarn(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const reason = interaction.options.getString('reason')

  const profile = await resolveProfile(interaction, username, 'id, username, warnings')
  if (!profile) return

  const warnings = (profile.warnings || 0) + 1
  const { error } = await supabase.from('profiles').update({ warnings }).eq('id', profile.id)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  await sendLog(logEmbed(
    '⚠️ User Warned',
    `**User:** \`${username}\`\n**Reason:** ${reason}\n**Total warnings:** ${warnings}\n**By:** ${interaction.user.tag}`,
    WARN_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed('User Warned', `\`${username}\` has been warned.\n**Reason:** ${reason}\n**Total warnings:** ${warnings}`)],
  })
}

async function userDelete(interaction) {
  if (!(await destructiveGate(interaction))) return
  const username = interaction.options.getString('username').toLowerCase().trim()

  const profile = await resolveProfile(interaction, username)
  if (!profile) return

  const ok = await confirm(interaction, {
    title: `Delete @${username}?`,
    body:
      `Permanently delete **@${username}** and ALL related data (sessions, social links, custom buttons, badges, titles, page views, link clicks, inbox messages).\n\n` +
      `This cannot be undone.`,
    confirmLabel: `Yes, delete @${username}`,
    danger: true,
    timeoutMs: 30_000,
  })
  if (!ok) return

  await Promise.all([
    supabase.from('sessions').delete().eq('user_id', profile.id),
    supabase.from('social_links').delete().eq('user_id', profile.id),
    supabase.from('custom_buttons').delete().eq('user_id', profile.id),
    supabase.from('profile_badges').delete().eq('user_id', profile.id),
    supabase.from('profile_badge_loadout').delete().eq('user_id', profile.id),
    supabase.from('profile_title_loadout').delete().eq('user_id', profile.id),
    supabase.from('page_views').delete().eq('profile_id', profile.id),
    supabase.from('link_clicks').delete().eq('user_id', profile.id),
    supabase.from('inbox_messages').delete().eq('user_id', profile.id),
  ])

  const { error } = await supabase.from('profiles').delete().eq('id', profile.id)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', `Failed to delete: ${error.message}`)] })

  await sendLog(logEmbed(
    '🗑️ Account Deleted',
    `**User:** \`${username}\`\n**ID:** ${profile.id}\n**By:** ${interaction.user.tag}`,
    ERROR_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed('Account Deleted', `\`${username}\` has been permanently deleted.`)],
  })
}

async function userEdit(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const field = interaction.options.getString('field')
  const value = interaction.options.getString('value') ?? null

  const profile = await resolveProfile(interaction, username)
  if (!profile) return

  if (field === 'username') {
    if (!value) return interaction.editReply({ embeds: [errorEmbed('Invalid', 'Username cannot be blank.')] })
    // .toLowerCase() preserved so URL routing keeps working - the
    // [username] page lowercases the URL param before the DB lookup,
    // so a mixed-case username row would 404 on its own profile URL.
    const newUsername = value.toLowerCase().trim()
    // Loosened from the strict signup regex per owner request - they
    // want to set admin-issued usernames with uppercase / dots /
    // hyphens / etc. Floor still rejects characters that break
    // Discord embed rendering OR enable markdown-link phishing in
    // contexts where the username gets interpolated unescaped:
    //   - whitespace (breaks URL routing, tab/zero-width can hide
    //     impersonations)
    //   - backticks (escape code blocks in Discord embeds)
    //   - markdown-link control chars: [ ] ( )  (the
    //     `[label](url)` syntax is the phishing vector)
    //   - HTML angle brackets: < >  (defence in depth for any
    //     future innerHTML render path)
    //   - pipe (Discord mentions / table syntax)
    //   - newline / control chars (length cap doesn't help if a
    //     newline lets the rest render on its own line)
    //   - forward slash (would break the /[username] URL route)
    if (newUsername.length === 0 || newUsername.length > 32) {
      return interaction.editReply({
        embeds: [errorEmbed('Invalid', 'Username must be 1-32 characters.')],
      })
    }
    if (/[\s`\[\]()<>|\/\\\x00-\x1f\x7f]/.test(newUsername)) {
      return interaction.editReply({
        embeds: [errorEmbed('Invalid', 'Username cannot contain whitespace or any of: ` [ ] ( ) < > | / \\')],
      })
    }
    const { data: taken } = await supabase
      .from('profiles').select('id').eq('username', newUsername).neq('id', profile.id).maybeSingle()
    if (taken) return interaction.editReply({ embeds: [errorEmbed('Taken', `\`${newUsername}\` is already in use.`)] })
    const { error } = await supabase.from('profiles').update({ username: newUsername }).eq('id', profile.id)
    if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })
    await sendLog(logEmbed('✏️ Username Changed', `**User:** \`${username}\` → \`${newUsername}\`\n**By:** ${interaction.user.tag}`, WARN_COLOR))
    return interaction.editReply({ embeds: [successEmbed('Username Changed', `\`${username}\` → \`${newUsername}\``)] })
  }

  const { error } = await supabase.from('profiles').update({ [field]: value || null }).eq('id', profile.id)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  const displayValue = value ? `\`${value.slice(0, 100)}\`` : '*(cleared)*'
  await sendLog(logEmbed(
    '✏️ Profile Edited',
    `**User:** \`${username}\`\n**Field:** ${field}\n**Value:** ${displayValue}\n**By:** ${interaction.user.tag}`,
    WARN_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed('Profile Updated', `\`${username}\`'s **${field}** has been set to ${displayValue}.`)],
  })
}

async function userMessage(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const body = interaction.options.getString('body')
  const subject = interaction.options.getString('subject') || 'Message from staff'

  const profile = await resolveProfile(interaction, username)
  if (!profile) return

  const { error } = await supabase.from('inbox_messages').insert({
    user_id: profile.id,
    title: subject,
    subject,
    body,
    message_type: 'staff',
    from_staff: true,
    staff_username: 'rez',
  })
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  await sendLog(logEmbed(
    '📨 Staff Message Sent',
    `**To:** \`${username}\`\n**Subject:** ${subject}\n**Message:** ${body.slice(0, 200)}\n**By:** ${interaction.user.tag}`,
    BRAND_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed('Message Sent', `Inbox message delivered to \`${username}\`.\n**Subject:** ${subject}`)],
  })
}

async function userResetPassword(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const profile = await resolveProfile(interaction, username)
  if (!profile) return

  const now = new Date().toISOString()
  await supabase.from('sessions').delete().eq('user_id', profile.id)
  await supabase.from('profiles').update({
    session_invalidated_at: now,
    must_reset_password: true,
  }).eq('id', profile.id)

  await sendLog(logEmbed('🔑 Password Reset Forced', `**User:** \`${username}\`\n**By:** ${interaction.user.tag}`, WARN_COLOR))
  return interaction.editReply({
    embeds: [successEmbed('Password Reset', `\`${username}\` has been logged out. They must reset their password to log back in.`)],
  })
}

async function userPremium(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const action = interaction.options.getString('action')

  const profile = await resolveProfile(interaction, username, 'id, username, is_premium, premium_active, premium_type')
  if (!profile) return

  let updateData = {}
  let label = ''
  if (action === 'revoke') {
    updateData = { is_premium: false, premium_active: false, premium_type: null, premium_activated_at: null }
    label = 'Revoked'
  } else {
    const type = action === 'grant-lifetime' ? 'lifetime' : 'monthly'
    updateData = {
      is_premium: true,
      premium_active: true,
      premium_type: type,
      premium_activated_at: new Date().toISOString(),
    }
    label = `Granted (${type})`
  }

  const { error } = await supabase.from('profiles').update(updateData).eq('id', profile.id)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  await sendLog(logEmbed(
    `⭐ Premium ${label}`,
    `**User:** \`${username}\`\n**Type:** ${updateData.premium_type || 'none'}\n**By:** ${interaction.user.tag}`,
    BRAND_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed(`Premium ${label}`, `\`${username}\`'s premium is now **${label.toLowerCase()}**.`)],
  })
}

async function userSiteAdmin(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const action = interaction.options.getString('action')

  const profile = await resolveProfile(interaction, username, 'id, username, is_admin')
  if (!profile) return

  const isAdmin = action === 'grant'
  const { error } = await supabase.from('profiles').update({ is_admin: isAdmin }).eq('id', profile.id)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  const label = isAdmin ? 'Site Admin Granted' : 'Site Admin Revoked'
  await sendLog(logEmbed(
    `🛡️ ${label}`,
    `**User:** \`${username}\`\n**By:** ${interaction.user.tag}`,
    isAdmin ? BRAND_COLOR : WARN_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed(label, `\`${username}\` site admin status is now **${isAdmin ? 'enabled' : 'disabled'}**.`)],
  })
}

// Issue a one-time recovery link for users who can't log in via the
// standard flow - usually because they lost email access and their
// Discord OAuth isn't working (Brave/mobile in-app browser, etc.).
// Replies ephemerally because the token is a secret; the admin then
// hands the URL to the user via their own private channel.
//
// Security:
//   - Token is 32 bytes of crypto.randomBytes (256 bits entropy).
//   - Only the sha256 hash hits the DB; raw token only exists in
//     the response payload and in transit.
//   - 15-minute expiry, single-use enforced via used_at column.
//   - issued_by recorded for audit; also logged to discord_audit_log
//     via sendLog so other staff can see who issued recovery and
//     for whom.
//   - Banned users are rejected here AND at consumption.
async function userMagicLogin(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()

  const profile = await resolveProfile(interaction, username, 'id, username, banned, ban_reason')
  if (!profile) return
  if (profile.banned) {
    return interaction.editReply({
      embeds: [errorEmbed('Banned', `\`${username}\` is banned (${profile.ban_reason || 'no reason'}). Unban before issuing a recovery link.`)],
    })
  }

  // Generate the token + insert hashed version. Top-level dynamic
  // import for crypto so the bundler doesn't choke on the Node
  // built-in at build time.
  const { randomBytes, createHash } = await import('crypto')
  const rawToken = randomBytes(32).toString('hex')   // 64 hex chars
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  const { error: insertErr } = await supabase.from('magic_login_tokens').insert({
    token_hash: tokenHash,
    user_id: profile.id,
    expires_at: expiresAt,
    issued_by: interaction.user.id,
  })
  if (insertErr) {
    return interaction.editReply({
      embeds: [errorEmbed('Error', `Couldn't create recovery token: ${insertErr.message}`)],
    })
  }

  const siteBase = process.env.NEXT_PUBLIC_SITE_URL || 'https://halo.rip'
  const url = `${siteBase}/magic-login?token=${rawToken}`

  // Public audit log so other staff see the issuance. Logs the
  // executor + target + 15-min expiry but NOT the token URL.
  await sendLog(logEmbed(
    '🔑 Magic-login Issued',
    `**Target:** \`${username}\`\n**Issued by:** ${interaction.user.tag}\n**Expires:** <t:${Math.floor(Date.now() / 1000 + 15 * 60)}:R>`,
    WARN_COLOR,
  ))

  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('🔑 One-time recovery link')
        .setDescription(
          `Send this to **${username}** via your private channel:\n\n` +
          // <url> wrap = clickable on tap, suppressed link-preview
          // unfurl. Critical NOT to put inside a code block: code
          // blocks make the URL un-clickable on Discord mobile,
          // forcing users to manually select+copy. The token is 64
          // hex chars, so even one missed character breaks the
          // recovery flow ("No recovery token in URL"). With <url>
          // they just tap and the browser opens with the full URL
          // intact. Long-press still copies it as a fallback.
          `<${url}>\n\n` +
          `**Single-use, expires in 15 min.** When they tap it the page asks them to pick a new email + password - once they submit, they're logged into \`${username}\` straight away.`,
        ),
    ],
  })
}
