-- 072: Atomic template uses_count increment.
-- Replaces a read-then-write in /api/templates/apply that lost increments
-- when two users applied the same template concurrently. Mirrors the existing
-- increment_profile_view_count RPC pattern used by /api/track-view.

CREATE OR REPLACE FUNCTION public.increment_template_uses(p_template_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.templates
  SET uses_count = COALESCE(uses_count, 0) + 1
  WHERE id = p_template_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_template_uses(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
