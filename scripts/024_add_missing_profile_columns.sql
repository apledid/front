-- Add missing columns to profiles table for appearance and effects

-- Icon color
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS icon_color TEXT DEFAULT '#06b6d4';

-- Background effects
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_effect TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_gradient TEXT;

-- Profile panel styling
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_blur INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_gradient_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_gradient_primary TEXT DEFAULT '#06b6d4';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_gradient_secondary TEXT DEFAULT '#8b5cf6';

-- Glow effects
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS glow_username BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS glow_socials BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS glow_badges BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS glow_intensity INTEGER DEFAULT 50;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS glow_color TEXT DEFAULT '#06b6d4';

-- Outline styling
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS outline_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS outline_color TEXT DEFAULT '#06b6d4';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS outline_width INTEGER DEFAULT 2;

-- Border style
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS border_style TEXT DEFAULT 'glow';

-- Custom font
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_font_url TEXT;

-- Cursor effects
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cursor_trail_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_cursor_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_cursor_hover_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cursor_effect TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cursor_color TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cursor_click_effect TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cursor_click_color TEXT;

-- Username effect
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_effect TEXT DEFAULT 'none';

-- Card effects
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tilt_effect BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hover_effect TEXT DEFAULT 'glow';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS entrance_animation TEXT DEFAULT 'fade';

-- Display options
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_view_count BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_badges BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monochrome_icons BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS animated_title BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS swap_box_colors BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS volume_control BOOLEAN DEFAULT true;

-- Music settings
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS music_show_title BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS music_show_artist BOOLEAN DEFAULT true;
