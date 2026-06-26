// Server-side premium gate.
//
// The customize UI tries to mark premium-only sections with a "PRO" badge,
// but a determined user can still craft a JSON PATCH directly. This helper
// is called from every profile/appearance/effects PUT/PATCH route to strip
// (or reject) premium fields when the user isn't on a paid plan.
//
// Behavior: returns a copy of `updates` with premium-only keys removed when
// `isPremium` is false, plus a list of which keys were stripped (so the
// caller can surface a 403 or just log it).

import { PREMIUM_USERNAME_EFFECTS, PREMIUM_CURSOR_EFFECTS, PREMIUM_HOVER_EFFECTS } from './premium-features'

// Boolean flags that mean a premium-only feature is on. If `isPremium=false`
// we force the value to FALSE rather than removing the key, so the column
// doesn't keep a stale `true` from when the user used to be premium.
//
// glow_username / glow_socials / glow_badges used to live here but the
// toggles were never visibly gated in the customize UI, so free users
// were silently saving `true` and seeing nothing render - confusing and
// unfixable from their POV. Glow is free for everyone now (matches the
// 2026-05 free-up of Typewriter Bio / Enter Page / Spark Trail / Cat
// cursor). Premium can still differentiate via outline, gradient,
// fonts, cursors, embed metadata, etc.
const PREMIUM_BOOLEAN_KEYS = [
  'profile_gradient_enabled',
  'outline_enabled',
  'monochrome_icons',
] as const

// String/url fields that mean a premium-only resource is set. Force to NULL
// when user isn't premium.
//
// custom_cursor_url + custom_cursor_hover_url USED to live here but the
// upload route at /api/upload auto-writes those columns when type='cursor',
// bypassing this strip - which meant non-premium users could upload a
// cursor successfully ("Cursor uploaded" toast), then watch the very next
// /api/profile PUT silently null it back out, because the editor always
// includes custom_cursor_url in its save payload. Saves looked broken.
// Same fix pattern as the 2026-05 glow_socials free-up. Custom cursors
// are now free; PREMIUM_CURSOR_EFFECTS (ghost-trail, splash, rainbow)
// remain premium-gated below.
const PREMIUM_NULLABLE_KEYS = [
  'custom_font_url',
  'custom_font_name',
  'font_1_url', 'font_2_url', 'font_3_url', 'font_4_url',
  'font_1_name', 'font_2_name', 'font_3_name', 'font_4_name',
  // Username Overlay (formerly "Display Name") - overrides the @handle text
  // shown on the profile. Premium-only as of 2026-05.
  'display_name',
  // Profile Metadata - custom favicon + embed (Open Graph / Discord card)
  // overrides for the link preview. All premium-only as of 2026-05.
  'favicon_url',
  'embed_title',
  'embed_description',
  'embed_image_url',
  'embed_color',
] as const

// Numeric font slot assignments. 0 = default (free), 1-4 = use a slot. Force
// non-premium users back to 0.
const PREMIUM_SLOT_KEYS = [
  'font_slot_displayname',
  'font_slot_username',
  'font_slot_bio',
  'font_slot_music',
] as const

// Per-element font apply toggles (legacy single-font mode).
const PREMIUM_FONT_APPLY_KEYS = [
  'font_apply_displayname',
  'font_apply_username',
  'font_apply_bio',
  'font_apply_music',
] as const

export interface StripResult {
  updates: Record<string, unknown>
  strippedKeys: string[]
}

export function stripPremiumFields(
  updates: Record<string, unknown>,
  isPremium: boolean,
): StripResult {
  if (isPremium) return { updates, strippedKeys: [] }

  const out: Record<string, unknown> = { ...updates }
  const stripped: string[] = []

  function flag(key: string) {
    if (key in out) { stripped.push(key); return true }
    return false
  }

  for (const k of PREMIUM_BOOLEAN_KEYS) if (flag(k)) out[k] = false
  for (const k of PREMIUM_NULLABLE_KEYS) if (flag(k)) out[k] = null
  for (const k of PREMIUM_SLOT_KEYS) if (flag(k)) out[k] = 0
  for (const k of PREMIUM_FONT_APPLY_KEYS) if (flag(k)) out[k] = false

  // Reject premium variants of effect picker fields. These are strings, so
  // unset back to the default ('none' or null) when the chosen value is in
  // the premium list.
  if ('username_effect' in out) {
    const v = String(out.username_effect ?? '').toLowerCase()
    if (PREMIUM_USERNAME_EFFECTS.includes(v)) {
      out.username_effect = null
      stripped.push('username_effect')
    }
  }
  if ('cursor_effect' in out) {
    const v = String(out.cursor_effect ?? '').toLowerCase()
    if (PREMIUM_CURSOR_EFFECTS.includes(v)) {
      out.cursor_effect = null
      stripped.push('cursor_effect')
    }
  }
  if ('hover_effect' in out) {
    const v = String(out.hover_effect ?? '').toLowerCase()
    if (PREMIUM_HOVER_EFFECTS.includes(v)) {
      out.hover_effect = null
      stripped.push('hover_effect')
    }
  }

  return { updates: out, strippedKeys: stripped }
}

// Convenience: returns true if any premium field would be stripped, used by
// callers that want to 403 instead of silently downgrading the request.
export function hasPremiumFields(updates: Record<string, unknown>): boolean {
  for (const k of PREMIUM_BOOLEAN_KEYS) if (k in updates && updates[k]) return true
  for (const k of PREMIUM_NULLABLE_KEYS) if (k in updates && updates[k]) return true
  for (const k of PREMIUM_SLOT_KEYS) if (k in updates && Number(updates[k]) > 0) return true
  for (const k of PREMIUM_FONT_APPLY_KEYS) if (k in updates && updates[k]) return true
  if ('username_effect' in updates && PREMIUM_USERNAME_EFFECTS.includes(String(updates.username_effect ?? ''))) return true
  if ('cursor_effect' in updates && PREMIUM_CURSOR_EFFECTS.includes(String(updates.cursor_effect ?? ''))) return true
  if ('hover_effect' in updates && PREMIUM_HOVER_EFFECTS.includes(String(updates.hover_effect ?? ''))) return true
  return false
}
