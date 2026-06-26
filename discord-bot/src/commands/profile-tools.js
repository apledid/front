import { SlashCommandBuilder } from 'discord.js'
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

export const meta = { permission: 'admin', rateLimit: 'admin' }

export const data = new SlashCommandBuilder()
  .setName('profile-tools')
  .setDescription('Per-profile data tools (view counts, UIDs, username swaps)')
  .addSubcommand((sub) =>
    sub
      .setName('viewset')
      .setDescription("Override a user's view count or lock it")
      .addStringOption((opt) => opt.setName('username').setDescription('Target username').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('action').setDescription('What to do').setRequired(true).addChoices(
          { name: 'set - override to a specific number', value: 'set' },
          { name: 'lock - freeze view count', value: 'lock' },
          { name: 'unlock - resume incrementing', value: 'unlock' },
          { name: 'info - show count + lock status', value: 'info' },
        ))
      .addIntegerOption((opt) =>
        opt.setName('count').setDescription('New view count (required for set)').setRequired(false).setMinValue(0)))
  .addSubcommand((sub) =>
    sub
      .setName('setuid')
      .setDescription("Override a user's UID number")
      .addStringOption((opt) => opt.setName('username').setDescription('Target username').setRequired(true))
      .addIntegerOption((opt) => opt.setName('uid').setDescription('New UID').setRequired(true).setMinValue(1)))
  .addSubcommand((sub) =>
    sub
      .setName('usernameswap')
      .setDescription('Swap usernames between two users (optional: grant lifetime to recipient)')
      .addStringOption((opt) => opt.setName('from').setDescription('Current owner of the desired username').setRequired(true))
      .addStringOption((opt) => opt.setName('to').setDescription('User to receive the username').setRequired(true))
      .addBooleanOption((opt) => opt.setName('grant_lifetime').setDescription('Also grant lifetime premium to the recipient').setRequired(false)))

export async function execute(interaction) {
  await interaction.deferReply()
  const sub = interaction.options.getSubcommand()
  if (sub === 'viewset')      return viewset(interaction)
  if (sub === 'setuid')       return setuid(interaction)
  if (sub === 'usernameswap') return usernameswap(interaction)
}

async function viewset(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const action = interaction.options.getString('action')
  const newCount = interaction.options.getInteger('count')

  const { data: profile, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, username, view_count, views_locked')
    .eq('username', username)
    .maybeSingle()
  if (fetchErr || !profile) return interaction.editReply({ embeds: [errorEmbed('Not Found', `No user \`${username}\``)] })

  if (action === 'info') {
    const locked = profile.views_locked === true
    return interaction.editReply({
      embeds: [infoEmbed(
        `👁️ View Info - ${username}`,
        `**View count:** ${(profile.view_count || 0).toLocaleString()}\n**Status:** ${locked ? '🔒 Locked (not incrementing)' : '🔓 Unlocked'}`,
      )],
    })
  }

  if (action === 'set') {
    if (newCount === null || newCount === undefined) {
      return interaction.editReply({ embeds: [errorEmbed('Missing', 'Provide a `count` for the set action.')] })
    }
    const oldCount = profile.view_count || 0
    const { error } = await supabase.from('profiles').update({ view_count: newCount }).eq('id', profile.id)
    if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

    await sendLog(logEmbed(
      '👁️ View Count Overridden',
      `**User:** \`${username}\`\n**Old:** ${oldCount.toLocaleString()}\n**New:** ${newCount.toLocaleString()}\n**By:** ${interaction.user.tag}`,
      WARN_COLOR,
    ))
    return interaction.editReply({
      embeds: [successEmbed('View Count Updated', `\`${username}\` set to **${newCount.toLocaleString()}** (was ${oldCount.toLocaleString()}).`)],
    })
  }

  if (action === 'lock') {
    if (profile.views_locked === true) {
      return interaction.editReply({ embeds: [infoEmbed('Already Locked', `\`${username}\` is already locked.`)] })
    }
    const { error } = await supabase.from('profiles').update({ views_locked: true }).eq('id', profile.id)
    if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })
    await sendLog(logEmbed('🔒 Views Locked', `**User:** \`${username}\`\n**By:** ${interaction.user.tag}`, WARN_COLOR))
    return interaction.editReply({ embeds: [successEmbed('Views Locked', `\`${username}\` is now **frozen** at ${(profile.view_count || 0).toLocaleString()}.`)] })
  }

  if (action === 'unlock') {
    if (profile.views_locked !== true) {
      return interaction.editReply({ embeds: [infoEmbed('Already Unlocked', `\`${username}\` is already unlocked.`)] })
    }
    const { error } = await supabase.from('profiles').update({ views_locked: false }).eq('id', profile.id)
    if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })
    await sendLog(logEmbed('🔓 Views Unlocked', `**User:** \`${username}\`\n**By:** ${interaction.user.tag}`, BRAND_COLOR))
    return interaction.editReply({ embeds: [successEmbed('Views Unlocked', `\`${username}\` will now increment normally.`)] })
  }
}

