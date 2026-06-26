-- Custom click + entrance sound effects.
-- Rez-only for now: the dashboard control + the /api/upload column write + the
-- profile playback are all gated to profile.username = 'rez' in app code.
-- These are plain URL columns (like music_url); no extra RLS needed.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS click_sound_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enter_sound_url text;

NOTIFY pgrst, 'reload schema';
