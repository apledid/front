-- 065 - revoke blanket SELECT from the `anon` PostgREST role.
--
-- setup/install-postgrest.sh historically ran:
--   GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
--
-- That gave the public anon JWT (which is shipped in our client bundle
-- under NEXT_PUBLIC_SUPABASE_ANON_KEY) read access to every table -
-- including `sessions` (token hashes), `profiles.password_hash`,
-- `verification_code`, `pending_resets`, `pending_signups`,
-- `stripe_customer_id`, IP addresses, and the trusted-device tokens.
--
-- Today this is mitigated only by PostgREST binding to 127.0.0.1:3001.
-- A future change that fronts PostgREST behind nginx, or an SSRF that
-- reaches loopback from the Next.js process, would dump the whole user
-- database via the anon JWT.
--
-- Audit of the codebase: lib/supabase/client.ts is the only place the
-- anon key gets used in the browser, and it's only ever called for
-- supabase.auth.signOut() and supabase.auth.verifyOtp() - never
-- .from(...). So we can revoke every table grant from anon without
-- breaking anything; defence in depth.
--
-- If a future feature legitimately needs a table to be browser-readable
-- it should add a column-scoped GRANT for the specific columns it
-- needs (e.g. GRANT SELECT (username, avatar_url) ON public.profiles
-- TO anon) plus its own RLS policy. NEVER restore the blanket grant.

REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;

-- The `authenticated` role is used by per-user JWTs and IS used by some
-- read paths through PostgREST; leave it alone. The `service_role` is
-- the bypass-everything role we use from the Next.js admin client and
-- has its own GRANT chain; also leave it.

NOTIFY pgrst, 'reload schema';
