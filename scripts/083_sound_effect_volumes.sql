-- Per-sound volume for the premium custom Entrance + Click sounds.
-- Stored 0-100 (percent); applied as audio.volume = value/100 on the public
-- profile. Defaults to 100 so existing sounds keep playing at full volume.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS click_sound_volume smallint DEFAULT 100;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enter_sound_volume smallint DEFAULT 100;
NOTIFY pgrst, 'reload schema';
