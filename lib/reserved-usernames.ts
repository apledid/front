/**
 * Usernames that conflict with platform routing.
 *
 * Picking one of these as a username would either:
 *   (a) shadow a static `app/` route - signing up as `dashboard` means
 *       /dashboard always serves the dashboard page, never the user's profile.
 *   (b) hit Next.js's framework-reserved error paths /404 and /500.
 *   (c) shadow a `public/` static asset path.
 *
 * Match is case-insensitive; signup already lowercases incoming usernames
 * before validation.
 *
 * Discovered when uid 2161 (username "500") and uid 2340 (username "404")
 * couldn't access their profile URLs because Next.js intercepts /500 and
 * /404 as built-in error pages. Renamed to _500 / _404 manually; this list
 * stops anyone else hitting the same wall.
 */
const RESERVED_USERNAMES = new Set([
  // Next.js framework-reserved error paths
  '404', '500', '_next', '_error', '_document', '_app',

  // App-route shadows (everything in app/ that's a static page or route group)
  'api', 'auth', 'banned', 'dashboard', 'demo', 'leaderboard', 'login',
  'maintenance', 'onboarding', 'pricing', 'redeem', 'signup', 'templates',
  'privacy', 'tos', 'error',

  // public/ asset paths (Next.js serves these before falling through to
  // the dynamic route)
  'cursor-buddy', 'decorations', 'effects', 'favicon', 'robots', 'sitemap',
  'apple-touch-icon',

  // Common impersonation / authority-claim vectors. Block proactively so
  // someone can't sign up as "admin", "staff", "support" and abuse the
  // implied authority in DMs or screenshots.
  'admin', 'administrator', 'mod', 'moderator', 'staff', 'support',
  'system', 'official', 'help', 'halo', 'root', 'owner', 'team',
  'security', 'noreply', 'no-reply', 'webmaster',
])

/** Case-insensitive check. Returns true if the given string is reserved
 *  and should be refused at signup / username-change time. */
export function isReservedUsername(username: string): boolean {
  if (!username) return false
  return RESERVED_USERNAMES.has(username.trim().toLowerCase())
}

/** Exposed for places that want to list / debug the reserved set. */
export function listReservedUsernames(): string[] {
  return [...RESERVED_USERNAMES].sort()
}
