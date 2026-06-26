-- 070: Decode HTML entities left in user text fields by the old over-escaping
-- sanitizer (sanitizeString in lib/security.ts). These fields render through
-- React text nodes (which escape on output), so the stored entities showed up
-- literally - e.g. a custom button label "/jnr" displayed as "&#x2F;jnr", and
-- a track "AC/DC" as "AC&#x2F;DC".
--
-- Decode &amp; LAST so single-escaped values round-trip cleanly. Only touches
-- rows that actually contain one of the entities escapeHtml produces.

UPDATE public.custom_buttons SET label =
  replace(replace(replace(replace(replace(replace(replace(replace(
    label,
    '&#x2F;', '/'),
    '&#x27;', ''''),
    '&#x60;', '`'),
    '&#x3D;', '='),
    '&quot;', '"'),
    '&lt;', '<'),
    '&gt;', '>'),
    '&amp;', '&')
WHERE label ~ '&(amp|lt|gt|quot|#x2F|#x27|#x60|#x3D);';

UPDATE public.music_history SET
  track_title = replace(replace(replace(replace(replace(replace(replace(replace(
    track_title, '&#x2F;', '/'), '&#x27;', ''''), '&#x60;', '`'), '&#x3D;', '='),
    '&quot;', '"'), '&lt;', '<'), '&gt;', '>'), '&amp;', '&'),
  track_artist = replace(replace(replace(replace(replace(replace(replace(replace(
    track_artist, '&#x2F;', '/'), '&#x27;', ''''), '&#x60;', '`'), '&#x3D;', '='),
    '&quot;', '"'), '&lt;', '<'), '&gt;', '>'), '&amp;', '&')
WHERE track_title ~ '&(amp|lt|gt|quot|#x2F|#x27|#x60|#x3D);'
   OR track_artist ~ '&(amp|lt|gt|quot|#x2F|#x27|#x60|#x3D);';
