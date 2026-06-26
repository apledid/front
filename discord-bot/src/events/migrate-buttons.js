/**
 * Button handler for the Lanyard → halo.rip presence migration DM.
 *
 * Flow:
 *   1. /migrate-presence DMs every user with a Discord widget.
 *      The DM has two buttons: "I'll join" (link) and "No"
 *      (custom button, fires this handler).
 *   2. Clicking "No" replaces the DM with an "Are you sure?"
 *      embed and two new buttons: "Cancel" (revert to the original
 *      message) and "Yes, my widget can break".
 *   3. Clicking the final confirmation just acknowledges and ends
 *      the flow. We don't track per-user state; the migration is
 *      purely a nudge; whether the widget works depends on whether
 *      they actually join halo.rip's server (which we measure via
 *      whether the bot sees their presenceUpdate events).
 *
 * customId conventions:
 *   migrate:no            → user clicked "No" on the initial DM
 *   migrate:no-confirm    → user confirmed "No" on the "Are you sure?"
 *   migrate:no-cancel     → user backed out of the "Are you sure?"
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js'
import { BRAND_COLOR, ERROR_COLOR, WARN_COLOR } from '../utils/embeds.js'

const INVITE_URL = 'https://discord.gg/NgVh45gXbD'

export function isMigrateButtonId(customId) {
  return typeof customId === 'string' && customId.startsWith('migrate:')
}

function initialDmEmbed() {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('Important: halo.rip Discord widget update')
    .setDescription(
      [
        'hey, heads up about your **discord widget** on halo.rip.',
        '',
        'We just moved off Lanyard. From now on, halo.rip tracks Discord status using **our own** bot inside the halo.rip Discord server.',
        '',
        '**To keep your widget working, leave the Lanyard server and join halo.rip:**',
        INVITE_URL,
        '',
        "If you don't join, your Discord widget will go offline.",
      ].join('\n'),
    )
    .setFooter({ text: 'halo.rip presence migration' })
    .setTimestamp()
}

function initialDmComponents() {
  return [
    new ActionRowBuilder().addComponents(
      // Link button. Opens the invite directly. Discord requires
      // link buttons to have a URL, not a customId.
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("I'll join")
        .setURL(INVITE_URL),
      new ButtonBuilder()
        .setCustomId('migrate:no')
        .setStyle(ButtonStyle.Secondary)
        .setLabel('No'),
    ),
  ]
}

function areYouSureEmbed() {
  return new EmbedBuilder()
    .setColor(WARN_COLOR)
    .setTitle('Are you sure?')
    .setDescription(
      [
        '**Your Discord widget will stop working** if you don\'t join the halo.rip server.',
        '',
        `One click and you're in: ${INVITE_URL}`,
      ].join('\n'),
    )
    .setFooter({ text: 'You can always add halo.rip later' })
    .setTimestamp()
}

function areYouSureComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Ok, join now')
        .setURL(INVITE_URL),
      new ButtonBuilder()
        .setCustomId('migrate:no-confirm')
        .setStyle(ButtonStyle.Danger)
        .setLabel("Yes, I'll let it break"),
      new ButtonBuilder()
        .setCustomId('migrate:no-cancel')
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Go back'),
    ),
  ]
}

function declinedEmbed() {
  return new EmbedBuilder()
    .setColor(ERROR_COLOR)
    .setTitle('Got it, widget paused')
    .setDescription(
      [
        "Your Discord widget will show offline until you join the halo.rip server. Change your mind any time:",
        INVITE_URL,
      ].join('\n'),
    )
    .setTimestamp()
}

/**
 * Top-level button dispatcher for the migration DMs. Invoked from
 * `index.js`'s interactionCreate listener when isMigrateButtonId
 * returns true.
 */
export async function handleMigrateButton(interaction) {
  try {
    const id = interaction.customId

    if (id === 'migrate:no') {
      return interaction.update({
        embeds: [areYouSureEmbed()],
        components: areYouSureComponents(),
      })
    }

    if (id === 'migrate:no-cancel') {
      // Back to the original DM.
      return interaction.update({
        embeds: [initialDmEmbed()],
        components: initialDmComponents(),
      })
    }

    if (id === 'migrate:no-confirm') {
      return interaction.update({
        embeds: [declinedEmbed()],
        components: [],
      })
    }
  } catch (err) {
    console.error('[migrate-buttons] handler error:', err?.message || err)
  }
}

// Exported so /migrate-presence can reuse the same shape when it
// initially sends the DM (keeps the format definition in one place).
export const migrationDm = {
  buildEmbed: initialDmEmbed,
  buildComponents: initialDmComponents,
}
