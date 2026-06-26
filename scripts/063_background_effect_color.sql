-- 063 - add background_effect_color override column.
--
-- Lets users in the Advanced Text Colors section pick a custom colour
-- for the wallpaper-effect layer (rain, snow, fireflies, sakura,
-- aurora, plasma, etc). Defaults to NULL meaning "inherit from
-- accent_color", which preserves current behaviour for every existing
-- profile - no visual change until a user explicitly sets a value.
--
-- Nullable TEXT, hex validated at the API layer (added to colorFields
-- in app/api/profile/route.ts). PROFILE_ALLOWED_COLUMNS gets the
-- column name too so /api/profile PUT accepts it.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS background_effect_color TEXT DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
