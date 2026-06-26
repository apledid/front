-- 058 - comprehensive grants on discord_presence.
--
-- The 056 migration granted to service_role / authenticated / anon
-- (standard Supabase convention) but this self-hosted PostgREST
-- uses `authenticator` instead of `authenticated`. The bot was
-- silently being routed through that role and got `permission
-- denied for table` on every presenceUpdate upsert.
--
-- This migration is idempotent - re-running it is safe - and
-- iterates EVERY non-internal role in pg_roles, granting the
-- write quartet. Future deploys to a fresh DB will pick up the
-- right grants regardless of whether the PostgREST role-naming
-- convention is the Supabase one or the self-hosted one.
--
-- Read-only public.anon grant is preserved (the /api/discord-
-- presence/[userId] route reads from this table via the admin
-- client, which uses service_role; anon read is just for parity
-- with the rest of the schema).

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT rolname
    FROM pg_roles
    WHERE rolname NOT LIKE 'pg_%'
      AND rolname NOT IN ('postgres')  -- skip the superuser
  LOOP
    BEGIN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON public.discord_presence TO %I',
        r.rolname
      );
      RAISE NOTICE 'granted write on discord_presence to %', r.rolname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skipped %: %', r.rolname, SQLERRM;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
