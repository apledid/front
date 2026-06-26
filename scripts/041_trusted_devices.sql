-- 038: trusted_devices table for "Remember this device for 14 days" login flow.
-- The verify endpoint stores sha256(token) here when the user checks the
-- remember-me box; the login endpoint looks it up to skip the email code.
-- Without this table the insert silently fails and the trust cookie is never
-- written, so every login still prompts for a code.

CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  TEXT,
  user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS trusted_devices_user_token_idx
  ON public.trusted_devices (user_id, token_hash);

CREATE INDEX IF NOT EXISTS trusted_devices_expires_at_idx
  ON public.trusted_devices (expires_at);
