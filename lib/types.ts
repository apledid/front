// Profile matches the database schema plus recent UI additions
// Note: id now references auth.users(id) directly via Supabase Auth
export interface Profile {
  id: string
  username: string | null
  display_name?: string | null
  bio?: string | null
  avatar_url?: string | null
  banner_url?: string | null
  background_url?: string | null

  // Profile Metadata - overrides for the embed/SEO card shown when the
  // profile link is shared on Discord, Twitter, etc. All premium-only.
  favicon_url?: string | null
  embed_title?: string | null
  embed_description?: string | null
  embed_image_url?: string | null
  embed_color?: string | null

  // Appearance
  accent_color?: string | null
  text_color?: string | null
  background_color?: string | null
  icon_color?: string | null
  font_family?: string | null
  custom_font_url?: string | null
  custom_font_name?: string | null
  card_style?: string | null
  border_style?: string | null
  background_effect?: string | null
  background_effect_strength?: number | null
  background_effect_color?: string | null
  background_type?: string | null
  background_gradient?: string | null
  profile_opacity?: number
  profile_blur?: number
  profile_radius?: number
  profile_border_color?: string | null
  profile_enter_animation?: string | null
  layout_mode?: string | null
  avatar_shape?: string | null
  widget_display_mode?: string | null
  profile_gradient_enabled?: boolean
  profile_gradient_primary?: string | null
  profile_gradient_secondary?: string | null
  glow_username?: boolean
  glow_socials?: boolean
  glow_badges?: boolean
  /** Bio paragraph gets a soft text-shadow halo built from
   *  `glow_color` + `glow_intensity`. Mirrors the username glow. */
  glow_description?: boolean
  glow_intensity?: number
  glow_color?: string | null
  /** When `glow_socials` is on: false (default) = each icon's drop-
   *  shadow uses its platform brand colour (Spotify green, YouTube
   *  red, …). True = single `glow_color` for all icons (legacy). */
  socials_glow_mono?: boolean
  /** Move the social-icon row below the widgets panel instead of its
   *  default slot between bio and custom buttons. */
  socials_below_widgets?: boolean
  outline_enabled?: boolean
  outline_color?: string | null
  outline_width?: number

  // Effects
  username_effect?: string | null
  particle_type?: string | null
  particle_enabled?: boolean
  particle_color?: string | null
  particle_count?: number
  cursor_effect?: string | null
  cursor_trail_enabled?: boolean
  cursor_glow_enabled?: boolean
  custom_cursor_url?: string | null
  custom_cursor_hover_url?: string | null
  cursor_color?: string | null
  cursor_click_effect?: string | null
  cursor_click_color?: string | null
  tilt_effect?: boolean
  hover_effect?: string | null
  hover_effect_color?: string | null
  entrance_animation?: string | null
  monochrome_icons?: boolean
  animated_title?: boolean
  swap_box_colors?: boolean
  // Profile likes / dislikes (guns.lol-style). `show_likes` toggles the
  // thumbs UI; the counts are denormalized from profile_reactions.
  show_likes?: boolean
  likes_count?: number
  dislikes_count?: number
  volume_control?: boolean
  use_discord_avatar?: boolean
  discord_avatar_decoration?: boolean

  // Profile options
  location?: string | null
  panel_size?: string | null
  panel_height?: number
  avatar_position?: string | null
  avatar_placement?: string | null
  show_avatar?: boolean
  show_name?: boolean
  typing_bio?: boolean
  typing_speed?: number
  bio_texts?: string[] | null
  profile_uid?: string | null
  enter_enabled?: boolean | null
  enter_title?: string | null
  enter_subtitle?: string | null
  enter_show_profile?: boolean | null
  enter_show_title?: boolean | null
  enter_show_subtitle?: boolean | null

  // Music
  music_enabled?: boolean
  music_url?: string | null
  // Sound effects (premium-only)
  click_sound_url?: string | null
  enter_sound_url?: string | null
  click_sound_volume?: number | null
  enter_sound_volume?: number | null
  music_title?: string | null
  music_artist?: string | null
  music_autoplay?: boolean
  music_show_title?: boolean
  music_show_artist?: boolean
  music_hide_panel?: boolean

