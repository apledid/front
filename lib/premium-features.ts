// Premium features that require lifetime subscription
export const PREMIUM_FEATURES = {
  // Fonts
  customFont: 'custom_font',

  // Effects
  gradientOverlay: 'gradient_overlay',
  outlineBorderGlow: 'outline_border_glow',

  // Username effects
  usernameRainbow: 'username_rainbow',
  usernameShuffle: 'username_shuffle',
  usernameGlitch: 'username_glitch',
  usernameWave: 'username_wave',

  // Hover effects
  hoverEffects: 'hover_effects',

  // Cursor effects
  cursorGhostTrail: 'cursor_ghost_trail',
  cursorSplash: 'cursor_splash',
  cursorRainbow: 'cursor_rainbow',

  // Icons
  monochromeIcons: 'monochrome_icons',
} as const

export type PremiumFeature = (typeof PREMIUM_FEATURES)[keyof typeof PREMIUM_FEATURES]

// Premium username effects (typewriter is free)
export const PREMIUM_USERNAME_EFFECTS = ['rainbow', 'shuffle', 'glitch', 'wave']

// Premium cursor effects (spark-trail, falling-spark, and cat are free)
export const PREMIUM_CURSOR_EFFECTS = ['ghost-trail', 'splash', 'rainbow']

// Premium hover effects - ALL hover effects are premium (only 'none' is free).
// Must list every non-none value the UI offers + the renderer supports, or
// free users slip past the gate (e.g. 'lift'/'tilt' used to be ungated).
export const PREMIUM_HOVER_EFFECTS = ['tilt', 'lift', 'glow', 'rainbow', 'shake', 'pulse', 'scale']

// Check if a specific feature requires premium
export function isPremiumFeature(feature: string): boolean {
  return Object.values(PREMIUM_FEATURES).includes(feature as PremiumFeature)
}

// Check if username effect is premium
export function isPremiumUsernameEffect(effect: string): boolean {
  return PREMIUM_USERNAME_EFFECTS.includes(effect)
}

// Check if cursor effect is premium
export function isPremiumCursorEffect(effect: string): boolean {
  return PREMIUM_CURSOR_EFFECTS.includes(effect)
}

// Check if hover effect is premium
export function isPremiumHoverEffect(effect: string): boolean {
  return PREMIUM_HOVER_EFFECTS.includes(effect)
}

// Helper - treats null / undefined / empty string / whitespace as "not set".
// Stops the detector from flagging fields that hold a stale URL or value
// the user pasted once and never actually applied.
function isSet(v: any): boolean {
  return typeof v === 'string' ? v.trim().length > 0 : !!v
}

// Given a profile-style config object (as stored in templates.config),
// return a list of human-readable premium feature names that are
// ACTIVELY IN USE on the profile. The detector deliberately does not
// flag features that are set in the row but inert in the render
// (e.g. custom_font_url is set but no font_apply_* flag is true, so
// the custom font isn't actually applied anywhere on the profile).
//
// History: a previous version of this detector flagged any non-falsy
// value of these fields. That over-flagged templates from users whose
// profiles had stale premium flags from a free-trial / event period -
// e.g. they once had custom_cursor_url set, never reverted it, and
// every template they shipped showed "Premium" even though their
// live profile didn't visibly use the custom cursor. The "actively
// in use" rule below fixes that without letting actual premium
// templates slip past the badge.
export function detectPremiumFeatures(config: Record<string, any>): string[] {
  const found: string[] = []
  if (!config) return found

  // The detector flags fields that match exactly what the customize
  // page gates with <PremiumGate locked={!isPremium}> + what
  // strip-premium-fields enforces server-side. Adding new entries
  // here that aren't actually gated anywhere is what produced the
  // "Enter-page splash / Typing bio / Username effect: typewriter"
  // bogus Premium tags users reported. Source-of-truth audit, May 2026.

  // FREE (do not flag):
  //   - enter_enabled, enter_title, enter_subtitle (Enter Splash)
  //   - typing_bio, typing_speed, bio_texts (Typewriter Bio)
  //   - typewriter username effect
  //   - spark-trail, falling-spark, cat, glow cursor effects
  //   - cursor_trail_enabled (not in PREMIUM_BOOLEAN_KEYS)
  //   - custom_cursor_url, custom_cursor_hover_url (freed 2026-05)
  //   - background_type='video' (landing page calls this free)
  //   - glow_socials / glow_username / glow_badges / glow_description

  // Custom font: requires a URL AND at least one slot actually applying
  // it. Without an apply flag the URL is dead config that does nothing.
  const fontApplied =
    config.font_apply_displayname === true ||
    config.font_apply_username === true ||
    config.font_apply_bio === true ||
    config.font_apply_music === true
  if (isSet(config.custom_font_url) && fontApplied) {
    found.push('Custom font')
  }

  // Profile gradient overlay - in PREMIUM_BOOLEAN_KEYS, wrapped in
  // PremiumGate on the customize page (Color Customization section).
  if (config.profile_gradient_enabled === true) {
    found.push('Profile gradient')
  }

  // Outline border glow: only flag when both enabled AND has a visible
  // width. outline_enabled stuck at true with width 0 produces no
  // visible glow.
  if (config.outline_enabled === true && Number(config.outline_width ?? 0) > 0) {
    found.push('Outline border glow')
  }

  // Monochrome icons - in PREMIUM_BOOLEAN_KEYS. Only flag strict true.
  if (config.monochrome_icons === true) found.push('Monochrome icons')

  // Effect detectors - flag ONLY when the value is in the explicit
  // premium list. Free effects (typewriter, spark-trail, glow hover etc.)
  // never trip these.
  if (config.username_effect && PREMIUM_USERNAME_EFFECTS.includes(config.username_effect)) {
    found.push(`Username effect: ${config.username_effect}`)
  }
  if (config.cursor_effect && PREMIUM_CURSOR_EFFECTS.includes(config.cursor_effect)) {
    found.push(`Cursor effect: ${config.cursor_effect}`)
  }
  if (config.hover_effect && PREMIUM_HOVER_EFFECTS.includes(config.hover_effect)) {
    found.push(`Hover effect: ${config.hover_effect}`)
  }

  // Username Overlay (display_name override) - PREMIUM_NULLABLE_KEYS in
  // strip-premium-fields.ts. A template author who set display_name was
  // previously slipping past the gate because no detector matched it -
  // confirmed in the wild: someone applied a template that just carried
  // a display_name and ended up with a custom overlay without buying
  // premium. The strip-premium-fields call in templates/apply is the
  // hard floor now, this detector entry gives the better UX (clear
  // "premium required" message before apply rather than silent strip).
  if (isSet(config.display_name)) found.push('Username Overlay')

  // Profile Metadata (custom favicon + Open Graph / Discord embed
  // overrides) - all PREMIUM_NULLABLE_KEYS. Flag if any one is set;
  // the customize page groups them together under a single Premium
  // gate so one message covers all of them.
  if (
    isSet(config.favicon_url) ||
    isSet(config.embed_title) ||
    isSet(config.embed_description) ||
    isSet(config.embed_image_url) ||
    isSet(config.embed_color)
  ) {
    found.push('Profile Metadata')
  }

  return found
}
