-- 039: multi-font support (up to 4 named font slots + per-element assignment)
--
-- Adds 4 font slots (each with url + display name) and switches each text
-- element from a boolean apply/don't-apply toggle to a small integer that
-- selects which font slot drives that element. 0 = no custom font (system
-- default), 1-4 = use the matching font slot.
--
-- The legacy custom_font_url column stays in place so existing users keep
-- working - it acts as font slot 1's fallback at the renderer layer.

-- ── 4 named font slots ────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_1_url   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_1_name  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_2_url   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_2_name  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_3_url   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_3_name  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_4_url   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_4_name  TEXT;

-- ── Per-element font slot assignment (0 = system default, 1-4 = slot N) ─
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_slot_displayname SMALLINT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_slot_username    SMALLINT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_slot_bio         SMALLINT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_slot_music       SMALLINT DEFAULT 0;

-- Backfill: if a user already had `custom_font_url` set, copy it into slot 1
-- and turn on the four element slots that previously had font_apply_* = TRUE.
UPDATE public.profiles
   SET font_1_url  = custom_font_url,
       font_1_name = COALESCE(custom_font_name, 'Custom'),
       font_slot_displayname = CASE WHEN font_apply_displayname IS NOT FALSE THEN 1 ELSE 0 END,
       font_slot_username    = CASE WHEN font_apply_username    IS NOT FALSE THEN 1 ELSE 0 END,
       font_slot_bio         = CASE WHEN font_apply_bio         IS NOT FALSE THEN 1 ELSE 0 END,
       font_slot_music       = CASE WHEN font_apply_music       IS NOT FALSE THEN 1 ELSE 0 END
 WHERE custom_font_url IS NOT NULL
   AND font_1_url IS NULL;
