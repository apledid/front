/**
 * Profile of the Day card for the landing page.
 *
 * Server component - calls `getFeaturedProfile()` directly so the
 * landing-page render is one DB round-trip, not an HTTP self-fetch.
 *
 * Returns null when no profile can be picked (brand-new install
 * with empty `page_views` and zero existing profiles). The landing
 * page already wraps this in a section, so the section just
 * collapses gracefully.
 */

import Link from 'next/link'
import { Eye } from 'lucide-react'
import { getFeaturedProfile } from '@/lib/featured-profile'

export async function FeaturedProfile() {
  const profile = await getFeaturedProfile()
  if (!profile || !profile.username) return null

  const displayName =
    profile.display_name && profile.display_name.trim() ? profile.display_name : profile.username
  const accent = profile.accent_color || '#e87fa0'
  const initial = (displayName || '?')[0]?.toUpperCase() ?? '?'

  return (
    <Link
      href={`/${profile.username}`}
      className="hp-potd-card"
      aria-label={`open ${profile.username}'s profile, today's featured profile`}
      style={{ '--potd-accent': accent } as React.CSSProperties}
    >
      <div className="hp-potd-avatar">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="hp-potd-avatar-img"
          />
        ) : (
          <span className="hp-potd-avatar-fallback" aria-hidden>{initial}</span>
        )}
      </div>
      <div className="hp-potd-meta">
        <span className="hp-potd-handle">@{profile.username}</span>
        {displayName !== profile.username && (
          <span className="hp-potd-name">{displayName}</span>
        )}
        <span className="hp-potd-views">
          <Eye className="hp-potd-views-icon" aria-hidden />
          {(profile.view_count ?? 0).toLocaleString()} views
        </span>
      </div>
      <span className="hp-potd-cta">view profile <span aria-hidden>→</span></span>
    </Link>
  )
}
