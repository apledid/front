-- Set enter_enabled to true by default for all new profiles
-- This ensures music plays after users click to enter

-- Update the default value for enter_enabled column
ALTER TABLE profiles ALTER COLUMN enter_enabled SET DEFAULT true;

-- Set enter_enabled to true for all existing profiles that have it as false or null
-- This ensures existing users also get the enter screen by default
UPDATE profiles 
SET enter_enabled = true 
WHERE enter_enabled IS NULL OR enter_enabled = false;
