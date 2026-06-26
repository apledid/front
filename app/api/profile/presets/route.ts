/**
 * Profile presets API - 5-slot named snapshots (v2).
 *
 *  - GET    /api/profile/presets        → list all 5 slots (filled or empty)
 *                                          + which one is currently active
 *  - POST   /api/profile/presets        → snapshot current profile into { slot }
 *                                          body: { slot: 1-5, name?: string }
 *  - PATCH  /api/profile/presets        → rename a slot WITHOUT re-snapshotting
 *                                          body: { slot: 1-5, name: string }
 *  - DELETE /api/profile/presets        → clear { slot }
 *
 * Loading a slot lives in /api/profile/presets/load (separate file -
 * different write pattern; also touches last_loaded_at).
 *
 * The snapshot stored in `config` covers:
 *   - profile row (only PROFILE_ALLOWED_COLUMNS - identity/security
 *     columns like is_admin / premium_active / username never enter
 *     the snapshot, so a load can't elevate or rename anyone)
 *   - social_links (all rows for the user)
 *   - custom_buttons
 *   - profile_badge_loadout
 *   - profile_title_loadout
 *   - music_history
 *   - widgets (VALORANT, Discord, GitHub, Last.fm tiles)
 *
 * The GET response also includes a small preview blob extracted from
 * the snapshot (avatar_url, display_name, accent_color, background)
 * so the dashboard UI can render a mini profile-card thumbnail per
 * slot without re-parsing the whole jsonb on the client.
 */

import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'
import { PROFILE_ALLOWED_COLUMNS } from '@/lib/profile-columns'

const SLOT_COUNT = 5

type SlotNumber = 1 | 2 | 3 | 4 | 5

function parseSlot(raw: unknown): SlotNumber | null {
  const n = Number(raw)
  if (n >= 1 && n <= SLOT_COUNT && Number.isInteger(n)) return n as SlotNumber
  return null
}

function pickProfileColumns(profile: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const col of PROFILE_ALLOWED_COLUMNS) {
    if (col in profile) out[col] = profile[col]
  }
  return out
}

// Extract a compact preview blob from a saved preset's `config` so
// the UI can render a thumbnail without parsing the full snapshot.
// Pulls just the fields the mini profile-card render needs.
function previewOf(config: any): {
  avatar_url: string | null
  display_name: string | null
  username: string | null
  bio: string | null
  accent_color: string | null
  background_color: string | null
  background_url: string | null
  card_style: string | null
  social_count: number
  button_count: number
} | null {
  if (!config?.profile) return null
  const p = config.profile as Record<string, unknown>
  return {
    avatar_url: (p.avatar_url as string) ?? null,
    display_name: (p.display_name as string) ?? null,
    username: null,  // never snapshotted (identity field); UI falls back to display_name
    bio: typeof p.bio === 'string' ? (p.bio as string).slice(0, 80) : null,
    accent_color: (p.accent_color as string) ?? '#e87fa0',
    background_color: (p.background_color as string) ?? '#0a0a0f',
    background_url: (p.background_url as string) ?? null,
    card_style: (p.card_style as string) ?? 'glass',
    social_count: Array.isArray(config.social_links) ? config.social_links.length : 0,
    button_count: Array.isArray(config.custom_buttons) ? config.custom_buttons.length : 0,
  }
}

