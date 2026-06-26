-- One-shot: delete every template + its likes / favorites / reports.
-- Use this if the existing templates table is full of bogus / wrong
-- premium_features and you want a clean slate to start over with the
-- fixed detector.
--
-- Run on the VPS:
--   PGPASSWORD='hj2oG6xyY7ll3dhHy5V77B2z' psql -h 127.0.0.1 -U halo -d halo \
--     -f scripts/nuke-all-templates.sql
--
-- DELETE order respects foreign keys: child rows first, then the
-- templates row itself. CASCADE on the FK would also work but being
-- explicit keeps the row counts visible in psql output.

BEGIN;

DELETE FROM public.template_reports;
DELETE FROM public.template_likes;
DELETE FROM public.template_favorites;
DELETE FROM public.templates;

COMMIT;

-- Sanity check after running. Should all return 0.
SELECT 'templates'         AS table_name, count(*) AS remaining FROM public.templates
UNION ALL
SELECT 'template_likes',     count(*) FROM public.template_likes
UNION ALL
SELECT 'template_favorites', count(*) FROM public.template_favorites
UNION ALL
SELECT 'template_reports',   count(*) FROM public.template_reports;
