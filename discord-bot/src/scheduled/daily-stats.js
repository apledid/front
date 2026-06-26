import { EmbedBuilder } from 'discord.js'
import supabase from '../utils/supabase.js'
import { BRAND_COLOR } from '../utils/embeds.js'
import { writeTaskResult } from './ledger.js'

export const taskKey = 'daily_stats'

/**
 * Post a daily platform-stats card to a staff channel.
 *
 * Channel is configured via the STAFF_CHANNEL_ID env var. If unset,
 * the task records `status='skipped'` and exits.
 *
 * Called by node-cron at 0 8 * * * UTC (8am daily) and by /staff
 * schedule run-now.
 */
export async function run(client) {
  const startedAt = Date.now()
  try {
    const channelId = process.env.STAFF_CHANNEL_ID
    if (!channelId) {
      await writeTaskResult(taskKey, { status: 'skipped', details: { reason: 'STAFF_CHANNEL_ID not set' } })
      return { skipped: true, reason: 'channel not configured' }
    }
    if (!client) {
      await writeTaskResult(taskKey, { status: 'skipped', details: { reason: 'No client passed' } })
      return { skipped: true, reason: 'no Discord client' }
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [
      totalUsersRes, premiumRes, verifiedRes, newUsersRes,
      newPremiumRes, viewsTodayRes, bansTodayRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).or('is_premium.eq.true,premium_active.eq.true'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('email_verified', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
      supabase.from('profiles').select('*', { count: 'exact', head: true })
        .or('is_premium.eq.true,premium_active.eq.true').gte('premium_activated_at', oneDayAgo),
      supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('last_viewed_at', oneDayAgo),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('banned_at', oneDayAgo),
    ])

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('📈 Daily Stats')
      .setDescription(`Snapshot for the last 24h.`)
      .addFields(
        { name: '👥 Total users',      value: (totalUsersRes.count || 0).toLocaleString(), inline: true },
        { name: '⭐ Premium users',    value: (premiumRes.count || 0).toLocaleString(),    inline: true },
        { name: '✅ Verified users',   value: (verifiedRes.count || 0).toLocaleString(),   inline: true },
        { name: '🆕 Signups today',    value: (newUsersRes.count || 0).toLocaleString(),   inline: true },
        { name: '🪙 New premium',      value: (newPremiumRes.count || 0).toLocaleString(), inline: true },
        { name: '👁️ Views today',     value: (viewsTodayRes.count || 0).toLocaleString(),  inline: true },
        { name: '🔨 Bans today',       value: (bansTodayRes.count || 0).toLocaleString(),  inline: true },
      )
      .setFooter({ text: 'halo.rip · automated daily report' })
      .setTimestamp()

    const channel = await client.channels.fetch(channelId).catch(() => null)
    if (!channel) {
      await writeTaskResult(taskKey, { status: 'error', error: `Channel ${channelId} not found / no access` })
      return { error: 'channel not found' }
    }
    await channel.send({ embeds: [embed] })

    await writeTaskResult(taskKey, {
      status: 'success',
      details: {
        total_users: totalUsersRes.count || 0,
        premium_users: premiumRes.count || 0,
        new_users_24h: newUsersRes.count || 0,
        new_premium_24h: newPremiumRes.count || 0,
        views_24h: viewsTodayRes.count || 0,
        bans_24h: bansTodayRes.count || 0,
        duration_ms: Date.now() - startedAt,
      },
    })
    return { posted: true }
  } catch (err) {
    await writeTaskResult(taskKey, { status: 'error', error: err.message })
    console.error('[daily_stats] failed:', err)
    throw err
  }
}
