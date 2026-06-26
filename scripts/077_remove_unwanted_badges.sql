-- 077: Remove the community badges that didn't fit the site's look.
--
-- Keep: Rich, Inviter. Remove: Suggestor Plus, Promotion Team, Lucky Legend,
-- Developer, Contributor. All five were verified unowned and unequipped (0/0),
-- so this is a clean catalog removal - nobody loses a badge.
--
-- Idempotent and safe to re-run. Runs after the seed scripts (035, the
-- 20260418 community-badges migration, 001), so a full rebuild ends with these
-- five absent.

DELETE FROM public.profile_badge_loadout
 WHERE badge_id IN (
   SELECT id FROM public.badges
    WHERE name IN ('Suggestor Plus','Promotion Team','Lucky Legend','Developer','Contributor')
 );

DELETE FROM public.profile_badges
 WHERE badge_id IN (
   SELECT id FROM public.badges
    WHERE name IN ('Suggestor Plus','Promotion Team','Lucky Legend','Developer','Contributor')
 );

DELETE FROM public.badges
 WHERE name IN ('Suggestor Plus','Promotion Team','Lucky Legend','Developer','Contributor');
