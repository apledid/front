import Link from 'next/link'
import { IconArrowLeft } from '@tabler/icons-react'
import { getCurrentProfileSummary } from '@/lib/current-profile'
import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'
import { getLeaderboards, type LeaderboardRange } from '@/lib/leaderboard'
import LeaderboardTabs from './leaderboard-tabs'

// Dynamic: the page reads the session cookie for the nav, and all three ranges
// come from one snapshot computed live per request (see lib/leaderboard). We do
// NOT cache the page per `?range=` anymore - doing so froze the weekly and
// monthly tabs at different times, which is how "weekly > monthly" appeared.
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ range?: string }>
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const initialRange: LeaderboardRange =
    sp.range === 'month' || sp.range === 'week' ? sp.range : 'all'

  const [me, boards] = await Promise.all([
    getCurrentProfileSummary(),
    getLeaderboards(),
  ])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav username={me?.username ?? null} />

      <main className="ds-container py-16 sm:py-20">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <IconArrowLeft className="size-4" />
          <span>back home</span>
        </Link>

        <div className="mt-8 max-w-2xl">
          <p className="text-eyebrow uppercase text-primary/80">leaderboard</p>
          <h1 className="mt-3 text-h1 font-display">top 50 profiles.</h1>
          <p className="mt-3 text-base leading-relaxed text-foreground-secondary">
            ranked by views. updates live.
          </p>
        </div>

        <div className="mt-10">
          <LeaderboardTabs boards={boards} initialRange={initialRange} />
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          views are deduplicated per visitor · weekly and monthly share one snapshot
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}