  // Display / status
  show_view_count?: boolean
  show_badges?: boolean
  is_public?: boolean
  premium_active?: boolean
  is_banned?: boolean
  ban_reason?: string | null
  banned_by_username?: string | null
  support_blacklisted?: boolean
  view_count?: number
  is_admin?: boolean
  email?: string | null
  created_at?: string
  updated_at?: string
}

export interface ThemeConfig {
  primary_color: string
  secondary_color: string
  background_type: 'solid' | 'gradient' | 'image' | 'video'
  background_value: string
  background_gradient_angle?: number
  card_style: 'glass' | 'solid' | 'outline' | 'minimal'
  card_blur: number
  card_opacity: number
  font_family: string
  border_radius: number
  glow_enabled: boolean
  glow_color: string
  glow_intensity: number
}

export interface EffectsConfig {
  particles_enabled: boolean
  particles_type: 'snow' | 'rain' | 'stars' | 'fireflies' | 'bubbles' | 'matrix' | 'none'
  particles_count: number
  particles_color: string
  cursor_glow: boolean
  cursor_trail: boolean
  cursor_trail_color: string
  typing_effect: boolean
  entrance_animation: 'fade' | 'slide' | 'scale' | 'bounce' | 'none'
  hover_animation: 'lift' | 'glow' | 'shake' | 'pulse' | 'none'
  background_animation: boolean
}

export interface SocialLink {
  id: string
  user_id: string
  platform: string
  url: string
  display_order: number
  created_at: string
  label?: string | null
  icon_url?: string | null
}

export interface CustomButton {
  id: string
  user_id: string
  label: string
  url: string
  media_url: string | null
  media_type: string | null
  bg_color: string | null
  text_color: string | null
  display_order: number
  created_at: string
}

export interface Badge {
  id: string
  name: string
  description: string | null
  icon: string
  icon_url?: string | null
  color: string
  background_color?: string | null
  glow_color?: string | null
  glow_strength?: number | null
  rarity?: string | null
  created_at?: string
}

export interface ProfileBadge {
  id: string
  user_id: string
  badge_id: string
  awarded_at: string
  badge?: Badge
}

export interface MusicHistory {
  id: string
  user_id: string
  track_url: string
  track_title: string | null
  track_artist: string | null
  added_at: string
}

export interface MusicTrack {
  id: string
  title: string
  artist: string
  url: string
  type?: 'direct' | 'spotify' | 'youtube' | 'soundcloud'
  cover_url?: string | null
  display_as_record?: boolean
  spin_record?: boolean
  // LRC-format synced lyrics ("[mm:ss.xx] line"); when present the profile can
  // show a Spotify-style synced lyrics view. external_url links out to the
  // track's source (e.g. its Apple Music / Spotify page).
  lyrics?: string | null
  external_url?: string | null
}

export interface PageView {
  id: string
  profile_id: string
  visitor_ip: string | null
  user_agent: string | null
  referrer: string | null
  country: string | null
  viewed_at: string
}

export interface LinkClick {
  id: string
  user_id: string
  link_type: string
  link_id: string | null
  clicked_at: string
}

export const DEFAULT_THEME: ThemeConfig = {
  primary_color: '#06b6d4',
  secondary_color: '#8b5cf6',
  background_type: 'gradient',
  background_value: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)',
  background_gradient_angle: 135,
  card_style: 'glass',
  card_blur: 20,
  card_opacity: 0.1,
  font_family: 'Inter',
  border_radius: 16,
  glow_enabled: true,
  glow_color: '#06b6d4',
  glow_intensity: 0.5,
}

export const DEFAULT_EFFECTS: EffectsConfig = {
  particles_enabled: true,
  particles_type: 'stars',
  particles_count: 50,
  particles_color: '#ffffff',
  cursor_glow: true,
  cursor_trail: false,
  cursor_trail_color: '#06b6d4',
  typing_effect: true,
  entrance_animation: 'fade',
  hover_animation: 'lift',
  background_animation: true,
}

