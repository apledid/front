-- Add missing columns for media backgrounds, custom cursor, and music
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS background_url TEXT,
ADD COLUMN IF NOT EXISTS custom_cursor_url TEXT,
ADD COLUMN IF NOT EXISTS tilt_effect BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS location TEXT;
