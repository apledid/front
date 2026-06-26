-- 064 - add discord_avatar_url column for the Use Discord Avatar feature.
--
-- The existing `discord_avatar` column is a boolean (legacy schema
-- defined in 011_add_new_features.sql) so it can't hold the actual
-- Discord CDN URL. Add a new nullable TEXT column populated by the
-- Discord OAuth callback (link + signup flows) and consumed by the
-- profile renderer when `use_discord_avatar = true`.
--
-- Nullable so existing users without a linked Discord stay untouched.
-- When NULL, the "Use Discord Avatar" toggle in the Avatar Manager
-- shows a Connect-Discord call to action instead.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discord_avatar_url TEXT DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
