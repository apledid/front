// Owner-only crypto badges. The badges aren't in the DB - they're
// synthesized client-side at profile-render time, so they can't be
// detached or claimed by other users.
//
// Add usernames + their allowed crypto slugs here. The visual rendering
// for each slug lives in `BadgeIcon` inside guns-profile.tsx and the
// dashboard's badges/client.tsx.

export type CryptoSlug = 'btc' | 'eth' | 'usdt' | 'ltc'

export interface CryptoBadgeDef {
  slug: CryptoSlug
  name: string
  description: string
  color: string
}

export const CRYPTO_BADGE_DEFS: Record<CryptoSlug, CryptoBadgeDef> = {
  btc:  { slug: 'btc',  name: 'Bitcoin',  description: 'BTC accepted',  color: '#F7931A' },
  eth:  { slug: 'eth',  name: 'Ethereum', description: 'ETH accepted',  color: '#627EEA' },
  usdt: { slug: 'usdt', name: 'Tether',   description: 'USDT accepted', color: '#26A17B' },
  ltc:  { slug: 'ltc',  name: 'Litecoin', description: 'LTC accepted',  color: '#345D9D' },
}

const CORE_THREE: CryptoSlug[] = ['btc', 'eth', 'usdt']

// username (lowercased) → list of slugs they get
const USER_CRYPTO_BADGES: Record<string, CryptoSlug[]> = {
  rez: ['btc', 'eth', 'usdt', 'ltc'],
  fuck: CORE_THREE,
  balenciaga: CORE_THREE,
  murder: CORE_THREE,
  pain: CORE_THREE,
  emo: CORE_THREE,
  liar: CORE_THREE,
  '+_+': ['eth'],
}

export function getCryptoBadgesForUser(username: string | null | undefined): CryptoBadgeDef[] {
  const u = (username || '').toLowerCase()
  const slugs = USER_CRYPTO_BADGES[u]
  if (!slugs) return []
  return slugs.map((s) => CRYPTO_BADGE_DEFS[s])
}

export function userHasCryptoBadges(username: string | null | undefined): boolean {
  const u = (username || '').toLowerCase()
  return u in USER_CRYPTO_BADGES
}
