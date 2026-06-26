import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { BRAND_COLOR, ERROR_COLOR, WARN_COLOR } from '../utils/embeds.js'

/**
 * Replaces "type DELETE to confirm" UX with a button-based confirmation.
 *
 * Usage:
 *
 *   await interaction.deferReply()
 *   const ok = await confirm(interaction, {
 *     title: 'Delete user?',
 *     body: 'Permanently delete @foo. This cannot be undone.',
 *     confirmLabel: 'Yes, delete',
 *     danger: true,
 *   })
 *   if (!ok) return
 *   // proceed with destructive action
 *
 * Returns true if the user clicked the confirm button, false if they
 * cancelled or the prompt timed out (default 30s).
 *
 * Only the original invoker can interact with the buttons - clicks from
 * anyone else are silently ignored.
 */
export async function confirm(interaction, {
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  timeoutMs = 30_000,
} = {}) {
  const embed = new EmbedBuilder()
    .setColor(danger ? ERROR_COLOR : WARN_COLOR)
    .setTitle(`${danger ? '⚠️ ' : ''}${title || 'Confirm action?'}`)
    .setDescription(body || 'Are you sure?')
    .setFooter({ text: `Times out in ${Math.round(timeoutMs / 1000)}s` })
    .setTimestamp()

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm:yes')
      .setLabel(confirmLabel)
      .setStyle(danger ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('confirm:no')
      .setLabel(cancelLabel)
      .setStyle(ButtonStyle.Secondary),
  )

  const reply = interaction.deferred || interaction.replied
    ? await interaction.editReply({ embeds: [embed], components: [row] })
    : await interaction.reply({ embeds: [embed], components: [row], fetchReply: true })

  try {
    const click = await reply.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: timeoutMs,
      filter: (i) => i.user.id === interaction.user.id,
    })

    const ok = click.customId === 'confirm:yes'
    await click.update({
      embeds: [
        new EmbedBuilder()
          .setColor(ok ? BRAND_COLOR : 0x6b7280)
          .setTitle(ok ? `▶️ ${title || 'Confirmed'}` : '✖️ Cancelled')
          .setDescription(ok ? 'Working...' : 'No action taken.')
          .setTimestamp(),
      ],
      components: [],
    })
    return ok
  } catch {
    // Timed out.
    try {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x6b7280)
            .setTitle('⏱️ Timed out')
            .setDescription('No response - cancelled.')
            .setTimestamp(),
        ],
        components: [],
      })
    } catch {}
    return false
  }
}
