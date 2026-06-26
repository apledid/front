-- 081: per-track synced lyrics + external URL for the haunt-style audio panel.
--
--   lyrics       LRC-format synced lyrics ("[mm:ss.xx] line"), shown as a
--                Spotify-style synced lyrics view on the profile when present.
--   external_url optional link to the track's source (e.g. its Spotify page).
--
-- Both are nullable and per-track (one row per music_history entry), so this is
-- a safe additive migration. cover_url / display_as_record / spin_record
-- already exist on this table.
ALTER TABLE music_history ADD COLUMN IF NOT EXISTS lyrics       TEXT;
ALTER TABLE music_history ADD COLUMN IF NOT EXISTS external_url TEXT;
