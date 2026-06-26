#!/usr/bin/env node
/**
 * One-shot backfill for templates.premium_features.
 *
 * Re-runs the (newly tightened) detectPremiumFeatures() over every
 * existing template's config and updates the row when the result
 * differs from the cached column. Fixes templates that were saved
 * before the detector was tightened and got stuck with a stale
 * "Premium" badge even though their config doesn't actively use any
 * premium feature.
 *
 * Run on the VPS:
 *   cd /opt/halo/website
 *   node scripts/backfill-template-premium-features.mjs
 *
 * Idempotent - safe to re-run.
 *
 * Requires env vars (already in /opt/halo/website/.env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: join(__dirname, '..', '.env') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

// Inline copy of detectPremiumFeatures so this script has zero runtime
// dependencies on the TS build. Keep in sync with lib/premium-features.ts.
const PREMIUM_USERNAME_EFFECTS = ['rainbow', 'shuffle', 'glitch', 'wave']
const PREMIUM_CURSOR_EFFECTS   = ['ghost-trail', 'splash', 'rainbow']
const PREMIUM_HOVER_EFFECTS    = ['glow', 'pulse', 'shake']

function isSet(v) {
  return typeof v === 'string' ? v.trim().length > 0 : !!v
}

// Mirror of lib/premium-features.ts detectPremiumFeatures - keep in sync.
function detectPremiumFeatures(config) {
  const found = []
  if (!config) return found

  const fontApplied =
    config.font_apply_displayname === true ||
    config.font_apply_username === true ||
    config.font_apply_bio === true ||
    config.font_apply_music === true
  if (isSet(config.custom_font_url) && fontApplied) found.push('Custom font')

  if (config.profile_gradient_enabled === true) found.push('Profile gradient')

  if (config.outline_enabled === true && Number(config.outline_width ?? 0) > 0) {
    found.push('Outline border glow')
  }
  if (config.monochrome_icons === true) found.push('Monochrome icons')

  if (config.username_effect && PREMIUM_USERNAME_EFFECTS.includes(config.username_effect)) {
    found.push(`Username effect: ${config.username_effect}`)
  }
  if (config.cursor_effect && PREMIUM_CURSOR_EFFECTS.includes(config.cursor_effect)) {
    found.push(`Cursor effect: ${config.cursor_effect}`)
  }
  if (config.hover_effect && PREMIUM_HOVER_EFFECTS.includes(config.hover_effect)) {
    found.push(`Hover effect: ${config.hover_effect}`)
  }

  // cursor_trail_enabled, custom_cursor_url, and video background are
  // all FREE in the current codebase - explicitly NOT detected here.
  // Old templates may have these set in their saved premium_features
  // array; the backfill clears them out.

  return found
}

// Page through templates in batches so we never hold the whole table
// in memory. A typical install will fit in a single query but the
// pagination future-proofs this if templates grow into the tens of
// thousands.
const PAGE_SIZE = 200
let from = 0
let total = 0
let changed = 0

console.log('Backfilling templates.premium_features...')

while (true) {
  const { data, error } = await supabase
    .from('templates')
    .select('id, name, config, premium_features')
    .order('created_at', { ascending: true })
    .range(from, from + PAGE_SIZE - 1)
  if (error) {
    console.error('Fetch error:', error)
    process.exit(1)
  }
  if (!data || data.length === 0) break

  for (const row of data) {
    total++
    const computed = detectPremiumFeatures(row.config || {})
    const current = Array.isArray(row.premium_features) ? row.premium_features : []
    const same =
      current.length === computed.length &&
      current.every((x) => computed.includes(x))
    if (same) continue

    const { error: upErr } = await supabase
      .from('templates')
      .update({ premium_features: computed })
      .eq('id', row.id)
    if (upErr) {
      console.error(`  ! ${row.id} (${row.name}) update failed:`, upErr.message)
      continue
    }

    changed++
    const before = current.length === 0 ? 'free' : current.join(', ')
    const after  = computed.length === 0 ? 'free' : computed.join(', ')
    console.log(`  ${row.id} (${row.name}): [${before}] -> [${after}]`)
  }

  if (data.length < PAGE_SIZE) break
  from += PAGE_SIZE
}

console.log(`\nDone. Scanned ${total} template(s), updated ${changed}.`)
