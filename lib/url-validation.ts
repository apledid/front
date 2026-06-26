import { SOCIAL_PLATFORMS } from './types'

// Allowed domains for media uploads
export const ALLOWED_MEDIA_DOMAINS = [
  'halo.rip',
  'blob.vercel-storage.com',
  'public.blob.vercel-storage.com',
  // Apple media CDNs used by the music quick-import: cover art lives on
  // *.mzstatic.com and the 30s track previews on *.itunes.apple.com. Both are
  // trusted media hosts (images + m4a audio, never executed as markup), so
  // they're safe as cover_url / track_url. NOTE: hot-linked for now; re-host
  // these onto halo storage before the music panel goes fully public so we're
  // not leaning on Apple's CDN at scale.
  'mzstatic.com',
  'itunes.apple.com',
]

// Relative URLs we trust as media URLs. ANY string starting with '/' used
// to pass here, which is a CSS-injection risk because uploaded URLs flow
// into `style={{ backgroundImage: 'url(${url})' }}` on the profile page -
// a value like `/'); background: url(...); --` would break out of the
// url() context and inject arbitrary CSS rules.
//
// Allowed shapes:
//   - /api/file?...      our own uploaded files (the upload route always
//                        emits URLs of this exact shape)
//   - /path/segment      simple relative paths with only [\w./-] chars
//
// Anything containing CSS-meta chars (', ", ), ;, parentheses other than
// where expected, whitespace, etc.) is rejected.
function isSafeRelativeMediaUrl(url: string): boolean {
  if (!url.startsWith('/')) return false
  // /api/file uploads use a stable shape - allow query string but no
  // CSS-breaking chars.
  if (url.startsWith('/api/file')) {
    return /^\/api\/file(\?[\w%=&.-]*)?$/.test(url)
  }
  // Other relative paths: only safe path chars. Letters, digits, dashes,
  // underscores, slashes, dots, query strings with the same restricted
  // set. Crucially: NO single/double quotes, NO parentheses, NO semicolons,
  // NO whitespace.
  return /^\/[\w./-]+(\?[\w%=&.-]+)?$/.test(url)
}

// Check if a URL is from an allowed domain (for media uploads).
//
// Two layers of safety vs the old version:
//   1. Relative URLs go through isSafeRelativeMediaUrl() which rejects
//      values containing CSS-breaking chars - stops the background_url
//      CSS-injection vector.
//   2. Absolute URLs use a strict hostname-suffix check (NOT a substring
//      check). `evil.halo.rip.attacker.com` is rejected because it
//      neither equals nor ends with `.halo.rip`.
export function isAllowedMediaUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false
  // Reject any URL whose raw text contains CSS/HTML breakout characters. These
  // values get interpolated verbatim into url("...") inside a <style> block
  // (custom fonts in effect-overlays.tsx), and React does NOT escape <style>
  // children - so an unescaped " or </style> in the path is CSS injection /
  // stored XSS. A well-formed media URL percent-encodes all of these, so this
  // never rejects a legitimate upload (our own /api/file URLs and Vercel Blob
  // URLs contain none of them).
  if (/[\s"'()<>;\\`]/.test(url)) return false
  if (url.startsWith('/')) return isSafeRelativeMediaUrl(url)
  try {
    const urlObj = new URL(url)
    // Only http(s) - block javascript:, data:, blob:, vbscript:, etc.
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return false
    return ALLOWED_MEDIA_DOMAINS.some((domain) => {
      const hostname = urlObj.hostname
      return hostname === domain || hostname.endsWith('.' + domain)
    })
  } catch {
    return false
  }
}

// Build full URL from username and platform
export function buildSocialUrl(input: string, platform: string): string {
  const p = SOCIAL_PLATFORMS.find(sp => sp.id === platform) as any
  const trimmed = (input || '').trim()

  // No template => return input unchanged (crypto addresses, discord, website, text, custom)
  if (!p || !p.urlTemplate) return trimmed

  // Already a full URL => use as-is
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('mailto:')) {
    return trimmed
  }

  // Email special case
  if (platform === 'email') {
    return p.urlTemplate.replace('{username}', trimmed)
  }

  const username = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
  return p.urlTemplate.replace('{username}', username)
}

