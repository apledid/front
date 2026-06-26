'use client'

import type { CSSProperties, ReactNode } from 'react'
import { decorationUrl as avatarDecorationUrl } from '@/lib/avatar-decoration-url'

/**
 * Avatar with optional decoration overlay. Mirrors Discord's render: when a
 * decoration is present the avatar is shrunk to ~82% (centered with 9% inset)
 * within a fixed bounding box and the decoration fills the full 100% box on
 * top. With no decoration, the avatar fills the box normally.
 */
export function AvatarWithDecoration({
  size,
  decorationSlug,
  avatarShapeStyle,
  ringStyle,
  children,
}: {
  size: number
  decorationSlug: string | null | undefined
  avatarShapeStyle: CSSProperties
  // Optional outline/glow ring (a box-shadow) drawn around the avatar.
  // Box-shadow renders outside the element and is NOT clipped by the
  // avatar's own overflow:hidden, so the ring shows even on the cropped
  // circle. Gated to @rez by the caller.
  ringStyle?: CSSProperties
  children: ReactNode
}) {
  if (!decorationSlug) {
    return (
      <div
        className="relative overflow-hidden rounded-full"
        style={{ width: size, height: size, ...avatarShapeStyle, ...ringStyle }}
      >
        {children}
      </div>
    )
  }
  // Discord avatar-decoration assets are designed with the avatar at ~82%
  // of the full asset, so scaling the decoration to 1/0.82 (~1.22x) makes
  // its transparent inner circle line up exactly with the avatar's outer
  // edge - regardless of the avatar shape (circle / soft / squircle /
  // rounded / square). Avatar itself stays at 100% of its native size.
  const outerSize = Math.round(size / 0.82)
  const offset = Math.round((outerSize - size) / 2)
  return (
    <div
      className="relative"
      style={{ width: outerSize, height: outerSize, marginLeft: -offset, marginTop: -offset }}
    >
      <div
        className="absolute overflow-hidden rounded-full"
        style={{
          width: size,
          height: size,
          left: offset,
          top: offset,
          ...avatarShapeStyle,
          ...ringStyle,
        }}
      >
        {children}
      </div>
      <img
        src={avatarDecorationUrl(decorationSlug, 240)}
        alt=""
        aria-hidden
        decoding="async"
        loading="lazy"
        className="pointer-events-none absolute inset-0"
        style={{ width: outerSize, height: outerSize }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    </div>
  )
}
