'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { IconMenu2, IconX } from '@tabler/icons-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const NAV_LINKS = [
  { label: 'features', href: '/#features' },
  { label: 'pricing', href: '/pricing' },
  { label: 'leaderboard', href: '/leaderboard' },
  { label: 'discord', href: 'https://discord.gg/NgVh45gXbD', external: true },
]

function Wordmark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2"
      aria-label="halo.rip home"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="h-7 w-auto" />
      <span className="font-display text-lg font-semibold tracking-tight">
        <span className="text-foreground">halo</span>
        <span className="text-primary">.rip</span>
      </span>
    </Link>
  )
}

export function SiteNav({ username }: { username?: string | null }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-colors duration-300',
        scrolled || open
          ? 'border-border bg-background/80 backdrop-blur-xl'
          : 'border-transparent bg-transparent',
      )}
    >
      <nav className="ds-container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-7">
          <Wordmark />
          <ul className="hidden items-center gap-0.5 md:flex">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                {l.external ? (
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg px-3 py-2 text-sm text-foreground-secondary transition-colors hover:bg-white/[0.04] hover:text-foreground"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    href={l.href}
                    className="rounded-lg px-3 py-2 text-sm text-foreground-secondary transition-colors hover:bg-white/[0.04] hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {username ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">dashboard</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/${username}`}>my profile</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">claim handle</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex size-9 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-white/[0.05] hover:text-foreground md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <IconX className="size-5" /> : <IconMenu2 className="size-5" />}
        </button>
      </nav>

      {open ? (
        <div className="border-t border-border md:hidden">
          <div className="ds-container flex flex-col gap-1 py-4">
            {NAV_LINKS.map((l) =>
              l.external ? (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-foreground-secondary transition-colors hover:bg-white/[0.04] hover:text-foreground"
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-foreground-secondary transition-colors hover:bg-white/[0.04] hover:text-foreground"
                >
                  {l.label}
                </Link>
              ),
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {username ? (
                <>
                  <Button asChild variant="secondary">
                    <Link href="/dashboard" onClick={() => setOpen(false)}>
                      dashboard
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href={`/${username}`} onClick={() => setOpen(false)}>
                      my profile
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="secondary">
                    <Link href="/login" onClick={() => setOpen(false)}>
                      sign in
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/signup" onClick={() => setOpen(false)}>
                      claim handle
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
