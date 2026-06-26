-- Ensure badge builder/remove work even if service-role env is missing.
-- This project uses custom auth tables, so these permissive policies match the rest of the app's public-write model.

ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS icon_url TEXT;
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS background_color TEXT;
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS glow_color TEXT;
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS glow_strength INTEGER DEFAULT 10;

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Badges public read" ON public.badges;
DROP POLICY IF EXISTS "Badges public insert" ON public.badges;
DROP POLICY IF EXISTS "Badges public update" ON public.badges;
DROP POLICY IF EXISTS "Badges public delete" ON public.badges;
DROP POLICY IF EXISTS "Profile badges public read" ON public.profile_badges;
DROP POLICY IF EXISTS "Profile badges public insert" ON public.profile_badges;
DROP POLICY IF EXISTS "Profile badges public update" ON public.profile_badges;
DROP POLICY IF EXISTS "Profile badges public delete" ON public.profile_badges;
DROP POLICY IF EXISTS "Badges are viewable by everyone" ON public.badges;
DROP POLICY IF EXISTS "Profile badges are viewable" ON public.profile_badges;
DROP POLICY IF EXISTS "Anyone can insert profile badges" ON public.profile_badges;

CREATE POLICY "Badges public read" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Badges public insert" ON public.badges FOR INSERT WITH CHECK (true);
CREATE POLICY "Badges public update" ON public.badges FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Badges public delete" ON public.badges FOR DELETE USING (true);

CREATE POLICY "Profile badges public read" ON public.profile_badges FOR SELECT USING (true);
CREATE POLICY "Profile badges public insert" ON public.profile_badges FOR INSERT WITH CHECK (true);
CREATE POLICY "Profile badges public update" ON public.profile_badges FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Profile badges public delete" ON public.profile_badges FOR DELETE USING (true);
