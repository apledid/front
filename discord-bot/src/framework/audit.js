import supabase from '../utils/supabase.js'
import { sendLog } from '../utils/logger.js'
import { logEmbed, BRAND_COLOR, ERROR_COLOR, SUCCESS_COLOR } from '../utils/embeds.js'

/**
 * Insert one row into discord_audit_log + mirror a brief line to the
 * configured Discord log channel.
 *
 * Designed to be called from the command handler's auditWrap middleware,
 * but command bodies can also call writeAudit() directly for richer
 * per-action details (e.g. /user ban writes the reason + target into
 * `details` after it has resolved the target profile).
 *
 * Failures here never throw - audit is best-effort. We don't want a
 * Postgres hiccup to break /user ban.
 */
export async function writeAudit({
  executor,                 // { discord_id, username }
  command,                  // top-level slash command, e.g. 'user'
  subcommand = null,        // e.g. 'ban'
  target = null,            // { user_id, username } - both optional
  details = {},
  success = true,
  errorMessage = null,
  mirror = true,            // also post a one-liner to the log channel
}) {
  try {
    await supabase.from('discord_audit_log').insert({
      executor_discord_id: executor?.discord_id || 'unknown',
      executor_username:   executor?.username   || 'unknown',
      command,
      subcommand,
      target_user_id:   target?.user_id   || null,
      target_username:  target?.username  || null,
      details:          details || {},
      success,
      error_message:    errorMessage,
    })
  } catch (err) {
    console.error('[audit] Failed to write log row:', err?.message || err)
  }

  if (!mirror) return

  // Live ops mirror - a one-line embed posted to the channel so watchers
  // see activity in real time. The DB row is the durable copy.
  try {
    const cmdLabel = subcommand ? `\`/${command} ${subcommand}\`` : `\`/${command}\``
    const targetLabel = target?.username ? ` -> **${target.username}**` : ''
    const status = success ? '✅' : '❌'
    const description = `${status} ${cmdLabel}${targetLabel}\n**By:** ${executor?.username || 'unknown'}`
    const color = success ? BRAND_COLOR : ERROR_COLOR
    void sendLog(logEmbed(`Audit: ${command}${subcommand ? `/${subcommand}` : ''}`, description, color))
  } catch (err) {
    console.error('[audit] Mirror to channel failed:', err?.message || err)
  }
}

/**
 * Convenience: format a single audit_log row into an embed for the
 * /staff audit list command.
 */
export function formatAuditRow(row) {
  const lines = []
  lines.push(`**By:** ${row.executor_username} (\`${row.executor_discord_id}\`)`)
  if (row.target_username) lines.push(`**Target:** ${row.target_username}`)
  if (row.details && Object.keys(row.details).length > 0) {
    const detailLines = Object.entries(row.details)
      .map(([k, v]) => `  • \`${k}\`: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .slice(0, 6)
    lines.push('**Details:**\n' + detailLines.join('\n'))
  }
  if (!row.success && row.error_message) lines.push(`**Error:** ${row.error_message}`)
  return {
    name: `${row.success ? '✅' : '❌'} /${row.command}${row.subcommand ? ` ${row.subcommand}` : ''} · <t:${Math.floor(new Date(row.created_at).getTime() / 1000)}:R>`,
    value: lines.join('\n').slice(0, 1024),
    inline: false,
  }
}

/** Color helper exposed for command code that wants to render an audit
 *  preview embed before the row is actually written. */
export const AUDIT_COLORS = { ok: SUCCESS_COLOR, fail: ERROR_COLOR }
