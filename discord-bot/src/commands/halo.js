import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import supabase from '../utils/supabase.js'
import {
  errorEmbed,
  BRAND_COLOR,
} from '../utils/embeds.js'

export const meta = { permission: 'public', rateLimit: 'public' }

// Public stats card. Reuses statsEmbed's structure but excludes PII /
// internal metrics: no banned-user count, no Discord-linked count, no
// 24h breakdowns. Just headline numbers the community can see.
export const data = new SlashCommandBuilder()
  .setName('halo')
  .setDescription('Public halo.rip platform stats')

export async function execute(interaction) {
  await interaction.deferReply()

  try {
    const [totalUsersRes, premiumRes, viewsRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_public', true).eq('banned', false),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).or('is_premium.eq.true,premium_active.eq.true').eq('banned', false),
      supabase.from('profiles').select('view_count').eq('is_public', true),
    ])

    const totalUsers = totalUsersRes.count || 0
    const premiumUsers = premiumRes.count || 0
    const totalViews = (viewsRes.data || []).reduce((sum, p) => sum + (p.view_count || 0), 0)
    const premiumPct = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('halo.rip')
        .setURL('https://halo.rip')
        .setDescription('Customizable profile pages with effects, music, links, and more.')
        .addFields(
          { name: '👥 Public profiles', value: totalUsers.toLocaleString(), inline: true },
          { name: '⭐ Premium users',   value: `${premiumUsers.toLocaleString()} (${premiumPct}%)`, inline: true },
          { name: '👁️ Total views',    value: totalViews.toLocaleString(), inline: true },
        )
        .setFooter({ text: 'halo.rip · build your perfect profile' })
        .setTimestamp()],
    })
  } catch (err) {
    console.error('[/halo]', err)
    return interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to fetch stats.')] })
  }
}
