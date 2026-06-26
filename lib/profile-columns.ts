/**
 * Single source of truth for which columns on `public.profiles` can be set
 * by the user via API routes.
 *
 * Used by:
 *   - `app/api/profile/route.ts` PUT handler (direct profile updates)
 *   - `app/api/templates/apply/route.ts` POST handler (applying a template)
 *
 * Anything not in this list is silently dropped. This stops:
 *   - mass-assignment of dangerous columns like `is_admin`, `premium_active`,
 *     `banned`, `uid`, `flagged_for_review`, `views_count`
 *   - a malicious public template stuffing those values into its config and
 *     escalating any user who applies it
 *
 * When adding a new profile column, add its name here.
 */
export const PROFILE_ALLOWED_COLUMNS = [
  'display_name', 'bio', 'location',
  'avatar_url', 'banner_url', 'background_url',
  'accent_color', 'background_type', 'background_color', 'background_gradient',
  'text_color', 'font_family', 'custom_font_url', 'custom_font_name', 'card_style', 'border_style',
  'panel_size', 'panel_height', 'avatar_position', 'avatar_placement', 'show_avatar', 'show_name',
  'typing_bio', 'typing_speed', 'bio_texts', 'enter_enabled', 'enter_title', 'enter_subtitle', 'enter_show_profile', 'enter_show_title', 'enter_show_subtitle',
  'background_effect', 'background_effect_strength', 'background_effect_color',
  'particle_enabled', 'particle_color', 'particle_count',
  'cursor_glow_enabled', 'cursor_trail_enabled', 'custom_cursor_url',
  'hover_effect', 'hover_effect_color', 'entrance_animation', 'tilt_effect',
  'show_view_count', 'show_badges',
  'music_enabled', 'music_url', 'music_title', 'music_artist', 'music_autoplay', 'music_show_title', 'music_show_artist', 'music_hide_panel', 'music_show_cover',
  'is_public',
  // Layout settings
  'layout_style', 'layout_mode', 'avatar_shape', 'widget_display_mode', 'showcase_mode', 'avatar_style', 'content_alignment', 'show_views', 'badges_next_to_name', 'layout_max_width',
  // Bento layout: JSONB array of tile descriptors (col/row/w/h + type).
  // Validated and capped server-side; see lib/bento-defaults.ts.
  'bento_tiles',
  'profile_opacity', 'profile_blur', 'profile_radius', 'profile_border_color', 'profile_enter_animation',
  // Profile card settings
  'card_color', 'card_radius', 'card_transparent', 'inner_card_transparent',
  'card_background', 'card_border_color', 'card_border_width', 'card_shadow', 'card_blur',
  'card_gradient_enabled', 'card_gradient_from', 'card_gradient_to',
  'inner_card_background', 'inner_card_border_color',
  // Time customization
  'show_join_date', 'time_format', 'time_display_mode',
  // Music
  'music_volume', 'music_shuffle',
  // Sound effects (premium-only; the column write is gated to premium in /api/upload)
  'click_sound_url', 'enter_sound_url',
  'click_sound_volume', 'enter_sound_volume',
  // Badge settings
  'badge_color', 'badge_glow_strength', 'badge_accent_color', 'badge_border_radius',
  'badge_opacity', 'badge_border_enabled', 'badge_border_color', 'badge_border_width', 'badge_border_opacity',
  'monochrome_badges', 'glow_badges',
  // Social icons
  'social_icons_no_background', 'monochrome_icons',
  // Where in the content stack the social-icon row sits. Default
  // (false) = between bio and custom buttons (Classic order). True =
  // below the widgets panel.
  'socials_below_widgets',
  // Glow Socials behaviour. Default (false) = per-platform brand
  // colour for each icon's drop-shadow (spotify green, youtube red,
  // …). True = single `glow_color` for all icons (the legacy mono
  // behaviour).
  'socials_glow_mono',
  // Advanced per-element text colors (NULL inherits text_color)
  'display_name_color', 'username_handle_color', 'bio_color', 'location_color',
  'card_text_color', 'music_text_color',
  // Per-element font targeting toggles (true = use uploaded font on this element)
  'font_apply_displayname', 'font_apply_username', 'font_apply_bio', 'font_apply_music',
  // Multi-font support (4 slots + per-element slot assignment)
  'font_1_url', 'font_1_name', 'font_2_url', 'font_2_name',
  'font_3_url', 'font_3_name', 'font_4_url', 'font_4_name',
  'font_slot_displayname', 'font_slot_username', 'font_slot_bio', 'font_slot_music',
  // Owner-only crypto badges loadout for @rez (text[] of unequipped slugs)
  'rez_unequipped_crypto',
  // Effects/cursor/username
  'username_effect', 'cursor_effect', 'cursor_color', 'custom_cursor_hover_url',
  // Profile gradient + outline + glows
  'profile_gradient_enabled', 'profile_gradient_primary', 'profile_gradient_secondary',
  'outline_enabled', 'outline_color', 'outline_width',
  'glow_username', 'glow_socials', 'glow_description', 'glow_color', 'glow_intensity',
  // Appearance misc
  'icon_color', 'panel_opacity',
  // Misc toggles previously on /api/effects
  'volume_control', 'animated_title', 'animate_view_count',
  'swap_box_colors', 'show_likes', 'views_location_position', 'views_badge_background',
  'use_discord_avatar', 'discord_avatar', 'discord_avatar_decoration',
  // Avatar decoration overlay (APNG hash served from decor CDN)
  'avatar_decoration_hash',
  // Avatar outline + glow (owner-only cosmetic for @rez; rendered only when
  // username === 'rez'). Harmless if set by other users - it never renders.
  'avatar_outline_enabled', 'avatar_outline_color', 'avatar_outline_size',
  'avatar_glow_enabled', 'avatar_glow_color', 'avatar_glow_size',
] as const

export type ProfileAllowedColumn = (typeof PROFILE_ALLOWED_COLUMNS)[number]
