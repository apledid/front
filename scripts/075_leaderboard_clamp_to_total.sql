-- 075: Clamp the windowed leaderboard to each profile's all-time total.
--
-- The public profile counter and the all-time tab show profiles.view_count
-- (the legacy running counter). The monthly/weekly tabs count unique visitors
-- from page_views, which is a different scale and a different history
-- (page_views only goes back ~7 weeks). For a handful of profiles the windowed
-- count exceeds view_count, so the board showed an impossible "monthly 1457"
-- next to a profile that reads 307 total.
--
-- Treat view_count (or an admin-pinned views_override) as the single source of
-- truth and cap each window at it with LEAST(...). Result: every profile has
-- all-time >= monthly >= weekly, and the windowed number always matches what
-- the profile itself shows as its ceiling. No displayed totals change.
--
-- Return type is unchanged from 074, so CREATE OR REPLACE is fine.

CREATE OR REPLACE FUNCTION public.leaderboard_window_counts(p_since timestamptz)
RETURNS TABLE(
  profile_id uuid,
  views bigint,
  username text,
  display_name text,
  avatar_url text,
  avatar_decoration_hash text,
  premium_active boolean
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id AS profile_id,
    -- unique visitors in the window, but never more than the profile's total
    LEAST(count(*), COALESCE(p.views_override, p.view_count, 0))::bigint AS views,
    p.username::text,
    p.display_name::text,
    p.avatar_url::text,
    p.avatar_decoration_hash::text,
    COALESCE(p.premium_active, false) AS premium_active
  FROM public.page_views pv
  JOIN public.profiles p ON p.id = pv.profile_id
  WHERE pv.last_viewed_at >= p_since
    AND p.flagged_for_review = false
    AND p.views_locked = false
  GROUP BY p.id
  ORDER BY views DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.leaderboard_window_counts(timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';
