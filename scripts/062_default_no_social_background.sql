-- 062 - flip social_icons_no_background to default ON.
--
-- The cleaner icon-only look (no pill background) is now the standard
-- default. The pill background is opt-in: users who want it back can
-- toggle "Disable Backgrounds" off on /dashboard/links.
--
-- Changes:
--   1. DB column default: false -> true (only affects future inserts).
--   2. Backfill: every existing row where the column is NULL gets true.
--      Rows that have an explicit value (true or false) are LEFT ALONE
--      so users who deliberately set it stay where they are.
--   3. App-side fallback in app/dashboard/links/page.tsx + guns-profile
--      renderer already default to true so the migration order doesn't
--      cause a flash of wrong UI between deploy and migration apply.

ALTER TABLE public.profiles
  ALTER COLUMN social_icons_no_background SET DEFAULT true;

UPDATE public.profiles
  SET social_icons_no_background = true
  WHERE social_icons_no_background IS NULL;

NOTIFY pgrst, 'reload schema';
