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
  .setName('badge')
  .setDescription('Manage badges (create, give, remove, list)')
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setDescription('Create a new badge')
      .addStringOption((opt) => opt.setName('name').setDescription('Badge name').setRequired(true))
      .addStringOption((opt) => opt.setName('description').setDescription('Description').setRequired(false))
      .addAttachmentOption((opt) => opt.setName('icon').setDescription('Icon image (PNG/JPG/GIF/WebP)').setRequired(false))
      .addStringOption((opt) => opt.setName('icon_url').setDescription('Icon URL (overridden by uploaded icon)').setRequired(false))
      .addStringOption((opt) => opt.setName('color').setDescription('Glow color hex (e.g. #ff0000)').setRequired(false))
      .addStringOption((opt) => opt.setName('icon_name').setDescription('Icon identifier (default: sparkles)').setRequired(false)))
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('Edit an existing badge')
      .addStringOption((opt) => opt.setName('badge_id').setDescription('Badge ID').setRequired(true))
      .addStringOption((opt) => opt.setName('name').setDescription('New name').setRequired(false))
      .addStringOption((opt) => opt.setName('description').setDescription('New description').setRequired(false))
      .addAttachmentOption((opt) => opt.setName('icon').setDescription('New icon image').setRequired(false))
      .addStringOption((opt) => opt.setName('icon_url').setDescription('New icon URL').setRequired(false))
      .addStringOption((opt) => opt.setName('color').setDescription('New glow color hex').setRequired(false))
      .addStringOption((opt) => opt.setName('icon_name').setDescription('New icon identifier').setRequired(false)))
  .addSubcommand((sub) =>
    sub
      .setName('give')
      .setDescription('Grant a badge to a user')
      .addStringOption((opt) => opt.setName('username').setDescription('Target username').setRequired(true))
      .addStringOption((opt) => opt.setName('badge_id').setDescription('Badge ID').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Revoke a badge from a user')
      .addStringOption((opt) => opt.setName('username').setDescription('Target username').setRequired(true))
      .addStringOption((opt) => opt.setName('badge_id').setDescription('Badge ID').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription("Show a user's badges")
      .addStringOption((opt) => opt.setName('username').setDescription('Target username').setRequired(true)))
  .addSubcommand((sub) =>
    sub.setName('listall').setDescription('Show all available badges in the catalog'))

export async function execute(interaction) {
  await interaction.deferReply()
  const sub = interaction.options.getSubcommand()
  if (sub === 'create')  return createBadge(interaction)
  if (sub === 'edit')    return editBadge(interaction)
  if (sub === 'give')    return giveBadge(interaction)
  if (sub === 'remove')  return removeBadge(interaction)
  if (sub === 'list')    return listUserBadges(interaction)
  if (sub === 'listall') return listAllBadges(interaction)
}

async function uploadBadgeIcon(attachment) {
  try {
    const response = await fetch(attachment.proxyURL || attachment.url)
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    const ext = attachment.name?.split('.').pop()?.toLowerCase() || 'png'
    const filename = `badge-icons/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const contentType = attachment.contentType || `image/${ext}`

    const { error } = await supabase.storage
      .from('badges')
      .upload(filename, buffer, { contentType, upsert: false })
    if (error) {
      console.warn('[badge] Storage upload failed, using Discord URL:', error.message)
      return attachment.proxyURL || attachment.url
    }
    const { data: { publicUrl } } = supabase.storage.from('badges').getPublicUrl(filename)
    return publicUrl
  } catch (err) {
    console.warn('[badge] Icon upload error, using Discord URL:', err.message)
    return attachment.proxyURL || attachment.url
  }
}

async function createBadge(interaction) {
  const name        = interaction.options.getString('name').trim()
  const description = interaction.options.getString('description')?.trim()
  const iconAttach  = interaction.options.getAttachment('icon')
  const iconUrlOpt  = interaction.options.getString('icon_url')?.trim()
  const color       = interaction.options.getString('color')?.trim()
  const iconName    = interaction.options.getString('icon_name')?.trim() || 'sparkles'

  let resolvedIconUrl = iconUrlOpt || null
  if (iconAttach) resolvedIconUrl = await uploadBadgeIcon(iconAttach)

  const { data: badge, error } = await supabase
    .from('badges')
    .insert({
      name,
      description: description || null,
      icon: iconName,
      icon_url: resolvedIconUrl,
      color: color || '#ffffff',
    })
    .select('id, name')
    .single()
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  await sendLog(logEmbed(
    '🏅 Badge Created',
    `**Name:** ${badge.name}\n**ID:** \`${badge.id}\`\n**Icon:** ${iconName}${resolvedIconUrl ? '\n**Icon URL:** set' : ''}\n**By:** ${interaction.user.tag}`,
    BRAND_COLOR,
  ))

  return interaction.editReply({
    embeds: [successEmbed('Badge Created', `**${badge.name}** created (ID \`${badge.id}\`).${resolvedIconUrl ? '\nIcon uploaded ✅' : ''}`)],
  })
}

async function editBadge(interaction) {
  const badgeId     = interaction.options.getString('badge_id')
  const name        = interaction.options.getString('name')?.trim()
  const description = interaction.options.getString('description')?.trim()
  const iconAttach  = interaction.options.getAttachment('icon')
  const iconUrlOpt  = interaction.options.getString('icon_url')?.trim()
  const color       = interaction.options.getString('color')?.trim()
  const iconName    = interaction.options.getString('icon_name')?.trim()

  const updates = {}
  if (name)        updates.name = name
  if (description) updates.description = description
  if (color)       updates.color = color
  if (iconName)    updates.icon = iconName
  if (iconAttach) updates.icon_url = await uploadBadgeIcon(iconAttach)
  else if (iconUrlOpt) updates.icon_url = iconUrlOpt

  if (Object.keys(updates).length === 0) {
    return interaction.editReply({ embeds: [errorEmbed('Nothing to update', 'Provide at least one field to change.')] })
  }

  const { error } = await supabase.from('badges').update(updates).eq('id', badgeId)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  await sendLog(logEmbed(
    '✏️ Badge Edited',
    `**Badge ID:** \`${badgeId}\`\n**Changes:** ${Object.keys(updates).join(', ')}\n**By:** ${interaction.user.tag}`,
    BRAND_COLOR,
  ))

  return interaction.editReply({
    embeds: [successEmbed('Badge Updated', `Badge \`${badgeId}\` updated: ${Object.keys(updates).join(', ')}.`)],
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

async function giveBadge(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const badgeId = interaction.options.getString('badge_id')

  const profile = await resolveProfile(interaction, username)
  if (!profile) return

  const { data: badge } = await supabase
    .from('badges').select('id, name').eq('id', badgeId).maybeSingle()
  if (!badge) return interaction.editReply({ embeds: [errorEmbed('Not Found', `No badge \`${badgeId}\`. Use \`/badge listall\` to see IDs.`)] })

  const { error } = await supabase
    .from('profile_badges')
    .upsert({ user_id: profile.id, badge_id: badgeId }, { onConflict: 'user_id,badge_id' })
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  await sendLog(logEmbed(
    '🏅 Badge Granted',
    `**User:** \`${username}\`\n**Badge:** ${badge.name} (\`${badgeId}\`)\n**By:** ${interaction.user.tag}`,
    BRAND_COLOR,
  ))

  return interaction.editReply({
    embeds: [successEmbed('Badge Granted', `\`${username}\` has been given the **${badge.name}** badge.`)],
  })
}

async function removeBadge(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const badgeId = interaction.options.getString('badge_id')

  const profile = await resolveProfile(interaction, username)
  if (!profile) return

  await supabase.from('profile_badge_loadout').delete().eq('user_id', profile.id).eq('badge_id', badgeId)

  const { error, count } = await supabase
    .from('profile_badges').delete({ count: 'exact' })
    .eq('user_id', profile.id).eq('badge_id', badgeId)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })
  if (!count) return interaction.editReply({ embeds: [errorEmbed('Not Found', `\`${username}\` doesn't have badge \`${badgeId}\`.`)] })

  await sendLog(logEmbed(
    '🗑️ Badge Removed',
    `**User:** \`${username}\`\n**Badge ID:** \`${badgeId}\`\n**By:** ${interaction.user.tag}`,
    WARN_COLOR,
  ))

  return interaction.editReply({
    embeds: [successEmbed('Badge Removed', `Badge \`${badgeId}\` removed from \`${username}\`.`)],
  })
}

async function listUserBadges(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const profile = await resolveProfile(interaction, username)
  if (!profile) return

  const { data: userBadges, error } = await supabase
    .from('profile_badges')
    .select('badge_id, badges(name, description, icon_url)')
    .eq('user_id', profile.id)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  if (!userBadges || !userBadges.length) {
    return interaction.editReply({ embeds: [infoEmbed('Badges', `\`${username}\` has no badges.`)] })
  }

  await paginate(interaction, userBadges, (pageItems, info) => {
    const lines = pageItems.map((b) =>
      `\`${b.badge_id}\` **${b.badges?.name || '?'}** - ${b.badges?.description || ''}`,
    )
    return new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle(`🏅 ${username}'s Badges`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Page ${info.page} of ${info.totalPages} · ${info.total} total` })
      .setTimestamp()
  }, { pageSize: 10 })
}

async function listAllBadges(interaction) {
  const { data: badges, error } = await supabase
    .from('badges').select('id, name, description, color').order('id', { ascending: true })
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  if (!badges || !badges.length) {
    return interaction.editReply({ embeds: [infoEmbed('Badges', 'No badges found in the database.')] })
  }

  await paginate(interaction, badges, (pageItems, info) => {
    const lines = pageItems.map((b) =>
      `\`${b.id}\` **${b.name}**${b.color ? ` (${b.color})` : ''} - ${b.description || 'No description'}`,
    )
    return new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🏅 All Badges')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Page ${info.page} of ${info.totalPages} · ${info.total} total` })
      .setTimestamp()
  }, { pageSize: 10 })
}
