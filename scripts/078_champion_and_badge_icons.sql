-- 078: Remove Champion; give Rich and Inviter proper built-in icons.
--
-- Champion is being retired (clears its ownership + loadout rows too).
--
-- Rich and Inviter were pointing icon_url at Discord ephemeral-attachment URLs
-- (a Robux PNG and a Star Creator PNG). Those render as raster <img>, so they
-- ignored Badge Color + glow and clashed with the site's SVG badges, and
-- ephemeral Discord links expire (they would have 404'd soon). Point icon at
-- the new built-in BadgeIcon cases ('rich' / 'inviter') and clear icon_url so
-- they render as currentColor SVGs that pick up color + glow like the rest.

DELETE FROM public.profile_badge_loadout
 WHERE badge_id IN (SELECT id FROM public.badges WHERE name = 'Champion');
DELETE FROM public.profile_badges
 WHERE badge_id IN (SELECT id FROM public.badges WHERE name = 'Champion');
DELETE FROM public.badges WHERE name = 'Champion';

UPDATE public.badges SET icon = 'rich',    icon_url = NULL WHERE name = 'Rich';
UPDATE public.badges SET icon = 'inviter', icon_url = NULL WHERE name = 'Inviter';