export const SOCIAL_PLATFORMS = [
  { id: 'discord', name: 'Discord', icon: 'discord', color: '#5865F2', urlTemplate: null, placeholder: 'Discord invite link or user ID' },
  { id: 'twitter', name: 'Twitter / X', icon: 'twitter', color: '#1DA1F2', urlTemplate: 'https://twitter.com/{username}', placeholder: 'username' },
  { id: 'github', name: 'GitHub', icon: 'github', color: '#ffffff', urlTemplate: 'https://github.com/{username}', placeholder: 'username' },
  { id: 'gitlab', name: 'GitLab', icon: 'gitlab', color: '#FC6D26', urlTemplate: 'https://gitlab.com/{username}', placeholder: 'username' },
  { id: 'instagram', name: 'Instagram', icon: 'instagram', color: '#E4405F', urlTemplate: 'https://instagram.com/{username}', placeholder: 'username' },
  { id: 'facebook', name: 'Facebook', icon: 'facebook', color: '#1877F2', urlTemplate: 'https://facebook.com/{username}', placeholder: 'username' },
  { id: 'spotify', name: 'Spotify', icon: 'spotify', color: '#1DB954', urlTemplate: 'https://open.spotify.com/user/{username}', placeholder: 'username or profile link' },
  { id: 'soundcloud', name: 'SoundCloud', icon: 'soundcloud', color: '#FF5500', urlTemplate: 'https://soundcloud.com/{username}', placeholder: 'username' },
  { id: 'apple', name: 'Apple Music', icon: 'apple', color: '#FA243C', urlTemplate: 'https://music.apple.com/profile/{username}', placeholder: 'username' },
  { id: 'youtube', name: 'YouTube', icon: 'youtube', color: '#FF0000', urlTemplate: 'https://youtube.com/@{username}', placeholder: 'channel name' },
  { id: 'twitch', name: 'Twitch', icon: 'twitch', color: '#9146FF', urlTemplate: 'https://twitch.tv/{username}', placeholder: 'username' },
  { id: 'tiktok', name: 'TikTok', icon: 'tiktok', color: '#ffffff', urlTemplate: 'https://tiktok.com/@{username}', placeholder: 'username' },
  { id: 'snapchat', name: 'Snapchat', icon: 'snapchat', color: '#FFFC00', urlTemplate: 'https://snapchat.com/add/{username}', placeholder: 'username' },
  { id: 'linkedin', name: 'LinkedIn', icon: 'linkedin', color: '#0A66C2', urlTemplate: 'https://linkedin.com/in/{username}', placeholder: 'username' },
  { id: 'reddit', name: 'Reddit', icon: 'reddit', color: '#FF4500', urlTemplate: 'https://reddit.com/user/{username}', placeholder: 'username' },
  { id: 'telegram', name: 'Telegram', icon: 'telegram', color: '#26A5E4', urlTemplate: 'https://t.me/{username}', placeholder: 'username' },
  { id: 'bluesky', name: 'Bluesky', icon: 'bluesky', color: '#0085FF', urlTemplate: 'https://bsky.app/profile/{username}', placeholder: 'handle (e.g. name.bsky.social)' },
  { id: 'vk', name: 'VK', icon: 'vk', color: '#0077FF', urlTemplate: 'https://vk.com/{username}', placeholder: 'username' },
  { id: 'pinterest', name: 'Pinterest', icon: 'pinterest', color: '#E60023', urlTemplate: 'https://pinterest.com/{username}', placeholder: 'username' },
  { id: 'dribbble', name: 'Dribbble', icon: 'dribbble', color: '#EA4C89', urlTemplate: 'https://dribbble.com/{username}', placeholder: 'username' },
  { id: 'deviantart', name: 'DeviantArt', icon: 'deviantart', color: '#05CC47', urlTemplate: 'https://deviantart.com/{username}', placeholder: 'username' },
  { id: 'steam', name: 'Steam', icon: 'steam', color: '#00adee', urlTemplate: 'https://steamcommunity.com/id/{username}', placeholder: 'custom URL or profile ID' },
  { id: 'roblox', name: 'Roblox', icon: 'roblox', color: '#a0a0a0', urlTemplate: 'https://roblox.com/users/{username}/profile', placeholder: 'user ID' },
  { id: 'itchio', name: 'itch.io', color: '#FA5C5C', icon: 'itchio', urlTemplate: 'https://{username}.itch.io', placeholder: 'username' },
  { id: 'kickstarter', name: 'Kickstarter', icon: 'kickstarter', color: '#05CE78', urlTemplate: 'https://kickstarter.com/profile/{username}', placeholder: 'username' },
  { id: 'patreon', name: 'Patreon', icon: 'patreon', color: '#FF424D', urlTemplate: 'https://patreon.com/{username}', placeholder: 'username' },
  { id: 'kofi', name: 'Ko-fi', icon: 'kofi', color: '#FF5E5B', urlTemplate: 'https://ko-fi.com/{username}', placeholder: 'username' },
  { id: 'buymeacoffee', name: 'Buy Me a Coffee', icon: 'buymeacoffee', color: '#FFDD00', urlTemplate: 'https://buymeacoffee.com/{username}', placeholder: 'username' },
  { id: 'paypal', name: 'PayPal', icon: 'paypal', color: '#00457C', urlTemplate: 'https://paypal.me/{username}', placeholder: 'username' },
  { id: 'btc', name: 'Bitcoin', icon: 'btc', color: '#F7931A', urlTemplate: null, placeholder: 'BTC wallet address', copyOnly: true },
  { id: 'eth', name: 'Ethereum', icon: 'eth', color: '#627EEA', urlTemplate: null, placeholder: 'ETH wallet address', copyOnly: true },
  { id: 'ltc', name: 'Litecoin', icon: 'ltc', color: '#345D9D', urlTemplate: null, placeholder: 'LTC wallet address', copyOnly: true },
  { id: 'sol', name: 'Solana', icon: 'sol', color: '#9945FF', urlTemplate: null, placeholder: 'Solana wallet address', copyOnly: true },
  { id: 'xmr', name: 'Monero', icon: 'xmr', color: '#FF6600', urlTemplate: null, placeholder: 'Monero wallet address', copyOnly: true },
  { id: 'email', name: 'Email', icon: 'email', color: '#EA4335', urlTemplate: 'mailto:{username}', placeholder: 'email@example.com' },
  { id: 'website', name: 'Website', icon: 'globe', color: '#06b6d4', urlTemplate: null, placeholder: 'https://yourwebsite.com' },
  // Custom link - for anything not in the canonical platform list. The Add
  // Link dialog (components/dashboard/links-editor.tsx) renders a full
  // label + URL + icon-upload form when platform === 'custom', so it
  // doesn't need a urlTemplate. Pink because that's the site brand color
  // - the tile in the grid uses the Globe2 lucide icon directly, not the
  // SocialIcon component, so the 'icon' field here is just a placeholder.
  { id: 'custom', name: 'Custom Link', icon: 'globe', color: '#e87fa0', urlTemplate: null, placeholder: 'https://example.com' },
] as const


export type LoadoutPosition = 'above_username' | 'below_username' | 'above_links' | 'below_links'

export interface TitleItem {
  id: string
  name: string
  color: string
  created_at?: string
}

export interface ProfileBadgeLoadoutItem {
  badge_id: string
  position: LoadoutPosition
  display_order: number
  badge: Badge
}

export interface ProfileTitleLoadoutItem {
  title_id: string
  position: LoadoutPosition
  display_order: number
  title: TitleItem
}

export interface LicenseItem {
  id: string
  license_key: string
  plan_name: string
  plan_type: string
  status: 'pending' | 'redeemed'
  purchased_by?: string | null
  redeemed_by?: string | null
  redeemed_at?: string | null
  created_at?: string
}

export interface InboxMessage {
  id: string
  user_id: string
  subject: string
  body: string
  message_type: string
  license_key?: string | null
  from_staff?: boolean
  staff_username?: string | null
  created_at?: string
  read_at?: string | null
}
