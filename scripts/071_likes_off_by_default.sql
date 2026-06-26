-- 071: Likes / dislikes are opt-in.
--
-- The feature ships off on every profile; owners turn it on via the
-- "Likes & Dislikes" toggle in customize. Flip the column default to false and
-- disable it on all existing profiles so nobody shows the thumbs until they
-- explicitly opt in.

ALTER TABLE public.profiles ALTER COLUMN show_likes SET DEFAULT false;
UPDATE public.profiles SET show_likes = false WHERE show_likes IS DISTINCT FROM false;

NOTIFY pgrst, 'reload schema';
