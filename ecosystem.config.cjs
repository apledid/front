// PM2 ecosystem for halo.rip on a single VPS.
// All three processes run under the same `halo` user. Logs go to PM2's
// default location (~/.pm2/logs/) - `pm2 logs <name>` to follow.
//
// Deploy from /opt/halo/website with:
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 startup           # one-time, follow the printed command
//
// Restart everything after a code/env change:
//   pm2 restart ecosystem.config.cjs --update-env

module.exports = {
  apps: [
    // ── Next.js site (port 3000, behind nginx) ────────────────────────────
    {
      name: 'halo',
      cwd: '/opt/halo/website',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      // The Node flag --env-file is the cleanest way to load the .env file
      // without committing to a runtime dependency on dotenv. Requires Node 20+.
      node_args: '--env-file=.env',
      exec_mode: 'fork',
      instances: 1,
      // Restart if RAM exceeds 1 GB (Next.js + Sharp can leak under load).
      max_memory_restart: '1G',
      // Don't restart in a tight loop if it keeps crashing.
      max_restarts: 10,
      restart_delay: 4000,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },

    // ── Discord bot ──────────────────────────────────────────────────────
    {
      name: 'halo-bot',
      cwd: '/opt/halo/website/discord-bot',
      script: 'src/index.js',
      node_args: '--env-file=.env',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '512M',
      max_restarts: 10,
      restart_delay: 4000,
      env: {
        NODE_ENV: 'production',
      },
    },

    // ── PostgREST (Supabase-compatible REST API on top of local Postgres) ─
    // Runs on 127.0.0.1:3001. The Next.js site and the Discord bot both
    // point SUPABASE_URL at this address - they speak the same protocol
    // Supabase does, so zero app code changes.
    //
    // Config lives in /etc/postgrest/halo.conf (created by install-postgrest.sh).
    // The binary lives in /usr/local/bin/postgrest.
    {
      name: 'postgrest',
      script: '/usr/local/bin/postgrest',
      args: '/etc/postgrest/halo.conf',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '512M',
      max_restarts: 10,
      restart_delay: 4000,
    },
  ],
}
