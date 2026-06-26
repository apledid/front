'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { IconWorld } from '@tabler/icons-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const COUNTRY_FLAGS: Record<string, string> = {
  'United States': '🇺🇸',
  'United Kingdom': '🇬🇧',
  'Canada': '🇨🇦',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Japan': '🇯🇵',
  'Australia': '🇦🇺',
  'Brazil': '🇧🇷',
  'India': '🇮🇳',
  'Mexico': '🇲🇽',
  'Netherlands': '🇳🇱',
  'Sweden': '🇸🇪',
  'Denmark': '🇩🇰',
  'Ireland': '🇮🇪',
  'Turkey': '🇹🇷',
  'Russia': '🇷🇺',
  'Spain': '🇪🇸',
  'Italy': '🇮🇹',
  'South Korea': '🇰🇷',
  'Singapore': '🇸🇬',
  'Default': '🌍',
}

export function TopCountriesByViews() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch('/api/analytics')
        const analyticsData = await res.json()
        setData(analyticsData)
      } catch (error) {
        console.error('[analytics] Failed to fetch analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <Card className="border-border bg-surface backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
              <IconWorld className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">Top Countries</CardTitle>
              <CardDescription className="text-muted-foreground">Loading...</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const topCountries = data?.topCountries || []

  return (
    <Card className="border-border bg-surface backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
            <IconWorld className="size-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg text-foreground">Top Countries</CardTitle>
            <CardDescription className="text-muted-foreground">Your audience geographical distribution</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {topCountries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface py-12">
            <IconWorld className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No country data yet</p>
            <p className="text-xs text-muted-foreground">Share your profile to get analytics!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* List View */}
            <div className="space-y-2">
              {topCountries.map((country: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition-all hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {COUNTRY_FLAGS[country.country] || COUNTRY_FLAGS['Default']}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground-secondary">{country.country}</p>
                      <p className="text-xs text-muted-foreground">{country.percentage}% of views</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{country.views}</p>
                    <p className="text-xs text-muted-foreground">views</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Chart */}
            {topCountries.length > 1 && (
              <div className="mt-4 rounded-xl border border-border bg-surface p-4">
                <h3 className="mb-4 text-sm font-medium text-foreground-secondary">Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topCountries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="country" 
                      angle={-45} 
                      textAnchor="end" 
                      height={80} 
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <YAxis 
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(10,10,18,0.95)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '12px',
                        color: '#fff'
                      }}
                    />
                    <Bar dataKey="views" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f290b0" />
                        <stop offset="100%" stopColor="#d66f90" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
