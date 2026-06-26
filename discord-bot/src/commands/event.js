import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import supabase from '../utils/supabase.js'
import {
  errorEmbed,
  infoEmbed,
  logEmbed,
  BRAND_COLOR,
  ERROR_COLOR,
} from '../utils/embeds.js'
import { sendLog } from '../utils/logger.js'

export const meta = { permission: 'owner', rateLimit: 'admin' }

// Premium-gated field values that must be stripped when the event ends.
// Kept in sync with lib/premium-features.ts on the website side.
const PREMIUM_USERNAME_EFFECTS = ['typewriter', 'rainbow', 'shuffle', 'glitch', 'wave']
const PREMIUM_CURSOR_EFFECTS   = ['spark-trail', 'ghost-trail', 'falling-spark', 'cat', 'splash', 'rainbow']
const PREMIUM_HOVER_EFFECTS    = ['glow', 'pulse', 'shake']
const CONFIG_KEY = 'free_event'

export const data = new SlashCommandBuilder()
  .setName('event')
  .setDescription('Manage the free premium event (owner only)')
  .addSubcommand((sub) => sub.setName('start').setDescription('Start the free premium event (everyone gets premium)'))
  .addSubcommand((sub) => sub.setName('end').setDescription('End the event - non-original-premium users revert to free'))
  .addSubcommand((sub) => sub.setName('status').setDescription('Check whether the event is currently active'))

export async function execute(interaction) {
  await interaction.deferReply()
  const sub = interaction.options.getSubcommand()
  if (sub === 'status') return statusEvent(interaction)
  if (sub === 'start')  return startEvent(interaction)
  if (sub === 'end')    return endEvent(interaction)
}

async function statusEvent(interaction) {
  const { data: row } = await supabase
    .from('site_config')
    .select('value')
    .eq('key', CONFIG_KEY)
    .maybeSingle()

  if (!row) {
    return interaction.editReply({ embeds: [infoEmbed('Free Event', '❌ No event is currently active.')] })
  }

  const v = row.value
  const premiumCount = v.premium_ids?.length ?? 0
  const started = v.started_at
    ? `<t:${Math.floor(new Date(v.started_at).getTime() / 1000)}:R>`
    : 'unknown'

  return interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🎉 Free Event - ACTIVE')
      .setDescription(`**Started:** ${started}\n**Started by:** ${v.started_by || 'unknown'}\n**Pre-event premium users:** ${premiumCount.toLocaleString()}`)
      .setTimestamp()],
  })
}

async function startEvent(interaction) {
  const { data: existing } = await supabase
    .from('site_config').select('value').eq('key', CONFIG_KEY).maybeSingle()
  if (existing) {
    return interaction.editReply({ embeds: [errorEmbed('Already Active', '⚠️ A free event is already running. End it first with `/event end`.')] })
  }

  const { data: premiumUsers, error: snapErr } = await supabase
    .from('profiles')
    .select('id')
    // Paid users may have premium_active=true but is_premium=false (Stripe
    // sets only premium_active). Snapshot by EITHER flag, else they'd be
    // caught by the is_premium=false grant below, tagged premium_type='event',
    // and wrongly stripped of premium when the event ends.
    .or('is_premium.eq.true,premium_active.eq.true')
  if (snapErr) return interaction.editReply({ embeds: [errorEmbed('Snapshot Failed', snapErr.message)] })

  const premiumIds = (premiumUsers || []).map((u) => u.id)

  const { error: configErr } = await supabase
    .from('site_config')
    .upsert({
      key: CONFIG_KEY,
      value: {
        active: true,
        premium_ids: premiumIds,
        started_at: new Date().toISOString(),
        started_by: interaction.user.tag,
      },
      updated_at: new Date().toISOString(),
    })
  if (configErr) return interaction.editReply({ embeds: [errorEmbed('Config Error', configErr.message)] })

  const { error: grantErr, count: grantCount } = await supabase
    .from('profiles')
    .update({ is_premium: true, premium_active: true, premium_type: 'event' })
    // Only grant to genuinely-free users (neither flag). Excluding
    // premium_active=true means paid users are never tagged premium_type=
    // 'event', so endEvent can't strip them.
    .eq('is_premium', false)
    .eq('premium_active', false)
    .select('id', { count: 'exact', head: true })
  if (grantErr) {
    await supabase.from('site_config').delete().eq('key', CONFIG_KEY)
    return interaction.editReply({ embeds: [errorEmbed('Grant Failed', grantErr.message)] })
  }
  const totalGranted = grantCount ?? '?'

  await sendLog(new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle('🎉 FREE PREMIUM EVENT STARTED')
    .setDescription(
      `**Started by:** ${interaction.user.tag}\n` +
      `**Pre-event premium users:** ${premiumIds.length.toLocaleString()}\n` +
      `**Newly unlocked accounts:** ~${String(totalGranted)}\n` +
      `**All features are now FREE for everyone.**`,
    )
    .setTimestamp())

  return interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('🎉 Free Event Started!')
      .setDescription(
        `Every single user now has access to **all premium features** for free.\n\n` +
        `📸 **Snapshot saved:** ${premiumIds.length.toLocaleString()} pre-existing premium users\n` +
        `✅ **Unlocked:** ~${String(totalGranted)} additional accounts\n\n` +
        `When the event ends, only those ${premiumIds.length.toLocaleString()} original premium users will keep their premium. ` +
        `All others will have premium features stripped from their profiles.`,
      )
      .setTimestamp()],
  })
}