// Validate social link URL / username
export function validateSocialUrl(url: string, platform: string): { valid: boolean; error?: string } {
  if (!url || url.trim() === '') {
    return { valid: false, error: 'A value is required' }
  }

  // For text / website / custom require a full URL
  if (platform === 'custom' || platform === 'website' || platform === 'text') {
    if (!/^https?:\/\//i.test(url)) {
      return { valid: false, error: 'Please enter a valid URL starting with https://' }
    }
  }

  // Discord accepts full invite/user URLs OR plain invite codes/ids.
  // Hostname check uses exact match OR ".<domain>" suffix - NOT substring
  // `includes()` which would accept `evil.discord.gg.attacker.com` because
  // the substring "discord.gg" appears in it. Same fix pattern as
  // isAllowedMediaUrl (lib/url-validation.ts:53-56).
  if (platform === 'discord' && /^https?:\/\//i.test(url)) {
    try {
      const host = new URL(url).hostname.toLowerCase()
      const allowedDiscordDomains = ['discord.gg', 'discord.com', 'discordapp.com']
      const ok = allowedDiscordDomains.some((d) => host === d || host.endsWith('.' + d))
      if (!ok) return { valid: false, error: 'Please enter a valid Discord link' }
    } catch {
      return { valid: false, error: 'Please enter a valid Discord link' }
    }
  }

  // Crypto addresses: just require non-empty (already checked above)
  const cryptoPlatforms = ['btc', 'eth', 'ltc', 'sol', 'xmr']
  if (cryptoPlatforms.includes(platform)) {
    if (url.trim().length < 20) {
      return { valid: false, error: 'Please enter a valid wallet address' }
    }
  }

  // Email format
  if (platform === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const toCheck = url.startsWith('mailto:') ? url.slice(7) : url
    if (!emailRegex.test(toCheck)) {
      return { valid: false, error: 'Please enter a valid email address' }
    }
  }

  return { valid: true }
}

// Extract username from a full URL for social platforms
export function extractUsername(url: string, platform: string): string {
  const patterns: Record<string, RegExp[]> = {
    twitter: [/(?:twitter\.com|x\.com)\/(?:@)?([^\/\?]+)/i],
    instagram: [/instagram\.com\/([^\/\?]+)/i],
    github: [/github\.com\/([^\/\?]+)/i],
    gitlab: [/gitlab\.com\/([^\/\?]+)/i],
    facebook: [/facebook\.com\/([^\/\?]+)/i],
    youtube: [/youtube\.com\/@([^\/\?]+)/i, /youtube\.com\/(?:c\/|channel\/|user\/)?([^\/\?]+)/i],
    twitch: [/twitch\.tv\/([^\/\?]+)/i],
    tiktok: [/tiktok\.com\/@([^\/\?]+)/i],
    snapchat: [/snapchat\.com\/add\/([^\/\?]+)/i],
    linkedin: [/linkedin\.com\/in\/([^\/\?]+)/i],
    reddit: [/reddit\.com\/(?:u|user)\/([^\/\?]+)/i],
    telegram: [/t\.me\/([^\/\?]+)/i],
    steam: [/steamcommunity\.com\/id\/([^\/\?]+)/i, /steamcommunity\.com\/profiles\/([^\/\?]+)/i],
    roblox: [/roblox\.com\/users\/(\d+)/i],
    spotify: [/open\.spotify\.com\/user\/([^\/\?]+)/i],
    soundcloud: [/soundcloud\.com\/([^\/\?]+)/i],
    bluesky: [/bsky\.app\/profile\/([^\/\?]+)/i],
    vk: [/vk\.com\/([^\/\?]+)/i],
    pinterest: [/pinterest\.com\/([^\/\?]+)/i],
    dribbble: [/dribbble\.com\/([^\/\?]+)/i],
    deviantart: [/deviantart\.com\/([^\/\?]+)/i],
    itchio: [/([^\/\?.]+)\.itch\.io/i],
    kickstarter: [/kickstarter\.com\/profile\/([^\/\?]+)/i],
    patreon: [/patreon\.com\/([^\/\?]+)/i],
    kofi: [/ko-fi\.com\/([^\/\?]+)/i],
    buymeacoffee: [/buymeacoffee\.com\/([^\/\?]+)/i],
    paypal: [/paypal\.me\/([^\/\?]+)/i],
  }
  const list = patterns[platform]
  if (!list) return url
  for (const p of list) {
    const m = url.match(p)
    if (m && m[1]) return m[1]
  }
  return url
}
