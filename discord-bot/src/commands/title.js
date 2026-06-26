import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import supabase from '../utils/supabase.js'
import {
  successEmbed,
  errorEmbed,
  infoEmbed,
  logEmbed,
  BRAND_COLOR,
  WARN_COLOR,
} from '../utils/embeds.js'
import { sendLog } from '../utils/logger.js'
import { paginate } from '../framework/paginator.js'

export const meta = { permission: 'admin', rateLimit: 'admin' }

export const data = new SlashCommandBuilder()
  .setName('title')
  .setDescription('Manage profile titles (create, give, remove, list)')
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setDescription('Create a new title')
      .addStringOption((opt) => opt.setName('name').setDescription('Title name').setRequired(true))
      .addStringOption((opt) => opt.setName('color').setDescription('Color hex (e.g. #a855f7)').setRequired(false)))
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('Edit an existing title')
      .addStringOption((opt) => opt.setName('title_id').setDescription('Title ID').setRequired(true))
      .addStringOption((opt) => opt.setName('name').setDescription('New name').setRequired(false))
      .addStringOption((opt) => opt.setName('color').setDescription('New color hex').setRequired(false)))
  .addSubcommand((sub) =>
    sub
      .setName('give')
      .setDescription('Grant a title to a user')
      .addStringOption((opt) => opt.setName('username').setDescription('Target username').setRequired(true))
      .addStringOption((opt) => opt.setName('title_id').setDescription('Title ID').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Revoke a title from a user')
      .addStringOption((opt) => opt.setName('username').setDescription('Target username').setRequired(true))
      .addStringOption((opt) => opt.setName('title_id').setDescription('Title ID').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription("Show a user's titles")
      .addStringOption((opt) => opt.setName('username').setDescription('Target username').setRequired(true)))
  .addSubcommand((sub) =>
    sub.setName('listall').setDescription('Show all available titles in the catalog'))

export async function execute(interaction) {
  await interaction.deferReply()
  const sub = interaction.options.getSubcommand()
  if (sub === 'create')  return createTitle(interaction)
  if (sub === 'edit')    return editTitle(interaction)
  if (sub === 'give')    return giveTitle(interaction)
  if (sub === 'remove')  return removeTitle(interaction)
  if (sub === 'list')    return listUserTitles(interaction)
  if (sub === 'listall') return listAllTitles(interaction)
}

async function createTitle(interaction) {
  const name  = interaction.options.getString('name').trim()
  const color = interaction.options.getString('color')?.trim()

  const { data: title, error } = await supabase
    .from('titles')
    .insert({ name, color: color || null })
    .select('id, name, color')
    .single()
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  await sendLog(logEmbed(
    '🏷️ Title Created',
    `**Name:** ${title.name}\n**ID:** \`${title.id}\`\n**Color:** ${title.color || 'none'}\n**By:** ${interaction.user.tag}`,
    BRAND_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed('Title Created', `**${title.name}** created with ID \`${title.id}\`${title.color ? ` - color: ${title.color}` : ''}.`)],
  })
}

async function editTitle(interaction) {
  const titleId = interaction.options.getString('title_id')
  const name    = interaction.options.getString('name')?.trim()
  const color   = interaction.options.getString('color')?.trim()

  const updates = {}
  if (name)  updates.name = name
  if (color) updates.color = color

  if (Object.keys(updates).length === 0) {
    return interaction.editReply({ embeds: [errorEmbed('Nothing to update', 'Provide `name` or `color`.')] })
  }

  const { error } = await supabase.from('titles').update(updates).eq('id', titleId)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  await sendLog(logEmbed(
    '✏️ Title Edited',
    `**Title ID:** \`${titleId}\`\n**Changes:** ${Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(', ')}\n**By:** ${interaction.user.tag}`,
    BRAND_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed('Title Updated', `Title \`${titleId}\` updated: ${Object.entries(updates).map(([k, v]) => `${k} → \`${v}\``).join(', ')}.`)],
  })
}

async function resolveProfile(interaction, username) {
  const { data, error } = await supabase
    .from('profiles').select('id, username').eq('username', username).maybeSingle()
  if (error || !data) {
    await interaction.editReply({ embeds: [errorEmbed('Not Found', `No user \`${username}\``)] })
    return null
  }
  return data
}

async function giveTitle(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const titleId = interaction.options.getString('title_id')

  const profile = await resolveProfile(interaction, username)
  if (!profile) return

  const { data: title } = await supabase
    .from('titles').select('id, name').eq('id', titleId).maybeSingle()
  if (!title) return interaction.editReply({ embeds: [errorEmbed('Not Found', `No title \`${titleId}\`. Use \`/title listall\` to see IDs.`)] })

  const { error } = await supabase
    .from('profile_titles')
    .upsert({ user_id: profile.id, title_id: titleId }, { onConflict: 'user_id,title_id' })
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  await sendLog(logEmbed(
    '🏷️ Title Granted',
    `**User:** \`${username}\`\n**Title:** ${title.name} (\`${titleId}\`)\n**By:** ${interaction.user.tag}`,
    BRAND_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed('Title Granted', `\`${username}\` has been given the **${title.name}** title.`)],
  })
}

async function removeTitle(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const titleId = interaction.options.getString('title_id')

  const profile = await resolveProfile(interaction, username)
  if (!profile) return

  await supabase.from('profile_title_loadout').delete().eq('user_id', profile.id).eq('title_id', titleId)

  const { error, count } = await supabase
    .from('profile_titles').delete({ count: 'exact' })
    .eq('user_id', profile.id).eq('title_id', titleId)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })
  if (!count) return interaction.editReply({ embeds: [errorEmbed('Not Found', `\`${username}\` doesn't have title \`${titleId}\`.`)] })

  await sendLog(logEmbed(
    '🗑️ Title Removed',
    `**User:** \`${username}\`\n**Title ID:** \`${titleId}\`\n**By:** ${interaction.user.tag}`,
    WARN_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed('Title Removed', `Title \`${titleId}\` removed from \`${username}\`.`)],
  })
}

async function listUserTitles(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const profile = await resolveProfile(interaction, username)
  if (!profile) return

  const { data: userTitles, error } = await supabase
    .from('profile_titles')
    .select('title_id, titles(name, color)')
    .eq('user_id', profile.id)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  if (!userTitles || !userTitles.length) {
    return interaction.editReply({ embeds: [infoEmbed('Titles', `\`${username}\` has no titles.`)] })
  }

  await paginate(interaction, userTitles, (pageItems, info) => {
    const lines = pageItems.map((t) =>
      `\`${t.title_id}\` **${t.titles?.name || '?'}**${t.titles?.color ? ` - ${t.titles.color}` : ''}`,
    )
    return new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle(`🏷️ ${username}'s Titles`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Page ${info.page} of ${info.totalPages} · ${info.total} total` })
      .setTimestamp()
  }, { pageSize: 10 })
}

async function listAllTitles(interaction) {
  const { data: titles, error } = await supabase
    .from('titles').select('id, name, color').order('id', { ascending: true })
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  if (!titles || !titles.length) {
    return interaction.editReply({ embeds: [infoEmbed('Titles', 'No titles found in the database.')] })
  }

  await paginate(interaction, titles, (pageItems, info) => {
    const lines = pageItems.map((t) =>
      `\`${t.id}\` **${t.name}**${t.color ? ` - ${t.color}` : ''}`,
    )
    return new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🏷️ All Titles')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Page ${info.page} of ${info.totalPages} · ${info.total} total` })
      .setTimestamp()
  }, { pageSize: 10 })
}
