-- ============================================================
-- STEP 1: sessions table
-- Stores hashed session tokens. Raw tokens live only in cookies.
-- ============================================================
create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  ip_address   text,
  user_agent   text
);

create index if not exists sessions_user_id_idx    on public.sessions(user_id);
create index if not exists sessions_token_hash_idx on public.sessions(token_hash);
create index if not exists sessions_expires_at_idx on public.sessions(expires_at);

-- RLS: only service_role can read/write sessions (no policy = deny all for anon/authenticated)
alter table public.sessions enable row level security;

-- ============================================================
-- STEP 2: Enable RLS on all user tables
-- Service-role bypasses RLS so your Next.js APIs keep working.
-- The anon key (used in the browser Supabase client if any)
-- can only see what policies explicitly allow.
-- ============================================================
alter table public.profiles                 enable row level security;
alter table public.social_links             enable row level security;
alter table public.custom_buttons           enable row level security;
alter table public.music_tracks             enable row level security;
alter table public.profile_badges           enable row level security;
alter table public.profile_badge_loadout    enable row level security;
alter table public.profile_titles           enable row level security;
alter table public.profile_title_loadout    enable row level security;
alter table public.titles                   enable row level security;
alter table public.page_views               enable row level security;
alter table public.inbox_messages           enable row level security;
alter table public.content_reports          enable row level security;
alter table public.license_keys             enable row level security;
alter table public.access_codes             enable row level security;
alter table public.admin_access_codes       enable row level security;
alter table public.chunked_uploads          enable row level security;
alter table public.upload_logs              enable row level security;
alter table public.pending_verifications    enable row level security;
alter table public.widgets                  enable row level security;
alter table public.templates                enable row level security;

-- ============================================================
-- STEP 3: Public read policies
-- Only allow anonymous/authenticated reads on data that should
-- actually be public. Everything else stays locked to service_role.
-- ============================================================

-- Public profiles (only is_public = true and not banned)
drop policy if exists "public can read public profiles" on public.profiles;
create policy "public can read public profiles"
  on public.profiles
  for select
  to anon, authenticated
  using (is_public = true and (banned is null or banned = false));

-- Public social links (parent profile must be public)
drop policy if exists "public reads social_links" on public.social_links;
create policy "public reads social_links"
  on public.social_links
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id
        and p.is_public = true
        and (p.banned is null or p.banned = false)
    )
  );

-- Public custom buttons
drop policy if exists "public reads custom_buttons" on public.custom_buttons;
create policy "public reads custom_buttons"
  on public.custom_buttons
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id
        and p.is_public = true
        and (p.banned is null or p.banned = false)
    )
  );

-- Public music tracks
drop policy if exists "public reads music_tracks" on public.music_tracks;
create policy "public reads music_tracks"
  on public.music_tracks
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id
        and p.is_public = true
        and (p.banned is null or p.banned = false)
    )
  );

-- Public templates (community gallery)
drop policy if exists "public reads templates" on public.templates;
create policy "public reads templates"
  on public.templates
  for select
  to anon, authenticated
  using (is_public = true);

-- Public titles/badges (lookup tables, fully public)
drop policy if exists "public reads titles" on public.titles;
create policy "public reads titles"
  on public.titles
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public reads profile_badges" on public.profile_badges;
create policy "public reads profile_badges"
  on public.profile_badges
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = user_id
        and p.is_public = true
        and (p.banned is null or p.banned = false)
    )
  );

drop policy if exists "public reads profile_badge_loadout" on public.profile_badge_loadout;
create policy "public reads profile_badge_loadout"
  on public.profile_badge_loadout
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = user_id
        and p.is_public = true
        and (p.banned is null or p.banned = false)
    )
  );

drop policy if exists "public reads profile_title_loadout" on public.profile_title_loadout;
create policy "public reads profile_title_loadout"
  on public.profile_title_loadout
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = user_id
        and p.is_public = true
        and (p.banned is null or p.banned = false)
    )
  );

-- ============================================================
-- STEP 4: Auto-clean expired sessions (optional scheduled job)
-- Run this manually or set up pg_cron if available.
-- ============================================================
-- delete from public.sessions where expires_at < now() or revoked_at is not null;
