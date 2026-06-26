import { EmbedBuilder } from 'discord.js'

let logChannel = null

export function setLogChannel(channel) {
  logChannel = channel
}

export async function sendLog(embed) {
  // Primary: send via bot to log channel
  if (logChannel) {
    try {
      await logChannel.send({ embeds: [embed] })
      return
    } catch (err) {
      console.error('[Logger] Failed to send to log channel:', err.message)
    }
  }

  // Fallback: send via Discord webhook if configured
  const webhookUrl = process.env.DISCORD_LOG_WEBHOOK_URL
  if (webhookUrl) {
    try {
      const payload = {
        embeds: [embed.toJSON ? embed.toJSON() : embed],
      }
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      console.error('[Logger] Failed to send via webhook:', err.message)
    }
    return
  }

  // Last resort: console log the embed title + description
  const json = embed.toJSON ? embed.toJSON() : embed
  console.log(`[Log] ${json.title || 'Event'}: ${json.description || ''}`)
}
