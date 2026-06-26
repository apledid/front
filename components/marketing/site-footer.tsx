import Link from 'next/link'
import { IconBrandDiscord } from '@tabler/icons-react'

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: 'product',
    links: [
      { label: 'features', href: '/#features' },
      { label: 'premium', href: '/pricing' },
      { label: 'leaderboard', href: '/leaderboard' },
      { label: 'demo profile', href: '/rez' },
    ],
  },
  {
    title: 'community',
    links: [
      { label: 'discord', href: 'https://discord.gg/NgVh45gXbD', external: true },
      { label: 'sign in', href: '/login' },
      { label: 'claim handle', href: '/signup' },
    ],
  },
  {
    title: 'legal',
    links: [
      { label: 'privacy', href: '/privacy' },
      { label: 'terms', href: '/tos' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="ds-container py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="h-7 w-auto" />
              <span className="font-display text-lg font-semibold tracking-tight">
                <span className="text-foreground">halo</span>
                <span className="text-primary">.rip</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-foreground-secondary">
              One link for your whole internet. Music, video, live status, and
              600+ decorations.
            </p>
            <a
              href="https://discord.gg/NgVh45gXbD"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground"
            >
              <IconBrandDiscord className="size-[18px]" />
              Join the Discord
            </a>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-eyebrow uppercase text-muted-foreground">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-foreground-secondary transition-colors hover:text-foreground"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        className="text-sm text-foreground-secondary transition-colors hover:text-foreground"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2024 halo.rip - made in the Discord.</p>
          <p>
            built by <span className="text-foreground-secondary">rez</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
