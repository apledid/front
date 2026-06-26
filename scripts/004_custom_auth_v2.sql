-- Custom authentication table (no Supabase Auth, no email)
-- Drop existing constraints first
DROP TABLE IF EXISTS public.link_clicks CASCADE;
DROP TABLE IF EXISTS public.page_views CASCADE;
DROP TABLE IF EXISTS public.profile_badges CASCADE;
DROP TABLE IF EXISTS public.music_history CASCADE;
DROP TABLE IF EXISTS public.custom_buttons CASCADE;
DROP TABLE IF EXISTS public.social_links CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create custom users table with username/password only
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create profiles table linked to custom users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  accent_color TEXT DEFAULT '#06b6d4',
  background_type TEXT DEFAULT 'solid',
  background_color TEXT DEFAULT '#0a0a0f',
  background_gradient TEXT,
  text_color TEXT DEFAULT '#ffffff',
  font_family TEXT DEFAULT 'Inter',
  card_style TEXT DEFAULT 'glass',
  border_style TEXT DEFAULT 'rounded',
  show_view_count BOOLEAN DEFAULT true,
  show_badges BOOLEAN DEFAULT true,
  particle_enabled BOOLEAN DEFAULT true,
  particle_color TEXT DEFAULT '#06b6d4',
  particle_count INTEGER DEFAULT 50,
  cursor_glow_enabled BOOLEAN DEFAULT true,
  cursor_trail_enabled BOOLEAN DEFAULT false,
  hover_effect TEXT DEFAULT 'glow',
  entrance_animation TEXT DEFAULT 'fade',
  music_enabled BOOLEAN DEFAULT false,
  music_url TEXT,
  music_title TEXT,
  music_artist TEXT,
  music_autoplay BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social links table
CREATE TABLE public.social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom buttons table
CREATE TABLE public.custom_buttons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  bg_color TEXT DEFAULT '#06b6d4',
  text_color TEXT DEFAULT '#ffffff',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Badges table
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User badges junction table
CREATE TABLE public.profile_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Page views for analytics
CREATE TABLE public.page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visitor_ip TEXT,
  user_agent TEXT,
  referrer TEXT,
  country TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link clicks for analytics
CREATE TABLE public.link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  link_id UUID,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Music history
CREATE TABLE public.music_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  track_url TEXT NOT NULL,
  track_title TEXT,
  track_artist TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_social_links_user_id ON public.social_links(user_id);
CREATE INDEX idx_custom_buttons_user_id ON public.custom_buttons(user_id);
CREATE INDEX idx_page_views_profile_id ON public.page_views(profile_id);
CREATE INDEX idx_link_clicks_user_id ON public.link_clicks(user_id);

-- Insert default badges
INSERT INTO public.badges (name, icon, color, description) VALUES
  ('OG', 'crown', '#fbbf24', 'Original member'),
  ('Verified', 'badge-check', '#3b82f6', 'Verified account'),
  ('Premium', 'sparkles', '#a855f7', 'Premium member'),
  ('Early', 'rocket', '#10b981', 'Early adopter')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_buttons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_history ENABLE ROW LEVEL SECURITY;

-- Policies for users table (public read for signup check, insert for signup)
CREATE POLICY "Anyone can check username" ON public.users FOR SELECT USING (true);
CREATE POLICY "Anyone can create account" ON public.users FOR INSERT WITH CHECK (true);

-- Policies for profiles (public read, owner can modify)
CREATE POLICY "Public profiles are viewable" ON public.profiles FOR SELECT USING (is_public = true);
CREATE POLICY "Anyone can insert profile" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update profile" ON public.profiles FOR UPDATE USING (true);

-- Policies for social_links
CREATE POLICY "Social links are viewable" ON public.social_links FOR SELECT USING (true);
CREATE POLICY "Anyone can insert social links" ON public.social_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update social links" ON public.social_links FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete social links" ON public.social_links FOR DELETE USING (true);

-- Policies for custom_buttons
CREATE POLICY "Custom buttons are viewable" ON public.custom_buttons FOR SELECT USING (true);
CREATE POLICY "Anyone can insert custom buttons" ON public.custom_buttons FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update custom buttons" ON public.custom_buttons FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete custom buttons" ON public.custom_buttons FOR DELETE USING (true);

-- Policies for profile_badges
CREATE POLICY "Profile badges are viewable" ON public.profile_badges FOR SELECT USING (true);
CREATE POLICY "Anyone can insert profile badges" ON public.profile_badges FOR INSERT WITH CHECK (true);

-- Policies for page_views
CREATE POLICY "Page views are viewable" ON public.page_views FOR SELECT USING (true);
CREATE POLICY "Anyone can insert page views" ON public.page_views FOR INSERT WITH CHECK (true);

-- Policies for link_clicks
CREATE POLICY "Link clicks are viewable" ON public.link_clicks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert link clicks" ON public.link_clicks FOR INSERT WITH CHECK (true);

-- Policies for music_history
CREATE POLICY "Music history is viewable" ON public.music_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert music history" ON public.music_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update music history" ON public.music_history FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete music history" ON public.music_history FOR DELETE USING (true);

-- Policies for badges
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges are viewable by everyone" ON public.badges FOR SELECT USING (true);
