import type { CSSProperties } from 'react'
import type { CustomButton } from '@/lib/types'

/**
 * Safe wrapper for user-supplied URLs that flow into inline CSS
 * `url()` constructs. Escapes the characters that would otherwise let
 * an attacker break out of the url() syntax: backslash, single quote,
 * double quote, parentheses, and newlines. The URL is wrapped in
 * double quotes so commas and ampersands (common in real CDN URLs)
 * pass through fine without further escaping.
 *
 * The API-side URL validator already rejects values with these chars
 * for new writes, but this is defence-in-depth for any legacy data
 * that snuck in before the validator was hardened.
 *
 *   cssUrl('/api/file?pathname=x') -> 'url("/api/file?pathname=x")'
 *   cssUrl(null) -> 'none'
 */
export function cssUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return 'none'
  // Reject obviously dangerous schemes early - prevents javascript: /
  // vbscript: from ever reaching the CSS engine even if they bypassed
  // the writer-side validator somehow.
  const trimmed = url.trim()
  if (/^\s*(javascript|vbscript|data\s*:\s*text\/html)/i.test(trimmed)) return 'none'
  const escaped = trimmed
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '')
    .replace(/\r/g, '')
  return `url("${escaped}")`
}

export const FONT_FAMILY_MAP: Record<string, string> = {
  Inter: 'Inter, system-ui, sans-serif',
  'Playfair Display': '"Playfair Display", Georgia, serif',
  Montserrat: 'Montserrat, system-ui, sans-serif',
  Roboto: 'Roboto, system-ui, sans-serif',
  Poppins: 'Poppins, system-ui, sans-serif',
  Raleway: 'Raleway, system-ui, sans-serif',
  'Open Sans': '"Open Sans", system-ui, sans-serif',
  Lato: 'Lato, system-ui, sans-serif',
  Ubuntu: 'Ubuntu, system-ui, sans-serif',
  Comfortaa: 'Comfortaa, system-ui, sans-serif',
  'Space Mono': '"Space Mono", monospace',
  'JetBrains Mono': '"JetBrains Mono", monospace',
  'Fira Code': '"Fira Code", monospace',
  'Dancing Script': '"Dancing Script", cursive',
  Pacifico: 'Pacifico, cursive',
  Oswald: 'Oswald, system-ui, sans-serif',
  'Bebas Neue': '"Bebas Neue", system-ui, sans-serif',
  Manrope: 'Manrope, system-ui, sans-serif',
  'DM Sans': '"DM Sans", system-ui, sans-serif',
  Sora: 'Sora, system-ui, sans-serif',
}

export function getResolvedFontFamily(fontFamily?: string | null, customFontUrl?: string | null) {
  const fallback = FONT_FAMILY_MAP[fontFamily || 'Inter'] || fontFamily || 'Inter, system-ui, sans-serif'
  return customFontUrl ? `"ProfileCustomFont", ${fallback}` : fallback
}

