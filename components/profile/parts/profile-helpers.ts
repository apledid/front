import type { CSSProperties } from 'react'
import type { Profile } from '@/lib/types'

/**
 * Map an `avatar_shape` value to a border-radius style. Defaults to circle
 * (handled by `rounded-full` on the wrapper className, not the inline style).
 */
export function getAvatarShapeStyle(shape?: string | null): CSSProperties {
  switch (shape) {
    case 'soft':     return { borderRadius: '35%' }
    case 'squircle': return { borderRadius: '22%' }
    case 'rounded':  return { borderRadius: '8px' }
    case 'square':   return { borderRadius: '2px' }
    default:         return {} // circle - keep rounded-full from className
  }
}

/**
 * Format the profile's UID for the hover tooltip on @username. Uses the
 * actual `uid` column from Postgres.
 */
export function formatProfileUid(profile: Profile) {
  const uid = (profile as any).uid
  if (uid) return `UID ${uid.toLocaleString()}`
  return 'UID 1'
}

// Whitespace + control characters (U+0000 through U+001F). Built as a
// RegExp from a string to keep the escaping intact when this file is
// transferred through tools that mangle inline escape sequences.
const STRIP_CONTROL_AND_WS = new RegExp('[\\s\\x00-\\x1f]', 'g')

/**
 * Sanitize a custom button URL. Blocks the obvious-dangerous protocols
 * (javascript:, data:, vbscript:) and prepends `https://` when the user
 * pasted a bare hostname.
 */
export function safeButtonHref(url: string | null | undefined): string {
  if (!url) return '#'
  const stripped = url.replace(STRIP_CONTROL_AND_WS, '').toLowerCase()
  if (stripped.startsWith('javascript:') || stripped.startsWith('data:') || stripped.startsWith('vbscript:')) return '#'
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

/**
 * Build a social link href from a (platform, raw-value) pair. Most platforms
 * have a `urlTemplate` in SOCIAL_PLATFORMS, but the user may also paste a
 * fully-qualified URL. Special-cases email + telegram.
 */
export function buildSocialHref(platform: string, url: string): string {
  if (!url) return '#'
  // Block dangerous protocols regardless of casing or whitespace
  const stripped = url.replace(STRIP_CONTROL_AND_WS, '').toLowerCase()
  if (stripped.startsWith('javascript:') || stripped.startsWith('data:') || stripped.startsWith('vbscript:')) return '#'
  if (/^https?:\/\//i.test(url)) return url
  // email platform: bare address → mailto:
  if (platform === 'email') return `mailto:${url}`
  // Telegram: bare username or @username → https://t.me/username
  if (platform === 'telegram') {
    const clean = url.replace(/^@/, '').replace(/^t\.me\/?/, '')
    return `https://t.me/${clean}`
  }
  return `https://${url}`
}

/**
 * Compute absolute positioning for the views/location pill in layouts that
 * render it as a corner badge. `topClearance` lets a layout push the pill
 * further down so it doesn't collide with an avatar that protrudes from
 * the top edge of the card.
 */
export function getViewsPositionStyle(pos: string, isMobile: boolean, topClearance?: number): CSSProperties {
  const spacing = isMobile ? 12 : 16
  const topVal = topClearance != null ? topClearance : spacing
  switch (pos) {
    case 'top-left':    return { left: spacing, top: topVal }
    case 'bottom-left': return { left: spacing, bottom: spacing }
    case 'bottom-right':return { right: spacing, bottom: spacing }
    default:            return { right: spacing, top: topVal } // top-right
  }
}
