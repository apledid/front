# halo.rip Discord Bot

Marketplace + moderation bot for halo.rip. Public commands for looking up profiles, browsing the template marketplace, and redeeming premium codes. Staff commands for managing users, badges, titles, premium, sessions, broadcasts, and a durable audit log. Three scheduled tasks keep the platform tidy and the community informed.

---

## Public commands

| Command | What it does |
|---------|--------------|
| `/profile lookup <username>` | Render a public halo.rip profile card |
| `/profile leaderboard [limit]` | Top profiles by view count (paginated) |
| `/template browse [sort] [tag]` | Browse the template marketplace |
| `/template trending` | Shortcut for `browse sort:trending` |
| `/template search <query>` | Find templates by name |
| `/redeem <code>` | Redeem a premium license code (ephemeral DM) |
| `/halo` | Public stats card (total users, premium count, views) |
| `/staff ping` | Bot latency / health check |
| `/help` | List every command, gated by role |

## Staff commands

| Group | Subcommands |
|-------|-------------|
| `/user` | `lookup` `info` `search` `recent` `ban` `unban` `warn` `delete` `edit` `message` `resetpassword` `premium` `site-admin` |
| `/badge` | `create` `edit` `give` `remove` `list` `listall` |
| `/title` | `create` `edit` `give` `remove` `list` `listall` |
| `/admin` | `grant` `revoke` `list` (owner only - manages bot_admins) |
| `/event` | `start` `end` `status` (owner only - free-premium event) |
| `/sessions` | `list` `revoke` `forcelogout` |
| `/profile-tools` | `viewset` `setuid` `usernameswap` |
| `/blacklist` | `add` `remove` `list` |
| `/staff` | `stats` `cleanup` `broadcast` `ping` |
| `/staff audit-*` | `audit-recent` `audit-by-executor` `audit-by-target` `audit-by-command` |
| `/staff schedule-*` | `schedule-status` `schedule-run-now` |

Destructive commands (`/user delete`, `/user ban`, `/sessions forcelogout`, `/staff broadcast`) require a button confirmation and are rate-limited to 5 actions per minute per admin.

## Scheduled tasks

| Task key | Schedule (UTC) | What it does |
|----------|----------------|--------------|
| `nightly_cleanup` | `0 3 * * *` | Delete unverified accounts older than 24h |
| `weekly_leaderboard` | `0 9 * * 1` | Post top-10 leaderboard to `LEADERBOARD_CHANNEL_ID` |
| `daily_stats` | `0 8 * * *` | Post daily stats card to `STAFF_CHANNEL_ID` |

Each task writes a row to `bot_scheduled_tasks` after every run. Inspect status via `/staff schedule-status` or run a task on demand via `/staff schedule-run-now`.

---

## Quick start (local)

```bash
cd discord-bot
cp .env.example .env      # fill in your values
npm install
npm run dev               # uses .env, watches for changes
```

## Deploy to Railway

1. Create a Discord Application at <https://discord.com/developers/applications>. Add a Bot, enable **Server Members Intent** + **Message Content Intent**, copy the token.
2. Invite to your server:
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2147485696&scope=bot%20applications.commands
   ```
3. Push this directory to a GitHub repo. On Railway -> New Project -> Deploy from GitHub. Railway auto-detects `railway.toml`.
4. Set the env vars listed in `.env.example`. At minimum:
   - `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `LOG_CHANNEL_ID` (optional but recommended)
   - `LEADERBOARD_CHANNEL_ID` + `STAFF_CHANNEL_ID` (optional - skip a scheduled task by leaving its channel blank)
5. Deploy. Watch the logs for:
   ```
   [Bot] ✅ Logged in as halo bot#1234
   [command-handler] ✅ Registered N guild commands
   [cron] registered 3 tasks
   ```

`DISCORD_GUILD_ID` makes slash registration instant (vs up to an hour for global commands).

## Database setup

Run the migrations under `../scripts/`. The latest required for the bot is `050_discord_bot_infrastructure.sql` which creates four tables:

- `discord_audit_log` - durable audit trail
- `bot_admins` - who can run admin commands (seeded with the owner)
- `bot_scheduled_tasks` - cron run ledger
- `bot_rate_limits` - destructive-command rate limit buckets

All four have RLS enabled with no policies; only the service role can read or write them.

## How permissions work

Permission gating is enforced server-side by a middleware in `framework/command-handler.js`. Every command declares a `meta.permission` tier:

- `public` - anyone in the guild can run it. Default member permissions are stripped so Discord shows the command to everyone.
- `admin` - looked up against the `bot_admins` table (60s in-memory cache). Discord hides the command from non-admins via `default_member_permissions='0'`.
- `owner` - only the row in `bot_admins` with `is_owner=true`.

To grant admin without a redeploy: `/admin grant @discord-user`. The cache invalidates immediately. To revoke: `/admin revoke @discord-user`. The owner row can't be revoked through the command; edit the table directly if you ever need to transfer ownership.

`BOT_OWNER_ID` env var acts as a backstop if the table ever ends up empty.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Bot offline / not starting | Railway logs - look for `❌ Missing required env vars` |
| Slash commands not showing | `DISCORD_GUILD_ID` set? Was bot invited with `applications.commands` scope? |
| `Login failed` | Regenerate the bot token in the Discord Developer Portal |
| DB errors | Use the **service_role** key, not the anon key |
| Commands report rate-limited | Destructive commands are capped 5/min/admin |
| Scheduled tasks not running | Confirm `[cron] registered 3 tasks` appears in startup logs |
| Daily stats / leaderboard not posting | The matching channel env var must be set AND the bot must be in that channel |