export function hexToRgba(hex: string | null | undefined, alpha: number) {
  if (!hex) return `rgba(255, 255, 255, ${alpha})`
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return `rgba(255, 255, 255, ${alpha})`
  const value = Number.parseInt(normalized, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function isVideoUrl(url?: string | null) {
  return Boolean(url && /\.(mp4|webm|mov|m4v|ogv|ogg)(?:$|\?)/i.test(url))
}

export function isGifUrl(url?: string | null) {
  return Boolean(url && /\.gif($|\?)/i.test(url))
}

export function getPanelMaxWidth(panelSize?: string | null) {
  switch (panelSize) {
    case 'small':
      return '420px'
    case 'large':
      return '680px'
    case 'xlarge':
      return '820px'
    default:
      return '600px'
  }
}

export function getPanelMinHeight(extraHeight?: number | null) {
  const safeHeight = Math.max(0, extraHeight ?? 0)
  return `${185 + safeHeight}px`
}

type CardStyleOptions = {
  accentColor: string
  backgroundColor: string
  cardStyle?: string | null
  borderStyle?: string | null
  profileOpacity?: number | null
  profileBlur?: number | null
  profileRadius?: number | null
  profileBorderColor?: string | null
  profileGradientEnabled?: boolean | null
  profileGradientPrimary?: string | null
  profileGradientSecondary?: string | null
  outlineEnabled?: boolean | null
  outlineColor?: string | null
  outlineWidth?: number | null
  glowColor?: string | null
  glowIntensity?: number | null
  swapBoxColors?: boolean | null
}

export function getCardContainerStyles({
  accentColor,
  backgroundColor,
  cardStyle,
  borderStyle,
  profileOpacity,
  profileBlur,
  profileRadius,
  profileBorderColor,
  profileGradientEnabled,
  profileGradientPrimary,
  profileGradientSecondary,
  outlineEnabled,
  outlineColor,
  outlineWidth,
  glowColor,
  glowIntensity,
  swapBoxColors,
}: CardStyleOptions): CSSProperties {
  const resolvedCardStyle = cardStyle || 'glass'
  const opacityFactor = Math.max(0, Math.min(1, (profileOpacity ?? 100) / 100))
  const resolvedBorderStyle = borderStyle || 'glow'
  const resolvedGlowColor = glowColor || accentColor
  const resolvedOutlineColor = outlineColor || accentColor
  const resolvedOutlineWidth = outlineWidth ?? 2
  const resolvedGlowIntensity = glowIntensity ?? 50
  const mainCardColor = swapBoxColors ? accentColor : backgroundColor
  const resolvedBlur = Math.max(0, profileBlur ?? 0)

  const backgroundImageParts: string[] = []
  let backgroundColorValue = hexToRgba(mainCardColor, resolvedBlur > 0 ? 0.14 * opacityFactor : 0.66 * opacityFactor)
  let backdropFilter = (opacityFactor === 0 || resolvedBlur === 0) ? 'none' : `blur(${resolvedBlur}px) saturate(155%)`
  let border = `1px solid ${hexToRgba('#ffffff', 0.14 * opacityFactor)}`
  let borderRadius = typeof profileRadius === 'number' ? `${Math.max(0, profileRadius)}px` : '26px'
  let boxShadow = opacityFactor === 0 ? 'none' : `0 24px 54px ${hexToRgba('#000000', 0.42 * opacityFactor)}, inset 0 1px 0 ${hexToRgba('#ffffff', 0.05 * opacityFactor)}`

  if (profileGradientEnabled) {
    backgroundImageParts.push(
      `linear-gradient(135deg, ${hexToRgba(profileGradientPrimary || accentColor, 0.34 * opacityFactor)}, ${hexToRgba(profileGradientSecondary || resolvedGlowColor, 0.22 * opacityFactor)})`,
    )
  }

  switch (resolvedCardStyle) {
    case 'classic':
      // Refined dark card with a soft accent-tinted border and a
      // subtle accent sheen along the bottom. No blur - Classic is
      // the "solid card" feel that sits between Glass (heavy blur,
      // 0.46 opacity) and Solid (almost opaque). Previously 'classic'
      // fell through to the default branch and rendered identical to
      // Glass, which confused users picking between the two.
      backgroundColorValue = hexToRgba(mainCardColor, 0.78 * opacityFactor)
      backdropFilter = 'none'
      border = `1px solid ${hexToRgba(accentColor, 0.34)}`
      boxShadow = opacityFactor === 0
        ? 'none'
        : `0 22px 50px ${hexToRgba('#000000', 0.45 * opacityFactor)}, inset 0 1px 0 ${hexToRgba('#ffffff', 0.08 * opacityFactor)}, inset 0 -1px 0 ${hexToRgba(accentColor, 0.18 * opacityFactor)}`
      break
    case 'solid':
      backgroundColorValue = hexToRgba(mainCardColor, 0.94 * opacityFactor)
      backdropFilter = 'none'
      break
    case 'outline':
      backgroundColorValue = hexToRgba(mainCardColor, 0.16 * opacityFactor)
      border = `2px solid ${hexToRgba(accentColor, 0.7)}`
      boxShadow = `0 0 0 1px ${hexToRgba('#ffffff', 0.08)} inset, 0 20px 50px ${hexToRgba('#000000', 0.4)}`
      break
    case 'minimal':
      backgroundColorValue = hexToRgba('#000000', 0.22 * opacityFactor)
      backdropFilter = (opacityFactor === 0 || resolvedBlur === 0) ? 'none' : `blur(${resolvedBlur}px) saturate(145%)`
      boxShadow = opacityFactor === 0 ? 'none' : `0 18px 42px ${hexToRgba('#000000', 0.36 * opacityFactor)}`
      break
    case 'neon':
      backgroundColorValue = hexToRgba('#05060a', 0.88 * opacityFactor)
      border = `1px solid ${hexToRgba(accentColor, 0.82)}`
      boxShadow = `0 0 22px ${hexToRgba(accentColor, 0.28)}, 0 0 48px ${hexToRgba(resolvedGlowColor, 0.22)}, 0 18px 45px ${hexToRgba('#000000', 0.5)}`
      break
    default:
      backgroundColorValue = hexToRgba(mainCardColor, resolvedBlur > 0 ? 0.11 * opacityFactor : 0.46 * opacityFactor)
      break
  }

  switch (resolvedBorderStyle) {
    case 'none':
      border = '1px solid transparent'
      break
    case 'solid':
      border = `1px solid ${hexToRgba(accentColor, 0.58)}`
      break
    case 'dashed':
      border = `2px dashed ${hexToRgba(accentColor, 0.62)}`
      break
    case 'gradient':
      border = '1px solid transparent'
      backgroundImageParts.push(`linear-gradient(135deg, ${hexToRgba(accentColor, 0.95)}, ${hexToRgba(resolvedGlowColor, 0.95)})`)
      break
    case 'glow':
    default:
      border = `1px solid ${hexToRgba(accentColor, 0.42)}`
      boxShadow = `${boxShadow}, 0 0 ${Math.max(18, resolvedGlowIntensity / 1.35)}px ${hexToRgba(resolvedGlowColor, 0.24)}, 0 0 ${Math.max(36, resolvedGlowIntensity / 1.05)}px ${hexToRgba(resolvedGlowColor, 0.1)}`
      break
  }

  if (outlineEnabled) {
    border = `${resolvedOutlineWidth}px solid ${resolvedOutlineColor}`
    boxShadow = `${boxShadow}, 0 0 ${resolvedOutlineWidth * 8}px ${hexToRgba(resolvedOutlineColor, 0.35)}, 0 0 ${resolvedOutlineWidth * 16}px ${hexToRgba(resolvedOutlineColor, 0.18)}`
  }

  // Explicit profile border color override (from layout panel)
  if (profileBorderColor && /^#[0-9a-fA-F]{6}$/.test(profileBorderColor)) {
    border = `1px solid ${profileBorderColor}`
  }

  const styles: CSSProperties = {
    backgroundColor: backgroundColorValue,
    border,
    borderRadius,
    boxShadow,
    backdropFilter,
    WebkitBackdropFilter: backdropFilter,
    overflow: 'hidden',
    position: 'relative',
    backgroundClip: 'padding-box',
  }

  if (resolvedBlur > 0) {
    styles.backdropFilter = `blur(${Math.max(0, resolvedBlur)}px) saturate(185%) brightness(1.03)`
    styles.WebkitBackdropFilter = `blur(${Math.max(0, resolvedBlur)}px) saturate(185%) brightness(1.03)`
    styles.willChange = 'backdrop-filter, transform'
  }

  if (backgroundImageParts.length > 0) {
    styles.backgroundImage = backgroundImageParts.join(', ')
    if (resolvedBorderStyle === 'gradient') {
      styles.backgroundOrigin = 'border-box'
      styles.backgroundClip = 'padding-box, border-box'
    }
  }

  return styles
}

type IconStyleOptions = {
  accentColor: string
  textColor: string
  monochromeIcons?: boolean | null
  glowSocials?: boolean | null
  glowColor?: string | null
  glowIntensity?: number | null
  swapBoxColors?: boolean | null
}

export function getSocialIconWrapperStyle({
  accentColor,
  textColor,
  glowSocials,
  glowColor,
  glowIntensity,
  swapBoxColors,
  noBackground,
  iconGlowColor,
  monoGlow,
}: IconStyleOptions & {
  noBackground?: boolean
  /** Optional per-icon glow color (e.g. Spotify green for the Spotify
   *  icon). When provided AND `monoGlow` is falsy, this overrides the
   *  global `glowColor`/`accentColor` for the wrapper's filter/shadow.
   *  Callers compute this from the canonical SOCIAL_PLATFORMS brand
   *  map so Classic + Modern stay in lockstep. */
  iconGlowColor?: string | null
  /** When true, ignore `iconGlowColor` and fall back to a single
   *  `glowColor || accentColor` halo for every icon (matches the
   *  legacy "one halo color" behaviour). */
  monoGlow?: boolean | null
}): CSSProperties {
  // Per-icon brand glow takes precedence when supplied and mono mode
  // is off. Falls back to the user's chosen Glow Color, then to the
  // accent. Modern's social row uses the same precedence inline so
  // both layouts produce the same halo for the same link.
  const haloColor = (!monoGlow && iconGlowColor) ? iconGlowColor : (glowColor || accentColor)
  if (noBackground) {
    // Render glow as a soft drop-shadow on the icon glyph when the pill
    // background is disabled. Two gentle layers (tight + wide) read as a
    // refined halo instead of a saturated bloom.
    const intensity = glowIntensity ?? 50
    const t = Math.max(0, Math.min(100, intensity)) / 100
    const tightRadius = 4 + t * 4   // 4–8px
    const wideRadius  = 8 + t * 12  // 8–20px
    const tightAlpha  = 0.35 + t * 0.3 // 0.35–0.65
    const wideAlpha   = 0.12 + t * 0.18 // 0.12–0.30
    const glowFilter = glowSocials
      ? `drop-shadow(0 0 ${tightRadius}px ${hexToRgba(haloColor, tightAlpha)}) drop-shadow(0 0 ${wideRadius}px ${hexToRgba(haloColor, wideAlpha)})`
      : undefined
    return {
      backgroundColor: 'transparent',
      color: swapBoxColors ? accentColor : textColor,
      border: 'none',
      // 48px click target (h-12 / w-12) so Classic's no-pill icon row
      // matches Modern's. Tailwind classNames like `h-10` on the
      // wrapper are inert here because the inline width/height wins.
      width: 48,
      height: 48,
      filter: glowFilter,
      // `overflow: hidden` on a Tailwind utility (used on the <a> in
      // Classic) would have clipped the drop-shadow paint region; we
      // override that here so the halo extends past the wrapper.
      overflow: 'visible',
    }
  }
  return {
    backgroundColor: swapBoxColors ? hexToRgba(accentColor, 0.9) : hexToRgba('#ffffff', 0.08),
    color: swapBoxColors ? '#06070b' : textColor,
    boxShadow: glowSocials
      ? `0 0 ${Math.max(16, (glowIntensity ?? 50) / 1.8)}px ${hexToRgba(haloColor, 0.32)}, inset 0 0 12px ${hexToRgba('#ffffff', 0.06)}`
      : 'inset 0 0 10px rgba(255,255,255,0.03)',
    border: `1px solid ${hexToRgba(accentColor, 0.26)}`,
  }
}

export function getButtonStyle(
  button: CustomButton,
  options: {
    accentColor: string
    textColor: string
    outlineEnabled?: boolean | null
    outlineColor?: string | null
    glowColor?: string | null
    glowIntensity?: number | null
    swapBoxColors?: boolean | null
  },
): CSSProperties {
  const bgColor = button.bg_color || (button as CustomButton & { background_color?: string | null }).background_color || null
  const resolvedBackground = bgColor || (options.swapBoxColors ? '#ffffff' : options.accentColor)
  const resolvedText = button.text_color || (options.swapBoxColors ? '#06070b' : options.textColor || '#ffffff')
  const disableBg = (button as CustomButton & { disable_background?: boolean | null }).disable_background === true

  if (disableBg) {
    return {
      backgroundColor: 'transparent',
      color: resolvedText,
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: 'none',
    }
  }

  return {
    backgroundColor: hexToRgba(resolvedBackground, options.swapBoxColors ? 0.92 : 0.22),
    color: resolvedText,
    border: `1px solid ${hexToRgba(options.outlineColor || options.accentColor, options.outlineEnabled ? 0.72 : 0.35)}`,
    boxShadow: `0 0 ${Math.max(12, (options.glowIntensity ?? 50) / 1.8)}px ${hexToRgba(options.glowColor || options.accentColor, 0.18)}, inset 0 0 10px ${hexToRgba('#ffffff', 0.04)}`,
  }
}
