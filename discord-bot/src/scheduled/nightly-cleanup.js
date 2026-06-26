import supabase from '../utils/supabase.js'
import { sendLog } from '../utils/logger.js'
import { logEmbed, WARN_COLOR } from '../utils/embeds.js'
import { writeTaskResult } from './ledger.js'

export const taskKey = 'nightly_cleanup'

/**
 * Delete profiles older than 24h that haven't verified their email.
 * Cascade-deletes related rows. Mirrors the logic in /staff cleanup.
 *
 * Called by node-cron at 0 3 * * * UTC and by /staff schedule run-now.
 */
export async function run() {
  const startedAt = Date.now()
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: noEmail } = await supabase
      .from('profiles').select('id, username').is('email', null).lt('created_at', cutoff)
    const { data: unverified } = await supabase
      .from('profiles').select('id, username').eq('email_verified', false).lt('created_at', cutoff)

    const seen = new Set()
    const toDelete = [...(noEmail || []), ...(unverified || [])].filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

    if (toDelete.length === 0) {
      await writeTaskResult(taskKey, { status: 'success', details: { deleted: 0, duration_ms: Date.now() - startedAt } })
      return { deleted: 0 }
    }

    const ids = toDelete.map((p) => p.id)
    const usernames = toDelete.map((p) => p.username || 'unknown')

    await Promise.all([
      supabase.from('social_links').delete().in('user_id', ids),
      supabase.from('custom_buttons').delete().in('user_id', ids),
      supabase.from('profile_badges').delete().in('user_id', ids),
      supabase.from('profile_badge_loadout').delete().in('user_id', ids),
      supabase.from('profile_title_loadout').delete().in('user_id', ids),
      supabase.from('music_history').delete().in('user_id', ids),
      supabase.from('page_views').delete().in('profile_id', ids),
      supabase.from('link_clicks').delete().in('user_id', ids),
      supabase.from('inbox_messages').delete().in('user_id', ids),
    ])
    await supabase.from('profiles').delete().in('id', ids)

    await sendLog(logEmbed(
      '🌙 Nightly Cleanup Ran',
      `**Deleted:** ${toDelete.length} unverified accounts\n**Usernames:** ${usernames.slice(0, 20).join(', ')}${usernames.length > 20 ? '...' : ''}`,
      WARN_COLOR,
    )).catch(() => {})

    await writeTaskResult(taskKey, {
      status: 'success',
      details: { deleted: toDelete.length, usernames: usernames.slice(0, 100), duration_ms: Date.now() - startedAt },
    })
    return { deleted: toDelete.length, usernames }
  } catch (err) {
    await writeTaskResult(taskKey, { status: 'error', error: err.message })
    console.error('[nightly_cleanup] failed:', err)
    throw err
  }
}
