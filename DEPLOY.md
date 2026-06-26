# halo.rip - VPS deploy & decommission guide

Self-hosted, no external services. Everything runs on a single Contabo
Cloud VPS behind Cloudflare:

```
Cloudflare → nginx (TLS via Origin Cert) → Next.js (3000)
                                        ↘ Discord bot
                                        ↘ PostgREST (3001) → Postgres
                                        ↘ /var/lib/halo-uploads (files)
```

Zero dependency on Supabase, Vercel, or Railway. The `@supabase/supabase-js`
client is kept because it speaks the **PostgREST** protocol - we run our
own PostgREST locally, so the client just points at `127.0.0.1:3001`.

---

## First-time setup (do once on a fresh VPS)

### 1. Prerequisites

Ubuntu 24.04, root SSH. As root:

```bash
apt-get update && apt-get upgrade -y
apt-get install -y \
  curl ca-certificates ufw nginx certbot \
  postgresql postgresql-client \
  build-essential git xz-utils
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2

# Create the unprivileged user the app runs as
useradd -m -s /bin/bash halo
```

### 2. Postgres

```bash
sudo -u postgres psql <<EOSQL
CREATE ROLE halo LOGIN PASSWORD 'PUT_A_STRONG_PASSWORD_HERE';
CREATE DATABASE halo OWNER halo;
EOSQL
```

Then restore the dump from the old Supabase project:

```bash
# Copy schema+data dumps onto the VPS first (scp from your laptop)
sudo -u postgres pg_restore -d halo --no-owner --role=halo halo-dump.sql
```

### 3. Clone the repo + install deps

```bash
mkdir -p /opt/halo
chown halo:halo /opt/halo
sudo -u halo git clone git@github.com:404rez/halo.rip.git /opt/halo/website
cd /opt/halo/website
sudo -u halo npm ci
sudo -u halo --prefix discord-bot npm ci
```

### 4. PostgREST + JWT keys (the Supabase replacement)

```bash
sudo bash setup/install-postgrest.sh
```

The script prints `SUPABASE_*` values. Paste them into both `.env` files.

### 5. .env files

```bash
# Site
cp .env.example .env
nano .env   # paste the PostgREST output + your Stripe/Resend/Discord/Turnstile keys

# Bot
cp discord-bot/.env.example discord-bot/.env
nano discord-bot/.env
```

### 6. Upload directory

```bash
mkdir -p /var/lib/halo-uploads/.tmp
chown -R halo:halo /var/lib/halo-uploads
chmod 755 /var/lib/halo-uploads /var/lib/halo-uploads/.tmp
```

If migrating from Vercel Blob, scp the files into `/var/lib/halo-uploads/`
preserving the `<type>/<user-id>/<timestamp>-<filename>` directory structure.

### 7. Build + start

```bash
sudo -u halo npm run build
sudo -u halo pm2 start ecosystem.config.cjs
sudo -u halo pm2 save
sudo -u halo pm2 startup    # follow the printed command, run as root once
```

### 8. nginx + TLS

Cloudflare Origin Certificate (15-year, free). Generate one in
**Cloudflare dashboard → SSL/TLS → Origin Server → Create Certificate**
for `*.halo.rip` and `halo.rip`. Save the cert + key on the VPS:

```bash
mkdir -p /etc/ssl/cloudflare
nano /etc/ssl/certs/cloudflare-halorip.pem   # paste the cert
nano /etc/ssl/private/cloudflare-halorip.key # paste the key
chmod 600 /etc/ssl/private/cloudflare-halorip.key
```

Then drop in the nginx site config:

```bash
cat > /etc/nginx/sites-available/halo <<'EOF'
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name halo.rip www.halo.rip;

    ssl_certificate     /etc/ssl/certs/cloudflare-halorip.pem;
    ssl_certificate_key /etc/ssl/private/cloudflare-halorip.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Big enough for 25MB background uploads
    client_max_body_size 200m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Trust Cloudflare's real-IP header so rate limiting works
        proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name halo.rip www.halo.rip;
    return 301 https://$host$request_uri;
}
EOF

ln -s /etc/nginx/sites-available/halo /etc/nginx/sites-enabled/halo
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 9. Firewall - lock 80/443 to Cloudflare only

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp

# Cloudflare IPv4
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
  ufw allow proto tcp from $ip to any port 80
  ufw allow proto tcp from $ip to any port 443
done
# Cloudflare IPv6
for ip in $(curl -s https://www.cloudflare.com/ips-v6); do
  ufw allow proto tcp from $ip to any port 80
  ufw allow proto tcp from $ip to any port 443
done

ufw --force enable
```

### 10. DNS

Point `halo.rip` and `www.halo.rip` at the VPS IP in Cloudflare, with the
**orange cloud ON** (proxied). Set SSL/TLS mode to **Full (Strict)** -
the Origin Cert is trusted by Cloudflare's CA.

---

## Day-to-day operations

### Deploy new code