export async function GET(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: rows, error } = await admin
      .from('profile_presets')
      .select('slot, name, saved_at, last_loaded_at, config')
      .eq('user_id', profile.id)
      .order('slot')

    if (error) {
      console.error('[presets/GET] DB error:', error)
      return NextResponse.json({ error: 'Failed to load presets' }, { status: 500 })
    }

    const bySlot = new Map<number, typeof rows[0]>()
    for (const r of rows ?? []) bySlot.set(r.slot, r)

    // Determine the currently-active slot - the one with the most
    // recent last_loaded_at. Returns null when no slot has ever
    // been loaded.
    let activeSlot: number | null = null
    let activeAt = 0
    for (const r of rows ?? []) {
      if (!r.last_loaded_at) continue
      const t = new Date(r.last_loaded_at).getTime()
      if (t > activeAt) { activeAt = t; activeSlot = r.slot }
    }

    const slots = Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((slot) => {
      const row = bySlot.get(slot)
      return {
        slot,
        filled: !!row,
        name: row?.name ?? null,
        saved_at: row?.saved_at ?? null,
        last_loaded_at: row?.last_loaded_at ?? null,
        active: activeSlot === slot,
        preview: row?.config ? previewOf(row.config) : null,
      }
    })

    return NextResponse.json({ slots, slotCount: SLOT_COUNT, activeSlot })
  } catch (error) {
    console.error('[presets/GET] error:', error)
    return NextResponse.json({ error: 'Failed to load presets' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const slot = parseSlot(body.slot)
    if (!slot) {
      return NextResponse.json({ error: `slot must be 1-${SLOT_COUNT}` }, { status: 400 })
    }
    const rawName = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : null
    const name = rawName || null

    const admin = createAdminClient()

    const [
      { data: profileRow },
      { data: socialLinks },
      { data: customButtons },
      { data: badgeLoadout },
      { data: titleLoadout },
      { data: musicHistory },
      { data: widgets },
    ] = await Promise.all([
      admin.from('profiles').select('*').eq('id', profile.id).single(),
      admin.from('social_links').select('*').eq('user_id', profile.id).order('display_order'),
      admin.from('custom_buttons').select('*').eq('user_id', profile.id).order('display_order'),
      admin.from('profile_badge_loadout').select('*').eq('user_id', profile.id).order('display_order'),
      admin.from('profile_title_loadout').select('*').eq('user_id', profile.id).order('display_order'),
      admin.from('music_history').select('*').eq('user_id', profile.id).order('added_at'),
      admin.from('widgets').select('*').eq('user_id', profile.id).order('display_order'),
    ])

    if (!profileRow) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const config = {
      profile: pickProfileColumns(profileRow as Record<string, unknown>),
      social_links: socialLinks ?? [],
      custom_buttons: customButtons ?? [],
      badge_loadout: badgeLoadout ?? [],
      title_loadout: titleLoadout ?? [],
      music_history: musicHistory ?? [],
      widgets: widgets ?? [],
    }

    const { error } = await admin
      .from('profile_presets')
      .upsert(
        {
          user_id: profile.id,
          slot,
          name,
          config,
          saved_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,slot' },
      )

    if (error) {
      console.error('[presets/POST] upsert error:', error)
      return NextResponse.json({ error: 'Failed to save preset' }, { status: 500 })
    }

    return NextResponse.json({ success: true, slot, name })
  } catch (error) {
    console.error('[presets/POST] error:', error)
    return NextResponse.json({ error: 'Failed to save preset' }, { status: 500 })
  }
}

// Rename a slot WITHOUT re-snapshotting. Used by the inline-rename
// affordance in the UI - saves the current name without touching
// the stored config or the saved_at timestamp.
export async function PATCH(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const slot = parseSlot(body.slot)
    if (!slot) {
      return NextResponse.json({ error: `slot must be 1-${SLOT_COUNT}` }, { status: 400 })
    }
    const rawName = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : null
    const name = rawName || null

    const admin = createAdminClient()
    const { error } = await admin
      .from('profile_presets')
      .update({ name })
      .eq('user_id', profile.id)
      .eq('slot', slot)

    if (error) {
      console.error('[presets/PATCH] rename error:', error)
      return NextResponse.json({ error: 'Failed to rename preset' }, { status: 500 })
    }

    return NextResponse.json({ success: true, slot, name })
  } catch (error) {
    console.error('[presets/PATCH] error:', error)
    return NextResponse.json({ error: 'Failed to rename preset' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const slot = parseSlot(body.slot)
    if (!slot) {
      return NextResponse.json({ error: `slot must be 1-${SLOT_COUNT}` }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('profile_presets')
      .delete()
      .eq('user_id', profile.id)
      .eq('slot', slot)

    if (error) {
      console.error('[presets/DELETE] error:', error)
      return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[presets/DELETE] error:', error)
    return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 })
  }
}
