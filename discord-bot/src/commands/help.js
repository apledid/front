import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import { BRAND_COLOR } from '../utils/embeds.js'
import { isAdmin } from '../framework/permissions.js'

export const meta = { permission: 'public', rateLimit: 'cheap' }

// Listing is hardcoded rather than introspected from the registered
// SlashCommandBuilders. The bot's command surface is small and stable
// post-consolidation; introspection would add a circular import hop
// for marginal value.
const PUBLIC = [
  ['/profile lookup',      'Show a halo.rip profile'],
  ['/profile leaderboard', 'Top profiles by view count'],
  ['/template browse',     'Browse public templates (sort + tag filter)'],
  ['/template trending',   'Shorthand for /template browse sort:trending'],
  ['/template search',     'Search templates by name'],
  ['/redeem',              'Redeem a premium license code (DM)'],
  ['/halo',                'Public platform stats card'],
  ['/staff ping',          'Bot latency / health check'],
  ['/help',                'You\'re reading it'],
]

const ADMIN = [
  ['/user [info|search|recent|lookup]',                       'Read-only user lookups'],
  ['/user [ban|unban|warn|delete|edit|message|resetpassword]', 'Per-user moderation actions'],
  ['/user [premium|site-admin]',                              'Grant / revoke premium and site admin'],
  ['/badge [create|edit|give|remove|list|listall]',           'Manage badges'],
  ['/title [create|edit|give|remove|list|listall]',           'Manage titles'],
  ['/admin [grant|revoke|list]',                              'Manage bot admins (owner only)'],
  ['/event [start|end|status]',                               'Free-premium event (owner only)'],
  ['/sessions [list|revoke|forcelogout]',                     'Inspect and revoke user sessions'],
  ['/profile-tools [viewset|setuid|usernameswap]',            'Per-profile data tools'],
  ['/blacklist [add|remove|list]',                            'Manage the support-ticket blacklist'],
  ['/staff [stats|cleanup|broadcast]',                        'Staff system tools'],
  ['/staff audit-*',                                          'Query the durable audit log'],
]

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('List all bot commands')

export async function execute(interaction) {
  await interaction.deferReply({ flags: 64 })

  const admin = await isAdmin(interaction.user.id)
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('📖 halo.rip bot commands')
    .setDescription('Use slash autocomplete to see arguments for each command.')
    .addFields(
      {
        name: '🌐 Public',
        value: PUBLIC.map(([cmd, desc]) => `\`${cmd}\` - ${desc}`).join('\n'),
        inline: false,
      },
    )

  if (admin) {
    embed.addFields({
      name: '🛡️ Staff',
      value: ADMIN.map(([cmd, desc]) => `\`${cmd}\` - ${desc}`).join('\n'),
      inline: false,
    })
  } else {
    embed.addFields({
      name: 'ℹ️ Staff commands hidden',
      value: 'Admin commands are listed only for staff. Run `/help` while signed in as an admin to see them.',
      inline: false,
    })
  }

  embed
    .setFooter({ text: 'halo.rip' })
    .setTimestamp()

  return interaction.editReply({ embeds: [embed] })
}
