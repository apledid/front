-- New features: discord presence, profile themes, visitor tracking, SEO metadata

-- Add discord presence columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discord_presence_enabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discord_user_id TEXT DEFAULT '';

-- Add SEO metadata columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_title TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_description TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_image_url TEXT DEFAULT '';

-- Add theme preset column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme_preset TEXT DEFAULT 'default';

-- Add profile layout column (compact, standard, expanded)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_layout TEXT DEFAULT 'standard';

-- Add audio visualizer toggle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS audio_visualizer_enabled BOOLEAN DEFAULT true;

-- Add avatar decoration/border style
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_border_style TEXT DEFAULT 'default';

-- Add profile card blur amount
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS card_blur_amount INTEGER DEFAULT 12;

-- Add background overlay opacity
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bg_overlay_opacity REAL DEFAULT 0.3;

-- Add custom CSS (premium feature)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_css TEXT DEFAULT '';

-- Add page title (shown in browser tab)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS page_title TEXT DEFAULT '';

-- Create profile_themes table for community templates
CREATE TABLE IF NOT EXISTS profile_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  creator_id UUID REFERENCES profiles(id),
  accent_color TEXT DEFAULT '#8B5CF6',
  background_color TEXT DEFAULT '#06060b',
  font_family TEXT DEFAULT 'Inter',
  card_blur_amount INTEGER DEFAULT 12,
  bg_overlay_opacity REAL DEFAULT 0.3,
  avatar_border_style TEXT DEFAULT 'default',
  preview_url TEXT DEFAULT '',
  uses INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS
ALTER TABLE profile_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Themes are viewable by everyone" ON profile_themes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create themes" ON profile_themes FOR INSERT WITH CHECK (true);

-- Create visitor_logs for advanced analytics
CREATE TABLE IF NOT EXISTS visitor_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  visitor_ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  referrer TEXT DEFAULT '',
  country TEXT DEFAULT '',
  city TEXT DEFAULT '',
  device_type TEXT DEFAULT 'desktop',
  browser TEXT DEFAULT '',
  os TEXT DEFAULT '',
  visited_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own visitor logs" ON visitor_logs FOR SELECT USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Anyone can insert visitor logs" ON visitor_logs FOR INSERT WITH CHECK (true);
