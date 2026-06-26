-- 061 - bump profile_presets from 3 slots to 5 + add last_loaded_at.
--
-- Profile Presets v2:
--   * 5 named slots instead of 3 (CHECK constraint bumped to 1..5)
--   * Each slot can be named (the `name` column already exists, just
--     gets surfaced in the new UI)
--   * last_loaded_at tracks the most recent time the slot was applied
--     to the live profile. The UI uses it to show a "currently active"
--     badge on whichever slot is most recently loaded.
--
-- Existing rows with slot 1/2/3 keep working; we just allow 4/5
-- going forward.

-- Drop and re-add the CHECK so the range widens. Existing rows are
-- all in [1..3] which is still inside the new range, so no data
-- migration needed.
ALTER TABLE public.profile_presets
  DROP CONSTRAINT IF EXISTS profile_presets_slot_check;

ALTER TABLE public.profile_presets
  ADD CONSTRAINT profile_presets_slot_check CHECK (slot BETWEEN 1 AND 5);

-- last_loaded_at: nullable timestamptz. NULL = never loaded since
-- saved. The UI compares last_loaded_at across the user's 5 slots
-- and badges the most-recent one as "currently active".
ALTER TABLE public.profile_presets
  ADD COLUMN IF NOT EXISTS last_loaded_at timestamptz;

NOTIFY pgrst, 'reload schema';
