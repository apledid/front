-- Add can_access_premium_keys column to profiles table
-- This column controls whether a user can access the Premium Keys tab in the staff panel

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS can_access_premium_keys boolean DEFAULT false;

-- Ensure @rez always has access (if exists)
UPDATE profiles 
SET can_access_premium_keys = true 
WHERE username = 'rez';

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_can_access_premium_keys 
ON profiles(can_access_premium_keys) 
WHERE can_access_premium_keys = true;
