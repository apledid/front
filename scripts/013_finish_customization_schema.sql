-- Final customization schema sync
-- Safe to run multiple times.

-- Missing profile columns used by the UI / renderer
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS glow_color TEXT DEFAULT '#06b6d4';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS particle_type TEXT DEFAULT 'stars';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS typing_speed INTEGER DEFAULT 80;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS panel_height INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_font_name TEXT;

-- Custom button media support
ALTER TABLE public.custom_buttons ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.custom_buttons ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image';
