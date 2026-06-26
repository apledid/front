-- ============================================================
-- Community Badges: Bug Hunter, Contributor, Spring 2026
-- Safe to run multiple times (INSERT ... ON CONFLICT DO NOTHING)
-- ============================================================

-- Ensure the rarity column exists (not present in earlier migrations)
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS rarity TEXT;

-- Insert community badges
INSERT INTO public.badges (id, name, icon, color, icon_url, description, rarity, created_at)
VALUES
  (
    gen_random_uuid(),
    'Bug Hunter',
    '🐛',
    '#f59e0b',
    '/badges/bug-hunter.png',
    'Reported a bug that was fixed',
    'rare',
    now()
  ),
  (
    gen_random_uuid(),
    'Contributor',
    '✨',
    '#8b5cf6',
    '/badges/contributor.png',
    'Suggested a feature that was added',
    'epic',
    now()
  ),
  (
    gen_random_uuid(),
    'Spring 2026',
    '🌸',
    '#ec4899',
    '/badges/spring-2026.png',
    'Active during Spring 2026',
    'limited',
    now()
  )
ON CONFLICT (name) DO NOTHING;
