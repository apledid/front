-- Fix schema: ensure all columns exist for the custom-auth based profile system
-- Safe to run multiple times due to IF NOT EXISTS

-- Core profile columns that might be missing from earlier migrations
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#06b6d4';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT '#ffffff';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#0a0a0f';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS icon_color TEXT DEFAULT '#06b6d4';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'Inter';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_font_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS card_style TEXT DEFAULT 'glass';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS border_style TEXT DEFAULT 'rounded';

-- Background
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_type TEXT DEFAULT 'solid';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_gradient TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_effect TEXT DEFAULT 'none';

-- Username & profile effects
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_effect TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_opacity INTEGER DEFAULT 100;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_blur INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_gradient_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_gradient_primary TEXT DEFAULT '#06b6d4';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_gradient_secondary TEXT DEFAULT '#8b5cf6';

-- Glow / outline settings
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS glow_username BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS glow_socials BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS glow_badges BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS outline_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS outline_color TEXT DEFAULT '#06b6d4';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS outline_width INTEGER DEFAULT 2;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS glow_intensity INTEGER DEFAULT 50;

-- Cursor effects
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cursor_effect TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cursor_glow_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cursor_trail_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_cursor_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tilt_effect BOOLEAN DEFAULT false;

-- Animation effects
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hover_effect TEXT DEFAULT 'lift';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS entrance_animation TEXT DEFAULT 'fade';

-- Particles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS particle_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS particle_color TEXT DEFAULT '#06b6d4';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS particle_count INTEGER DEFAULT 30;

-- Display toggles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_view_count BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_badges BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monochrome_icons BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS animated_title BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS swap_box_colors BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS volume_control BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS use_discord_avatar BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discord_avatar_decoration BOOLEAN DEFAULT false;

-- Profile layout options
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS panel_size TEXT DEFAULT 'medium';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_position TEXT DEFAULT 'center';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_avatar BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_name BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS typing_bio BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio_texts TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;

-- Music
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS music_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS music_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS music_title TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS music_artist TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS music_autoplay BOOLEAN DEFAULT false;

-- Misc
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- Ensure link_clicks has profile_id column for analytics
ALTER TABLE public.link_clicks ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
