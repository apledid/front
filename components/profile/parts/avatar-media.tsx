'use client'

import type { ReactNode } from 'react'

// Avatars can be images OR short videos (users upload .mp4/.webm/.gif-as-video
// pfps). An <img> can't play a video, so a video avatar rendered as <img> just
// fails and leaves an empty circle. Detect video by extension and render a
// muted, looping, inline <video> instead.
const VIDEO_RE = /\.(mp4|webm|ogv|ogg|mov|m4v)(?:$|[?#&%])/i

export function isVideoAvatar(src: string | null | undefined): boolean {
  return !!src && VIDEO_RE.test(src)
}

/**
 * Renders an avatar source as a <video> when it's a video file, otherwise an
 * <img>. Falls back to `fallback` (e.g. the initial-letter tile) when there's
 * no src. Both branches hide themselves on load error so a dead URL collapses
 * to nothing rather than showing a broken-media icon.
 */
export function AvatarMedia({
  src,
  className = 'h-full w-full object-cover',
  fallback = null,
}: {
  src: string | null | undefined
  className?: string
  fallback?: ReactNode
}) {
  if (!src) return <>{fallback}</>

  if (isVideoAvatar(src)) {
    return (
      <video
        src={src}
        className={className}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        onError={(e) => {
          ;(e.currentTarget as HTMLVideoElement).style.display = 'none'
        }}
      />
    )
  }

  return (
    <img
      decoding="async"
      src={src}
      alt=""
      className={className}
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}
