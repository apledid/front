-- 076: Lock down the view-counting surface.
--
-- Context: profiles.view_count was being incremented TWICE per unique visitor.
-- A trigger on page_views (page_view_insert_trigger -> increment_profile_view_count())
-- already bumps it on insert, and /api/track-view ALSO called the
-- increment_profile_view_count(uuid) RPC for the same row. The app side has
-- been removed (the trigger is the single, atomic source now); this migration
-- closes the rest of the surface so views can't be inflated out of band.
--
-- None of these are currently reachable by the public key (scripts/065 already
-- revoked anon table grants, so direct page_views writes fail with "permission
-- denied" and the RPCs 401), but the permissive policies + PUBLIC EXECUTE are
-- live landmines: one accidental GRANT to anon later would reopen a
-- one-request "increment any profile's views" hole. Remove them now.

-- 1. Drop the "anyone can do anything" RLS policies on page_views. RLS stays
--    enabled; service_role (the app + bot) bypasses RLS, so server-side reads,
--    writes, and the leaderboard keep working. Anon simply has no path in.
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;
DROP POLICY IF EXISTS "Anyone can update page views" ON public.page_views;
DROP POLICY IF EXISTS "Anyone can view page views"   ON public.page_views;
DROP POLICY IF EXISTS "page_views_insert_anon"       ON public.page_views;
DROP POLICY IF EXISTS "page_views_select_anon"       ON public.page_views;

-- 2. These functions mutate state and must only ever be called by the server
--    (service_role). Strip the PUBLIC/anon EXECUTE the catalog still showed
--    (=X/halo), keep service_role.
REVOKE EXECUTE ON FUNCTION public.increment_profile_view_count(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_template_uses(uuid)      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.leaderboard_window_counts(timestamptz) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.increment_profile_view_count(uuid) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.increment_template_uses(uuid) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.leaderboard_window_counts(timestamptz) FROM anon';
  END IF;
END$$;

GRANT EXECUTE ON FUNCTION public.increment_profile_view_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_template_uses(uuid)      TO service_role;
GRANT EXECUTE ON FUNCTION public.leaderboard_window_counts(timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';
