-- 073: must_reset_password flag.
--
-- The Discord admin command /user resetpassword and the website's login gate
-- both reference profiles.must_reset_password, but the column was never created
-- (so the admin command silently errored and the flag never persisted). Create
-- it. The login route blocks session creation while it's true; the
-- forgot-password reset flow clears it.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
