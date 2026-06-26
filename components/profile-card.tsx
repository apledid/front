"use client"

import { useState } from "react"
import Image from "next/image"

interface ProfileCardProps {
  username: string
  displayName: string
  bio: string
  avatarUrl: string
  status?: "online" | "idle" | "dnd" | "offline"
}

export function ProfileCard({
  username,
  displayName,
  bio,
  avatarUrl,
  status = "online",
}: ProfileCardProps) {
  const [imageError, setImageError] = useState(false)

  const statusColors = {
    online: "bg-emerald-500",
    idle: "bg-amber-500",
    dnd: "bg-red-500",
    offline: "bg-gray-500",
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar with status indicator */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-accent/50 rounded-full blur-md opacity-75 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative w-28 h-28 rounded-full overflow-hidden ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
          {!imageError ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <span className="text-3xl font-bold text-foreground">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        {/* Status indicator */}
        <div
          className={`absolute bottom-1 right-1 w-5 h-5 ${statusColors[status]} rounded-full border-4 border-background`}
        />
      </div>

      {/* Name and Bio */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {displayName}
        </h1>
        <p className="text-sm font-mono text-muted-foreground">@{username}</p>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          {bio}
        </p>
      </div>

      {/* View counter */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span>1,234 views</span>
      </div>
    </div>
  )
}
