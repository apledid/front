-- 070: "Liked" badge - auto-earned at 10 profile likes.
--
-- Granted / revoked instantly by /api/profile/like as a profile crosses the
-- 10-like threshold (see reconcileLikeBadge there). This seed inserts the
-- badge row and backfills anyone already at/above the threshold. Idempotent.

INSERT INTO public.badges (id, name, icon, color, glow_color, description, rarity, created_at)
VALUES (
  gen_random_uuid(),
  'Liked',
  'liked',
  '#ff4d6d',
  '#ff4d6d',
  'Get 10 likes on your profile.',
  'common',
  NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Backfill: grant to every profile already holding 10+ likes.
INSERT INTO public.profile_badges (user_id, badge_id)
SELECT p.id, b.id
FROM public.profiles p
CROSS JOIN (SELECT id FROM public.badges WHERE name = 'Liked') b
WHERE COALESCE(p.likes_count, 0) >= 10
ON CONFLICT (user_id, badge_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
