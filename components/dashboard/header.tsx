"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { IconBell, IconLogout, IconUser, IconSettings, IconChevronDown, IconMenu2 } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Profile } from "@/lib/types"

interface DashboardHeaderProps {
  profile: Profile
  onMenuClick?: () => void
}

export function DashboardHeader({ profile, onMenuClick }: DashboardHeaderProps) {
  const router = useRouter()
  
  const handleLogout = async () => {
    // halo.rip uses custom session cookies (set by /api/auth/login/verify
    // and friends), NOT Supabase Auth. Calling supabase.auth.signOut()
    // here was leftover from an old auth model: it cleared a session
    // that didn't exist, so the actual halo session_token cookie was
    // never deleted and the user stayed logged in after clicking
    // "Sign Out". Hit the real logout endpoint, then hard-navigate so
    // the server picks up the cookie deletion.
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    } catch {
      // Even if the request fails (network blip), still try to bounce
      // the user out of the dashboard - the cookie will be retried/
      // invalidated on the next request.
    }
    window.location.href = "/"
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      {/* Mobile: Hamburger + Logo */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          onClick={onMenuClick}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-surface-2 hover:text-foreground-secondary transition-colors"
        >
          <IconMenu2 className="size-5" />
        </button>
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-6 w-auto" />
          <span className="font-['Syne'] text-base font-extrabold tracking-tight">
            <span className="text-foreground">halo</span>
            <span className="text-muted-foreground">.</span>
            <span className="text-primary">rip</span>
          </span>
        </Link>
      </div>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl hover:bg-surface-2 border-0">
          <Link href="/dashboard/inbox">
            <IconBell className="size-4 text-muted-foreground" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2 rounded-xl hover:bg-surface-2 border-0">
              <Avatar className="h-7 w-7 border border-border">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-accent-soft text-primary text-xs font-medium">
                  {profile.display_name?.[0]?.toUpperCase() || profile.username?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-[13px] font-medium text-foreground-secondary md:block">
                {profile.display_name || profile.username || 'User'}
              </span>
              <IconChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl bg-surface-2/95 backdrop-blur-xl border-border">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-foreground">{profile.display_name || profile.username || 'User'}</p>
              <p className="text-xs text-muted-foreground">@{profile.username || 'user'}</p>
            </div>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem asChild className="rounded-lg text-foreground-secondary focus:bg-surface-3 focus:text-foreground">
              <Link href="/dashboard/customize" className="flex items-center">
                <IconUser className="mr-2 size-3.5" /> Edit Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-lg text-foreground-secondary focus:bg-surface-3 focus:text-foreground">
              <Link href="/dashboard/settings" className="flex items-center">
                <IconSettings className="mr-2 size-3.5" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem onClick={handleLogout} className="rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive">
              <IconLogout className="mr-2 size-3.5" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
