-- 055 - discord_presence table for the in-house Lanyard replacement.
--
-- The Discord bot subscribes to presenceUpdate events in halo.rip's
-- main Discord server and upserts the latest state per user here.
-- The /api/discord-presence/[userId] route reads from this table to
-- power the Discord Presence widget (replaces the external Lanyard
-- API).
--
-- Schema mirrors Lanyard's response shape so the widget renderer
-- doesn't need to change - same fields (status, activities, spotify,
-- discord_user) under the same names.
--
-- Privacy note: any user in halo.rip's server is being tracked here.
-- The widget rendering is gated to profiles that explicitly added a
-- Discord widget with their userId, so the data isn't enumerable
-- without already knowing the Discord ID.

CREATE TABLE IF NOT EXISTS public.discord_presence (
  -- Snowflake ID from Discord - string because it's a 64-bit int
  -- that JS would lose precision on.
  user_id      text PRIMARY KEY,
  -- 'online' | 'idle' | 'dnd' | 'offline'.
  status       text NOT NULL DEFAULT 'offline',
  -- Cached snapshot of the discord_user object (username, global_name,
  -- avatar hash). The widget renderer needs the avatar URL - we
  -- snapshot here so the public read doesn't hit Discord's CDN for
  -- the lookup separately.
  discord_user jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Activities list (game, custom status, Spotify, etc.) in the same
  -- shape Lanyard exposes - type, name, details, state, assets,
  -- timestamps, application_id, emoji.
  activities   jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Convenience shortcut for "what's playing on Spotify right now".
  -- null when not listening. The bot derives this from activities so
  -- the widget doesn't have to filter the array.
  spotify      jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Index on updated_at so we can prune stale rows in a future cron
-- (e.g. "delete anyone we haven't seen in 30 days") without scanning
-- the whole table.
CREATE INDEX IF NOT EXISTS discord_presence_updated_idx
  ON public.discord_presence (updated_at DESC);

NOTIFY pgrst, 'reload schema';
