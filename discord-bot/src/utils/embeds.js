import { EmbedBuilder } from 'discord.js'

export const BRAND_COLOR  = 0xe87fa0
export const SUCCESS_COLOR = 0x34d399
export const ERROR_COLOR   = 0xf87171
export const WARN_COLOR    = 0xfbbf24
const INFO_COLOR  = 0x60a5fa

export function profileEmbed(profile, stats = {}) {
  const title = (profile.display_name || profile.username || 'Unknown User').slice(0, 256)
  const embed = new EmbedBuilder()
    .setColor(profile.banned ? ERROR_COLOR : BRAND_COLOR)
    .setTitle(title)
    .setURL(`https://halo.rip/${profile.username || ''}`)
    .addFields(
      { name: '👤 Username', value: `\`${profile.username || 'N/A'}\``, inline: true },
      { name: '👁️ Views', value: (profile.view_count || 0).toLocaleString(), inline: true },
      { name: '⭐ Premium', value: (profile.premium_active || profile.is_premium) ? '✅ Yes' : '❌ No', inline: true },
    )

  if (profile.bio) embed.setDescription(profile.bio.slice(0, 300))

  if (profile.avatar_url) {
    try { embed.setThumbnail(profile.avatar_url) } catch {}
  }

  if (profile.banned) {
    embed.addFields({ name: '🔨 Banned', value: profile.ban_reason || 'No reason', inline: false })
  }

  if (profile.uid != null) {
    embed.addFields({ name: '🔢 UID', value: `#${profile.uid}`, inline: true })
  }

  if (profile.created_at) {
    embed.addFields({
      name: '📅 Joined',
      value: `<t:${Math.floor(new Date(profile.created_at).getTime() / 1000)}:R>`,
      inline: true,
    })
  }

  if (stats.links !== undefined) {
    embed.addFields({ name: '🔗 Links', value: String(stats.links), inline: true })
  }
  if (stats.clicks !== undefined) {
    embed.addFields({ name: '🖱️ Clicks (30d)', value: String(stats.clicks), inline: true })
  }

  embed.setFooter({ text: 'halo.rip' }).setTimestamp()
  return embed
}

/** Full admin-level info embed - includes email, discord ID, IP, etc. */
export function userInfoEmbed(profile, extra = {}) {
  const title = (profile.display_name || profile.username || 'Unknown').slice(0, 256)
  const embed = new EmbedBuilder()
    .setColor(profile.banned ? ERROR_COLOR : BRAND_COLOR)
    .setTitle(`🔍 ${title}`)
    .setURL(`https://halo.rip/${profile.username || ''}`)

  const fields = [
    { name: '👤 Username',   value: `\`${profile.username || 'N/A'}\``,             inline: true },
    { name: '🔢 UID',        value: profile.uid != null ? `#${profile.uid}` : 'N/A', inline: true },
    { name: '🆔 User ID',    value: `\`${profile.id}\``,                             inline: false },
    { name: '📧 Email',      value: profile.email ? `\`${profile.email}\`` : '*(none)*', inline: true },
    { name: '✅ Verified',   value: profile.email_verified ? 'Yes' : 'No',           inline: true },
    { name: '⭐ Premium',    value: (profile.premium_active || profile.is_premium) ? `Yes (${profile.premium_type || 'active'})` : 'No', inline: true },
    { name: '🎮 Discord ID', value: profile.discord_id ? `\`${profile.discord_id}\`` : '*(not linked)*', inline: true },
    { name: '🔨 Banned',     value: profile.banned ? `Yes - ${profile.ban_reason || 'No reason'}` : 'No', inline: true },
    { name: '📅 Joined',     value: `<t:${Math.floor(new Date(profile.created_at).getTime() / 1000)}:R>`, inline: true },
    { name: '👁️ Total Views', value: (profile.view_count || 0).toLocaleString(),    inline: true },
  ]

  if (extra.sessions !== undefined) {
    fields.push({ name: '🔑 Active Sessions', value: String(extra.sessions), inline: true })
  }
  if (extra.links !== undefined) {
    fields.push({ name: '🔗 Links', value: String(extra.links), inline: true })
  }
  if (extra.clicks !== undefined) {
    fields.push({ name: '🖱️ Clicks (30d)', value: String(extra.clicks), inline: true })
  }

  embed.addFields(fields)

  if (profile.avatar_url) {
    try { embed.setThumbnail(profile.avatar_url) } catch {}
  }

  embed.setFooter({ text: 'halo.rip admin' }).setTimestamp()
  return embed
}

export function logEmbed(action, details, color = BRAND_COLOR) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(action)
    .setDescription(details)
    .setTimestamp()
    .setFooter({ text: 'halo.rip bot' })
}

export function successEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(SUCCESS_COLOR)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp()
}

export function errorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(ERROR_COLOR)
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp()
}

export function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(INFO_COLOR)
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setTimestamp()
}

export function warnEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(WARN_COLOR)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setTimestamp()
}

export function statsEmbed(stats) {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('📊 Platform Statistics')
    .addFields(
      { name: '👥 Total Users',     value: stats.totalUsers.toLocaleString(),   inline: true },
      { name: '⭐ Premium Users',   value: stats.premiumUsers.toLocaleString(), inline: true },
      { name: '✅ Verified Users',  value: stats.verifiedUsers.toLocaleString(), inline: true },
      { name: '👁️ Total Views',    value: stats.totalViews.toLocaleString(),    inline: true },
      { name: '📈 Views (24h)',     value: stats.recentViews.toLocaleString(),   inline: true },
      { name: '🆕 New Users (24h)', value: stats.newUsers24h.toLocaleString(),  inline: true },
      { name: '🔨 Banned Users',   value: stats.bannedUsers.toLocaleString(),   inline: true },
      { name: '🎮 Discord Linked', value: stats.discordLinked.toLocaleString(),  inline: true },
      { name: '⏱️ Bot Uptime',    value: `${Math.floor(process.uptime() / 60)}m`, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: 'halo.rip' })
}
