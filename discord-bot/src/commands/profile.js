import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import supabase from '../utils/supabase.js'
import {
  profileEmbed,
  errorEmbed,
  BRAND_COLOR,
} from '../utils/embeds.js'
import { paginate } from '../framework/paginator.js'

export const meta = { permission: 'public', rateLimit: 'public' }

// Public-facing profile commands. Available to anyone in the guild.
// Rate-limited via the framework (default 'public' = 15/min per user).
export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('halo.rip profile lookups')
  .addSubcommand((sub) =>
    sub
      .setName('lookup')
      .setDescription('Show a public halo.rip profile')
      .addStringOption((opt) => opt.setName('username').setDescription('Username').setRequired(true)))
  .addSubcommand((sub) =>
    sub
      .setName('leaderboard')
      .setDescription('Top profiles by view count')
      .addIntegerOption((opt) =>
        opt
          .setName('limit')
          .setDescription('How many to show (max 50)')
          .setRequired(false)
          .setMinValue(5)
          .setMaxValue(50)))

export async function execute(interaction) {
  await interaction.deferReply()
  const sub = interaction.options.getSubcommand()
  if (sub === 'lookup')      return lookupProfile(interaction)
  if (sub === 'leaderboard') return showLeaderboard(interaction)
}

async function lookupProfile(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, view_count, is_premium, premium_active, premium_type, banned, ban_reason, uid, created_at, email_verified, discord_id, is_public')
    .eq('username', username)
    .maybeSingle()
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', 'Lookup failed.')] })
  if (!profile) return interaction.editReply({ embeds: [errorEmbed('Not Found', `No profile for \`${username}\``)] })

  // Banned or non-public profiles aren't shown to non-admins. The website
  // hides them from public view too.
  if (profile.banned || profile.is_public === false) {
    return interaction.editReply({ embeds: [errorEmbed('Not Available', `\`${username}\`'s profile isn't public.`)] })
  }

  // We deliberately don't fetch link / click counts here - those are
  // admin-only context. profileEmbed handles the case where they're absent.
  return interaction.editReply({
    embeds: [profileEmbed(profile)],
  })
}

async function showLeaderboard(interaction) {
  const limit = interaction.options.getInteger('limit') || 10
  const { data: rows, error } = await supabase
    .from('profiles')
    .select('username, display_name, view_count, premium_active, is_premium')
    .eq('banned', false)
    .eq('is_public', true)
    .order('view_count', { ascending: false })
    .limit(limit)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to fetch leaderboard.')] })
  if (!rows?.length) return interaction.editReply({ embeds: [errorEmbed('Empty', 'No profiles yet.')] })

  await paginate(interaction, rows, (pageItems, info) => {
    const start = (info.page - 1) * info.pageSize
    const lines = pageItems.map((p, i) => {
      const rank = start + i + 1
      const medal = rank === 1 ? '🥇 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : ''
      const premium = (p.is_premium || p.premium_active) ? ' ⭐' : ''
      return `${medal}\`${rank}.\` [**${p.username}**](https://halo.rip/${p.username})${premium} - ${(p.view_count || 0).toLocaleString()} views`
    })
    return new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🏆 halo.rip Leaderboard')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Page ${info.page} of ${info.totalPages} · top ${info.total}` })
      .setTimestamp()
  }, { pageSize: 10 })
}
