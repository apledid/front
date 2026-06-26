-- 080: Composite index for the /api/track-view per-profile velocity cap.
--
-- Every profile view runs a count of page_views WHERE profile_id = $1 AND
-- first_viewed_at >= now()-1h (the anti-bomb hourly cap). With only an index
-- on profile_id, a profile that goes viral during a launch push accumulates
-- thousands of rows and that per-view count walks all of them. A composite
-- (profile_id, first_viewed_at) turns it into an index range scan so the hot
-- path stays flat no matter how popular a profile gets.
--
-- CONCURRENTLY so building it never blocks the inserts track-view is doing.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_page_views_profile_first_viewed
  ON public.page_views (profile_id, first_viewed_at);
