-- 072: Hard per-IP account cap at the DB layer + supporting index.
--
-- The app-level check (lib/account-limits.ts) is a fast UX gate, but on its own
-- it's a non-atomic count-then-insert and it fails open on a DB error. This
-- trigger makes the 5-accounts-per-signup_ip cap authoritative:
--   * a transaction-scoped advisory lock keyed on the IP serializes concurrent
--     inserts for the SAME ip, so two parallel signups can't both read count=4
--     and slip past the limit (closes the TOCTOU race);
--   * the count + rejection run inside the insert's own transaction.
-- NULL / empty signup_ip (IP couldn't be determined) is never capped, matching
-- the app helper. Fires for every profiles insert, so all signup paths - and
-- any future one - are covered with no app changes.

-- The signup_ip column was referenced by the signup code but never actually
-- created by any migration, so the original per-IP cap silently no-op'd (its
-- count query errored and the check fell through). Create it now so the cap
-- has real data to count, then index it.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_ip TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_signup_ip ON public.profiles (signup_ip);

CREATE OR REPLACE FUNCTION public.enforce_signup_ip_cap()
RETURNS TRIGGER AS $$
DECLARE
  ip_count INTEGER;
BEGIN
  IF NEW.signup_ip IS NULL OR NEW.signup_ip = '' THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent inserts for this IP; released at commit/rollback.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.signup_ip, 0));

  SELECT count(*) INTO ip_count
  FROM public.profiles
  WHERE signup_ip = NEW.signup_ip;

  -- Keep in sync with MAX_ACCOUNTS_PER_IP in lib/account-limits.ts
  IF ip_count >= 5 THEN
    RAISE EXCEPTION 'account_limit_per_ip' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_signup_ip_cap ON public.profiles;
CREATE TRIGGER trg_enforce_signup_ip_cap
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_signup_ip_cap();

NOTIFY pgrst, 'reload schema';
