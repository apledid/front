import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import supabase from '../utils/supabase.js'
import {
  successEmbed,
  errorEmbed,
  logEmbed,
  BRAND_COLOR,
  WARN_COLOR,
  SUCCESS_COLOR,
} from '../utils/embeds.js'
import { sendLog } from '../utils/logger.js'
import { paginate } from '../framework/paginator.js'

export const meta = { permission: 'admin', rateLimit: 'admin' }

// Manages the support_blacklisted flag on profiles - users marked here lose
// access to support tickets but keep all other site features. Mirrored to
// the user's inbox as a notice so they know why support is closed.
export const data = new SlashCommandBuilder()
  .setName('blacklist')
  .setDescription('Manage the support-ticket blacklist')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Blacklist a user from support')
      .addStringOption((opt) => opt.setName('username').setDescription('Target username').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription("Restore a user's support access")
      .addStringOption((opt) => opt.setName('username').setDescription('Target username').setRequired(true)))
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all currently-blacklisted users'))

export async function execute(interaction) {
  await interaction.deferReply()
  const sub = interaction.options.getSubcommand()
  if (sub === 'add')    return setBlacklist(interaction, true)
  if (sub === 'remove') return setBlacklist(interaction, false)
  if (sub === 'list')   return listBlacklist(interaction)
}

async function setBlacklist(interaction, blacklisted) {
  const username = interaction.options.getString('username').toLowerCase().trim()

  const { data: profile, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, username, support_blacklisted')
    .eq('username', username)
    .maybeSingle()
  if (fetchErr || !profile) {
    return interaction.editReply({ embeds: [errorEmbed('Not Found', `No user \`${username}\``)] })
  }

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ support_blacklisted: blacklisted })
    .eq('id', profile.id)
  if (updateErr) return interaction.editReply({ embeds: [errorEmbed('Error', updateErr.message)] })

  const title = blacklisted ? 'Support access removed' : 'Support access restored'
  const body = blacklisted
    ? 'You have been blacklisted from support tickets by halo.rip staff.'
    : 'Your support access has been restored by halo.rip staff.'

  await supabase.from('inbox_messages').insert({
    user_id: profile.id,
    title,
    subject: title,
    body,
    message_type: 'staff',
    from_staff: true,
    staff_username: 'rez',
  })

  const label = blacklisted ? 'Support Blacklisted' : 'Support Unblacklisted'
  await sendLog(logEmbed(
    `🚫 ${label}`,
    `**User:** \`${username}\`\n**By:** ${interaction.user.tag}`,
    blacklisted ? WARN_COLOR : SUCCESS_COLOR,
  ))

  return interaction.editReply({
    embeds: [successEmbed(label, `\`${username}\` has been **${blacklisted ? 'blacklisted from' : 'restored to'}** support.`)],
  })
}

async function listBlacklist(interaction) {
  const { data: rows, error } = await supabase
    .from('profiles')
    .select('username, banned, created_at')
    .eq('support_blacklisted', true)
    .order('username', { ascending: true })
    .limit(200)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  if (!rows || rows.length === 0) {
    return interaction.editReply({ embeds: [successEmbed('Empty', 'No users are blacklisted from support.')] })
  }

  await paginate(interaction, rows, (pageItems, info) => {
    const start = (info.page - 1) * info.pageSize
    const lines = pageItems.map((r, i) =>
      `\`${start + i + 1}.\` **${r.username}**${r.banned ? ' 🔨 banned' : ''}`,
    )
    return new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🚫 Support Blacklist')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Page ${info.page} of ${info.totalPages} · ${info.total} total` })
      .setTimestamp()
  }, { pageSize: 15 })
}
