import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import supabase from '../utils/supabase.js'
import {
  successEmbed,
  errorEmbed,
  logEmbed,
  BRAND_COLOR,
  WARN_COLOR,
} from '../utils/embeds.js'
import { sendLog } from '../utils/logger.js'
import { invalidateAdminCache } from '../framework/permissions.js'
import { paginate } from '../framework/paginator.js'

export const meta = { permission: 'owner', rateLimit: 'admin' }

// Manages the bot_admins Postgres table - who can run /staff and /user etc.
// commands. Owner-only because granting admin is a security-sensitive
// action; the existing OWNER_ID is the only person who can hand out keys.
export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Manage bot admins (owner only)')
  .addSubcommand((sub) =>
    sub
      .setName('grant')
      .setDescription('Grant a Discord user bot admin access')
      .addUserOption((opt) => opt.setName('user').setDescription('Discord user').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('revoke')
      .setDescription('Revoke a Discord user\'s bot admin access')
      .addUserOption((opt) => opt.setName('user').setDescription('Discord user').setRequired(true)))
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all current bot admins'))

export async function execute(interaction) {
  await interaction.deferReply()
  const sub = interaction.options.getSubcommand()
  if (sub === 'grant')  return grantAdmin(interaction)
  if (sub === 'revoke') return revokeAdmin(interaction)
  if (sub === 'list')   return listAdmins(interaction)
}

async function grantAdmin(interaction) {
  const user = interaction.options.getUser('user')
  const { error } = await supabase
    .from('bot_admins')
    .upsert(
      { discord_id: user.id, username: user.tag, granted_by: interaction.user.tag },
      { onConflict: 'discord_id' },
    )
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  await invalidateAdminCache()
  await sendLog(logEmbed(
    '🛡️ Bot Admin Granted',
    `**User:** ${user.tag} (\`${user.id}\`)\n**By:** ${interaction.user.tag}`,
    BRAND_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed('Admin Granted', `${user.tag} can now run bot admin commands.`)],
  })
}

async function revokeAdmin(interaction) {
  const user = interaction.options.getUser('user')

  // Refuse to revoke the owner row from this command - the owner must edit
  // bot_admins directly in SQL. Prevents a footgun where the only owner
  // accidentally locks themselves out.
  const { data: row } = await supabase
    .from('bot_admins')
    .select('discord_id, is_owner')
    .eq('discord_id', user.id)
    .maybeSingle()
  if (!row) {
    return interaction.editReply({ embeds: [errorEmbed('Not Found', `${user.tag} isn't a bot admin.`)] })
  }
  if (row.is_owner) {
    return interaction.editReply({ embeds: [errorEmbed('Refused', 'Cannot revoke the bot owner via this command. Edit the bot_admins table directly.')] })
  }

  const { error } = await supabase
    .from('bot_admins')
    .delete()
    .eq('discord_id', user.id)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  await invalidateAdminCache()
  await sendLog(logEmbed(
    '🛡️ Bot Admin Revoked',
    `**User:** ${user.tag} (\`${user.id}\`)\n**By:** ${interaction.user.tag}`,
    WARN_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed('Admin Revoked', `${user.tag} no longer has bot admin access.`)],
  })
}

async function listAdmins(interaction) {
  const { data: rows, error } = await supabase
    .from('bot_admins')
    .select('discord_id, username, granted_by, granted_at, is_owner')
    .order('granted_at', { ascending: true })
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  if (!rows || rows.length === 0) {
    return interaction.editReply({ embeds: [errorEmbed('Empty', 'No bot admins configured.')] })
  }

  await paginate(interaction, rows, (pageItems, info) => {
    const start = (info.page - 1) * info.pageSize
    const lines = pageItems.map((r, i) => {
      const tag = r.is_owner ? ' 👑' : ''
      const granted = r.granted_at
        ? `<t:${Math.floor(new Date(r.granted_at).getTime() / 1000)}:R>`
        : 'unknown'
      return `\`${start + i + 1}.\` <@${r.discord_id}> **${r.username}**${tag}\n     granted by ${r.granted_by || 'unknown'}, ${granted}`
    })
    return new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🛡️ Bot Admins')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Page ${info.page} of ${info.totalPages} · ${info.total} total · 👑 = owner` })
      .setTimestamp()
  }, { pageSize: 10 })
}
