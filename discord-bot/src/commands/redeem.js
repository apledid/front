import { SlashCommandBuilder } from 'discord.js'
import supabase from '../utils/supabase.js'
import {
  successEmbed,
  errorEmbed,
  infoEmbed,
} from '../utils/embeds.js'

export const meta = { permission: 'public', rateLimit: 'public' }

// Public-facing license-code redemption. The user redeems via Discord and
// we activate premium on the linked halo.rip account.
//
// Linking is done on the website (Settings -> Discord -> Connect). If the
// user runs /redeem without linking, we tell them what to do first.
//
// We talk directly to Supabase rather than the website's /api/redeem
// endpoint - the bot has service-role access and the redemption logic
// is simple (look up code, ensure unused, mark used, grant premium).
export const data = new SlashCommandBuilder()
  .setName('redeem')
  .setDescription('Redeem a premium license code')
  .addStringOption((opt) => opt.setName('code').setDescription('Your license code').setRequired(true))

export async function execute(interaction) {
  // Replies are ephemeral so the redeemed code never lands in chat.
  await interaction.deferReply({ flags: 64 })

  const code = interaction.options.getString('code').trim()
  if (!code) return interaction.editReply({ embeds: [errorEmbed('Missing', 'Provide a code.')] })

  // 1. Find the user's halo.rip profile via discord_id.
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, username, is_premium, premium_active, premium_type')
    .eq('discord_id', interaction.user.id)
    .maybeSingle()
  if (profErr) return interaction.editReply({ embeds: [errorEmbed('Error', profErr.message)] })
  if (!profile) {
    return interaction.editReply({
      embeds: [infoEmbed(
        'Link your account first',
        'You need to link your Discord account to halo.rip before redeeming codes.\n\n' +
        'Open <https://halo.rip/dashboard/settings>, find the Discord section, and click Connect. Then run `/redeem` again.',
      )],
    })
  }

  // 2. Look up the license code by exact-match. The previous
  // implementation used .ilike('code', code) which treats `%` and
  // `_` in the user-submitted string as wildcards. Any linked
  // Discord user could submit `%` to claim a random unused key, or
  // narrow the search with patterns like `HALO-LIFETIME-______-...`
  // to target a tier. License codes are generated as uppercase hex
  // by lib/staff.ts so we uppercase + trim and exact-match.
  const normalizedCode = String(code || '').trim().toUpperCase()
  const { data: license, error: licErr } = await supabase
    .from('license_keys')
    .select('id, code, used_by, used_at, type, expires_at')
    .eq('code', normalizedCode)
    .maybeSingle()
  if (licErr) return interaction.editReply({ embeds: [errorEmbed('Error', licErr.message)] })
  if (!license) {
    return interaction.editReply({ embeds: [errorEmbed('Invalid Code', 'That license code doesn\'t exist.')] })
  }
  if (license.used_by) {
    return interaction.editReply({ embeds: [errorEmbed('Already Used', 'This code has already been redeemed.')] })
  }
  if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) {
    return interaction.editReply({ embeds: [errorEmbed('Expired', 'This code has expired.')] })
  }

  // 3. Atomically claim the code, THEN grant premium. The previous
  // implementation fired both updates in Promise.all - .is('used_by',
  // null) made the mark race-safe at the SQL level, but Supabase
  // returns data:[] with no error when zero rows match, and the
  // parallel grant had already written premium_active=true to the
  // requesting profile by the time we found out the mark missed.
  // Net effect: two users redeeming the same code within a few ms
  // both got premium granted while one of them silently lost the
  // race on the mark. Matching app/api/redeem/route.ts:61-91 which
  // sequences the steps correctly.
  const premiumType = license.type === 'lifetime' ? 'lifetime' : 'monthly'
  const now = new Date().toISOString()

  const { data: claimed, error: claimErr } = await supabase
    .from('license_keys')
    .update({ used_by: profile.id, used_at: now })
    .eq('id', license.id)
    .is('used_by', null)
    .select('id')
    .maybeSingle()
  if (claimErr) return interaction.editReply({ embeds: [errorEmbed('Error', claimErr.message)] })
  if (!claimed) {
    return interaction.editReply({
      embeds: [errorEmbed('Already Used', 'Someone redeemed this code a moment before you did.')],
    })
  }

  // Only now is the row provably ours - safe to flip premium on.
  const grantRes = await supabase.from('profiles').update({
    is_premium: true,
    premium_active: true,
    premium_type: premiumType,
    premium_activated_at: now,
  }).eq('id', profile.id)

  if (grantRes.error) return interaction.editReply({ embeds: [errorEmbed('Error', grantRes.error.message)] })

  return interaction.editReply({
    embeds: [successEmbed(
      'Premium activated! ⭐',
      `**${premiumType === 'lifetime' ? 'Lifetime' : 'Monthly'} premium** has been activated on \`${profile.username}\`.\n\n` +
      `Open <https://halo.rip/dashboard/customize> to start using the premium features.`,
    )],
  })
}
