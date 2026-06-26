-- Admin / UID / cursor / badge customization sync
-- Safe to run multiple times.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_placement TEXT DEFAULT 'outside';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_uid TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cursor_color TEXT DEFAULT '#ffffff';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cursor_click_effect TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cursor_click_color TEXT DEFAULT '#ffffff';

ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS icon_url TEXT;
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS background_color TEXT;
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS glow_color TEXT;
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS glow_strength INTEGER DEFAULT 10;

ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS visitor_ip TEXT;
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS user_agent TEXT;

UPDATE public.profiles
SET profile_uid = 'UID ' || upper(substring(replace(id::text, '-', '') from 1 for 8))
WHERE profile_uid IS NULL;
