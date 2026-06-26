-- 060 - hotfix grants for profile_presets + featured_profile.
--
-- Same root cause as 058 (discord_presence): the original migrations
-- created the tables but never explicitly granted base-table privileges
-- to the Postgres roles PostgREST uses. Worked while the @rez tester
-- gate intercepted the API (gate returned 404 before the DB call), but
-- after lifting the gate every save/load/reset/list returns 500 with
-- "permission denied for table profile_presets".
--
-- Iterates pg_roles dynamically so this works regardless of whether
-- the target DB uses Supabase naming (service_role/authenticated) or
-- self-hosted PostgREST naming (authenticator). Each grant is wrapped
-- in a DO block so a missing role doesn't abort the migration.
--
-- Also disables RLS for parity with the existing schema - self-hosted
-- PostgREST here doesn't grant BYPASSRLS to service_role, so enabling
-- RLS without permissive policies blocks every write. Same call we
-- made for discord_presence (migration 057).

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT rolname FROM pg_roles
    WHERE rolname NOT LIKE 'pg_%' AND rolname NOT IN ('postgres')
  LOOP
    BEGIN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_presets TO %I',
        r.rolname
      );
      RAISE NOTICE 'granted on profile_presets to %', r.rolname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skipped profile_presets grant on %: %', r.rolname, SQLERRM;
    END;

    BEGIN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON public.featured_profile TO %I',
        r.rolname
      );
      RAISE NOTICE 'granted on featured_profile to %', r.rolname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skipped featured_profile grant on %: %', r.rolname, SQLERRM;
    END;
  END LOOP;
END $$;

ALTER TABLE public.profile_presets  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_profile DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
