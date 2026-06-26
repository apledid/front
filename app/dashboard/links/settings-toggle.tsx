'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

export default function LinksSettingsToggle({
  initialNoBackground,
  initialMonochrome,
  isPremium,
}: {
  initialNoBackground: boolean
  initialMonochrome: boolean
  isPremium: boolean
}) {
  const [noBg, setNoBg] = useState(initialNoBackground)
  const [mono, setMono] = useState(initialMonochrome)
  const [saving, setSaving] = useState(false)

  async function update(payload: any, label: string, on: boolean) {
    setSaving(true)
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      toast.success(`${label} ${on ? 'enabled' : 'disabled'}`)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 6px 18px -10px rgba(0,0,0,0.5)' }}
    >
      <label className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Disable Backgrounds</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Show only icons, no pill</p>
        </div>
        <Switch checked={noBg} onCheckedChange={(v) => { setNoBg(v); update({ social_icons_no_background: v }, 'Backgrounds', !v) }} disabled={saving} />
      </label>
      <label className={`relative flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3 ${!isPremium ? 'opacity-70' : ''}`}>
        <div>
          <p className="text-sm font-semibold text-foreground">Monochrome Icons</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Use icon color instead of brand colors</p>
        </div>
        <div className="flex items-center gap-2">
          {!isPremium ? <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-primary">PRO</span> : null}
          <Switch checked={mono} onCheckedChange={(v) => { if (!isPremium) return; setMono(v); update({ monochrome_icons: v }, 'Monochrome', v) }} disabled={saving || !isPremium} />
        </div>
      </label>
    </div>
  )
}
