-- 056 - hotfix grants for discord_presence.
--
-- The 055 migration created the table but didn't grant base-table
-- privileges to the Postgres roles PostgREST uses. The bot connects
-- through PostgREST with the service_role JWT and was hitting
-- `permission denied for table discord_presence` on every upsert.
--
-- Standard project pattern (mirrors 050_discord_bot_infrastructure.sql)
-- is RLS-on with no policies, and service_role bypasses RLS. But
-- service_role STILL needs base-table grants - those don't come from
-- RLS, they're a separate Postgres permission layer.
--
-- We wrap each GRANT in a DO block so the migration is safe to run on
-- a database where a particular role (e.g. anon) hasn't been provisioned.

DO $$
BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.discord_presence TO service_role';
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'role service_role does not exist, skipping';
END $$;

DO $$
BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.discord_presence TO authenticated';
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'role authenticated does not exist, skipping';
END $$;

DO $$
BEGIN
  -- anon gets read-only - the public widget fetcher reads presence
  -- but should never be able to write it.
  EXECUTE 'GRANT SELECT ON public.discord_presence TO anon';
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'role anon does not exist, skipping';
END $$;

-- Enable RLS for parity with the rest of the schema. Without
-- policies + an `ENABLE ROW LEVEL SECURITY`, only service_role and
-- the table owner can touch the table - exactly what we want
-- (bot = service_role, web read = anon via the API route which goes
-- through createAdminClient = service_role).
ALTER TABLE public.discord_presence ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
