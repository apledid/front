import type { MetadataRoute } from 'next'

/**
 * Sitemap - marketing / static pages only.
 *
 * We deliberately do NOT enumerate individual user profiles. Auto-dumping
 * every handle to search engines is a privacy problem (users never opt into
 * being indexed) and exposes sensitive usernames sitewide. Profiles are still
 * reachable and individually indexable when someone shares them - we just
 * don't hand the entire user table to crawlers and recon tools.
 *
 * If we ever want a curated subset for SEO (e.g. the top leaderboard
 * profiles), add them here explicitly rather than listing everyone.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://halo.rip'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`,            changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/pricing`,     changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/leaderboard`, changeFrequency: 'daily',   priority: 0.5 },
    { url: `${BASE}/login`,       changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/signup`,      changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/privacy`,     changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${BASE}/tos`,         changeFrequency: 'yearly',  priority: 0.2 },
  ]
}
