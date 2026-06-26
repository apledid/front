-- 053 - profile_presets table for the 3-slot full-clone preset feature.
--
-- Each user gets up to 3 slots (CHECK enforces it). The `config` JSONB
-- stores a complete snapshot of the user's customizable profile state +
-- all related rows (social_links, custom_buttons, badge_loadout,
-- title_loadout, music_history). The renderer never reads this table -
-- /api/profile/presets/load is the only path that consumes it, and it
-- works by overwriting the live profile + child rows.
--
-- Identity columns (username / email / password_hash / view_count /
-- premium_active / admin flags) are excluded from snapshots at the API
-- layer (PROFILE_ALLOWED_COLUMNS allowlist), so they can't be reset by
-- a load.

CREATE TABLE IF NOT EXISTS public.profile_presets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot       smallint NOT NULL CHECK (slot BETWEEN 1 AND 3),
  name       text,
  config     jsonb NOT NULL,
  saved_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slot)
);

-- Index for the GET /api/profile/presets list lookup.
CREATE INDEX IF NOT EXISTS profile_presets_user_idx
  ON public.profile_presets (user_id);

-- Tell PostgREST to re-read the schema so the new table is accepted
-- by /api/profile/presets immediately, with no restart.
NOTIFY pgrst, 'reload schema';