async function endEvent(interaction) {
  const { data: row, error: rowErr } = await supabase
    .from('site_config').select('value').eq('key', CONFIG_KEY).maybeSingle()
  if (rowErr) return interaction.editReply({ embeds: [errorEmbed('Error', rowErr.message)] })
  if (!row) return interaction.editReply({ embeds: [errorEmbed('No Event', 'There is no active free event to end.')] })

  const premiumIds = row.value.premium_ids || []

  const { data: eventUsers, error: fetchErr } = await supabase
    .from('profiles').select('id').eq('premium_type', 'event')
  if (fetchErr) return interaction.editReply({ embeds: [errorEmbed('Fetch Error', fetchErr.message)] })

  const eventUserIds = (eventUsers || []).map((u) => u.id)
  let stripped = 0
  const BATCH = 200

  for (let i = 0; i < eventUserIds.length; i += BATCH) {
    const batch = eventUserIds.slice(i, i + BATCH)
    if (!batch.length) continue

    await supabase
      .from('profiles')
      .update({ is_premium: false, premium_active: false, premium_type: null })
      .in('id', batch)

    const { data: batchProfiles } = await supabase
      .from('profiles')
      .select('id, username_effect, cursor_effect, hover_effect, monochrome_icons, custom_font_url, enter_enabled, outline_enabled, cursor_trail_enabled, custom_cursor_url, custom_cursor_hover_url')
      .in('id', batch)

    if (batchProfiles) {
      for (const p of batchProfiles) {
        const resets = {}
        if (p.username_effect && PREMIUM_USERNAME_EFFECTS.includes(p.username_effect)) resets.username_effect = 'none'
        if (p.cursor_effect   && PREMIUM_CURSOR_EFFECTS.includes(p.cursor_effect))     resets.cursor_effect   = 'none'
        if (p.hover_effect    && PREMIUM_HOVER_EFFECTS.includes(p.hover_effect))       resets.hover_effect    = 'none'
        if (p.monochrome_icons)      resets.monochrome_icons      = false
        if (p.custom_font_url)       resets.custom_font_url       = null
        if (p.enter_enabled)         resets.enter_enabled         = false
        if (p.outline_enabled)       resets.outline_enabled       = false
        if (p.cursor_trail_enabled)  resets.cursor_trail_enabled  = false
        if (p.custom_cursor_url)     resets.custom_cursor_url     = null
        if (p.custom_cursor_hover_url) resets.custom_cursor_hover_url = null
        if (Object.keys(resets).length > 0) {
          await supabase.from('profiles').update(resets).eq('id', p.id)
          stripped++
        }
      }
    }
  }

  await supabase.from('site_config').delete().eq('key', CONFIG_KEY)

  await sendLog(new EmbedBuilder()
    .setColor(ERROR_COLOR)
    .setTitle('🔒 FREE PREMIUM EVENT ENDED')
    .setDescription(
      `**Ended by:** ${interaction.user.tag}\n` +
      `**Accounts reverted to free:** ${eventUserIds.length.toLocaleString()}\n` +
      `**Profiles with features stripped:** ${stripped.toLocaleString()}\n` +
      `**Original premium users kept:** ${premiumIds.length.toLocaleString()}`,
    )
    .setTimestamp())

  return interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(ERROR_COLOR)
      .setTitle('🔒 Free Event Ended')
      .setDescription(
        `The free premium event has been closed.\n\n` +
        `🔴 **Reverted to free tier:** ${eventUserIds.length.toLocaleString()} accounts\n` +
        `🗑️ **Premium features stripped from:** ${stripped.toLocaleString()} profiles\n` +
        `⭐ **Kept premium (original):** ${premiumIds.length.toLocaleString()} users\n\n` +
        `All non-premium users have had their premium-gated effects, fonts, cursors, and settings removed.`,
      )
      .setTimestamp()],
  })
}
