ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enter_enabled BOOLEAN DEFAULT true;
UPDATE public.profiles SET enter_enabled = true WHERE enter_enabled IS NULL;
