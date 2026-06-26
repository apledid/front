#!/usr/bin/env bash
#
# verify-schema.sh - sanity-check every table + column the codebase
# references against the live Postgres schema. Run after any migration
# or when you hit a "Could not find the X column in schema cache" error.
#
# Usage (on the VPS):
#   sudo bash /opt/halo/website/scripts/verify-schema.sh
#
# What it does:
#   1. Lists every table the code reads from via supabase-js .from('…')
#   2. Diffs that list against the actual public.* tables in halo db
#   3. Reads PROFILE_ALLOWED_COLUMNS from lib/profile-columns.ts and
#      diffs against the actual columns on public.profiles
#   4. Sends PostgREST a `NOTIFY pgrst, 'reload schema'` so any newly-
#      visible columns become writable through the REST API
#   5. Prints a green PASS / red FAIL summary

set -uo pipefail

DB_NAME="${DB_NAME:-halo}"
REPO_DIR="${REPO_DIR:-/opt/halo/website}"

red()   { printf '\033[31m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$1"; }
bold()  { printf '\033[1m%s\033[0m\n' "$1"; }

bold "── halo.rip schema audit ──"
echo

# 1. Tables referenced by code
bold "1. Tables referenced via .from('…') in code"
CODE_TABLES=$(grep -rh "\.from(['\"]" "$REPO_DIR/app" "$REPO_DIR/components" "$REPO_DIR/lib" \
  --include="*.ts" --include="*.tsx" 2>/dev/null \
  | sed -E "s/.*\.from\(['\"]([a-z_]+)['\"]\).*/\1/" \
  | sort -u)
echo "$CODE_TABLES" | sed 's/^/  /'
echo

# 2. Actual tables in DB
bold "2. Actual tables in public schema"
DB_TABLES=$(sudo -u postgres psql -d "$DB_NAME" -tAc \
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
echo "$DB_TABLES" | sed 's/^/  /'
echo

# 3. Diff: tables in code but missing from DB
bold "3. Tables referenced by code but MISSING from DB"
MISSING_TABLES=$(comm -23 <(echo "$CODE_TABLES") <(echo "$DB_TABLES"))
if [[ -z "$MISSING_TABLES" ]]; then
  green "  none - every table the code reads exists"
else
  red "$(echo "$MISSING_TABLES" | sed 's/^/  ✗ /')"
fi
echo

# 4. profiles columns: allowlist vs actual
bold "4. PROFILE_ALLOWED_COLUMNS vs actual public.profiles columns"
ALLOWLIST=$(sed -n "/^export const PROFILE_ALLOWED_COLUMNS = \[/,/^] as const/p" \
  "$REPO_DIR/lib/profile-columns.ts" \
  | grep -oE "'[a-z_0-9]+'" | tr -d "'" | sort -u)
ACTUAL_COLS=$(sudo -u postgres psql -d "$DB_NAME" -tAc \
  "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' ORDER BY column_name")

MISSING_COLS=$(comm -23 <(echo "$ALLOWLIST") <(echo "$ACTUAL_COLS"))
EXTRA_COLS=$(comm -13 <(echo "$ALLOWLIST") <(echo "$ACTUAL_COLS"))

if [[ -z "$MISSING_COLS" ]]; then
  green "  Columns in allowlist but missing from DB: none"
else
  red "  Columns in allowlist but MISSING from DB (will 500 on save):"
  echo "$MISSING_COLS" | sed 's/^/    ✗ /'
fi

if [[ -n "$EXTRA_COLS" ]]; then
  # Categorise the "extra" columns so it's easy to spot a genuine missing
  # entry vs the many columns that are EXPECTED to be missing from
  # PROFILE_ALLOWED_COLUMNS (auth/admin/payment/timestamps/per-route).
  yellow "  Columns in DB but NOT in PROFILE_ALLOWED_COLUMNS:"
  echo "$EXTRA_COLS" | while IFS= read -r col; do
    case "$col" in
      id|uid|username|email|password_hash|email_verified|email_deadline|verification_code|verification_expires_at|created_at|updated_at|session_invalidated_at|discord_id|use_discord_avatar)
        echo "    • $col   (auth / identity - never user-editable, OK)" ;;
      is_admin|banned|banned_at|banned_by_username|ban_reason|flagged_for_review|is_banned|admin_access|can_give_premium|support_blacklisted)
        echo "    • $col   (moderation - admin-only, OK)" ;;
      premium_active|premium_activated_at|premium_type|is_premium|is_verified|stripe_customer_id|stripe_payment_id)
        echo "    • $col   (premium / payments - server-managed, OK)" ;;
      view_count|views_locked|views_override)
        echo "    • $col   (analytics - server-managed, OK)" ;;
      cursor_click_color|cursor_click_effect|effect_enabled|effect_type|particle_type)
        echo "    • $col   (editable via /api/effects, OK)" ;;
      embed_color|embed_description|embed_image_url|embed_title|favicon_url)
        echo "    • $col   (editable via /api/appearance metadata route, OK)" ;;
      music_type)
        echo "    • $col   (set server-side on music upload, OK)" ;;
      *)
        echo "    • $col   (?? verify this is intentional)" ;;
    esac
  done
fi
echo

# 5. Reload PostgREST schema cache so newly-visible columns work via REST
bold "5. Reloading PostgREST schema cache"
sudo -u postgres psql -d "$DB_NAME" -tAc "NOTIFY pgrst, 'reload schema';" \
  && green "  NOTIFY sent - PostgREST will pick up any new tables/columns within ~1s"
echo

# Final summary
bold "── Summary ──"
if [[ -z "$MISSING_TABLES" && -z "$MISSING_COLS" ]]; then
  green "✓ All tables exist. All allowed columns exist. PostgREST notified."
  exit 0
else
  red "✗ Mismatches found above. Apply the missing migrations and re-run."
  exit 1
fi
