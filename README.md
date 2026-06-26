# halo.rip

A bio-link / customizable profile page platform. Users sign up, customize their
public page (avatar, badges, music, social links, widgets, custom backgrounds,
cursor effects, fonts, etc.), and share a single URL like `halo.rip/yourname`.

Live at **[halo.rip](https://halo.rip)**.

---

## What's in here

A standard Next.js 15 (App Router) app deployed on Railway with Supabase as
the database, Vercel Blob as media storage, Cloudflare in front for
DNS/security, Stripe for premium payments, and Resend for transactional email.

### Tech stack

- **Framework:** Next.js 15 (App Router) + React 19, Turbopack dev
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (Postgres) - schema lives in `scripts/*.sql`
- **Auth:** Custom session-cookie auth (see `lib/api-auth.ts`); Discord OAuth via `app/api/auth/discord/`
- **File storage:** Vercel Blob, proxied through `/api/file`
- **Payments:** Stripe one-time checkout for premium ($5 lifetime)
- **Email:** Resend (`lib/resend.ts`)
- **Anti-bot:** Cloudflare Turnstile on signup/login

### Notable features

- **Profile customizer** at `/dashboard/customize` - every field on the public
  profile is configurable: fonts (multi-slot), gradients, glows, particle/cursor
  effects, music player, video backgrounds, etc.
- **Discord-style avatar decorations** - 636 animated APNG decorations
  (`/dashboard/decoration`)
- **Widgets panel** - pluggable platform-specific widgets (GitHub, Last.fm,
  Roblox, Valorant, Chess.com, Discord, TikTok, weather, etc.)
- **Premium gate** - server-side stripping of premium-only fields
  (`lib/strip-premium-fields.ts`) so direct API calls can't bypass the UI
- **Auto-compress on video upload** - client-side ffmpeg.wasm transcodes
  uploads to H.264 1080p / CRF 26 before they hit storage
  (`lib/compress-video.ts`)
- **Animated badges** - custom SVG mark per badge type, optional glow + pill
  rendering
- **Per-user crypto badges** for select users (`lib/crypto-badges.ts`)

---

## Local development

### 1. Prerequisites

- Node.js 20+
- pnpm (the lockfile is pnpm)
- A Supabase project (any tier works for dev)
- A Vercel Blob token (free tier works)
- A Stripe account (test mode is fine)

### 2. Install

```bash
pnpm install
```

### 3. Environment

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

Required for dev:
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`
- `BLOB_READ_WRITE_TOKEN` (Vercel Blob)
- `STRIPE_SECRET_KEY` (test mode `sk_test_...` is fine)

Optional but recommended:
- `RESEND_API_KEY` - without this, email-verification + password-reset emails
  won't send (you can set `SKIP_EMAIL_VERIFICATION=true` to bypass for dev)
- `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - without these,
  Turnstile renders "always pass" mode in dev

### 4. Database setup

Apply migrations in order from `scripts/`:

```bash
# Connect via psql or run via Supabase dashboard
for f in scripts/*.sql; do psql "$POSTGRES_URL" -f "$f"; done
```

Or use the Supabase CLI / dashboard to apply each `*.sql` migration manually.

### 5. Run

```bash
pnpm dev
```

Default dev URL is `http://localhost:3000`.

---

## Deployment

This is set up for **Railway** (build pack auto-detects Next.js + pnpm). Any
host that runs Node.js 20+ + pnpm works.

For Railway:

1. Connect the GitHub repo.
2. Set all env vars from `.env.example`.
3. Railway runs `pnpm install --frozen-lockfile` then `pnpm build` then
   `pnpm start` automatically.
4. Point `halo.rip` at Railway via Cloudflare DNS.

Cloudflare proxy on for SSL + DDoS + edge caching.

---

## Repo layout

```
app/                    Next.js App Router routes
  [username]/           Public profile page
  api/                  API routes (auth, profile, upload, stripe, etc.)
  dashboard/            Authenticated dashboard
  (legal)/              ToS + Privacy
components/
  profile/              Public profile renderer + sub-components
  dashboard/            Dashboard layout + sub-pages
  halo/                 Marketing landing components
  ui/                   shadcn-style primitives
lib/                    Shared helpers
  supabase/             Server + client Supabase factories
public/                 Static assets (favicons, halo-logo.png, oneko sprite)
scripts/                SQL migrations + maintenance scripts
```

---

## Maintenance scripts

A few one-shot operational scripts live under `scripts/`:

- `batch-compress-videos.mjs` - recompresses all existing background videos +
  music covers at CRF 22. Run once after schema/storage changes.
- `sync-decor-catalog.ts` - refreshes the avatar decoration catalog from
  the upstream community mirror.

Each script reads credentials from `.env` and is safe to re-run idempotently.

---

## License

Proprietary. All rights reserved. See `LICENSE`.
