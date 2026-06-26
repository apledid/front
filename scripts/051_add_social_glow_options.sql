-- 051_add_social_glow_options.sql
--
-- Two new boolean columns driving the social-icon row on the profile:
--
--   socials_below_widgets  Move the social-icon row from its default
--                          slot (between bio and custom buttons) to
--                          below the widgets panel. Default false.
--
--   socials_glow_mono      Make the Glow Socials drop-shadow use the
--                          single `glow_color` for every icon (the
--                          legacy behaviour). When false (default),
--                          each icon's glow uses its own platform
--                          brand colour - Spotify green, YouTube
--                          red, GitLab orange, etc.
--
-- Both default to false so existing profiles get the new per-link
-- brand-coloured glow + classic socials position automatically; a
-- user can opt back into mono-coloured glow via the Glow Settings
-- toggle and into the below-widgets position via the Layout toggle.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS socials_below_widgets boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS socials_glow_mono boolean DEFAULT false;

-- Tell PostgREST about the new columns so they become writable via
-- the REST API without a service restart.
NOTIFY pgrst, 'reload schema';
