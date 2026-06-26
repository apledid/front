-- 079: Give Rich and Inviter a glow_color + glow_strength like every other
-- badge. They were created without these, so glow never applied to them (the
-- profile render keyed glow off glow_color). The render now also falls back to
-- the badge color, but set the data too so the catalog and any glow_color
-- readers stay consistent. Mirror the other badges' strength (14) and use each
-- badge's own color as its glow.

UPDATE public.badges SET glow_color = '#00ff97', glow_strength = 14 WHERE name = 'Rich'    AND glow_color IS NULL;
UPDATE public.badges SET glow_color = '#fcff97', glow_strength = 14 WHERE name = 'Inviter' AND glow_color IS NULL;
