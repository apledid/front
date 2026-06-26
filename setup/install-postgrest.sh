#!/usr/bin/env bash
# install-postgrest.sh
#
# One-shot installer that puts PostgREST in front of local Postgres so the
# Next.js site and the Discord bot keep using @supabase/supabase-js with
# zero app code changes. After this finishes, halo.rip has zero runtime
# dependency on Supabase / Vercel / Railway.
#
# What it does:
#   1. Downloads the latest PostgREST static binary (~10 MB) to /usr/local/bin
#   2. Creates the `anon` and `authenticator` Postgres roles
#   3. Grants the right schema permissions
#   4. Generates a 64-byte JWT secret + signs anon + service_role keys
#   5. Writes /etc/postgrest/halo.conf
#   6. Prints the keys you paste into both .env files
#
# Run as root on the VPS:
#   curl -sSL https://halo.rip/setup/install-postgrest.sh | sudo bash
#   # or, if cloned:
#   sudo bash /opt/halo/website/setup/install-postgrest.sh
#
# Re-running is safe: it skips steps that already completed.

set -euo pipefail

PGRST_VERSION="v12.2.3"
PGRST_BIN="/usr/local/bin/postgrest"
PGRST_CONF="/etc/postgrest/halo.conf"
PG_DB="${PG_DB:-halo}"
PG_USER="${PG_USER:-halo}"
DB_OWNER_PASSWORD="${DB_OWNER_PASSWORD:-}"  # password for $PG_USER

# ── Sanity checks ────────────────────────────────────────────────────────
if [[ "$EUID" -ne 0 ]]; then
  echo "Run me as root: sudo bash $0" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install postgresql-client first:"
  echo "  apt-get install -y postgresql-client"
  exit 1
fi

# ── 1. Install PostgREST binary ──────────────────────────────────────────
if [[ ! -x "$PGRST_BIN" ]]; then
  echo "Downloading PostgREST $PGRST_VERSION..."
  TMP="$(mktemp -d)"
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64)  PGRST_ARCH="linux-static-x64" ;;
    aarch64) PGRST_ARCH="ubuntu-aarch64"  ;;
    *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;;
  esac
  curl -sSL -o "$TMP/postgrest.tar.xz" \
    "https://github.com/PostgREST/postgrest/releases/download/${PGRST_VERSION}/postgrest-${PGRST_VERSION}-${PGRST_ARCH}.tar.xz"
  tar -xJf "$TMP/postgrest.tar.xz" -C "$TMP"
  install -m 0755 "$TMP/postgrest" "$PGRST_BIN"
  rm -rf "$TMP"
  echo "  → installed: $($PGRST_BIN --version | head -n1)"
else
  echo "PostgREST already installed: $($PGRST_BIN --version | head -n1)"
fi

# ── 2. Postgres roles ────────────────────────────────────────────────────
echo "Setting up Postgres roles..."

# The `authenticator` role is what PostgREST connects as. It has no
# privileges of its own - it can only switch into the role the JWT names.
# `anon` and `service_role` are the targets it switches into.

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$PG_DB" <<EOSQL
-- Authenticator (the role PostgREST connects with). NOINHERIT so it has
-- to explicitly SET ROLE to anon / service_role.
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'authpass_$(openssl rand -hex 8)';
  END IF;
END
\$\$;

-- anon: minimal-privilege role used by unauthenticated requests
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END
\$\$;

-- service_role: bypasses RLS, equivalent to Supabase service role.
-- BYPASSRLS is the critical bit - without it the admin client can't
-- write to row-level-secured tables.
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
\$\$;

-- Let authenticator switch into either role
GRANT anon, service_role TO authenticator;

-- service_role gets full access; anon gets schema usage only.
--
-- We deliberately do NOT grant SELECT on tables to anon. The anon
-- JWT ships in the client bundle (NEXT_PUBLIC_SUPABASE_ANON_KEY)
-- and the only reason a request would hit PostgREST with anon auth
-- is supabase.auth.* calls (signOut / verifyOtp), which don't need
-- table read access. Granting blanket SELECT here would mean a
-- future PostgREST exposure (binding to 0.0.0.0 by mistake, nginx
-- proxy in front of it, SSRF reaching loopback from Next.js) leaks
-- password_hash / session token hashes / pending reset codes /
-- stripe_customer_id / IPs out of the public anon JWT.
--
-- If a future feature needs anon to read a specific column on a
-- specific table, add a column-scoped GRANT there: e.g.
--   GRANT SELECT (username, avatar_url) ON public.profiles TO anon;
-- with a matching RLS policy. Never restore the blanket grant.
GRANT USAGE ON SCHEMA public TO anon, service_role;
GRANT ALL    ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Future tables/sequences/functions inherit these grants. Same
-- reasoning: do NOT default-grant SELECT to anon, only to
-- service_role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL    ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
EOSQL

