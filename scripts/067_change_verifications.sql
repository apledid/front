-- 067 - change_verifications for in-app email + password changes.
--
-- Built for /dashboard/settings: users who want to change their
-- registered email OR password without the magic-login recovery
-- flow have to prove control of their current email (and, for
-- email changes, also the new email) by entering 6-digit codes
-- that we send to those inboxes.
--
-- Flows:
--
--   Email change (two codes):
--     1. POST /api/auth/change-email/start { newEmail }
--        - Stores a code under (user_id, 'email_old') with the
--          new_email as payload. Code goes to current email.
--     2. POST /api/auth/change-email/verify-old { code }
--        - Validates the 'email_old' code. Promotes the row to
--          'email_new'. Sends a fresh code to newEmail.
--     3. POST /api/auth/change-email/verify-new { code }
--        - Validates the 'email_new' code, atomically updates
--          profiles.email, deletes the row.
--
--   Password change (one code):
--     1. POST /api/auth/change-password/start
--        - Stores a code under (user_id, 'password') with the
--          new password's bcrypt hash as payload (already hashed
--          client-side via a separate field? No: hashed server-side
--          on submit). Actually we accept the new password at
--          /verify time, not /start, so payload is empty here.
--     2. POST /api/auth/change-password/verify { code, newPassword }
--        - Validates the 'password' code, bcrypts newPassword,
--          atomically updates profiles.password_hash, deletes the row.
--
-- Composite PK (user_id, purpose) means a user has at most one
-- pending verification per purpose; starting a fresh flow upserts
-- the row, overwriting any stale code. This is the simplest way
-- to avoid stale rows piling up when users abandon the flow.
--
-- Security:
--   - code_hash stores sha256(code), never the plaintext, so a
--     DB dump can't be replayed into account takeovers.
--   - attempts counter: each failed verify increments it; >= 5
--     locks the row (user has to /start again). Stops brute
--     force on the 6-digit space.
--   - expires_at: 10 minutes from issuance. Short enough that an
--     intercepted email won't be useful, long enough to actually
--     paste the code in.
--   - ON DELETE CASCADE on the user_id FK so deleting a profile
--     nukes any in-flight verifications.

CREATE TABLE IF NOT EXISTS public.change_verifications (
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purpose     TEXT        NOT NULL,
  code_hash   TEXT        NOT NULL,
  sent_to     TEXT        NOT NULL,
  payload     JSONB,
  attempts    INTEGER     NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, purpose),
  CONSTRAINT change_verifications_purpose_check
    CHECK (purpose IN ('email_old', 'email_new', 'password'))
);

-- Cleanup index: lets a future cron sweep expired rows efficiently.
CREATE INDEX IF NOT EXISTS change_verifications_expires_idx
  ON public.change_verifications (expires_at);

-- Explicit grant. ALTER DEFAULT PRIVILEGES only fires for tables
-- created by the role that originally set the default - migrations
-- applied by `halo` via psql don't inherit those grants, so the
-- service_role would otherwise hit "permission denied" on first
-- access. Mirror the pattern from 066.
GRANT ALL ON public.change_verifications TO service_role;

NOTIFY pgrst, 'reload schema';
