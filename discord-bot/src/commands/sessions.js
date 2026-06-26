import { SlashCommandBuilder } from 'discord.js'
import supabase from '../utils/supabase.js'
import {
  successEmbed,
  errorEmbed,
  infoEmbed,
  logEmbed,
  WARN_COLOR,
} from '../utils/embeds.js'
import { sendLog } from '../utils/logger.js'
import { confirm } from '../framework/confirm.js'
import { checkPolicy } from '../framework/rate-limit.js'
import { rateLimitEmbed } from '../framework/embed-kit.js'

export const meta = { permission: 'admin', rateLimit: 'admin' }

export const data = new SlashCommandBuilder()
  .setName('sessions')
  .setDescription('Inspect and revoke user sessions')
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('List active sessions for a user')
      .addStringOption((opt) => opt.setName('username').setDescription('Target username').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('revoke')
      .setDescription("Revoke all of a user's sessions")
      .addStringOption((opt) => opt.setName('username').setDescription('Target username').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('forcelogout')
      .setDescription('Force logout one user or ALL users (destructive)')
      .addStringOption((opt) =>
        opt
          .setName('username')
          .setDescription('Username to log out. Omit to log out ALL users.')
          .setRequired(false)))

export async function execute(interaction) {
  await interaction.deferReply()
  const sub = interaction.options.getSubcommand()
  if (sub === 'list')        return listSessions(interaction)
  if (sub === 'revoke')      return revokeForUser(interaction)
  if (sub === 'forcelogout') return forceLogout(interaction)
}

async function resolveProfile(interaction, username) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', username)
    .maybeSingle()
  if (error || !data) {
    await interaction.editReply({ embeds: [errorEmbed('Not Found', `No user found with username \`${username}\``)] })
    return null
  }
  return data
}

async function listSessions(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const profile = await resolveProfile(interaction, username)
  if (!profile) return

  const now = new Date().toISOString()
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, created_at, expires_at, ip_address, user_agent, revoked_at')
    .eq('user_id', profile.id)
    .is('revoked_at', null)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })
  if (!sessions || sessions.length === 0) {
    return interaction.editReply({ embeds: [infoEmbed('Sessions', `\`${username}\` has no active sessions.`)] })
  }

  const lines = sessions.map((s, i) => {
    const age = Math.round((Date.now() - new Date(s.created_at).getTime()) / 60000)
    const ip = s.ip_address || 'unknown'
    const ua = (s.user_agent || 'unknown').slice(0, 50)
    return `**${i + 1}.** ${age}m ago · IP: \`${ip}\`\n   ${ua}`
  })

  return interaction.editReply({
    embeds: [infoEmbed('Active Sessions', `**${username}** - ${sessions.length} active session(s)\n\n${lines.join('\n\n')}`)],
  })
}

async function revokeForUser(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const profile = await resolveProfile(interaction, username)
  if (!profile) return

  const { error, count } = await supabase
    .from('sessions')
    .delete({ count: 'exact' })
    .eq('user_id', profile.id)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  await sendLog(logEmbed(
    '🔑 Sessions Revoked',
    `**User:** \`${username}\`\n**Sessions revoked:** ${count ?? 0}\n**By:** ${interaction.user.tag}`,
    WARN_COLOR,
  ))

  return interaction.editReply({
    embeds: [successEmbed('Sessions Revoked', `Revoked ${count ?? 0} session(s) for \`${username}\`. They will be logged out on next request.`)],
  })
}

async function forceLogout(interaction) {
  // Both the per-user and all-users variants count toward the destructive
  // rate-limit policy. The all-users path additionally requires a button
  // confirmation since it kicks the entire user base in one click.
  const rl = await checkPolicy('destructive', interaction.user.id)
  if (!rl.allowed) return interaction.editReply({ embeds: [rateLimitEmbed(rl.retryAfter)] })

  const usernameOpt = interaction.options.getString('username')
  const now = new Date().toISOString()

  if (usernameOpt) {
    const profile = await resolveProfile(interaction, usernameOpt.toLowerCase().trim())
    if (!profile) return

    const { error, count } = await supabase
      .from('sessions')
      .delete({ count: 'exact' })
      .eq('user_id', profile.id)
    if (error) return interaction.editReply({ embeds: [errorEmbed('Error', `Failed: ${error.message}`)] })

    await supabase.from('profiles').update({ session_invalidated_at: now }).eq('id', profile.id)

    await sendLog(logEmbed(
      'User Force Logged Out',
      `**User:** ${profile.username}\n**Sessions revoked:** ${count ?? 0}\n**By:** ${interaction.user.tag}`,
      WARN_COLOR,
    ))
    return interaction.editReply({
      embeds: [successEmbed('Force Logout', `\`${profile.username}\` has been logged out of all sessions (${count ?? 0} revoked).`)],
    })
  }

  // All-users variant: confirm before nuking every session.
  const ok = await confirm(interaction, {
    title: 'Force logout EVERY user?',
    body:
      'This revokes every active session on halo.rip in one click. Every signed-in user gets kicked back to the login page on their next request.\n\n' +
      'Use this for security incidents - leaked keys, suspected compromise. Not for routine ops.',
    confirmLabel: 'Yes, kick everyone',
    danger: true,
    timeoutMs: 45_000,
  })
  if (!ok) return

  const { error, count } = await supabase
    .from('sessions')
    .delete({ count: 'exact' })
    .gt('expires_at', now)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', `Failed: ${error.message}`)] })

  await supabase.from('profiles').update({ session_invalidated_at: now }).not('id', 'is', null)

  await sendLog(logEmbed(
    'All Users Force Logged Out',
    `**Sessions revoked:** ${count ?? 0}\n**By:** ${interaction.user.tag}\n**Time:** ${now}`,
    WARN_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed('Force Logout All', `All users have been logged out. ${count ?? 0} active sessions revoked.`)],
  })
}
