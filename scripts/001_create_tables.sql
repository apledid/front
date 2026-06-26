-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  location TEXT,
  
  -- Theme settings (JSON)
  theme JSONB DEFAULT '{
    "background_type": "solid",
    "background_color": "#0a0a0f",
    "background_gradient_from": "#0a0a0f",
    "background_gradient_to": "#1a1a2e",
    "background_gradient_direction": "to-br",
    "background_image_url": null,
    "background_particles": true,
    "accent_color": "#00d4aa",
    "card_background": "rgba(20, 20, 30, 0.8)",
    "card_blur": true,
    "text_color": "#ffffff",
    "font_family": "Inter",
    "custom_cursor": false,
    "cursor_glow": true,
    "border_style": "glow"
  }'::jsonb,
  
  -- Profile settings
  is_public BOOLEAN DEFAULT true,
  show_views BOOLEAN DEFAULT true,
  show_discord_status BOOLEAN DEFAULT true,
  show_spotify BOOLEAN DEFAULT true,
  show_badges BOOLEAN DEFAULT true,
  
  -- Discord integration
  discord_id TEXT,
  discord_username TEXT,
  
  -- Spotify integration
  spotify_access_token TEXT,
  spotify_refresh_token TEXT,
  spotify_token_expires_at TIMESTAMPTZ,
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  
  -- Premium status
  is_premium BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  is_og BOOLEAN DEFAULT false,
  is_early BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create social links table
CREATE TABLE IF NOT EXISTS social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  custom_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create custom buttons table
CREATE TABLE IF NOT EXISTS custom_buttons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT,
  style TEXT DEFAULT 'default',
  background_color TEXT,
  text_color TEXT,
  display_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create badges table
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create profile_badges junction table
CREATE TABLE IF NOT EXISTS profile_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, badge_id)
);

-- Create page views table for analytics
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  visitor_ip TEXT,
  visitor_country TEXT,
  visitor_city TEXT,
  visitor_device TEXT,
  visitor_browser TEXT,
  referrer TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create link clicks table for analytics
CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL, -- 'social' or 'custom'
  link_id UUID,
  platform TEXT,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create music history table for Spotify
CREATE TABLE IF NOT EXISTS music_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  track_name TEXT,
  artist_name TEXT,
  album_name TEXT,
  album_image_url TEXT,
  track_url TEXT,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_buttons ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_history ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select_public" ON profiles FOR SELECT USING (is_public = true OR auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE USING (auth.uid() = id);

-- Social links policies
CREATE POLICY "social_links_select_public" ON social_links FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = social_links.profile_id AND (profiles.is_public = true OR auth.uid() = profiles.id))
);
CREATE POLICY "social_links_insert_own" ON social_links FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "social_links_update_own" ON social_links FOR UPDATE USING (auth.uid() = profile_id);
CREATE POLICY "social_links_delete_own" ON social_links FOR DELETE USING (auth.uid() = profile_id);

-- Custom buttons policies
CREATE POLICY "custom_buttons_select_public" ON custom_buttons FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = custom_buttons.profile_id AND (profiles.is_public = true OR auth.uid() = profiles.id))
);
CREATE POLICY "custom_buttons_insert_own" ON custom_buttons FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "custom_buttons_update_own" ON custom_buttons FOR UPDATE USING (auth.uid() = profile_id);
CREATE POLICY "custom_buttons_delete_own" ON custom_buttons FOR DELETE USING (auth.uid() = profile_id);

-- Badges policies (public read, admin write)
CREATE POLICY "badges_select_all" ON badges FOR SELECT USING (true);

-- Profile badges policies
CREATE POLICY "profile_badges_select_public" ON profile_badges FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profile_badges.profile_id AND (profiles.is_public = true OR auth.uid() = profiles.id))
);

-- Page views policies
CREATE POLICY "page_views_insert_all" ON page_views FOR INSERT WITH CHECK (true);
CREATE POLICY "page_views_select_own" ON page_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = page_views.profile_id AND auth.uid() = profiles.id)
);

-- Link clicks policies
CREATE POLICY "link_clicks_insert_all" ON link_clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "link_clicks_select_own" ON link_clicks FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = link_clicks.profile_id AND auth.uid() = profiles.id)
);

-- Music history policies
CREATE POLICY "music_history_select_public" ON music_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = music_history.profile_id AND (profiles.is_public = true OR auth.uid() = profiles.id))
);
CREATE POLICY "music_history_insert_own" ON music_history FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_social_links_profile ON social_links(profile_id);
CREATE INDEX IF NOT EXISTS idx_custom_buttons_profile ON custom_buttons(profile_id);
CREATE INDEX IF NOT EXISTS idx_page_views_profile ON page_views(profile_id);
CREATE INDEX IF NOT EXISTS idx_page_views_date ON page_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_link_clicks_profile ON link_clicks(profile_id);

-- Insert default badges
INSERT INTO badges (name, description, icon, color) VALUES
  ('OG', 'Original user from early days', 'Crown', '#FFD700'),
  ('Verified', 'Verified profile', 'BadgeCheck', '#1DA1F2'),
  ('Premium', 'Premium subscriber', 'Sparkles', '#FF69B4'),
  ('Early', 'Early adopter', 'Rocket', '#9B59B6'),
  ('Developer', 'Platform developer', 'Code', '#00D4AA'),
  ('Staff', 'Platform staff member', 'Shield', '#FF4444')
ON CONFLICT (name) DO NOTHING;
