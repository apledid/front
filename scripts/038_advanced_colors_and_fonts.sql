-- 038: advanced color targeting + per-element font toggles
-- Adds granular text color overrides and lets users decide which
-- profile elements use the uploaded custom font.

-- ── Per-element text color overrides ──────────────────────────────────
-- NULL = inherit from text_color. Storing as TEXT to match existing
-- color column patterns (validated as hex on the API layer).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name_color    TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_handle_color TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio_color             TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_color        TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS card_text_color       TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS music_text_color      TEXT;

-- ── Custom font targeting ─────────────────────────────────────────────
-- Booleans default to TRUE so existing users with a custom font keep it
-- applied to every element, matching prior behavior.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_apply_displayname BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_apply_username    BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_apply_bio         BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_apply_music       BOOLEAN DEFAULT TRUE;
