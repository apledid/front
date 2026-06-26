-- Profile likes / dislikes
--
-- One row per (profile, user). `reaction` flips between 'like' and 'dislike'
-- so a user can only hold one stance per profile at a time (mutual exclusion
-- is enforced by the composite PK + a single column rather than two tables).
-- Denormalized counts live on `profiles` for cheap reads + a future leaderboard.

CREATE TABLE IF NOT EXISTS public.profile_reactions (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction   TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, user_id)
);

-- Count likes for a profile / list a user's reactions quickly.
CREATE INDEX IF NOT EXISTS idx_profile_reactions_profile ON public.profile_reactions(profile_id, reaction);
CREATE INDEX IF NOT EXISTS idx_profile_reactions_user ON public.profile_reactions(user_id);

-- Denormalized counters + the per-profile visibility toggle.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dislikes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_likes BOOLEAN NOT NULL DEFAULT true;

-- Reload PostgREST's schema cache so the new table/columns are queryable.
NOTIFY pgrst, 'reload schema';
