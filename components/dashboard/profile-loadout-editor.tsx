'use client'

import { useEffect, useState } from 'react'
import { IconLoader2, IconDeviceFloppy, IconTrophy } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Badge, LoadoutPosition, TitleItem } from '@/lib/types'

type BadgeState = {
  badge: Badge
  enabled: boolean
  position: LoadoutPosition
  display_order: number
}

type TitleState = {
  title: TitleItem
  enabled: boolean
  position: LoadoutPosition
  display_order: number
}

const POSITION_OPTIONS: Array<{ value: LoadoutPosition; label: string }> = [
  { value: 'above_username', label: 'Above username' },
  { value: 'below_username', label: 'Below username' },
  { value: 'above_links', label: 'Above links' },
  { value: 'below_links', label: 'Below links' },
]

export function ProfileLoadoutEditor() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [badges, setBadges] = useState<BadgeState[]>([])
  const [titles, setTitles] = useState<TitleState[]>([])

  async function loadData() {
    setLoading(true)
    try {
      const response = await fetch('/api/profile/loadout', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to load equipment')

      const badgeLoadoutMap = new Map((data.badgeLoadout || []).map((item: any) => [item.badge_id, item]))
      const titleLoadoutMap = new Map((data.titleLoadout || []).map((item: any) => [item.title_id, item]))

      setBadges((data.badges || []).map((badge: Badge, index: number) => {
        const loadout = badgeLoadoutMap.get(badge.id)
        return {
          badge,
          enabled: Boolean(loadout),
          position: loadout?.position || 'below_username',
          display_order: loadout?.display_order ?? index,
        }
      }))

      setTitles((data.titles || []).map((title: TitleItem, index: number) => {
        const loadout = titleLoadoutMap.get(title.id)
        return {
          title,
          enabled: Boolean(loadout),
          position: loadout?.position || 'above_username',
          display_order: loadout?.display_order ?? index,
        }
      }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load profile equipment')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  async function saveLoadout() {
    setSaving(true)
    try {
      const response = await fetch('/api/profile/loadout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          badges: badges.filter((item) => item.enabled).map((item, index) => ({
            badge_id: item.badge.id,
            position: item.position,
            display_order: index,
          })),
          titles: titles.filter((item) => item.enabled).map((item, index) => ({
            title_id: item.title.id,
            position: item.position,
            display_order: index,
          })),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to save loadout')
      toast.success('Profile equipment saved')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save loadout')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[24vh] items-center justify-center">
        <IconLoader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <Card className="border-border bg-surface backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft">
            <IconTrophy className="size-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg text-foreground">Badges and titles</CardTitle>
            <CardDescription className="text-muted-foreground">Equip badges and titles, then choose where they display on your card.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Badges</p>
            {badges.length > 0 ? badges.map((item, index) => (
              <div key={item.badge.id} className="rounded-[24px] border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(event) => setBadges((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, enabled: event.target.checked } : entry))}
                      className="h-4 w-4"
                    />
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-black/20">
                      {item.badge.icon_url ? <img src={item.badge.icon_url} alt={item.badge.name} className="h-full w-full object-cover" /> : <span className="text-sm text-foreground-secondary">{item.badge.icon}</span>}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.badge.name}</p>
                      <p className="text-xs text-muted-foreground">Hover on your profile to see the badge name.</p>
                    </div>
                  </div>
                </div>
                <select
                  value={item.position}
                  onChange={(event) => setBadges((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, position: event.target.value as LoadoutPosition } : entry))}
                  className="mt-3 h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm text-foreground outline-none"
                >
                  {POSITION_OPTIONS.map((option) => <option key={option.value} value={option.value} className="bg-surface-2 text-foreground">{option.label}</option>)}
                </select>
              </div>
            )) : <div className="rounded-[24px] border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">No badges assigned yet.</div>}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Titles</p>
            {titles.length > 0 ? titles.map((item, index) => (
              <div key={item.title.id} className="rounded-[24px] border border-border bg-surface p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(event) => setTitles((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, enabled: event.target.checked } : entry))}
                    className="h-4 w-4"
                  />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: item.title.color }}>{item.title.name}</p>
                    <p className="text-xs text-muted-foreground">Place this title around your identity block.</p>
                  </div>
                </div>
                <select
                  value={item.position}
                  onChange={(event) => setTitles((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, position: event.target.value as LoadoutPosition } : entry))}
                  className="mt-3 h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm text-foreground outline-none"
                >
                  {POSITION_OPTIONS.map((option) => <option key={option.value} value={option.value} className="bg-surface-2 text-foreground">{option.label}</option>)}
                </select>
              </div>
            )) : <div className="rounded-[24px] border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">No titles assigned yet.</div>}
          </div>
        </div>

        <div className="flex justify-end">
          <Button disabled={saving} onClick={() => void saveLoadout()} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconDeviceFloppy className="mr-2 size-4" />}
            Save equipment
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
