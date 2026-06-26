-- 059 - migration_dm_log table.
--
-- Tracks every DM attempt for /migrate-presence so the command can
-- be re-run as many times as needed and only retry users who
-- weren't delivered to last time. The first blast hit 41/102
-- delivered before Discord rate-limited the bot; the remaining 61
-- need re-attempt with slower throttle.
--
-- Schema:
--   user_id      - Discord snowflake (text, matches discord_presence)
--   status       - 'delivered' | 'failed'
--   attempts     - how many times we've tried this user
--   error        - last error message for failed attempts (null on delivered)
--   attempted_at - last attempt timestamp
--
-- The /migrate-presence command:
--   * SELECT user_id FROM migration_dm_log WHERE status='delivered' to
--     build a skip-set
--   * For each Discord-widget user NOT in the skip-set, try to DM
--   * UPSERT after each attempt with the new status / incremented attempts
--   * A force:true command flag bypasses the skip-set if the operator
--     wants to re-blast everyone (e.g. updated copy)
--
-- This stays write-from-bot, read-from-bot only. No public API surface
-- so RLS isn't needed; matches the existing discord_presence pattern.

CREATE TABLE IF NOT EXISTS public.migration_dm_log (
  user_id      text PRIMARY KEY,
  status       text NOT NULL CHECK (status IN ('delivered', 'failed')),
  attempts     integer NOT NULL DEFAULT 1,
  error        text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS migration_dm_log_status_idx
  ON public.migration_dm_log (status);

-- Grant to every non-superuser role so PostgREST (whichever role
-- the bot's JWT decodes to) can write. Matches the pattern from
-- the discord_presence grant migration (058).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT rolname FROM pg_roles
    WHERE rolname NOT LIKE 'pg_%' AND rolname NOT IN ('postgres')
  LOOP
    BEGIN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON public.migration_dm_log TO %I',
        r.rolname
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skipped grant on %', r.rolname;
    END;
  END LOOP;
END $$;

-- Disable RLS (same reasoning as discord_presence - self-hosted
-- PostgREST here doesn't grant BYPASSRLS to service_role).
ALTER TABLE public.migration_dm_log DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
