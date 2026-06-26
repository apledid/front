"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  IconEye, IconPointer, IconTrendingUp, IconChartBar, IconWorld, IconLink as IconLinkIcon,
  IconDownload, IconClock, IconCalendar, IconDeviceDesktop, IconDeviceMobile, IconLoader2,
} from "@tabler/icons-react"

type Period = '3d' | '7d' | '30d' | '90d' | 'all'

interface AnalyticsResponse {
  period: Period
  totalViews: number
  totalClicks: number
  totalViewsAllTime: number
  totalClicksAllTime: number
  uniqueVisitors: number
  avgDaily: number
  clickRate: number
  viewsByDay: { date: string; views: number }[]
  hourly: number[]
  dayOfWeek: number[]
  deviceBreakdown: { label: string; value: number }[]
  browserBreakdown: { label: string; value: number }[]
  osBreakdown: { label: string; value: number }[]
  topCountries: { country: string; views: number; percentage: number }[]
  trafficSources: { source: string; visits: number; percentage: number }[]
  topLinks: { link_type: string; link_id: string | null; clicks: number }[]
  recentViews: { viewed_at: string; referrer: string | null; country: string | null }[]
}

const PERIODS: { value: Period; label: string }[] = [
  { value: '3d', label: 'Last 3 days' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

const DONUT_COLORS = ['#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#06b6d4', '#ef4444', '#8b5cf6']

function Donut({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground/70">No data</div>
  let offset = 0
  const r = 50, c = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90">
        {data.map((d, i) => {
          const len = (d.value / total) * c
          const seg = (
            <circle
              key={d.label}
              cx="70" cy="70" r={r}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth="18"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          )
          offset += len
          return seg
        })}
      </svg>
      <div className="flex-1 space-y-1.5">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-foreground-secondary">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              {d.label}
            </span>
            <span className="font-medium text-foreground">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LineChart({ data }: { data: { date: string; views: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.views))
  const w = 600, h = 180, pad = 20
  const single = data.length === 1
  const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0
  // A lone point (e.g. a brand-new profile with only today's data) gets
  // centered instead of stuck against the left edge.
  const xAt = (i: number) => (single ? w / 2 : pad + i * step)
  const yAt = (v: number) => h - pad - (v / max) * (h - pad * 2)
  const points = data.map((d, i) => `${xAt(i)},${yAt(d.views)}`).join(' ')
  const area = `${xAt(0)},${h - pad} ${points} ${xAt(data.length - 1)},${h - pad}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="viewsArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#e87fa0" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e87fa0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={area} fill="url(#viewsArea)" />
      <polyline points={points} fill="none" stroke="#e87fa0" strokeWidth="2" />
      {/* Point markers only on short ranges; 90d / all-time render as a clean
          line so we don't paint a dense blob of overlapping dots. */}
      {(single || data.length <= 31) && data.map((d, i) => (
        <circle key={i} cx={xAt(i)} cy={yAt(d.views)} r="3" fill="#e87fa0" />
      ))}
    </svg>
  )
}

function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values)
  return (
    <div className="flex h-40 items-end gap-1">
      {values.map((v, i) => (
        <div key={i} className="group flex flex-1 flex-col items-center gap-1.5">
          <div
            className="w-full rounded-t-md bg-primary transition-all group-hover:opacity-80"
            style={{ height: `${(v / max) * 140}px`, minHeight: v > 0 ? 4 : 2 }}
            title={`${labels[i]}: ${v}`}
          />
          <span className="text-[10px] text-muted-foreground/70">{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('all')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics?period=${period}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [period])

  const exportCsv = () => {
    if (!data) return
    const rows: string[] = []
    rows.push('section,key,value')
    rows.push(`stats,total_views,${data.totalViews}`)
    rows.push(`stats,total_clicks,${data.totalClicks}`)
    rows.push(`stats,click_rate,${data.clickRate}`)
    rows.push(`stats,avg_daily,${data.avgDaily}`)
    rows.push(`stats,unique_visitors,${data.uniqueVisitors}`)
    data.viewsByDay.forEach(d => rows.push(`views_by_day,${d.date},${d.views}`))
    data.topCountries.forEach(c => rows.push(`country,${c.country},${c.views}`))
    data.trafficSources.forEach(s => rows.push(`source,${s.source},${s.visits}`))
    data.topLinks.forEach(l => rows.push(`link,${l.link_type},${l.clicks}`))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `halo-analytics-${period}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const dayOfWeekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const hourLabels = useMemo(() => Array.from({ length: 24 }, (_, i) => `${i}`), [])

  if (loading || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <IconLoader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  // All four stat tiles use the same pink chrome - keeps the dashboard on
  // the site palette instead of looking like a generic Tailwind admin
  // template. Variation comes from the icon shape, not from accent color.
  const PINK_GRADIENT = 'bg-accent-soft'
  const PINK_ICON = 'text-primary'
  const stats = [
    { title: 'Profile Views', value: data.totalViews, icon: IconEye, color: PINK_GRADIENT, iconColor: PINK_ICON, sub: `${data.totalViewsAllTime.toLocaleString()} all time` },
    { title: 'Total Link Clicks', value: data.totalClicks, icon: IconPointer, color: PINK_GRADIENT, iconColor: PINK_ICON, sub: `${data.totalClicksAllTime.toLocaleString()} all time` },
    { title: 'Click Rate', value: `${data.clickRate}%`, icon: IconTrendingUp, color: PINK_GRADIENT, iconColor: PINK_ICON, sub: 'Clicks per view' },
    { title: 'Average Daily Views', value: data.avgDaily, icon: IconCalendar, color: PINK_GRADIENT, iconColor: PINK_ICON, sub: `${data.uniqueVisitors} unique visitors` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track your profile performance and audience insights</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-border bg-surface p-1">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${period === p.value ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground-secondary'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button onClick={exportCsv} variant="outline" className="h-9 rounded-xl text-xs">
            <IconDownload className="mr-2 size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => (
          <Card key={s.title} className="border-border bg-surface">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{s.title}</p>
                  <p className="mt-1 text-3xl font-bold text-foreground">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">{s.sub}</p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${s.color}`}>
                  <s.icon className={`size-6 ${s.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Profile Views + Visitor Devices */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-border bg-surface lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <IconChartBar className="size-5 text-primary" /> Profile Views
            </CardTitle>
            <CardDescription className="text-muted-foreground">Daily profile view trend</CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart data={data.viewsByDay} />
          </CardContent>
        </Card>
        <Card className="border-border bg-surface">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <IconDeviceDesktop className="size-5 text-primary" /> Visitor Devices
            </CardTitle>
            <CardDescription className="text-muted-foreground">Desktop vs mobile split</CardDescription>
          </CardHeader>
          <CardContent>
            <Donut data={data.deviceBreakdown} />
          </CardContent>
        </Card>
      </div>

      {/* Traffic Sources + Social Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-foreground">Traffic Sources</CardTitle>
            <CardDescription className="text-muted-foreground">Where visitors come from</CardDescription>
          </CardHeader>
          <CardContent>
            {data.trafficSources.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground/70">No traffic yet</p>
            ) : (
              <div className="space-y-2">
                {data.trafficSources.slice(0, 8).map(s => (
                  <div key={s.source} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                    <span className="text-sm text-foreground-secondary">{s.source}</span>
                    <span className="text-sm font-medium text-muted-foreground">{s.visits} · {s.percentage}%</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-foreground">Top Clicked Links</CardTitle>
            <CardDescription className="text-muted-foreground">Most popular links</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topLinks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-8">
                <IconLinkIcon className="mb-2 size-6 text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground/70">No link clicks yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.topLinks.map((l, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-xs font-bold text-primary">{i + 1}</span>
                      <span className="text-sm capitalize text-foreground-secondary">{l.link_type}</span>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{l.clicks} clicks</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Geographic Data */}
      <Card className="border-border bg-surface">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <IconWorld className="size-5 text-primary" /> Geographic Data
          </CardTitle>
          <CardDescription className="text-muted-foreground">Top countries and regional performance</CardDescription>
        </CardHeader>
        <CardContent>
          {data.topCountries.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground/70">No location data yet</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {data.topCountries.map((c, i) => (
                <div key={c.country} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-xs text-muted-foreground/70">#{i + 1}</span>
                    <span className="text-sm text-foreground-secondary">{c.country}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full bg-primary" style={{ width: `${c.percentage}%` }} />
                    </div>
                    <span className="w-16 text-right text-sm font-medium text-muted-foreground">{c.views} · {c.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hourly & Day patterns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <IconClock className="size-5 text-primary" /> Hourly Patterns
            </CardTitle>
            <CardDescription className="text-muted-foreground">Views by hour of day</CardDescription>
          </CardHeader>
          <CardContent>
            <Bars values={data.hourly} labels={hourLabels} />
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <IconCalendar className="size-5 text-primary" /> Day of Week Patterns
            </CardTitle>
            <CardDescription className="text-muted-foreground">Views by day of week</CardDescription>
          </CardHeader>
          <CardContent>
            <Bars values={data.dayOfWeek} labels={dayOfWeekLabels} />
          </CardContent>
        </Card>
      </div>

      {/* Browser + OS breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-foreground">Browser Breakdown</CardTitle>
            <CardDescription className="text-muted-foreground">Top browsers used by visitors</CardDescription>
          </CardHeader>
          <CardContent>
            <Donut data={data.browserBreakdown} />
          </CardContent>
        </Card>
        <Card className="border-border bg-surface">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-foreground">Operating System</CardTitle>
            <CardDescription className="text-muted-foreground">OS split across visitors</CardDescription>
          </CardHeader>
          <CardContent>
            <Donut data={data.osBreakdown} />
          </CardContent>
        </Card>
      </div>

      {/* Recent visitors */}
      <Card className="border-border bg-surface">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <IconDeviceMobile className="size-5 text-primary" /> Recent Visitors
          </CardTitle>
          <CardDescription className="text-muted-foreground">Last 20 profile views</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentViews.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground/70">No visitors yet</p>
          ) : (
            <div className="space-y-2">
              {data.recentViews.map((v, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{new Date(v.viewed_at).toLocaleString()}</span>
                  {v.country && <span className="text-muted-foreground">{v.country}</span>}
                  <span className="truncate text-muted-foreground/70 max-w-[200px]">{v.referrer || 'Direct'}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
