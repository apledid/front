-- Recreate profile_badge_loadout and profile_title_loadout referencing auth.users
-- (The original versions in 021 referenced public.users which was dropped by 022)
-- Safe to run multiple times via IF NOT EXISTS.

-- Titles lookup table
CREATE TABLE IF NOT EXISTS public.titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL DEFAULT '#a855f7',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-user title assignments (which titles has an admin given this user)
CREATE TABLE IF NOT EXISTS public.profile_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, title_id)
);

-- Badge loadout: which of their assigned badges a user has chosen to display
CREATE TABLE IF NOT EXISTS public.profile_badge_loadout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  position TEXT NOT NULL DEFAULT 'below_username',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Title loadout: which of their assigned titles a user has chosen to display
CREATE TABLE IF NOT EXISTS public.profile_title_loadout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  position TEXT NOT NULL DEFAULT 'above_username',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, title_id)
);

-- Enable RLS
ALTER TABLE public.titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_badge_loadout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_title_loadout ENABLE ROW LEVEL SECURITY;

-- Drop stale policies if they exist, then recreate
DROP POLICY IF EXISTS "Titles public read" ON public.titles;
DROP POLICY IF EXISTS "Titles public write" ON public.titles;
DROP POLICY IF EXISTS "Profile titles public read" ON public.profile_titles;
DROP POLICY IF EXISTS "Profile titles public write" ON public.profile_titles;
DROP POLICY IF EXISTS "Profile badge loadout public read" ON public.profile_badge_loadout;
DROP POLICY IF EXISTS "Profile badge loadout public write" ON public.profile_badge_loadout;
DROP POLICY IF EXISTS "Profile title loadout public read" ON public.profile_title_loadout;
DROP POLICY IF EXISTS "Profile title loadout public write" ON public.profile_title_loadout;

CREATE POLICY "Titles public read"  ON public.titles FOR SELECT USING (true);
CREATE POLICY "Titles public write" ON public.titles FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Profile titles public read"  ON public.profile_titles FOR SELECT USING (true);
CREATE POLICY "Profile titles public write" ON public.profile_titles FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Profile badge loadout public read"  ON public.profile_badge_loadout FOR SELECT USING (true);
CREATE POLICY "Profile badge loadout public write" ON public.profile_badge_loadout FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Profile title loadout public read"  ON public.profile_title_loadout FOR SELECT USING (true);
CREATE POLICY "Profile title loadout public write" ON public.profile_title_loadout FOR ALL USING (true) WITH CHECK (true);
