'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconCircleCheck, IconCopy, IconCrown, IconKey, IconLoader2, IconShieldCheck } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { LicenseItem } from '@/lib/types'

export function PremiumClient() {
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState(false)
  const [premiumActive, setPremiumActive] = useState(false)
  const [licenses, setLicenses] = useState<LicenseItem[]>([])
  const [manualKey, setManualKey] = useState('')

  async function loadData() {
    setLoading(true)
    try {
      const response = await fetch('/api/licenses', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to load licenses')
      setPremiumActive(Boolean(data.premiumActive))
      setLicenses(data.licenses || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load premium data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const pendingLicenses = useMemo(() => licenses.filter((license) => license.status !== 'redeemed'), [licenses])

  async function redeemLicense(payload: { licenseKey?: string; licenseId?: string }) {
    setRedeeming(true)
    try {
      const response = await fetch('/api/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to redeem key')
      toast.success('License redeemed successfully')
      setManualKey('')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to redeem key')
    } finally {
      setRedeeming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <IconLoader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-surface backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft">
              <IconCrown className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl text-foreground">Premium</CardTitle>
              <CardDescription className="text-muted-foreground">Redeem and manage the license keys connected to your account.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-foreground-secondary">
            Purchased keys appear here and in your inbox. Click a key to auto redeem it, or paste one manually.
          </div>

          {!premiumActive ? (
            <>
              <div className="rounded-2xl border border-primary/20 bg-accent-soft p-6 text-center">
                <IconCrown className="size-10 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Want Premium?</h3>
                <p className="text-sm text-foreground-secondary mb-4">Unlock custom themes, badges, effects, and more!</p>
                <a
                  href="/pricing"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  <IconCrown className="size-4" />
                  View Pricing
                </a>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {pendingLicenses.length > 0 ? pendingLicenses.map((license) => (
                  <button
                    key={license.id}
                    type="button"
                    onClick={() => void redeemLicense({ licenseId: license.id })}
                    className="rounded-[26px] border border-primary/20 bg-accent-soft p-4 text-left transition hover:border-primary/30 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{license.plan_name}</p>
                        <p className="mt-2 font-mono text-sm text-foreground-secondary">{license.license_key}</p>
                      </div>
                      <div className="rounded-full border border-border bg-surface-2 px-3 py-1 text-[11px] font-semibold text-primary">
                        Redeem
                      </div>
                    </div>
                  </button>
                )) : (
                  <div className="rounded-[26px] border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground md:col-span-2">
                    No pending keys yet. Buy a plan from pricing and your license will show up here.
                  </div>
                )}
              </div>

              <div className="rounded-[26px] border border-border bg-surface p-4">
                <p className="mb-3 text-sm font-medium text-foreground-secondary">Manual redeem</p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    value={manualKey}
                    onChange={(event) => setManualKey(event.target.value)}
                    placeholder="Paste your license key"
                    className="h-12 border-border bg-surface-2 font-mono"
                  />
                  <Button
                    disabled={redeeming || !manualKey.trim()}
                    onClick={() => void redeemLicense({ licenseKey: manualKey.trim() })}
                    className="h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {redeeming ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconKey className="mr-2 size-4" />}
                    Redeem
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-[30px] border border-primary/20 bg-accent-soft p-6 text-center shadow-[0_0_40px_rgba(232,127,160,0.1)]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <IconShieldCheck className="size-7" />
              </div>
              <p className="mt-4 text-lg font-semibold text-foreground">Constructing our premium page.. we are currently creating our documents and proper functions.</p>
              <p className="mt-2 text-sm text-muted-foreground">Premium has been activated on your account. Your bought keys remain visible in Inbox.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-surface backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base text-foreground">All keys</CardTitle>
          <CardDescription className="text-muted-foreground">Copy a key or keep it for manual redeeming later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {licenses.length > 0 ? licenses.map((license) => (
            <div key={license.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{license.plan_name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${license.status === 'redeemed' ? 'bg-white/[0.06] text-foreground-secondary' : 'bg-primary/10 text-primary'}`}>
                    {license.status}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-foreground-secondary">{license.license_key}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(license.license_key)
                    toast.success('License key copied')
                  }}
                  className="rounded-xl border-border bg-surface text-foreground-secondary hover:bg-white/[0.05]"
                >
                  <IconCopy className="mr-2 size-4" />
                  Copy
                </Button>
                {license.status !== 'redeemed' ? (
                  <Button
                    onClick={() => void redeemLicense({ licenseId: license.id })}
                    disabled={redeeming}
                    className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {redeeming ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconCircleCheck className="mr-2 size-4" />}
                    Auto redeem
                  </Button>
                ) : null}
              </div>
            </div>
          )) : (
            <div className="rounded-[26px] border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">
              No keys yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
