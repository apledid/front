import { EmbedBuilder } from 'discord.js'
import supabase from '../utils/supabase.js'
import { BRAND_COLOR } from '../utils/embeds.js'
import { writeTaskResult } from './ledger.js'

export const taskKey = 'weekly_leaderboard'

/**
 * Post the top-10 profiles by view count to a configured channel.
 *
 * Channel is configured via the LEADERBOARD_CHANNEL_ID env var. If unset,
 * the task records `status='skipped'` and exits without erroring.
 *
 * Called by node-cron at 0 9 * * 1 UTC (Monday 9am) and by /staff
 * schedule run-now.
 */
export async function run(client) {
  const startedAt = Date.now()
  try {
    const channelId = process.env.LEADERBOARD_CHANNEL_ID
    if (!channelId) {
      await writeTaskResult(taskKey, { status: 'skipped', details: { reason: 'LEADERBOARD_CHANNEL_ID not set' } })
      return { skipped: true, reason: 'channel not configured' }
    }
    if (!client) {
      await writeTaskResult(taskKey, { status: 'skipped', details: { reason: 'No client passed (manual run-now)' } })
      return { skipped: true, reason: 'no Discord client' }
    }

    const { data: rows, error } = await supabase
      .from('profiles')
      .select('username, view_count, is_premium, premium_active')
      .eq('banned', false)
      .eq('is_public', true)
      .order('view_count', { ascending: false })
      .limit(10)
    if (error) throw error

    const lines = (rows || []).map((p, i) => {
      const rank = i + 1
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `\`${rank}.\``
      const premium = (p.is_premium || p.premium_active) ? ' ⭐' : ''
      return `${medal} [**${p.username}**](https://halo.rip/${p.username})${premium} - ${(p.view_count || 0).toLocaleString()} views`
    })

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🏆 Weekly Leaderboard')
      .setDescription(lines.join('\n') || 'No data this week.')
      .setFooter({ text: 'halo.rip · top profiles by view count' })
      .setTimestamp()

    const channel = await client.channels.fetch(channelId).catch(() => null)
    if (!channel) {
      await writeTaskResult(taskKey, { status: 'error', error: `Channel ${channelId} not found / no access` })
      return { error: 'channel not found' }
    }
    await channel.send({ embeds: [embed] })

    await writeTaskResult(taskKey, {
      status: 'success',
      details: { rank_count: rows?.length || 0, channel_id: channelId, duration_ms: Date.now() - startedAt },
    })
    return { posted: rows?.length || 0 }
  } catch (err) {
    await writeTaskResult(taskKey, { status: 'error', error: err.message })
    console.error('[weekly_leaderboard] failed:', err)
    throw err
  }
}
