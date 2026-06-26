/**
 * Username content filter - blocks handles containing CSAM terms, hard
 * slurs, and other universally-offensive content.
 *
 * Separate from reserved-usernames.ts (exact-match route shadows like
 * "dashboard"). This one matches against a normalized form of the handle
 * so leet/padding evasion (ch1ld_p0rn -> childporn) is caught.
 *
 * Two tiers, because naive substring matching hits the Scunthorpe
 * problem (innocent words containing a banned substring):
 *
 *   HARD_SUBSTRINGS - terms long/unique enough that no innocent English
 *     word contains them (childporn, pedophile, nigger, faggot, …).
 *     Matched anywhere in the normalized handle, including padded/leet
 *     forms (xchildpornx, n1gg3r).
 *
 *   BOUNDED_TOKENS - short terms that ARE substrings of innocent words
 *     (rape→grape, pedo→torpedo, coon→raccoon, spic→spicy,
 *     rapist→therapist, cunt→scunthorpe). Matched only as a whole token
 *     (the entire handle, or a piece delimited by digits/underscores/
 *     symbols), so "grape" and "torpedo" pass while "x_rape_x" and bare
 *     "pedo" are blocked.
 *
 * Applied at every handle-creation path:
 *   - /api/auth/signup/send-code  (email signup, username reservation)
 *   - /api/auth/signup            (legacy direct signup)
 *   - /api/auth/check-username    (live availability check in the UI)
 *   - /api/auth/discord/callback  (auto-generated handle from Discord name)
 */

// Collapse common leet / homoglyph substitutions to their base letter,
// strip everything that isn't a-z. "ch1ld_p0rn" and "C H I L D P O R N"
// both become "childporn".
function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[8]/g, 'b')
    .replace(/[(]/g, 'c')
    .replace(/[3€]/g, 'e')
    .replace(/[6]/g, 'g')
    .replace(/[1!|íìî]/g, 'i')
    .replace(/[0óòôö]/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[2]/g, 'z')
    .replace(/[^a-z]/g, '')
}

// Unambiguous - safe to match anywhere. No common innocent word contains
// these. (Verified against the obvious false-positive candidates.)
const HARD_SUBSTRINGS: string[] = [
  // CSAM / child exploitation
  'childporn', 'kidporn', 'kiddieporn', 'pedophile', 'paedophile',
  'lolicon', 'shotacon', 'jailbait', 'cheesepizza', 'pthc', 'childrape',
  // Hard racial slurs
  'nigger', 'nigga', 'niglet', 'nigglet', 'niggr', 'sandnigger',
  'jigaboo', 'porchmonkey', 'tarbaby', 'wetback', 'beaner', 'kike',
  // Anti-LGBT / ableist
  'faggot', 'faggit', 'fagget', 'tranny', 'trannie', 'retarded',
  // Nazi / hate
  'heilhitler', 'siegheil', 'gaschamber', 'gasjews', 'killjews',
  'killallblacks', 'whitepower', 'lynchnig', 'hitler',
]

// Short/ambiguous - block only as a standalone token so we don't nuke
// grape / torpedo / raccoon / spicy / therapist / scunthorpe.
const BOUNDED_TOKENS: Set<string> = new Set([
  'rape', 'raper', 'rapist', 'pedo', 'coon', 'spic', 'gook', 'chink',
  'dyke', 'retard', 'nazi', 'kkk', 'incest', 'molest', 'cunt', 'sperg',
])

/**
 * Returns the offending term if the username contains banned content,
 * or null if clean. Use the returned term for server-side logging only -
 * never echo it back to the user.
 */
export function findBannedTerm(username: string): string | null {
  if (!username) return null

  const normalized = normalize(username)
  if (!normalized) return null

  // Tier 1: unambiguous substrings, matched against the normalized form.
  for (const term of HARD_SUBSTRINGS) {
    if (normalized.includes(term)) return term
  }

  // Tier 2: ambiguous short terms, matched only as whole tokens. Split
  // the ORIGINAL handle on anything that isn't a letter (digits, _, -,
  // ., spaces) so "x_rape_x" -> ['x','rape','x'] but "grape" -> ['grape'].
  // Also test the fully-normalized string so "rape" (no separators) and
  // leet "r4pe" still match as the whole token.
  const tokens = username.toLowerCase().split(/[^a-z]+/).filter(Boolean)
  for (const tok of tokens) {
    if (BOUNDED_TOKENS.has(normalize(tok))) return normalize(tok)
  }
  if (BOUNDED_TOKENS.has(normalized)) return normalized

  return null
}

/** Convenience boolean wrapper. */
export function isBannedUsername(username: string): boolean {
  return findBannedTerm(username) !== null
}
