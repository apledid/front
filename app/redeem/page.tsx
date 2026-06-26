'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/marketing/auth-shell'
import { toast } from 'sonner'
import {
  IconKey,
  IconLoader2,
  IconCheck,
  IconCrown,
} from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RedeemPage() {
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!key.trim()) {
      toast.error('Please enter a license key')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: key.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to redeem key')
      }

      setSuccess(true)
      toast.success(data.message || 'License key redeemed successfully!')

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (error: any) {
      toast.error(error.message || 'Failed to redeem license key')
    } finally {
      setLoading(false)
    }
  }

  // Format key as user types (HALO-XXXX-XXXX-XXXX)
  const handleKeyChange = (value: string) => {
    // Remove all non-alphanumeric characters except hyphens
    let cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, '')
    setKey(cleaned)
  }

  if (success) {
    return (
      <AuthShell
        title="You're all set"
        subtitle="Your license key has been redeemed. You now have lifetime premium access."
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex size-16 items-center justify-center rounded-full border border-primary/20 bg-accent-soft">
            <IconCheck className="size-8 text-primary" />
          </div>

          {/* Feature unlock callout. Used to redirect silently
              without telling the user what they actually got;
              listing the unlocks here makes the purchase feel
              worth it instead of generic. Copy mirrors the
              landing-page premium FAQ so the two stay in sync. */}
          <ul className="mb-6 w-full space-y-2.5 text-left text-sm text-foreground-secondary">
            <li className="flex items-center gap-2.5">
              <IconCheck className="size-4 shrink-0 text-primary" />
              30+ extra effects unlocked
            </li>
            <li className="flex items-center gap-2.5">
              <IconCheck className="size-4 shrink-0 text-primary" />
              Animated avatar decorations
            </li>
            <li className="flex items-center gap-2.5">
              <IconCheck className="size-4 shrink-0 text-primary" />
              Custom fonts + premium badge
            </li>
            <li className="flex items-center gap-2.5">
              <IconCheck className="size-4 shrink-0 text-primary" />
              All future premium features
            </li>
          </ul>

          <div className="flex items-center gap-2 text-sm text-primary">
            <IconCrown className="size-4" />
            <span>Redirecting to dashboard…</span>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Redeem a key"
      subtitle="Enter your license key to activate lifetime premium access"
      footer={
        <>
          Don&apos;t have a key?{' '}
          <Link href="/pricing" className="font-medium text-primary hover:underline">
            Purchase lifetime access
          </Link>
        </>
      }
    >
      <form onSubmit={handleRedeem} className="space-y-5">
        <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-full border border-primary/20 bg-accent-soft">
          <IconKey className="size-6 text-primary" />
        </div>

        <input
          placeholder="HALO-XXXX-XXXX-XXXX"
          value={key}
          onChange={(e) => handleKeyChange(e.target.value)}
          disabled={loading}
          className="h-14 w-full rounded-lg border border-border bg-surface-2 text-center font-mono text-lg uppercase tracking-[0.2em] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus-visible:border-[color:var(--accent)] disabled:opacity-50"
        />

        <Button type="submit" disabled={loading || !key.trim()} className="w-full">
          {loading ? (
            <>
              <IconLoader2 className="animate-spin" /> Redeeming…
            </>
          ) : (
            <>
              <IconKey /> Redeem key
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  )
}
