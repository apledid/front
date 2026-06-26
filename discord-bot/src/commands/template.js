import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import supabase from '../utils/supabase.js'
import {
  errorEmbed,
  BRAND_COLOR,
} from '../utils/embeds.js'
import { paginate } from '../framework/paginator.js'

export const meta = { permission: 'public', rateLimit: 'public' }

// Public-facing template marketplace browsing. Hits the same `templates`
// table the website uses; queries are scoped to public templates only.
export const data = new SlashCommandBuilder()
  .setName('template')
  .setDescription('Browse halo.rip profile templates')
  .addSubcommand((sub) =>
    sub
      .setName('browse')
      .setDescription('Browse public templates')
      .addStringOption((opt) =>
        opt.setName('sort').setDescription('Sort order').setRequired(false).addChoices(
          { name: 'Trending',   value: 'trending' },
          { name: 'Most liked', value: 'most_liked' },
          { name: 'Newest',     value: 'newest' },
          { name: 'Most used',  value: 'most_used' },
        ))
      .addStringOption((opt) => opt.setName('tag').setDescription('Filter by tag').setRequired(false)))
  .addSubcommand((sub) =>
    sub.setName('trending').setDescription('Shorthand for /template browse sort:trending'))
  .addSubcommand((sub) =>
    sub
      .setName('search')
      .setDescription('Search public templates by name')
      .addStringOption((opt) => opt.setName('query').setDescription('Search query').setRequired(true)))

export async function execute(interaction) {
  await interaction.deferReply()
  const sub = interaction.options.getSubcommand()
  if (sub === 'browse')   return browseTemplates(interaction, interaction.options.getString('sort') || 'trending')
  if (sub === 'trending') return browseTemplates(interaction, 'trending')
  if (sub === 'search')   return searchTemplates(interaction)
}

function sortColumn(sort) {
  switch (sort) {
    case 'newest':    return 'created_at'
    case 'most_used': return 'uses_count'
    case 'most_liked':
    case 'trending':
    default:          return 'likes_count'  // 'trending' falls back to likes_count until the website API adds a trending_score column
  }
}

async function browseTemplates(interaction, sort) {
  const tag = interaction.options.getString('tag')?.toLowerCase().trim()

  let query = supabase
    .from('templates')
    .select('id, name, description, tags, uses_count, likes_count, premium_features, created_at, author:profiles!templates_user_id_fkey(username)')
    .eq('visibility', 'public')
    .order(sortColumn(sort), { ascending: false })
    .limit(30)
  if (tag) query = query.overlaps('tags', [tag])

  const { data: rows, error } = await query
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })
  if (!rows?.length) {
    return interaction.editReply({
      embeds: [errorEmbed('Empty', tag ? `No templates tagged \`${tag}\`.` : 'No public templates yet.')],
    })
  }

  const sortLabel = sort.replace('_', ' ')
  await paginate(interaction, rows, (pageItems, info) => {
    const fields = pageItems.map((t) => {
      const isPremium = (t.premium_features?.length ?? 0) > 0
      const author = t.author?.username || 'unknown'
      const tagList = (t.tags || []).slice(0, 4).map((x) => `\`${x}\``).join(' ') || '(no tags)'
      return {
        name: `${isPremium ? '⭐ ' : ''}${t.name}`,
        value:
          (t.description ? `${String(t.description).slice(0, 160)}\n` : '') +
          `by **@${author}** · ${tagList}\n` +
          `📥 ${t.uses_count} applied · ❤️ ${t.likes_count} · ` +
          `[preview](https://halo.rip/templates/preview/${t.id})`,
        inline: false,
      }
    })
    return new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle(`🎨 Templates - ${sortLabel}${tag ? ` (#${tag})` : ''}`)
      .addFields(fields)
      .setFooter({ text: `Page ${info.page} of ${info.totalPages} · ${info.total} total · ⭐ = premium required` })
      .setTimestamp()
  }, { pageSize: 5 })
}

async function searchTemplates(interaction) {
  const q = interaction.options.getString('query').trim()
  const { data: rows, error } = await supabase
    .from('templates')
    .select('id, name, description, tags, uses_count, likes_count, premium_features, created_at, author:profiles!templates_user_id_fkey(username)')
    .eq('visibility', 'public')
    .ilike('name', `%${q}%`)
    .order('likes_count', { ascending: false })
    .limit(30)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })
  if (!rows?.length) return interaction.editReply({ embeds: [errorEmbed('No Results', `No templates matching \`${q}\``)] })

  await paginate(interaction, rows, (pageItems, info) => {
    const fields = pageItems.map((t) => ({
      name: `${(t.premium_features?.length ?? 0) > 0 ? '⭐ ' : ''}${t.name}`,
      value:
        `by **@${t.author?.username || 'unknown'}** · ${t.tags?.length ? t.tags.map((x) => `\`${x}\``).join(' ') : '(no tags)'}\n` +
        `📥 ${t.uses_count} · ❤️ ${t.likes_count} · ` +
        `[preview](https://halo.rip/templates/preview/${t.id})`,
      inline: false,
    }))
    return new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle(`🎨 Templates: "${q}"`)
      .addFields(fields)
      .setFooter({ text: `Page ${info.page} of ${info.totalPages} · ${info.total} match${info.total === 1 ? '' : 'es'}` })
      .setTimestamp()
  }, { pageSize: 5 })
}
