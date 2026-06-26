-- 073: Server-side aggregation for the windowed leaderboards.
--
-- The old path pulled every page_views row in the window into Node and counted
-- in JS behind a .limit(100000) guard. Two problems with that:
--   1. Once a window holds more than 100k rows it silently undercounts.
--   2. It shipped ~20k+ rows over the wire on every leaderboard render.
-- This does the GROUP BY in Postgres and returns only the top 80 profiles.
--
-- It also underpins the "weekly > monthly" fix: callers now compute the week
-- and month windows from a single snapshot, and a cheap aggregate makes doing
-- both on one request painless.

-- Supports the range scan in leaderboard_window_counts (filter on
-- last_viewed_at). Was previously a full table scan per render.
CREATE INDEX IF NOT EXISTS idx_page_views_last_viewed_at
  ON public.page_views (last_viewed_at);

CREATE OR REPLACE FUNCTION public.leaderboard_window_counts(p_since timestamptz)
RETURNS TABLE(profile_id uuid, views bigint)
LANGUAGE sql
STABLE
AS $$
  -- page_views is already deduplicated per (profile_id, visitor_hash), so a
  -- row count per profile is the unique-visitor count for the window. Grab a
  -- few extra (80) so the caller can drop flagged/locked profiles and still
  -- fill the top 50.
  SELECT profile_id, count(*)::bigint AS views
  FROM public.page_views
  WHERE last_viewed_at >= p_since
  GROUP BY profile_id
  ORDER BY views DESC
  LIMIT 80;
$$;

GRANT EXECUTE ON FUNCTION public.leaderboard_window_counts(timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';
