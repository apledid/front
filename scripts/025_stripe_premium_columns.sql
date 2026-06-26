-- Add premium/Stripe columns to profiles table if they don't exist
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS premium_type TEXT DEFAULT NULL;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS premium_activated_at TIMESTAMPTZ DEFAULT NULL;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT DEFAULT NULL;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT DEFAULT NULL;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Create index for faster premium lookups
CREATE INDEX IF NOT EXISTS idx_profiles_premium_active ON profiles(premium_active) WHERE premium_active = true;
