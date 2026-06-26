-- 052 - adds glow_description (bio text-shadow halo).
--
-- Mirrors the existing glow_username / glow_socials / glow_badges
-- pattern. When true, the bio paragraph in the profile renderer
-- inherits a soft text-shadow built from glow_color + glow_intensity.
-- Default false so existing rows render unchanged.
--
-- Feature requested by users in Discord ("glow describtion would be
-- tuff") - the username + socials + badges already glow, the bio
-- was the obvious missing surface.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS glow_description boolean DEFAULT false;

-- Tell PostgREST to re-read the schema so the new column is
-- accepted by /api/profile PUTs immediately, with no restart.
NOTIFY pgrst, 'reload schema';
