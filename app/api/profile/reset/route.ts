/**
 * Reset profile fields by category.
 *
 * POST body: { categories?: ResetCategory[] }
 *
 *   - If `categories` is empty / missing → reset EVERYTHING (legacy
 *     full-nuke behavior preserved so old client code still works).
 *   - If `categories` lists one or more buckets → only the columns
 *     and child tables that bucket maps to get reset.
 *
 * Categories:
 *
 *   theme        accent / background / text colors, fonts, glow,
 *                gradients, outline
 *   layout       layout_mode, panel_size, avatar position/shape,
 *                card_style, border_style, profile_radius +
 *                truncates widgets table
 *   background   background image / video, particle effect,
 *                wallpaper-ish stuff
 *   bio          display_name, bio text, location, typing-bio
 *                settings + avatar_url, avatar_decoration_hash,
 *                discord avatar columns
 *   socials      truncates social_links table for this user
 *   buttons      truncates custom_buttons table for this user
 *   badges       truncates profile_badge_loadout + title_loadout
 *   music        truncates music_history + resets music_* columns
 *                on the profile row
 *   effects      hover_effect, cursor_effect, username_effect,
 *                entrance_animation, tilt_effect, enter_*
 *
 * Identity columns (username, email, password_hash, premium_active,
 * view_count, admin flags, etc.) are NEVER touched regardless of
 * the categories selected - they aren't in PROFILE_ALLOWED_COLUMNS
 * so the reset can't reach them.
 */

import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withRateLimit } from '@/lib/rate-limit'
import { PROFILE_ALLOWED_COLUMNS } from '@/lib/profile-columns'

// Non-null DB defaults for columns that have a NOT NULL constraint.
// Anything not listed here gets nulled, which the DB will accept for
// nullable columns. This map is hand-curated; the source of truth is
//   SELECT column_name, column_default FROM information_schema.columns
//   WHERE table_name='profiles' AND is_nullable='NO';
const RESET_DEFAULTS: Record<string, unknown> = {
  accent_color: '#06b6d4',
  background_type: 'solid',
  background_color: '#0a0a0f',
  text_color: '#ffffff',
  font_family: 'Inter',
  card_style: 'glass',
  border_style: 'glow',
  panel_size: 'medium',
  show_avatar: true,
  show_name: true,
  show_view_count: true,
  show_badges: true,
  is_public: true,
  layout_mode: 'default',
  avatar_position: 'center',
  avatar_placement: 'outside',
  typing_speed: 100,
  music_volume: 80,
  glow_intensity: 50,
  glow_color: '#e87fa0',
  profile_opacity: 100,
  profile_blur: 0,
  profile_radius: 16,
  widget_display_mode: 'carousel',
  time_format: '24h',
  animate_view_count: false,
  views_badge_background: false,
  views_location_position: 'top-right',
  rez_unequipped_crypto: [],
}

function defaultFor(column: string): unknown {
  return column in RESET_DEFAULTS ? RESET_DEFAULTS[column] : null
}

// Each category maps to the set of `profiles` columns it resets and
// the set of child tables it truncates for the user. Columns may
// appear in multiple categories (e.g. background_color is in both
// `theme` and `background`) - that's fine, the UPDATE is idempotent.
type Category =
  | 'theme'
  | 'layout'
  | 'background'
  | 'bio'
  | 'socials'
  | 'buttons'
  | 'badges'
  | 'music'
  | 'effects'

interface CategoryMap {
  columns: string[]
  tables: string[]
}

