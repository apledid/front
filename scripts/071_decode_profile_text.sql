-- 071: Decode HTML entities left in profiles text columns by the old
-- over-escaping sanitizer (sanitizeString). Same class of fix as 070 (which
-- covered custom_buttons + music_history). These columns render through React
-- text nodes (escaped on output), so the stored entities showed up literally.
-- Only touches rows that actually contain an entity escapeHtml produced.

CREATE OR REPLACE FUNCTION pg_temp.dec(s text) RETURNS text AS $$
  SELECT CASE WHEN s IS NULL THEN NULL ELSE
    replace(replace(replace(replace(replace(replace(replace(replace(
      s, '&#x2F;', '/'), '&#x27;', ''''), '&#x60;', '`'), '&#x3D;', '='),
      '&quot;', '"'), '&lt;', '<'), '&gt;', '>'), '&amp;', '&')
  END
$$ LANGUAGE sql IMMUTABLE;

UPDATE public.profiles SET
  display_name     = pg_temp.dec(display_name),
  location         = pg_temp.dec(location),
  enter_title      = pg_temp.dec(enter_title),
  enter_subtitle   = pg_temp.dec(enter_subtitle),
  music_title      = pg_temp.dec(music_title),
  music_artist     = pg_temp.dec(music_artist),
  custom_font_name = pg_temp.dec(custom_font_name)
WHERE display_name     ~ '&(amp|lt|gt|quot|#x2F|#x27|#x60|#x3D);'
   OR location         ~ '&(amp|lt|gt|quot|#x2F|#x27|#x60|#x3D);'
   OR enter_title      ~ '&(amp|lt|gt|quot|#x2F|#x27|#x60|#x3D);'
   OR enter_subtitle   ~ '&(amp|lt|gt|quot|#x2F|#x27|#x60|#x3D);'
   OR music_title      ~ '&(amp|lt|gt|quot|#x2F|#x27|#x60|#x3D);'
   OR music_artist     ~ '&(amp|lt|gt|quot|#x2F|#x27|#x60|#x3D);'
   OR custom_font_name ~ '&(amp|lt|gt|quot|#x2F|#x27|#x60|#x3D);';
