-- Add background_url column to profiles table for video/gif/image backgrounds
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS background_url TEXT;
