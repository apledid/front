-- Discord bot infrastructure tables.
--
-- Replaces the bot's current hardcoded ADMIN_IDS array, channel-only audit log,
-- and per-process in-memory rate limiting with durable Postgres-backed
-- equivalents. Lets us grant admin without a redeploy, query historical
-- admin actions, and rate-limit destructive commands across bot restarts.
--
-- RLS is enabled with no policies on every table so only service_role can
-- read/write. The bot connects with the service-role key.

BEGIN;

-- ── Durable audit log ────────────────────────────────────────────────────────
-- Every admin command writes one row via framework/audit.js. The Discord log
-- channel still receives a one-liner mirror so live ops watchers don't lose
-- the firehose, but this table is the queryable source of truth.
CREATE TABLE IF NOT EXISTS public.discord_audit_log (
  id                  BIGSERIAL PRIMARY KEY,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executor_discord_id TEXT        NOT NULL,
  executor_username   TEXT        NOT NULL,
  command             TEXT        NOT NULL,
  subcommand          TEXT,
  target_user_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_username     TEXT,
  details             JSONB       NOT NULL DEFAULT '{}'::JSONB,
  success             BOOLEAN     NOT NULL DEFAULT TRUE,
  error_message       TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_executor ON public.discord_audit_log (executor_discord_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target   ON public.discord_audit_log (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_command  ON public.discord_audit_log (command, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON public.discord_audit_log (created_at DESC);

ALTER TABLE public.discord_audit_log ENABLE ROW LEVEL SECURITY;

-- ── Bot admins ───────────────────────────────────────────────────────────────
-- Replaces the hardcoded ADMIN_IDS array in src/utils/guard.js. Granting
-- admin is a single INSERT now; revoking is a DELETE. The framework caches
-- this table for 60 seconds, so grants reflect within a minute.
CREATE TABLE IF NOT EXISTS public.bot_admins (
  discord_id TEXT        PRIMARY KEY,
  username   TEXT        NOT NULL,
  granted_by TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_owner   BOOLEAN     NOT NULL DEFAULT FALSE
);

ALTER TABLE public.bot_admins ENABLE ROW LEVEL SECURITY;

-- Seed with the existing OWNER_ID from src/utils/guard.js so the bot keeps
-- working at first start without an out-of-band admin grant.
INSERT INTO public.bot_admins (discord_id, username, granted_by, granted_at, is_owner)
VALUES ('823227411721093142', 'rez', 'system_seed', NOW(), TRUE)
ON CONFLICT (discord_id) DO NOTHING;

-- ── Scheduled task ledger ────────────────────────────────────────────────────
-- Each cron job (nightly_cleanup, weekly_leaderboard, daily_stats) writes a
-- row here after every run so `/staff schedule status` can show last-ran
-- timestamps and details without scraping logs.
CREATE TABLE IF NOT EXISTS public.bot_scheduled_tasks (
  task_key         TEXT        PRIMARY KEY,
  last_run_at      TIMESTAMPTZ,
  last_run_status  TEXT,
  last_run_details JSONB       DEFAULT '{}'::JSONB,
  last_error       TEXT
);

ALTER TABLE public.bot_scheduled_tasks ENABLE ROW LEVEL SECURITY;

-- Pre-seed the known tasks so /staff schedule status has rows to render
-- before the first cron tick.
INSERT INTO public.bot_scheduled_tasks (task_key) VALUES
  ('nightly_cleanup'),
  ('weekly_leaderboard'),
  ('daily_stats')
ON CONFLICT (task_key) DO NOTHING;

-- ── Rate limit buckets ───────────────────────────────────────────────────────
-- Sliding-window counter for destructive commands (delete / ban / forcelogout
-- / broadcast). Per-executor windowed by 60-second buckets. Old buckets get
-- pruned by the bot opportunistically; nothing depends on cleanup running.
CREATE TABLE IF NOT EXISTS public.bot_rate_limits (
  bucket TEXT   NOT NULL,
  ts     BIGINT NOT NULL,
  count  INT    NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, ts)
);

CREATE INDEX IF NOT EXISTS idx_bot_rate_limits_ts ON public.bot_rate_limits (ts);

ALTER TABLE public.bot_rate_limits ENABLE ROW LEVEL SECURITY;

COMMIT;
