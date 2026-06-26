-- 066 - magic_login_tokens for owner-issued account recovery.
--
-- Built for the scenario where a user has lost both their email
-- access AND a working Discord OAuth path (most common: phone-only
-- user whose Discord OAuth fails in their browser). The owner runs
-- `/user magic-login <username>` in Discord, gets back a one-time
-- recovery URL, hands it to the user. They click it, get logged
-- in, and can then fix their email/password from settings.
--
-- Security model:
--   - The raw token is 32 bytes of crypto.randomBytes (256 bits of
--     entropy). Only the sha256 hash is stored in this table.
--   - 15-minute expiry. Short enough that an intercepted link is
--     unlikely to be useful by the time it leaks; long enough to
--     paste into Discord and have the user click without rushing.
--   - Single-use. `used_at` gets set on consumption; subsequent
--     attempts with the same token are rejected even within the
--     expiry window.
--   - `issued_by` records the Discord user id of the admin who
--     created the token, for audit. The Discord bot also writes a
--     row to discord_audit_log on issuance.
--   - Banned users are rejected at consumption time (re-check
--     server-side in case the user was banned between issuance
--     and consumption).
--
-- ON DELETE CASCADE on the user_id FK means deleting a profile
-- nukes any pending magic-login tokens for that user automatically.

CREATE TABLE IF NOT EXISTS public.magic_login_tokens (
  token_hash  TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  issued_by   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS magic_login_tokens_user_idx
  ON public.magic_login_tokens (user_id);

-- Cleanup index: lets a future cron sweep expired+used rows
-- efficiently. We don't need them lying around forever.
CREATE INDEX IF NOT EXISTS magic_login_tokens_expires_idx
  ON public.magic_login_tokens (expires_at);

-- Grant access to the PostgREST service_role. The setup script in
-- setup/install-postgrest.sh sets up ALTER DEFAULT PRIVILEGES so
-- that the role that ran the script gets these grants on every new
-- table - but migrations applied later by a different DB role
-- (e.g. `halo` via psql) don't trigger that default. So every new
-- table migration explicitly grants the privileges the API layer
-- and bot need. service_role gets ALL because that's the
-- bypass-RLS role the admin client uses for both reads and writes
-- to this table.
GRANT ALL ON public.magic_login_tokens TO service_role;

NOTIFY pgrst, 'reload schema';
