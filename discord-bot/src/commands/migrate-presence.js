/**
 * /migrate-presence - re-runnable DM blast to every user who has a
 * Discord Presence widget configured on their halo.rip profile.
 *
 * Tells them Lanyard is out, halo.rip's own bot is in, and they
 * need to join the halo.rip Discord server for their widget to
 * keep working. The DM contains a "No" button that triggers the
 * "Are you sure?" follow-up flow (see events/migrate-buttons.js).
 *
 * Idempotency: every attempt is logged to `migration_dm_log` with
 * a status of 'delivered' or 'failed'. Subsequent invocations skip
 * users with a 'delivered' row by default, so you can run the
 * command repeatedly until everyone's been reached. Failed users
 * stay eligible for retry (their row gets UPSERTed with the new
 * attempt count + latest error).
 *
 * Options:
 *   dry_run: true  - preview the audience without sending DMs
 *   force: true    - bypass the dedupe and re-DM every Discord-widget
 *                    user, including ones we've already delivered to.
 *                    Useful when you change the DM copy and want
 *                    everyone to see the new version.
 *
 * Throttling: 750ms between DMs (~1.3/sec). The first run with 250ms
 * tripped Discord's bulk-DM rate limit at ~40 DMs and the rest of
 * the queue failed. The slower pace lets discord.js's built-in
 * rate-limit handling absorb the occasional 429 without cascading.
 */

import { SlashCommandBuilder } from 'discord.js'
import supabase from '../utils/supabase.js'
import { errorEmbed, BRAND_COLOR } from '../utils/embeds.js'
import { EmbedBuilder } from 'discord.js'
import { migrationDm } from '../events/migrate-buttons.js'

export const meta = { permission: 'owner', rateLimit: 'destructive' }

const DM_INTERVAL_MS = 750

export const data = new SlashCommandBuilder()
  .setName('migrate-presence')
  .setDescription('DM every Discord-widget user telling them to join halo.rip (owner only)')
  .addBooleanOption((o) =>
    o.setName('dry_run').setDescription('Only show who WOULD be DMed, send nothing').setRequired(false),
  )
  .addBooleanOption((o) =>
    o.setName('force').setDescription('Re-DM users we already delivered to (e.g. updated copy)').setRequired(false),
  )

export async function execute(interaction) {
  const dryRun = interaction.options.getBoolean('dry_run') ?? false
  const force = interaction.options.getBoolean('force') ?? false
  await interaction.deferReply({ flags: 64 })

  // Find every Discord-widget config in the widgets table.
  // config.userId is the Discord snowflake to DM.
  const { data: rows, error } = await supabase
    .from('widgets')
    .select('user_id, config')
    .eq('type', 'discord')
    .eq('enabled', true)

  if (error) {
    return interaction.editReply({
      embeds: [errorEmbed('Query failed', error.message || 'Could not load widgets.')],
    })
  }

  // Build the full audience (dedupe by Discord ID).
  const audience = new Set()
  for (const row of rows ?? []) {
    const id = String(row?.config?.userId ?? '').trim()
    if (/^\d{17,20}$/.test(id)) audience.add(id)
  }

  if (audience.size === 0) {
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('Nothing to do')
        .setDescription('No users currently have a Discord Presence widget enabled.')],
    })
  }

  // Load already-delivered IDs from migration_dm_log so we can skip
  // them. force=true means we ignore the log and re-DM everyone.
  const skip = new Set()
  if (!force) {
    const { data: logRows, error: logErr } = await supabase
      .from('migration_dm_log')
      .select('user_id')
      .eq('status', 'delivered')
    if (logErr) {
      // Log table might not exist yet (first deploy). Continue
      // with an empty skip-set; the first run will populate it.
      console.warn('[migrate-presence] could not load migration_dm_log:', logErr.message)
    } else {
      for (const r of logRows ?? []) skip.add(r.user_id)
    }
  }

  // Final audience = full audience minus already-delivered.
  const ids = [...audience].filter((id) => !skip.has(id))

  if (ids.length === 0) {
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('Nothing to do')
        .setDescription(`All ${audience.size} widget users have already received the migration DM. Use \`force:true\` to re-blast.`)],
    })
  }

  if (dryRun) {
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle(`Dry run: ${ids.length} user${ids.length === 1 ? '' : 's'} would be DMed`)
        .setDescription(ids.slice(0, 50).map((id) => `\`${id}\``).join('\n') || '(none)')
        .setFooter({
          text: [
            `Audience total: ${audience.size}`,
            `Already delivered: ${skip.size}`,
            `Pending: ${ids.length}`,
            ids.length > 50 ? `Showing first 50 of ${ids.length}` : '',
            'No DMs sent.',
          ].filter(Boolean).join(' · '),
        })],
    })
  }

  // Real blast. Embed + components are built fresh each loop so
  // we don't accidentally share mutable state across attempts.
  let sent = 0
  let failed = 0
  const failedIds = []

  for (const id of ids) {
    let success = false
    let errMsg = null

    try {
      const user = await interaction.client.users.fetch(id).catch(() => null)
      if (!user) {
        errMsg = 'Unknown user'
      } else {
        await user.send({
          embeds: [migrationDm.buildEmbed()],
          components: migrationDm.buildComponents(),
        })
        success = true
        sent++
      }
    } catch (err) {
      errMsg = err?.message || 'Send failed'
      console.error(`[migrate-presence] failed for ${id}:`, errMsg)
    }

    if (!success) {
      failed++
      failedIds.push(id)
    }

    // UPSERT the result. attempts increments on conflict so we can
    // see who's been hammered repeatedly.
    await supabase.from('migration_dm_log').upsert(
      {
        user_id: id,
        status: success ? 'delivered' : 'failed',
        error: success ? null : (errMsg ?? 'unknown'),
        attempted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    ).then(({ error: upErr }) => {
      if (upErr) console.error('[migrate-presence] log upsert failed:', upErr.message)
    })

    // Slow throttle. 750ms between DMs ≈ 1.3 per second, well
    // under Discord's bulk-DM ceiling.
    await new Promise((r) => setTimeout(r, DM_INTERVAL_MS))
  }

  // Bump attempts counter for the failed ones (the upsert above
  // overwrites the row but doesn't increment attempts). Do this in
  // one SQL update so we don't fire N extra queries.
  if (failedIds.length > 0) {
    await supabase.rpc('increment_migration_attempts', { p_user_ids: failedIds })
      .then(({ error: rpcErr }) => {
        if (rpcErr && !rpcErr.message?.includes('does not exist')) {
          console.warn('[migrate-presence] attempts increment failed:', rpcErr.message)
        }
      })
  }

  return interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('Migration DM blast complete')
      .addFields(
        { name: 'Audience total',         value: String(audience.size), inline: true },
        { name: 'Already delivered (skipped)', value: String(skip.size), inline: true },
        { name: 'Attempted this run',     value: String(ids.length),    inline: true },
        { name: 'DMs delivered',          value: String(sent),          inline: true },
        { name: 'Failed',                 value: String(failed),        inline: true },
        { name: 'Throttle',               value: `${DM_INTERVAL_MS}ms`, inline: true },
      )
      .setDescription(
        failedIds.length > 0
          ? `Re-run \`/migrate-presence\` (no flag) to retry just these ${failedIds.length} failures.\nFirst 30 failed IDs:\n\`\`\`\n${failedIds.slice(0, 30).join('\n')}\n\`\`\``
          : 'All deliveries succeeded.',
      )
      .setTimestamp()],
  })
}
