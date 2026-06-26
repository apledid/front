-- Extra profile polish fields for v5
-- Safe to run multiple times.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_cursor_hover_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS music_show_title BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS music_show_artist BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enter_title TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enter_subtitle TEXT;

UPDATE public.profiles
SET enter_title = COALESCE(NULLIF(enter_title, ''), display_name, username),
    enter_subtitle = COALESCE(NULLIF(enter_subtitle, ''), 'Click anywhere to enter'),
    music_show_title = COALESCE(music_show_title, true),
    music_show_artist = COALESCE(music_show_artist, true);

-- Optional stronger UID automation if your project does not already handle this elsewhere.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'profile_uid_seq') THEN
    CREATE SEQUENCE profile_uid_seq START 1;
  END IF;
END $$;

SELECT setval('profile_uid_seq', GREATEST((SELECT COUNT(*) FROM public.profiles), 1), true);

CREATE OR REPLACE FUNCTION public.assign_profile_uid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.profile_uid IS NULL OR NEW.profile_uid = '' THEN
    NEW.profile_uid := 'UID ' || nextval('profile_uid_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_profile_uid ON public.profiles;
CREATE TRIGGER trg_assign_profile_uid
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_profile_uid();
