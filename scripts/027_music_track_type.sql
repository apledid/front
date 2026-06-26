-- Add track_type column to music_history table for Spotify/YouTube/SoundCloud support
-- Safe to run multiple times

ALTER TABLE public.music_history ADD COLUMN IF NOT EXISTS track_type TEXT DEFAULT 'direct';

-- Also add music_type to profiles for the legacy single-track field
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS music_type TEXT DEFAULT 'direct';

-- Update existing tracks to detect their type from URL
UPDATE public.music_history 
SET track_type = CASE
  WHEN track_url LIKE '%spotify.com%' THEN 'spotify'
  WHEN track_url LIKE '%youtube.com%' OR track_url LIKE '%youtu.be%' THEN 'youtube'
  WHEN track_url LIKE '%soundcloud.com%' THEN 'soundcloud'
  ELSE 'direct'
END
WHERE track_type IS NULL OR track_type = '';

UPDATE public.profiles
SET music_type = CASE
  WHEN music_url LIKE '%spotify.com%' THEN 'spotify'
  WHEN music_url LIKE '%youtube.com%' OR music_url LIKE '%youtu.be%' THEN 'youtube'
  WHEN music_url LIKE '%soundcloud.com%' THEN 'soundcloud'
  ELSE 'direct'
END
WHERE music_url IS NOT NULL AND (music_type IS NULL OR music_type = '');
