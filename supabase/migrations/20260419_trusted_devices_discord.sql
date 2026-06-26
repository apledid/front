-- Trusted devices: lets users skip login codes for 14 days on trusted browsers
create table if not exists public.trusted_devices (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  token_hash  text        not null unique,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists trusted_devices_user_id_idx    on public.trusted_devices(user_id);
create index if not exists trusted_devices_token_hash_idx on public.trusted_devices(token_hash);
create index if not exists trusted_devices_expires_at_idx on public.trusted_devices(expires_at);
alter table public.trusted_devices enable row level security;

-- Discord ID: allows connecting a Discord account for OAuth login
alter table public.profiles add column if not exists discord_id text unique;
