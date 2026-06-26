// Lightweight gate for users hard-blocked from running ANY bot command,
// regardless of admin status. Checked by command-handler.js before any
// other middleware runs.
//
// Permission gating (admin / owner tiers) now lives in
// framework/permissions.js, which reads the bot_admins Postgres table.
// To grant admin without a redeploy use `/admin grant`.

export const BANNED_USER_IDS = new Set([
  '1475992116412022976',
])

export function isBannedFromBot(userId) {
  return BANNED_USER_IDS.has(userId)
}
