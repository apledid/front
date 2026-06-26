-- 057 - disable RLS on discord_presence.
--
-- The 056 migration assumed `service_role` would bypass RLS the way
-- it does in standard Supabase setups. This self-hosted PostgREST
-- doesn't grant BYPASSRLS to service_role, so enabling RLS with no
-- policies blocked every write from the Discord bot:
--
--   permission denied for table discord_presence
--
-- Other tables in this DB (widgets, profiles, social_links, etc.)
-- have RLS DISABLED, which is the de-facto pattern here - they
-- rely on base-table grants + API-layer authorisation instead.
-- Match that pattern so the bot's upserts go through.
--
-- Security note: discord_presence holds presence data for users in
-- halo.rip's Discord server. It's not particularly sensitive (Discord
-- itself exposes the same data publicly) and the API route
-- (/api/discord-presence/[userId]) validates the userId is a real
-- snowflake before returning anything - there's no enumeration
-- surface that opening this table up would create.

ALTER TABLE public.discord_presence DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
