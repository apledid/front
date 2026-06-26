-- 069: rank-badge glow + medal icons, Angel badge restriction, grant rez all
-- badges. Safe to run multiple times.

-- 1. Rank badges: give them a glow color (so profile.glow_badges lights them
--    up) and a recognized icon name so BadgeIcon renders a numbered medal
--    instead of the generic star fallback.
UPDATE public.badges
SET glow_color    = color,
    glow_strength = 12,
    icon = CASE name
             WHEN '#1 Ranked' THEN 'rank-1'
             WHEN '#2 Ranked' THEN 'rank-2'
             WHEN '#3 Ranked' THEN 'rank-3'
           END
WHERE name IN ('#1 Ranked', '#2 Ranked', '#3 Ranked');

-- 2. Angel badge: restricted, so it's hidden from the catalog for anyone who
--    doesn't already own it (only @rez + @shy will). They still see + equip.
UPDATE public.badges SET restricted = true WHERE name = 'Angel';

-- 3. Grant + equip EVERY badge to @rez.
INSERT INTO public.profile_badges (user_id, badge_id)
SELECT p.id, b.id
FROM public.profiles p CROSS JOIN public.badges b
WHERE p.username = 'rez'
  AND NOT EXISTS (
    SELECT 1 FROM public.profile_badges pb WHERE pb.user_id = p.id AND pb.badge_id = b.id
  );

INSERT INTO public.profile_badge_loadout (user_id, badge_id, position, display_order)
SELECT p.id, b.id, 'below_username', row_number() OVER (ORDER BY b.name)
FROM public.profiles p CROSS JOIN public.badges b
WHERE p.username = 'rez'
ON CONFLICT (user_id, badge_id) DO NOTHING;

-- 4. Grant + equip the Angel badge to @shy (no-op if that user doesn't exist).
INSERT INTO public.profile_badges (user_id, badge_id)
SELECT p.id, b.id
FROM public.profiles p CROSS JOIN public.badges b
WHERE p.username = 'shy' AND b.name = 'Angel'
  AND NOT EXISTS (
    SELECT 1 FROM public.profile_badges pb WHERE pb.user_id = p.id AND pb.badge_id = b.id
  );

INSERT INTO public.profile_badge_loadout (user_id, badge_id, position, display_order)
SELECT p.id, b.id, 'below_username', 0
FROM public.profiles p CROSS JOIN public.badges b
WHERE p.username = 'shy' AND b.name = 'Angel'
ON CONFLICT (user_id, badge_id) DO NOTHING;