echo "  → roles ready (authenticator, anon, service_role)"

# Capture the authenticator password we just generated so we can write it
# into the PostgREST config. We re-fetch it from a known file we just
# wrote so re-runs don't overwrite a working install.
AUTH_PASSWORD_FILE="/root/.halo-authenticator-password"
if [[ ! -f "$AUTH_PASSWORD_FILE" ]]; then
  AUTH_PASS="$(openssl rand -hex 16)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$PG_DB" \
    -c "ALTER ROLE authenticator PASSWORD '${AUTH_PASS}';"
  echo "$AUTH_PASS" > "$AUTH_PASSWORD_FILE"
  chmod 600 "$AUTH_PASSWORD_FILE"
else
  AUTH_PASS="$(cat "$AUTH_PASSWORD_FILE")"
fi

# ── 3. JWT secret + anon + service_role keys ─────────────────────────────
JWT_SECRET_FILE="/root/.halo-jwt-secret"
if [[ ! -f "$JWT_SECRET_FILE" ]]; then
  # 64 bytes hex = 512 bits. PostgREST requires ≥32 chars.
  openssl rand -hex 32 > "$JWT_SECRET_FILE"
  chmod 600 "$JWT_SECRET_FILE"
fi
JWT_SECRET="$(cat "$JWT_SECRET_FILE")"

# Sign two long-lived JWTs (10 years). Pure-bash HS256 signer - no jq, no
# python needed.
hs256_jwt() {
  local role="$1"
  local secret="$2"
  local header='{"alg":"HS256","typ":"JWT"}'
  # 10-year expiry. iat = now.
  local now exp
  now="$(date +%s)"
  exp=$((now + 60 * 60 * 24 * 365 * 10))
  local payload="{\"role\":\"$role\",\"iss\":\"halo\",\"iat\":$now,\"exp\":$exp}"

  b64() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
  local h p
  h="$(printf '%s' "$header"  | b64)"
  p="$(printf '%s' "$payload" | b64)"
  local sig
  sig="$(printf '%s.%s' "$h" "$p" | openssl dgst -sha256 -hmac "$secret" -binary | b64)"
  printf '%s.%s.%s\n' "$h" "$p" "$sig"
}

ANON_JWT="$(hs256_jwt anon "$JWT_SECRET")"
SERVICE_JWT="$(hs256_jwt service_role "$JWT_SECRET")"

# ── 4. /etc/postgrest/halo.conf ──────────────────────────────────────────
mkdir -p /etc/postgrest
cat > "$PGRST_CONF" <<EOF
# /etc/postgrest/halo.conf
#
# Managed by setup/install-postgrest.sh - edit by hand if you know what
# you're doing.

db-uri = "postgres://authenticator:${AUTH_PASS}@127.0.0.1:5432/${PG_DB}"
db-schemas = "public"
db-anon-role = "anon"

# Listen only on loopback. nginx does not proxy this - only the Next.js
# process and the Discord bot (both same host) talk to it.
server-host = "127.0.0.1"
server-port = 3001

# Match Supabase's behaviour
db-pool = 10
db-pool-acquisition-timeout = 10

# JWT verification
jwt-secret = "${JWT_SECRET}"
jwt-aud = ""

# Slightly larger row limit for big lists (badges, music history, etc.)
db-max-rows = 1000

# Don't dump the schema in OpenAPI - tighten attack surface
openapi-mode = "disabled"
EOF
chmod 600 "$PGRST_CONF"

# ── 5. Print the credentials ─────────────────────────────────────────────
cat <<EOF

═══════════════════════════════════════════════════════════════════════════
  PostgREST installed. Paste these into BOTH .env files:
    /opt/halo/website/.env
    /opt/halo/website/discord-bot/.env
═══════════════════════════════════════════════════════════════════════════

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3001
SUPABASE_URL=http://127.0.0.1:3001

NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_JWT}
SUPABASE_ANON_KEY=${ANON_JWT}

SUPABASE_SERVICE_ROLE_KEY=${SERVICE_JWT}

SUPABASE_JWT_SECRET=${JWT_SECRET}

DATABASE_URL=postgres://${PG_USER}:CHANGE_ME@127.0.0.1:5432/${PG_DB}

═══════════════════════════════════════════════════════════════════════════
  Secrets saved to disk (root-only):
    /root/.halo-jwt-secret               (the HS256 signing key)
    /root/.halo-authenticator-password   (Postgres password for PostgREST)
═══════════════════════════════════════════════════════════════════════════

Next:
  1. Update both .env files with the values above.
  2. pm2 start /opt/halo/website/ecosystem.config.cjs
  3. pm2 save && pm2 status
  4. Smoke test:  curl -s http://127.0.0.1:3001/profiles?limit=1 -H "apikey: \$SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY"

EOF
