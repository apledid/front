-- Migration to use Supabase Auth instead of custom auth
-- This creates a profiles table that references auth.users

-- Drop old custom auth tables if they exist
DROP TABLE IF EXISTS public.link_clicks CASCADE;
DROP TABLE IF EXISTS public.page_views CASCADE;
DROP TABLE IF EXISTS public.profile_badges CASCADE;
DROP TABLE IF EXISTS public.music_history CASCADE;
DROP TABLE IF EXISTS public.custom_buttons CASCADE;
DROP TABLE IF EXISTS public.social_links CASCADE;
DROP TABLE IF EXISTS public.custom_links CASCADE;
DROP TABLE IF EXISTS public.licenses CASCADE;
DROP TABLE IF EXISTS public.purchases CASCADE;
DROP TABLE IF EXISTS public.staff_roles CASCADE;
DROP TABLE IF EXISTS public.moderation_logs CASCADE;
DROP TABLE IF EXISTS public.admin_actions CASCADE;
DROP TABLE IF EXISTS public.user_awards CASCADE;
DROP TABLE IF EXISTS public.awards CASCADE;
DROP TABLE IF EXISTS public.user_titles CASCADE;
DROP TABLE IF EXISTS public.titles CASCADE;
DROP TABLE IF EXISTS public.inbox CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.badges CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Create profiles table linked to Supabase Auth
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  accent_color TEXT DEFAULT '#06b6d4',
  background_type TEXT DEFAULT 'solid',
  background_color TEXT DEFAULT '#0a0a0f',
  background_url TEXT,
  text_color TEXT DEFAULT '#ffffff',
  font_family TEXT DEFAULT 'Inter',
  card_style TEXT DEFAULT 'glass',
  panel_size TEXT DEFAULT 'medium',
  panel_opacity INTEGER DEFAULT 100,
  particle_enabled BOOLEAN DEFAULT true,
  particle_color TEXT DEFAULT '#06b6d4',
  cursor_glow_enabled BOOLEAN DEFAULT true,
  effect_enabled BOOLEAN DEFAULT false,
  effect_type TEXT DEFAULT 'sparkles',
  music_enabled BOOLEAN DEFAULT false,
  music_url TEXT,
  music_title TEXT,
  music_artist TEXT,
  music_autoplay BOOLEAN DEFAULT false,
  music_volume INTEGER DEFAULT 50,
  is_public BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  is_banned BOOLEAN DEFAULT false,
  ban_reason TEXT,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social links table
CREATE TABLE public.social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom buttons table
CREATE TABLE public.custom_buttons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  bg_color TEXT DEFAULT '#06b6d4',
  text_color TEXT DEFAULT '#ffffff',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Badges table
CREATE TABLE public.badges (
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
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Page views for analytics
CREATE TABLE public.page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visitor_ip TEXT,
  country TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link clicks for analytics
CREATE TABLE public.link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  link_id UUID,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_profiles_username ON public.profiles(username);
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
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_buttons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles 
  FOR SELECT USING (is_public = true OR auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles 
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles 
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete their own profile" ON public.profiles 
  FOR DELETE USING (auth.uid() = id);

-- RLS Policies for social_links
CREATE POLICY "Social links are viewable by everyone" ON public.social_links 
  FOR SELECT USING (true);
CREATE POLICY "Users can insert their own social links" ON public.social_links 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own social links" ON public.social_links 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own social links" ON public.social_links 
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for custom_buttons
CREATE POLICY "Custom buttons are viewable by everyone" ON public.custom_buttons 
  FOR SELECT USING (true);
CREATE POLICY "Users can insert their own buttons" ON public.custom_buttons 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own buttons" ON public.custom_buttons 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own buttons" ON public.custom_buttons 
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for badges (read only for users)
CREATE POLICY "Badges are viewable by everyone" ON public.badges 
  FOR SELECT USING (true);

-- RLS Policies for profile_badges
CREATE POLICY "Profile badges are viewable by everyone" ON public.profile_badges 
  FOR SELECT USING (true);

-- RLS Policies for analytics (insert only, viewable by profile owner)
CREATE POLICY "Anyone can insert page views" ON public.page_views 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Profile owners can view their page views" ON public.page_views 
  FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Anyone can insert link clicks" ON public.link_clicks 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their own link clicks" ON public.link_clicks 
  FOR SELECT USING (auth.uid() = user_id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
