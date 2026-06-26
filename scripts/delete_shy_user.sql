-- Delete user account with username "shy"
-- This script will:
-- 1. Delete related data (social_links, music_history, license_keys, etc.)
-- 2. Delete the profile
-- 3. Delete the auth user

BEGIN;

-- Get the user ID first
WITH user_to_delete AS (
  SELECT id FROM profiles WHERE username = 'shy' LIMIT 1
)
DELETE FROM social_links WHERE user_id IN (SELECT id FROM user_to_delete);

WITH user_to_delete AS (
  SELECT id FROM profiles WHERE username = 'shy' LIMIT 1
)
DELETE FROM music_history WHERE user_id IN (SELECT id FROM user_to_delete);

WITH user_to_delete AS (
  SELECT id FROM profiles WHERE username = 'shy' LIMIT 1
)
DELETE FROM license_keys WHERE redeemed_by IN (SELECT id FROM user_to_delete) OR created_by IN (SELECT id FROM user_to_delete);

-- Delete the profile record
DELETE FROM profiles WHERE username = 'shy';

COMMIT;

-- Note: The auth user in auth.users will be automatically cleaned up by Supabase
-- if you have the cascade delete trigger set up, otherwise you may need to 
-- delete it manually through the Supabase dashboard or using admin API
