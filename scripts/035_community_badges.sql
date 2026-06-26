-- Community badges: Bug Hunter, Contributor, Seasonal
-- Safe to run multiple times (ON CONFLICT DO NOTHING)

-- Ensure rarity column exists (it's in TypeScript types but may be missing from DB)
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS rarity TEXT;

-- Bug Hunter badge
INSERT INTO public.badges (id, name, icon, color, description, rarity, created_at)
VALUES (
  gen_random_uuid(),
  'Bug Hunter',
  '🐛',
  '#f59e0b',
  'Reported a bug that was fixed.',
  'rare',
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Contributor badge
INSERT INTO public.badges (id, name, icon, color, description, rarity, created_at)
VALUES (
  gen_random_uuid(),
  'Contributor',
  '✨',
  '#8b5cf6',
  'Suggested a feature that was added to the site.',
  'epic',
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Spring 2026 seasonal badge
INSERT INTO public.badges (id, name, icon, color, description, rarity, created_at)
VALUES (
  gen_random_uuid(),
  'Spring 2026',
  '🌸',
  '#ec4899',
  'Was active during Spring 2026.',
  'limited',
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Also add background_effect_strength and profile_radius columns if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_effect_strength INTEGER DEFAULT 50;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_radius INTEGER DEFAULT 26;
