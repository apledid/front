-- 074: Make leaderboard_window_counts return the profile fields it needs.
--
-- 073's version returned only (profile_id, views), so the app had to follow up
-- with a profiles .in(id, [...]) lookup. With both windows unioned that list
-- hit ~160 uuids, overflowed the request URI, and the windowed tabs came back
-- blank ("[leaderboard] profiles lookup failed: <html>"). Joining profiles
-- here removes that second round-trip entirely, filters flagged/locked rows in
-- SQL, and limits to the 50 we actually render.
--
-- Return type changes, so we DROP first (CREATE OR REPLACE can't repoint it).

DROP FUNCTION IF EXISTS public.leaderboard_window_counts(timestamptz);

CREATE FUNCTION public.leaderboard_window_counts(p_since timestamptz)
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
  -- page_views is deduplicated per (profile_id, visitor_hash), so count(*) per
  -- profile is the unique-visitor count for the window. GROUP BY p.id (the
  -- primary key) lets us select the other profile columns by functional
  -- dependency.
  SELECT
    p.id AS profile_id,
    count(*)::bigint AS views,
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
