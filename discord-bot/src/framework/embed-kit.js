import { EmbedBuilder } from 'discord.js'
import { BRAND_COLOR, SUCCESS_COLOR, ERROR_COLOR, WARN_COLOR } from '../utils/embeds.js'

/**
 * Extras on top of utils/embeds.js. The old helpers (profileEmbed,
 * userInfoEmbed, logEmbed, etc.) stay; this file adds page / confirm
 * preview / audit-specific builders the new framework uses.
 */

export function pageEmbed({ title, description, items, info, color = BRAND_COLOR, footer }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title || 'Results')
    .setTimestamp()
  if (description) embed.setDescription(description)
  if (Array.isArray(items) && items.length > 0) embed.addFields(items)
  if (info) {
    const f = footer || `Page ${info.page} of ${info.totalPages} · ${info.total} total`
    embed.setFooter({ text: f })
  } else if (footer) {
    embed.setFooter({ text: footer })
  }
  return embed
}

export function confirmPreviewEmbed({ title, body, danger = false }) {
  return new EmbedBuilder()
    .setColor(danger ? ERROR_COLOR : WARN_COLOR)
    .setTitle(`${danger ? '⚠️ ' : ''}${title}`)
    .setDescription(body)
    .setTimestamp()
}

export function auditListEmbed({ title, rows, info, formatter, footerSuffix = '' }) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(title || '📜 Audit Log')
    .setTimestamp()
  if (rows.length === 0) {
    embed.setDescription('No matching entries.')
  } else {
    embed.addFields(rows.map(formatter))
  }
  if (info) {
    embed.setFooter({
      text: `Page ${info.page} of ${info.totalPages} · ${info.total} total${footerSuffix ? ` · ${footerSuffix}` : ''}`,
    })
  }
  return embed
}

export function rateLimitEmbed(retryAfter) {
  return new EmbedBuilder()
    .setColor(WARN_COLOR)
    .setTitle('⏳ Slow down')
    .setDescription(`You're using that command too quickly. Try again in ${retryAfter}s.`)
    .setTimestamp()
}

export const COLORS = { BRAND_COLOR, SUCCESS_COLOR, ERROR_COLOR, WARN_COLOR }
