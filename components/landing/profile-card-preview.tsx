import Link from 'next/link'
import { PLATFORM_ICON_PATHS, PLATFORMS, type PlatformChip } from '@/lib/landing/platforms'
import type { FeaturedProfile } from '@/lib/landing/featured-profiles'

const PLATFORM_LOOKUP = new Map<string, PlatformChip>(
  PLATFORMS.map((p) => [p.key, p])
)

/** Detects whether a URL points to a video file we can use as a card bg. */
function isVideoUrl(url: string | null): boolean {
  if (!url) return false
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || /mp4|webm/.test(url)
}

/**
 * Lightweight server-rendered preview of a profile.
 *
 * Mirrors the visual hierarchy of the real `/{username}` page (background,
 * avatar with decoration overlay, handle, tag, socials, ♪ indicator) without
 * pulling in the full interactive GunsProfile component. The whole card is
 * a Link to the live profile, so visitors click through and see the real
 * thing instead of a mockup.
 */
export function ProfileCardPreview({ profile }: { profile: FeaturedProfile }) {
  const bgIsVideo = isVideoUrl(profile.background_url)
  const bgImage = profile.background_url && !bgIsVideo ? profile.background_url : null
  // Trim Unicode "invisible name" hack so it doesn't render as a blank line
  const displayName =
    profile.display_name && profile.display_name.replace(/[​-‏﻿⁠­]|‎/g, '').trim()
      ? profile.display_name
      : profile.username

  return (
    <Link href={`/${profile.username}`} className="hp-card" aria-label={`open ${profile.username}'s profile`}>
      <div className="hp-card-bg" style={{ background: profile.background_color || '#0a0a0f' }}>
        {bgImage && (
          <div
            className="hp-card-bg-img"
            role="img"
            aria-label=""
            style={{ backgroundImage: `url("${bgImage.replace(/"/g, '%22')}")` }}
          />
        )}
        {bgIsVideo && profile.background_url && (
          <video
            className="hp-card-bg-img"
            src={profile.background_url}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
          />
        )}
        <div className="hp-card-bg-fade" />
      </div>

      <div className="hp-card-body">
        {/* Avatar removed on the landing page - the featured cards link to
            real profiles, and showing other users' faces here without
            explicit opt-in felt off. Background image still hints at the
            profile aesthetic. */}

        <div className="hp-card-handle">
          <span className="hp-card-handle-prefix">halo.rip/</span>
          <span className="hp-card-handle-name">{profile.username}</span>
        </div>

        {displayName && displayName !== profile.username && (
          <div className="hp-card-display">{displayName}</div>
        )}

        <div className="hp-card-tag">{profile.tag}</div>

        <div className="hp-card-meta">
          {profile.music_title && profile.music_title.trim() && profile.music_title.trim() !== '.' && (
            <span className="hp-card-music">♪ {profile.music_title.trim().slice(0, 28)}</span>
          )}
        </div>

        {profile.socials.length > 0 && (
          <div className="hp-card-socials">
            {profile.socials.slice(0, 5).map((s) => {
              const meta = PLATFORM_LOOKUP.get(s.platform)
              const path = PLATFORM_ICON_PATHS[s.platform]
              if (!path) return null
              return (
                <span
                  key={s.platform}
                  className="hp-card-social"
                  style={{ background: meta?.bg ?? 'rgba(255,255,255,0.06)' }}
                  title={meta?.label ?? s.platform}
                >
                  <svg viewBox="0 0 24 24" width="11" height="11" style={{ fill: meta?.color ?? '#fff', display: 'block' }}>
                    <path d={path} />
                  </svg>
                </span>
              )
            })}
            {profile.socials.length > 5 && (
              <span className="hp-card-social hp-card-social-more">+{profile.socials.length - 5}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