```bash
sudo -u halo bash -c 'cd /opt/halo/website && git pull && npm ci && npm run build'
sudo -u halo pm2 restart ecosystem.config.cjs --update-env
```

### Logs

```bash
pm2 logs halo --lines 100
pm2 logs halo-bot --lines 100
pm2 logs postgrest --lines 100
sudo tail -f /var/log/nginx/error.log
```

### Postgres backup

```bash
sudo -u postgres pg_dump -Fc halo > /var/backups/halo-$(date +%F).dump
# rotate weekly via cron
```

### Restart everything cleanly

```bash
sudo -u halo pm2 kill
sudo -u halo pm2 start ecosystem.config.cjs
```

---

## Decommission the old paid services

Do these **in order**. Each step verifies the previous worked.

### A. Verify the VPS is serving 100% of traffic

```bash
# From your laptop, not the VPS
curl -sI https://halo.rip | grep -i server   # should be cloudflare
dig +short halo.rip                          # should be Cloudflare IPs only
```

Load the site in a browser. Sign in, view a profile, upload a tiny avatar.
If any of those fail, **stop here** and fix before continuing.

### B. Stop the old Discord bot on Railway

In Railway: open the project → **Settings → Danger → Suspend service**.
After 24h with no missed Discord events, delete the service entirely.

### C. Decommission Vercel

1. Verify the production deployment is no longer being hit:
   - Vercel dashboard → your project → **Logs** - should be quiet.
2. **Settings → General → Delete Project** (or pause it for 30 days first
   if you want a rollback window).
3. Stripe webhook URL: update from
   `https://halo-rip.vercel.app/api/stripe/webhook` to
   `https://halo.rip/api/stripe/webhook` in the Stripe dashboard.
4. Discord OAuth redirect URI: update to `https://halo.rip/api/auth/discord/callback`
   in the Discord developer portal.

### D. Decommission Vercel Blob

1. Confirm `/var/lib/halo-uploads` has every file you care about:
   ```bash
   find /var/lib/halo-uploads -type f | wc -l
   ```
2. Vercel dashboard → **Storage → Blob → halo-blob → Settings → Delete store**.
3. Revoke the `BLOB_READ_WRITE_TOKEN` (no longer used in the code).

### E. Decommission Supabase

1. Confirm PostgREST is serving every read/write the site needs by tailing:
   ```bash
   pm2 logs postgrest --lines 200
   ```
   For 10 minutes of real traffic, look for 4xx/5xx responses. Zero =
   safe to proceed.
2. Take one final logical backup straight from Supabase as insurance:
   ```bash
   pg_dump -Fc "$SUPABASE_POOLER_URL" > supabase-final-backup.dump
   ```
3. Supabase dashboard → **Settings → General → Pause project**. Wait 7
   days. If nothing broke, **Delete project**.

### F. Cancel the paid plans

Once all four services are deleted or fully paused for 7+ days:

- Supabase: **Billing → Cancel Pro plan**
- Vercel: **Billing → Cancel Pro plan**
- Vercel Blob: included in the Vercel cancel above
- Railway: **Account → Billing → Cancel plan**

---

## Cost after migration

| Before                         | After                            |
|--------------------------------|----------------------------------|
| Supabase Pro:     $25/mo       | Contabo VPS:        €14/mo       |
| Vercel Pro:       $20/mo       | Cloudflare:         €0           |
| Vercel Blob:      $5/mo        | PostgREST:          €0 (FOSS)    |
| Railway:          $10/mo       | nginx + pm2:        €0           |
| **Total:          ~$60/mo**    | **Total:            ~€14/mo**    |

---

## Troubleshooting

### `pm2 status` shows halo restarting in a loop

```bash
pm2 logs halo --err --lines 50 --nostream
```

Common causes:
- `.env` missing a required var → check against `.env.example`
- Wrong `SUPABASE_SERVICE_ROLE_KEY` → re-run `install-postgrest.sh`, paste the new key
- Port 3000 already in use → `lsof -i :3000` and kill the squatter

### PostgREST returns `JWSError`

The JWT in `SUPABASE_SERVICE_ROLE_KEY` was signed with a different secret
than `/etc/postgrest/halo.conf` expects. Re-run `install-postgrest.sh` -
it's idempotent and won't clobber working state, but the printed values
must be copied into both `.env`s.

### Uploads fail silently in the browser

```bash
sudo -u halo touch /var/lib/halo-uploads/.tmp/test && rm /var/lib/halo-uploads/.tmp/test
```

If that fails, the `halo` user can't write to the upload dir. Fix:

```bash
chown -R halo:halo /var/lib/halo-uploads
chmod 755 /var/lib/halo-uploads /var/lib/halo-uploads/.tmp
```

### Site returns 502 from Cloudflare

Either nginx is down (`systemctl status nginx`) or Next.js crashed
(`pm2 status` + `pm2 logs halo`). 99% of the time it's the Next.js
process, not nginx.
