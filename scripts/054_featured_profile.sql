-- 054 - featured_profile table + RPC for the auto Profile-of-the-Day.
--
-- One row per UTC date. The `date` primary key gives us natural
-- idempotency: two concurrent landing-page requests racing to populate
-- the cache will produce one winner via ON CONFLICT DO NOTHING.
--
-- The picker (top_viewed_profile_for_day) runs once per day per
-- server instance - first /api/landing/featured request after UTC
-- midnight populates the cache, the rest of the day reads it.

CREATE TABLE IF NOT EXISTS public.featured_profile (
  date       date PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Returns the profile with the most unique visitors (distinct
-- visitor_hash) for the given date. Filters out banned + non-public
-- profiles so we don't accidentally promote bad actors.
--
-- COALESCE in the WHERE clause is defensive: some profiles predate the
-- is_public / banned columns and have NULL there. Treat NULL as the
-- safe default (public = true, banned = false) so historical profiles
-- can still win.
CREATE OR REPLACE FUNCTION public.top_viewed_profile_for_day(p_date date)
RETURNS TABLE(profile_id uuid)
LANGUAGE sql
STABLE
AS $$
  SELECT pv.profile_id
  FROM public.page_views pv
  JOIN public.profiles p ON p.id = pv.profile_id
  WHERE pv.last_viewed_at::date = p_date
    AND COALESCE(p.is_public, true) = true
    AND COALESCE(p.banned, false) = false
  GROUP BY pv.profile_id
  ORDER BY count(DISTINCT pv.visitor_hash) DESC
  LIMIT 1;
$$;

NOTIFY pgrst, 'reload schema';
