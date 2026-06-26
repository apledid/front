'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  IconChartBar,
  IconChevronDown,
  IconCrown,
  IconExternalLink,
  IconWorld,
  IconLayoutDashboard,
  IconLink,
  IconMail,
  IconPointer,
  IconLayoutGrid,
  IconStack2,
  IconSettings,
  IconWand,
  IconSticker,
  IconX,
  IconAward,
} from '@tabler/icons-react'

import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types'
import { PremiumBadge } from '@/components/ui/premium-lock'

interface DashboardSidebarProps {
  profile: Profile
}

type IconCmp = React.ComponentType<{ className?: string }>

type ChildItem = {
  href: string
  label: string
  icon: IconCmp
  /** Adds a PRO pill next to the label when the viewer isn't premium. */
  premium?: boolean
}

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="h-7 w-auto" />
      <span className="font-display text-lg font-semibold tracking-tight">
        <span className="text-foreground">halo</span>
        <span className="text-primary">.rip</span>
      </span>
    </Link>
  )
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  child = false,
  onClick,
  showPremiumBadge = false,
}: {
  href: string
  label: string
  icon: IconCmp
  active: boolean
  child?: boolean
  onClick?: () => void
  showPremiumBadge?: boolean
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
        child && 'ml-3 text-[12px]',
        active
          ? 'bg-white/[0.06] text-foreground'
          : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground-secondary',
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-primary"
        />
      ) : null}
      <Icon
        className={cn(
          'size-4 shrink-0',
          active ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground-secondary',
        )}
      />
      <span className="truncate">{label}</span>
      {showPremiumBadge ? (
        <span className="ml-auto">
          <PremiumBadge />
        </span>
      ) : null}
    </Link>
  )
}

function GroupRow({
  href,
  label,
  icon: Icon,
  active,
  open,
  onToggle,
}: {
  href: string
  label: string
  icon: IconCmp
  active: boolean
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Link
        href={href}
        className={cn(
          'group relative flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
          active
            ? 'bg-white/[0.06] text-foreground'
            : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground-secondary',
        )}
      >
        {active ? (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-primary"
          />
        ) : null}
        <Icon
          className={cn(
            'size-4 shrink-0',
            active ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground-secondary',
          )}
        />
        <span className="truncate">{label}</span>
      </Link>
      <button
        type="button"
        onClick={onToggle}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-white/[0.03] hover:text-foreground-secondary"
        aria-label={`Toggle ${label} items`}
      >
        <IconChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
    </div>
  )
}

function useNavModel(profile: Profile) {
  const overviewChildren: ChildItem[] = useMemo(
    () => [
      { href: '/dashboard/customize', icon: IconWand, label: 'Customize' },
      { href: '/dashboard/decoration', icon: IconSticker, label: 'Decoration' },
      { href: '/dashboard/metadata', icon: IconWorld, label: 'Profile Metadata', premium: true },
      { href: '/dashboard/premium', icon: IconCrown, label: 'Premium' },
    ],
    [],
  )
  const toolItems: ChildItem[] = useMemo(
    () => [
      { href: '/dashboard/links', icon: IconLink, label: 'Links' },
      { href: '/dashboard/buttons', icon: IconPointer, label: 'Buttons' },
      { href: '/dashboard/badges', icon: IconAward, label: 'Badges' },
      { href: '/dashboard/widgets', icon: IconLayoutGrid, label: 'Widgets' },
      { href: '/dashboard/templates', icon: IconStack2, label: 'Templates' },
      { href: '/dashboard/analytics', icon: IconChartBar, label: 'Analytics' },
    ],
    [],
  )
  const settingsChildren: ChildItem[] = useMemo(
    () => [{ href: '/dashboard/inbox', icon: IconMail, label: 'Inbox' }],
    [],
  )
  return { overviewChildren, toolItems, settingsChildren, isPremium: profile.premium_active === true }
}

function ViewProfileButton({
  username,
  onClick,
}: {
  username?: string | null
  onClick?: () => void
}) {
  return (
    <Link
      href={`/${username || 'user'}`}
      target="_blank"
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-accent-soft px-4 py-2.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary/15"
    >
      <IconExternalLink className="size-3.5" />
      View profile
    </Link>
  )
}

