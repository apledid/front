-- 068: Top-3 rank badges + avatar outline & glow columns
-- Safe to run multiple times (IF NOT EXISTS / ON CONFLICT DO NOTHING).

-- ─── Avatar outline + glow ────────────────────────────────────────────
-- Owner-only cosmetic for @rez (gated in the profile renderer by username).
-- Columns live on every profile row but only render when username = 'rez'.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_outline_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_outline_color   TEXT    DEFAULT '#ffffff';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_outline_size    INTEGER DEFAULT 3;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_glow_enabled    BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_glow_color      TEXT    DEFAULT '#e87fa0';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_glow_size       INTEGER DEFAULT 24;

-- ─── Top-3 leaderboard rank badges ────────────────────────────────────
-- Granted/revoked automatically by the bot `rank_badges` scheduled task
-- (discord-bot/src/scheduled/rank-badges.js). badges.name is UNIQUE so
-- this is idempotent. The cron looks them up by these exact names.
INSERT INTO public.badges (id, name, icon, color, description, rarity, created_at)
VALUES
  (gen_random_uuid(), '#1 Ranked', '🥇', '#FFD700', 'Ranked #1 on the halo.rip leaderboard.', 'limited', NOW()),
  (gen_random_uuid(), '#2 Ranked', '🥈', '#C0C0C0', 'Ranked #2 on the halo.rip leaderboard.', 'limited', NOW()),
  (gen_random_uuid(), '#3 Ranked', '🥉', '#CD7F32', 'Ranked #3 on the halo.rip leaderboard.', 'limited', NOW())
ON CONFLICT (name) DO NOTHING;

-- Reload PostgREST schema cache so the new profile columns are queryable now.
NOTIFY pgrst, 'reload schema';
