'use client'

/**
 * REZ-ONLY dashboard overview (haunt.gg-style).
 *
 * Gated in app/dashboard/page.tsx to profile.username === 'rez'. Everyone
 * else still gets the original overview. This is a presentation-only change
 * (it shows the same per-user analytics the /dashboard/analytics page already
 * exposes), so the single page-level gate is the whole story - when this goes
 * public, drop the gate in page.tsx and render this for everyone.
 *
 * Wired entirely to data halo already tracks via /api/analytics. Sections
 * haunt has but halo has no data model for (projects, comments, feedback) are
 * intentionally omitted rather than faked with dead empty states.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  IconAt, IconHash, IconEye, IconPointer, IconWorld, IconExternalLink,
  IconLink as LinkIcon, IconTrendingUp, IconLoader2,
} from '@tabler/icons-react'
import { SocialIcon } from '@/components/profile/social-icon'

type Period = '3d' | '7d' | '30d' | '90d'

interface Analytics {
  totalViews: number
  totalClicks: number
  totalViewsAllTime: number
  totalClicksAllTime: number
  uniqueVisitors: number
  avgDaily: number
  clickRate: number
  viewsByDay: { date: string; views: number }[]
  deviceBreakdown: { label: string; value: number }[]
  topCountries: { country: string; views: number; percentage: number }[]
  trafficSources: { source: string; visits: number; percentage: number }[]
  topLinks: { link_type: string; link_id: string | null; clicks: number; name: string; platform: string | null; url: string | null }[]
  recentViews: { viewed_at: string; referrer: string | null; country: string | null }[]
}

const PERIODS: { value: Period; label: string }[] = [
  { value: '3d', label: '3D' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
]

const PINK = '#e87fa0'
const DONUT = ['#e87fa0', '#f4abc6', '#bd5c7d', '#ffb3d2', '#8c4a64']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Shared card chrome. Near-black surface a hair lighter than the page (#030306)
// with a hairline rim - matches the haunt look without piling on gradients.
const CARD = 'rounded-2xl border border-border bg-surface'

function fmtDate(d: string) {
  const parts = d.split('-')
  if (parts.length !== 3) return d
  return `${MONTHS[Number(parts[1]) - 1]} ${Number(parts[2])}`
}

/** Section card with a title + optional description and right-slot. */
function Panel({
  title, description, right, children, className = '',
}: {
  title: string; description?: string; right?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`${CARD} p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

/** Top stat tile: muted label + icon on top, big value below (haunt layout). */
function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof IconEye }) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-3 truncate text-2xl font-bold text-foreground sm:text-[1.7rem]">{value}</p>
    </div>
  )
}

/** Smooth pink area chart with faint gridlines + date axis. */
function AreaChart({ data }: { data: { date: string; views: number }[] }) {
  if (!data || data.length === 0) {
    return <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground">No view data yet</div>
  }
  const max = Math.max(1, ...data.map(d => d.views))
  const w = 760, h = 240, padL = 30, padR = 14, padT = 18, padB = 30
  const n = data.length
  const xAt = (i: number) => (n > 1 ? padL + (i * (w - padL - padR)) / (n - 1) : w / 2)
  const yAt = (v: number) => padT + (1 - v / max) * (h - padT - padB)
  const linePts = data.map((d, i) => `${xAt(i)},${yAt(d.views)}`).join(' ')
  const areaPts = `${xAt(0)},${h - padB} ${linePts} ${xAt(n - 1)},${h - padB}`
  // 3 horizontal gridlines (0, mid, max) and their value labels.
  const ticks = [0, Math.round(max / 2), max]
  // ~5 evenly spaced x labels so they never crowd.
  const labelEvery = Math.max(1, Math.ceil(n / 5))
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 'auto' }}>
      <defs>
        <linearGradient id="rezViewsArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={PINK} stopOpacity="0.32" />
          <stop offset="100%" stopColor={PINK} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => {
        const y = yAt(t)
        return (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={0} y={y + 3} fill="rgba(255,255,255,0.28)" fontSize="10">{t}</text>
          </g>
        )
      })}
      <polygon points={areaPts} fill="url(#rezViewsArea)" />
      <polyline points={linePts} fill="none" stroke={PINK} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {n <= 31 && data.map((d, i) => (
        <circle key={i} cx={xAt(i)} cy={yAt(d.views)} r="2.6" fill={PINK} />
      ))}
      {data.map((d, i) => (i % labelEvery === 0 || i === n - 1) ? (
        <text key={`l${i}`} x={xAt(i)} y={h - 8} fill="rgba(255,255,255,0.3)" fontSize="10" textAnchor="middle">{fmtDate(d.date)}</text>
      ) : null)}
    </svg>
  )
}

/** Thick pink donut with legend, matching the haunt devices widget. */
function Donut({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">No data yet</div>
  const r = 52, c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="flex flex-col items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90">
        {data.map((d, i) => {
          const len = (d.value / total) * c
          const seg = (
            <circle
              key={d.label}
              cx="70" cy="70" r={r}
              fill="none"
              stroke={DONUT[i % DONUT.length]}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}`}
              strokeDashoffset={-offset}
            />
          )
          offset += len
          return seg
        })}
      </svg>
      <div className="w-full space-y-2">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-foreground-secondary">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: DONUT[i % DONUT.length] }} />
              {d.label}
            </span>
            <span className="font-medium text-foreground-secondary">{d.value} ({Math.round((d.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Labelled progress row used by countries + sources. */
function BarRow({ label, hint, value, pct }: { label: string; hint?: string; value: string; pct: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate text-foreground-secondary">
          {label}{hint ? <span className="ml-1.5 text-muted-foreground">{hint}</span> : null}
        </span>
        <span className="shrink-0 font-medium text-muted-foreground">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: PINK }} />
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, sub }: { icon: typeof IconEye; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
      <Icon className="mb-2 size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

export function RezOverview({
  username, displayName, uidDisplay, viewCount, profileUrl, profilePath,
}: {
  username: string; displayName: string; uidDisplay: string; viewCount: number; profileUrl: string; profilePath: string
}) {
  const [period, setPeriod] = useState<Period>('7d')
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/analytics?period=${period}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [period])

  const copyUrl = () => {
    navigator.clipboard.writeText(profileUrl).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }).catch(() => undefined)
  }

  const clicksValue = data ? data.totalClicksAllTime.toLocaleString() : '-'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s a quick look at your halo.rip page.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyUrl}
            className="rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-medium text-foreground-secondary transition hover:bg-white/[0.06] hover:text-foreground"
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <Link
            href={profilePath}
            target="_blank"
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
          >
            <IconExternalLink className="size-3.5" /> View profile
          </Link>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Username" value={username} icon={IconAt} />
        <Stat label="UID" value={uidDisplay} icon={IconHash} />
        <Stat label="Profile views" value={viewCount.toLocaleString()} icon={IconEye} />
        <Stat label="Link clicks" value={clicksValue} icon={IconPointer} />
      </div>

      {/* Views chart + devices */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <Panel
          title="Profile views"
          description="Views over the selected range."
          className="lg:col-span-2"
          right={
            <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${period === p.value ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground-secondary'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          }
        >
          {loading && !data ? (
            <div className="flex h-[240px] items-center justify-center"><IconLoader2 className="size-6 animate-spin text-primary" /></div>
          ) : (
            <AreaChart data={data?.viewsByDay ?? []} />
          )}
        </Panel>

        <Panel title="Devices" description="How visitors break down by device type.">
          {loading && !data ? (
            <div className="flex h-44 items-center justify-center"><IconLoader2 className="size-6 animate-spin text-primary" /></div>
          ) : (
            <Donut data={data?.deviceBreakdown ?? []} />
          )}
        </Panel>
      </div>

      {/* Countries */}
      <Panel
        title="Top countries"
        description="Where your visitors are coming from in the selected range."
        right={<span className="flex items-center gap-1.5 text-xs text-muted-foreground"><IconWorld className="size-3.5" /> {data?.topCountries.length ?? 0} countries</span>}
      >
        {!data || data.topCountries.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No location data yet.</p>
        ) : (
          <div className="space-y-3">
            {data.topCountries.slice(0, 6).map(c => (
              <BarRow key={c.country} label={c.country} value={`${c.views} (${c.percentage}%)`} pct={c.percentage} />
            ))}
          </div>
        )}
      </Panel>

      {/* Sources + links */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Panel title="Top sources" description="Which path or domain visitors used to reach your page.">
          {!data || data.trafficSources.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No traffic yet.</p>
          ) : (
            <div className="space-y-3">
              {data.trafficSources.slice(0, 6).map(s => (
                <BarRow key={s.source} label={s.source} value={`${s.visits} (${s.percentage}%)`} pct={s.percentage} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Top links" description="Your most-clicked links in the selected range.">
          {!data || data.topLinks.length === 0 ? (
            <EmptyState icon={LinkIcon} title="No link clicks tracked yet." sub="Add links to your page and watch the clicks roll in." />
          ) : (
            <div className="space-y-2">
              {data.topLinks.slice(0, 6).map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-foreground-secondary">
                      {l.platform ? <SocialIcon platform={l.platform} className="size-4" /> : <LinkIcon className="size-4" />}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground-secondary">{l.name}</span>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-muted-foreground">{l.clicks} clicks</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Recent visitors (halo's analogue to haunt's recent comments/feedback) */}
      <Panel title="Recent visitors" description="Your last profile views.">
        {!data || data.recentViews.length === 0 ? (
          <EmptyState icon={IconTrendingUp} title="No visitors yet." sub="Share your profile and they'll show up here." />
        ) : (
          <div className="space-y-2">
            {data.recentViews.slice(0, 8).map((v, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs">
                <span className="text-foreground-secondary">{new Date(v.viewed_at).toLocaleString()}</span>
                <div className="flex items-center gap-3">
                  {v.country ? <span className="text-muted-foreground">{v.country}</span> : null}
                  <span className="max-w-[220px] truncate text-muted-foreground">{v.referrer || 'Direct'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