const CATEGORIES: Record<Category, CategoryMap> = {
  theme: {
    columns: [
      'accent_color', 'text_color', 'icon_color', 'font_family',
      'custom_font_url', 'custom_font_name',
      'font_1_url', 'font_1_name', 'font_2_url', 'font_2_name',
      'font_3_url', 'font_3_name', 'font_4_url', 'font_4_name',
      'font_slot_displayname', 'font_slot_username', 'font_slot_bio', 'font_slot_music',
      'font_apply_displayname', 'font_apply_username', 'font_apply_bio', 'font_apply_music',
      'display_name_color', 'username_handle_color', 'bio_color', 'location_color',
      'card_text_color', 'music_text_color',
      'glow_username', 'glow_socials', 'glow_badges', 'glow_description',
      'glow_color', 'glow_intensity',
      'socials_glow_mono',
      'profile_gradient_enabled', 'profile_gradient_primary', 'profile_gradient_secondary',
      'outline_enabled', 'outline_color', 'outline_width',
      'swap_box_colors', 'monochrome_icons', 'monochrome_badges',
      'badge_color', 'badge_glow_strength', 'badge_accent_color', 'badge_border_radius',
      'badge_opacity', 'badge_border_enabled', 'badge_border_color', 'badge_border_width',
      'badge_border_opacity',
    ],
    tables: [],
  },
  layout: {
    columns: [
      'layout_mode', 'layout_style', 'avatar_position', 'avatar_placement',
      'avatar_shape', 'avatar_style',
      'panel_size', 'panel_height', 'panel_opacity',
      'card_style', 'border_style', 'profile_radius', 'profile_border_color',
      'profile_opacity', 'profile_blur', 'profile_enter_animation',
      'content_alignment', 'layout_max_width',
      'bento_tiles', 'widget_display_mode', 'showcase_mode',
      'card_color', 'card_radius', 'card_transparent', 'inner_card_transparent',
      'card_background', 'card_border_color', 'card_border_width',
      'card_shadow', 'card_blur',
      'card_gradient_enabled', 'card_gradient_from', 'card_gradient_to',
      'inner_card_background', 'inner_card_border_color',
      'badges_next_to_name', 'show_views', 'views_location_position',
      'views_badge_background', 'animate_view_count',
      'banner_url', 'show_join_date',
      'social_icons_no_background', 'socials_below_widgets',
    ],
    // Widgets table - VALORANT / Discord / GitHub / Last.fm tiles
    // live on the profile next to the layout, so a layout reset
    // wipes the widget set too.
    tables: ['widgets'],
  },
  background: {
    columns: [
      'background_type', 'background_color', 'background_gradient', 'background_url',
      'background_effect', 'background_effect_strength',
      'particle_enabled', 'particle_color', 'particle_count',
    ],
    tables: [],
  },
  bio: {
    columns: [
      'display_name', 'bio', 'location',
      'typing_bio', 'typing_speed', 'bio_texts',
      // Avatar / PFP + decoration overlay. Treating these as bio
      // content rather than theme - they're identity content, not
      // colors. Resetting bio nulls the avatar so the profile falls
      // back to the placeholder.
      'avatar_url', 'avatar_decoration_hash',
      'use_discord_avatar', 'discord_avatar', 'discord_avatar_decoration',
    ],
    tables: [],
  },
  socials: {
    columns: [],
    tables: ['social_links'],
  },
  buttons: {
    columns: [],
    tables: ['custom_buttons'],
  },
  badges: {
    columns: [],
    tables: ['profile_badge_loadout', 'profile_title_loadout'],
  },
  music: {
    columns: [
      'music_enabled', 'music_url', 'music_title', 'music_artist',
      'music_autoplay', 'music_show_title', 'music_show_artist',
      'music_hide_panel', 'music_show_cover', 'music_volume', 'music_shuffle',
    ],
    tables: ['music_history'],
  },
  effects: {
    columns: [
      'hover_effect', 'hover_effect_color',
      'cursor_effect', 'cursor_color', 'custom_cursor_url', 'custom_cursor_hover_url',
      'cursor_glow_enabled', 'cursor_trail_enabled',
      'username_effect',
      'entrance_animation', 'tilt_effect',
      'enter_enabled', 'enter_title', 'enter_subtitle',
      'enter_show_profile', 'enter_show_title', 'enter_show_subtitle',
      'volume_control', 'animated_title',
    ],
    tables: [],
  },
}

const ALL_CATEGORIES = Object.keys(CATEGORIES) as Category[]

function isValidCategory(c: unknown): c is Category {
  return typeof c === 'string' && c in CATEGORIES
}

export async function POST(request: Request) {
  try {
    const rateLimit = await withRateLimit(request, 'profileUpdate')
    if (rateLimit.response) return rateLimit.response

    const profile = await getApiUser()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const rawCategories = Array.isArray(body?.categories) ? body.categories : []
    const requested = rawCategories.filter(isValidCategory) as Category[]

    // Empty / missing categories = full reset (back-compat with the
    // old "reset everything" button).
    const categories: Category[] = requested.length > 0 ? requested : [...ALL_CATEGORIES]

    // Collapse the per-category column / table sets into uniques.
    const columnSet = new Set<string>()
    const tableSet = new Set<string>()
    for (const cat of categories) {
      const map = CATEGORIES[cat]
      for (const col of map.columns) {
        // Defense in depth: only allow columns that are in
        // PROFILE_ALLOWED_COLUMNS. If a typo slips into a category
        // map, we won't accidentally try to update some sensitive
        // column.
        if (PROFILE_ALLOWED_COLUMNS.includes(col as any)) columnSet.add(col)
      }
      for (const t of map.tables) tableSet.add(t)
    }

    const admin = createAdminClient()

    // Build the column update payload.
    const updates: Record<string, unknown> = {}
    for (const col of columnSet) {
      updates[col] = defaultFor(col)
    }

    // Run the profile UPDATE + every child table truncate in
    // parallel. They're independent operations on different rows /
    // tables so there's no ordering requirement.
    const ops: PromiseLike<{ error: any }>[] = []
    if (Object.keys(updates).length > 0) {
      ops.push(
        admin
          .from('profiles')
          .update(updates)
          .eq('id', profile.id)
          .then((r) => ({ error: r.error })),
      )
    }
    for (const table of tableSet) {
      ops.push(
        admin
          .from(table)
          .delete()
          .eq('user_id', profile.id)
          .then((r) => ({ error: r.error })),
      )
    }

    const results = await Promise.all(ops)
    for (const r of results) {
      if (r.error) {
        console.error('[reset] op error:', r.error)
      }
    }

    // Return the resolved category list + counts so the UI can show
    // an accurate "Reset 4 categories" confirmation toast.
    return NextResponse.json({
      success: true,
      categories,
      columnsTouched: columnSet.size,
      tablesTruncated: tableSet.size,
    })
  } catch (error) {
    console.error('[reset] error:', error)
    return NextResponse.json({ error: 'Failed to reset profile' }, { status: 500 })
  }
}