export function DashboardSidebar({ profile }: DashboardSidebarProps) {
  const pathname = usePathname()
  const [overviewOpen, setOverviewOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(true)
  const { overviewChildren, toolItems, settingsChildren, isPremium } = useNavModel(profile)

  const overviewActive =
    pathname === '/dashboard' || overviewChildren.some((item) => pathname.startsWith(item.href))
  const settingsActive =
    pathname.startsWith('/dashboard/settings') ||
    settingsChildren.some((item) => pathname.startsWith(item.href))

  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[270px] flex-col border-r border-border bg-background lg:flex">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Wordmark />
      </div>

      <nav className="flex-1 space-y-2 overflow-y-hidden p-3 pt-3">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
          Menu
        </p>

        <div className="space-y-1">
          <GroupRow
            href="/dashboard"
            label="Overview"
            icon={IconLayoutDashboard}
            active={overviewActive}
            open={overviewOpen}
            onToggle={() => setOverviewOpen((value) => !value)}
          />
          {overviewOpen
            ? overviewChildren.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={pathname.startsWith(item.href)}
                  child
                  showPremiumBadge={item.premium && !isPremium}
                />
              ))
            : null}
        </div>

        <div className="space-y-1">
          {toolItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={pathname.startsWith(item.href)}
              showPremiumBadge={item.premium && !isPremium}
            />
          ))}
        </div>

        <div className="space-y-1">
          <GroupRow
            href="/dashboard/settings"
            label="Settings"
            icon={IconSettings}
            active={settingsActive}
            open={settingsOpen}
            onToggle={() => setSettingsOpen((value) => !value)}
          />
          {settingsOpen
            ? settingsChildren.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={pathname.startsWith(item.href)}
                  child
                />
              ))
            : null}
        </div>
      </nav>

      <div className="border-t border-border p-3">
        <ViewProfileButton username={profile.username} />
      </div>
    </aside>
  )
}

interface MobileSidebarProps {
  profile: DashboardSidebarProps['profile']
  isOpen: boolean
  onClose: () => void
}

export function MobileSidebar({ profile, isOpen, onClose }: MobileSidebarProps) {
  const pathname = usePathname()
  const [overviewOpen, setOverviewOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(true)
  const { overviewChildren, toolItems, settingsChildren, isPremium } = useNavModel(profile)

  const overviewActive =
    pathname === '/dashboard' || overviewChildren.some((item) => pathname.startsWith(item.href))
  const settingsActive =
    pathname.startsWith('/dashboard/settings') ||
    settingsChildren.some((item) => pathname.startsWith(item.href))

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-border bg-background transition-transform duration-300 lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <Wordmark />
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-white/[0.04] hover:text-foreground-secondary"
            aria-label="Close menu"
          >
            <IconX className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto p-3 pt-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
            Menu
          </p>

          <div className="space-y-1">
            <GroupRow
              href="/dashboard"
              label="Overview"
              icon={IconLayoutDashboard}
              active={overviewActive}
              open={overviewOpen}
              onToggle={() => setOverviewOpen((v) => !v)}
            />
            {overviewOpen &&
              overviewChildren.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={pathname.startsWith(item.href)}
                  child
                  onClick={onClose}
                  showPremiumBadge={item.premium && !isPremium}
                />
              ))}
          </div>

          <div className="space-y-1">
            {toolItems.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={pathname.startsWith(item.href)}
                onClick={onClose}
                showPremiumBadge={item.premium && !isPremium}
              />
            ))}
          </div>

          <div className="space-y-1">
            <GroupRow
              href="/dashboard/settings"
              label="Settings"
              icon={IconSettings}
              active={settingsActive}
              open={settingsOpen}
              onToggle={() => setSettingsOpen((v) => !v)}
            />
            {settingsOpen &&
              settingsChildren.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={pathname.startsWith(item.href)}
                  child
                  onClick={onClose}
                />
              ))}
          </div>
        </nav>

        <div className="border-t border-border p-3">
          <ViewProfileButton username={profile.username} onClick={onClose} />
        </div>
      </aside>
    </>
  )
}
