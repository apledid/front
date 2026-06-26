-- 030_add_bento_tiles_column.sql
--
-- Adds the bento_tiles JSONB column to public.profiles. Required by the
-- Bento layout (lib/bento-defaults.ts + components/profile/layouts/
-- bento-layout.tsx).
--
-- Existing profiles get an empty array as default. The render component
-- falls back to DEFAULT_BENTO_TILES (the curated Balanced preset) when
-- a user picks layout_mode='bento' without saving any tile arrangement
-- yet, so old rows don't need backfilling beyond this default.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS makes the statement idempotent.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bento_tiles jsonb DEFAULT '[]'::jsonb;

-- No index needed yet - bento_tiles is only read alongside the rest of
-- the profile row, never queried independently. If we ever filter by
-- tile contents we can add a GIN index then.

COMMENT ON COLUMN public.profiles.bento_tiles IS
  'Bento layout tile arrangement. Array of { id, type, col, row, w, h, ...} validated by lib/bento-defaults.ts:validateBentoTiles before write.';