async function setuid(interaction) {
  const username = interaction.options.getString('username').toLowerCase().trim()
  const newUid = interaction.options.getInteger('uid')

  const { data: profile, error: fetchErr } = await supabase
    .from('profiles').select('id, username, uid').eq('username', username).maybeSingle()
  if (fetchErr || !profile) return interaction.editReply({ embeds: [errorEmbed('Not Found', `No user \`${username}\``)] })

  const oldUid = profile.uid

  // profiles.uid has no DB unique constraint, so without this check setuid
  // would silently create duplicate UIDs. Reject if another profile holds it.
  const { data: clash } = await supabase
    .from('profiles').select('username').eq('uid', newUid).neq('id', profile.id).maybeSingle()
  if (clash) {
    return interaction.editReply({ embeds: [errorEmbed('UID Taken', `UID #${newUid} is already held by \`${clash.username}\`. Pick another.`)] })
  }

  const { error } = await supabase.from('profiles').update({ uid: newUid }).eq('id', profile.id)
  if (error) return interaction.editReply({ embeds: [errorEmbed('Error', error.message)] })

  await sendLog(logEmbed(
    '🔢 UID Changed',
    `**User:** \`${username}\`\n**Old UID:** ${oldUid ?? 'none'}\n**New UID:** ${newUid}\n**By:** ${interaction.user.tag}`,
    WARN_COLOR,
  ))
  return interaction.editReply({
    embeds: [successEmbed('UID Updated', `\`${username}\`'s UID is now **#${newUid}** (was ${oldUid ?? 'none'}).`)],
  })
}

async function usernameswap(interaction) {
  const fromUsername = interaction.options.getString('from').toLowerCase().trim()
  const toUsername = interaction.options.getString('to').toLowerCase().trim()
  const grantLifetime = interaction.options.getBoolean('grant_lifetime') ?? false

  // Loosened from the strict signup regex per owner request - any
  // admin-issued username is allowed as long as it isn't empty,
  // doesn't blow past 32 chars, and doesn't contain the small set
  // of characters that break Discord embed rendering or enable
  // markdown-link phishing in unescaped interpolation contexts.
  // Lowercased for URL-routing parity (app/[username]/page.tsx
  // lowercases the URL param before the DB lookup).
  const BAD_CHARS_RE = /[\s`\[\]()<>|\/\\\x00-\x1f\x7f]/
  function isValid(u) {
    return u.length >= 1 && u.length <= 32 && !BAD_CHARS_RE.test(u)
  }
  if (!isValid(fromUsername) || !isValid(toUsername)) {
    return interaction.editReply({
      embeds: [errorEmbed('Invalid', 'Username must be 1-32 chars and cannot contain whitespace or any of: ` [ ] ( ) < > | / \\')],
    })
  }

  if (fromUsername === toUsername) {
    return interaction.editReply({ embeds: [errorEmbed('Invalid', 'From and To usernames cannot be the same.')] })
  }

  const [fromRes, toRes] = await Promise.all([
    supabase.from('profiles').select('id, username').eq('username', fromUsername).maybeSingle(),
    supabase.from('profiles').select('id, username').eq('username', toUsername).maybeSingle(),
  ])
  if (fromRes.error || !fromRes.data) return interaction.editReply({ embeds: [errorEmbed('Not Found', `No user \`${fromUsername}\``)] })
  if (toRes.error || !toRes.data) return interaction.editReply({ embeds: [errorEmbed('Not Found', `No user \`${toUsername}\``)] })

  const fromProfile = fromRes.data
  const toProfile = toRes.data

  // 3-step swap via temp placeholder to avoid the unique constraint.
  const tempUsername = `__swap_${Date.now()}__`
  const step1 = await supabase.from('profiles').update({ username: tempUsername }).eq('id', fromProfile.id)
  if (step1.error) return interaction.editReply({ embeds: [errorEmbed('Error', `Failed to clear: ${step1.error.message}`)] })

  const step2Update = { username: fromUsername }
  if (grantLifetime) {
    Object.assign(step2Update, {
      is_premium: true,
      premium_active: true,
      premium_type: 'lifetime',
      premium_activated_at: new Date().toISOString(),
    })
  }
  const step2 = await supabase.from('profiles').update(step2Update).eq('id', toProfile.id)
  if (step2.error) {
    await supabase.from('profiles').update({ username: fromUsername }).eq('id', fromProfile.id)
    return interaction.editReply({ embeds: [errorEmbed('Error', `Failed to assign: ${step2.error.message}`)] })
  }

  const step3 = await supabase.from('profiles').update({ username: toUsername }).eq('id', fromProfile.id)
  if (step3.error) {
    return interaction.editReply({
      embeds: [errorEmbed('Partial Error', `Username transferred but couldn't assign \`${toUsername}\` back. From-user now has temp name \`${tempUsername}\`. Fix manually.`)],
    })
  }

  const extras = grantLifetime ? '\n⭐ Lifetime premium granted to recipient.' : ''
  await sendLog(logEmbed(
    '🔄 Username Swap',
    `**From:** \`${fromUsername}\` → \`${toUsername}\`\n**To:** \`${toUsername}\` → \`${fromUsername}\`${grantLifetime ? '\n⭐ Lifetime premium granted' : ''}\n**By:** ${interaction.user.tag}`,
    WARN_COLOR,
  ))

  return interaction.editReply({
    embeds: [successEmbed(
      'Username Swap Complete',
      `✅ \`${toProfile.username}\` → owns **\`${fromUsername}\`**\n✅ \`${fromProfile.username}\` → owns **\`${toUsername}\`**${extras}`,
    )],
  })
}
