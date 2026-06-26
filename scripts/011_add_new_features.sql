-- Add new columns for enhanced customization features
-- Background Effects, Username Effects, Profile Opacity/Blur, Color Customization, etc.

-- Add new columns to profiles table for background/username effects
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_effect TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_effect TEXT DEFAULT 'none';

-- Profile appearance settings
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_opacity INTEGER DEFAULT 100;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_blur INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_gradient_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_gradient_primary TEXT DEFAULT '#0c0c0c';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_gradient_secondary TEXT DEFAULT '#000000';

-- Color customization
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS icon_color TEXT DEFAULT '#ffffff';

-- Glow settings
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS glow_username BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS glow_socials BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS glow_badges BOOLEAN DEFAULT false;

-- Other customization toggles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monochrome_icons BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS animated_title BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS swap_box_colors BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS volume_control BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS use_discord_avatar BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discord_avatar_decoration BOOLEAN DEFAULT false;

-- Custom font support
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_font_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_font_name TEXT;

-- Missing columns from previous scripts
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_cursor_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tilt_effect BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS panel_size TEXT DEFAULT 'medium';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_position TEXT DEFAULT 'left';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_avatar BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_name BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS typing_bio BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio_texts TEXT[];
