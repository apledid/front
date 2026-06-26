-- Halo premium, inbox, titles, staff moderation, and loadout support

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_active BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_by_username TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS support_blacklisted BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL DEFAULT '#a855f7',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profile_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, title_id)
);

CREATE TABLE IF NOT EXISTS public.profile_badge_loadout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  position TEXT NOT NULL DEFAULT 'below_username',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS public.profile_title_loadout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  position TEXT NOT NULL DEFAULT 'above_username',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, title_id)
);

CREATE TABLE IF NOT EXISTS public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT UNIQUE NOT NULL,
  plan_name TEXT NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'subscription',
  status TEXT NOT NULL DEFAULT 'pending',
  purchased_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  redeemed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'message',
  license_key TEXT DEFAULT NULL,
  from_staff BOOLEAN DEFAULT false,
  staff_username TEXT DEFAULT NULL,
  read_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_badge_loadout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_title_loadout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Titles public read" ON public.titles;
DROP POLICY IF EXISTS "Profile titles public read" ON public.profile_titles;
DROP POLICY IF EXISTS "Profile badge loadout public read" ON public.profile_badge_loadout;
DROP POLICY IF EXISTS "Profile title loadout public read" ON public.profile_title_loadout;
DROP POLICY IF EXISTS "Licenses public read" ON public.licenses;
DROP POLICY IF EXISTS "Inbox messages public read" ON public.inbox_messages;

CREATE POLICY "Titles public read" ON public.titles FOR SELECT USING (true);
CREATE POLICY "Profile titles public read" ON public.profile_titles FOR SELECT USING (true);
CREATE POLICY "Profile badge loadout public read" ON public.profile_badge_loadout FOR SELECT USING (true);
CREATE POLICY "Profile title loadout public read" ON public.profile_title_loadout FOR SELECT USING (true);
CREATE POLICY "Licenses public read" ON public.licenses FOR SELECT USING (true);
CREATE POLICY "Inbox messages public read" ON public.inbox_messages FOR SELECT USING (true);
CREATE POLICY "Titles public write" ON public.titles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Profile titles public write" ON public.profile_titles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Profile badge loadout public write" ON public.profile_badge_loadout FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Profile title loadout public write" ON public.profile_title_loadout FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Licenses public write" ON public.licenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Inbox messages public write" ON public.inbox_messages FOR ALL USING (true) WITH CHECK (true);
