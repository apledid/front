'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IconCheck, IconX, IconKey, IconSparkles, IconCrown } from '@tabler/icons-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const FREE_FEATURES: { name: string; included: boolean }[] = [
  { name: 'Profile page', included: true },
  { name: 'Social links', included: true },
  { name: 'Custom links (with icons)', included: true },
  { name: 'Avatar and banner', included: true },
  { name: 'Basic appearance settings', included: true },
  { name: 'Profile bio and info', included: true },
  { name: 'Custom fonts', included: false },
  { name: 'Gradient overlay', included: false },
  { name: 'Outline / border glow', included: false },
  { name: 'Enter page animation', included: false },
  { name: 'Premium effects', included: false },
]

const LIFETIME_FEATURES = [
  'Everything in Free',
  'Custom fonts',
  'Gradient overlay',
  'Outline / border glow',
  'Enter page animation',
  'Username effects (typewriter, rainbow, glitch, wave…)',
  'Hover effects (glow, pulse, shake)',
  'Cursor effects (spark trail, cat, splash, rainbow…)',
  'Monochrome icons',
  'Background music',
  'All future premium features',
]

export function PricingClient({
  loggedIn,
  alreadyPremium,
}: {
  loggedIn: boolean
  alreadyPremium?: boolean
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)

  return (
    <div className="ds-container py-16 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-eyebrow uppercase text-primary/80">pricing</p>
        <h1 className="mt-3 text-h1 font-display">
          Free, or <span className="text-gradient-accent">$5 once.</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-foreground-secondary">
          The free tier is actually good. Five dollars unlocks every premium
          feature - paid once, yours forever.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          one-time payment · no subscriptions · all future updates included
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-3xl items-start gap-5 sm:grid-cols-2">
        {/* Free */}
        <div className="rounded-2xl border border-border bg-surface p-7">
          <div className="flex items-center gap-2">
            <span className="text-eyebrow uppercase text-muted-foreground">free</span>
            {!alreadyPremium && loggedIn ? (
              <span className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[0.7rem] text-foreground-secondary">
                current plan
              </span>
            ) : null}
          </div>
          <p className="mt-4 font-display text-5xl font-bold">$0</p>
          <p className="mt-1 text-sm text-muted-foreground">free forever</p>

          <ul className="mt-6 space-y-2.5">
            {FREE_FEATURES.map((f) => (
              <li key={f.name} className="flex items-start gap-2.5 text-sm">
                {f.included ? (
                  <IconCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <IconX className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
                )}
                <span
                  className={cn(
                    f.included ? 'text-foreground-secondary' : 'text-muted-foreground/60',
                  )}
                >
                  {f.name}
                </span>
              </li>
            ))}
          </ul>

          {loggedIn ? (
            <Button variant="secondary" disabled className="mt-7 w-full">
              {alreadyPremium ? 'You have Lifetime' : 'Current plan'}
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="mt-7 w-full"
              onClick={() => router.push('/signup')}
            >
              Get started free
            </Button>
          )}
        </div>

        {/* Lifetime */}
        <div className="relative rounded-2xl border border-primary/40 bg-accent-soft/40 p-7">
          <span className="absolute right-6 top-7 rounded-full bg-primary px-2.5 py-1 text-[0.7rem] font-semibold text-primary-foreground">
            pay once
          </span>
          <div className="flex items-center gap-2">
            <span className="text-eyebrow uppercase text-primary">lifetime</span>
            {alreadyPremium ? (
              <span className="rounded-full border border-primary/30 bg-accent-soft px-2.5 py-0.5 text-[0.7rem] text-primary">
                active
              </span>
            ) : null}
          </div>
          <p className="mt-4 font-display text-5xl font-bold">$5</p>
          <p className="mt-1 text-sm font-medium text-primary">pay once, keep forever</p>

          <ul className="mt-6 space-y-2.5">
            {LIFETIME_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <IconCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-foreground">{f}</span>
              </li>
            ))}
          </ul>

          {alreadyPremium ? (
            <Button disabled className="mt-7 w-full">
              <IconCheck /> You have lifetime access
            </Button>
          ) : (
            <Button
              className="mt-7 w-full"
              onClick={() => {
                if (!loggedIn) {
                  router.push('/signup')
                  return
                }
                setModal(true)
              }}
            >
              <IconSparkles /> {loggedIn ? 'Get lifetime access' : 'Sign up to purchase'}
            </Button>
          )}

          {!alreadyPremium && loggedIn ? (
            <Link
              href="/redeem"
              className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground-secondary"
            >
              <IconKey className="size-3.5" /> Have a license key? Redeem here
            </Link>
          ) : null}
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Questions? Find us on{' '}
        <a
          href="https://discord.gg/NgVh45gXbD"
          target="_blank"
          rel="noreferrer"
          className="text-foreground-secondary underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Discord
        </a>
      </p>

      {modal ? (
        <div
          onClick={() => setModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-border bg-popover p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
          >
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-soft">
              <IconCrown className="size-6 text-primary" />
            </span>
            <h2 className="mt-5 text-h3 font-display">Get lifetime access</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
              DM on Discord to complete your purchase. One-time $5 payment.
            </p>
            <div className="mt-5 rounded-xl border border-primary/20 bg-accent-soft/50 p-4">
              <p className="font-display text-xl font-semibold">@38fx</p>
              <p className="text-xs text-muted-foreground">on Discord</p>
            </div>
            <Button variant="secondary" className="mt-5 w-full" onClick={() => setModal(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
