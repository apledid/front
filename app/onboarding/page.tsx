'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  IconCheck,
  IconChevronRight,
  IconArrowRight,
  IconCrown,
  IconWorld,
  IconLayoutGrid,
  IconLink,
  IconPalette,
  IconSearch,
  IconShare,
  IconUsers,
  IconBolt,
  IconSparkles,
} from '@tabler/icons-react'

import { Button } from '@/components/ui/button'

type Step = 'discovery' | 'usage' | 'setup' | 'complete'

const STEPS: Step[] = ['discovery', 'usage', 'setup', 'complete']

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('discovery')
  const [discovery, setDiscovery] = useState('')
  const [usage, setUsage] = useState('')

  const currentIndex = STEPS.indexOf(step)

  function next() {
    const nextIndex = currentIndex + 1
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex])
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="ds-container flex h-16 items-center">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight"
          aria-label="halo.rip home"
        >
          <span className="text-foreground">halo</span>
          <span className="text-primary">.rip</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-4">
        <div className="w-full max-w-lg">
          {/* Step indicator */}
          <div className="mb-8">
            <p className="mb-3 text-center text-eyebrow uppercase text-muted-foreground">
              Step {Math.min(currentIndex + 1, STEPS.length)} of {STEPS.length}
            </p>
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= currentIndex ? 'bg-primary' : 'bg-surface-3'
                  }`}
                />
              ))}
            </div>
          </div>

          {step === 'discovery' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-accent-soft">
                  <IconSearch className="size-7 text-primary" />
                </div>
                <h1 className="text-h2 font-display">Where did you find out about halo.rip?</h1>
                <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
                  Help us understand how you discovered us.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'search', label: 'Search engines', icon: IconWorld },
                  { id: 'social', label: 'Social media', icon: IconShare },
                  { id: 'friend', label: 'Through a friend', icon: IconUsers },
                  { id: 'other', label: 'Other', icon: IconBolt },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDiscovery(id)}
                    className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
                      discovery === id
                        ? 'border-primary bg-accent-soft'
                        : 'border-border bg-surface hover:border-border-strong'
                    }`}
                  >
                    <div
                      className={`flex size-10 items-center justify-center rounded-lg ${
                        discovery === id ? 'bg-primary/20' : 'bg-surface-2'
                      }`}
                    >
                      <Icon className={`size-5 ${discovery === id ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <span className={`text-sm font-medium ${discovery === id ? 'text-foreground' : 'text-foreground-secondary'}`}>
                      {label}
                    </span>
                    {discovery === id && <IconCheck className="ml-auto size-5 text-primary" />}
                  </button>
                ))}
              </div>

              <Button
                type="button"
                onClick={next}
                disabled={!discovery}
                size="lg"
                className="w-full"
              >
                Continue
                <IconArrowRight />
              </Button>
            </div>
          )}

          {step === 'usage' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-accent-soft">
                  <IconLayoutGrid className="size-7 text-primary" />
                </div>
                <h1 className="text-h2 font-display">How are you planning to use halo.rip?</h1>
                <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
                  We will tailor your experience accordingly.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'personal', label: 'Personal Use', icon: IconUsers },
                  { id: 'brand', label: 'Brand Promotion', icon: IconCrown },
                  { id: 'content', label: 'Content Sharing', icon: IconShare },
                  { id: 'other', label: 'Other', icon: IconBolt },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setUsage(id)}
                    className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
                      usage === id
                        ? 'border-primary bg-accent-soft'
                        : 'border-border bg-surface hover:border-border-strong'
                    }`}
                  >
                    <div
                      className={`flex size-10 items-center justify-center rounded-lg ${
                        usage === id ? 'bg-primary/20' : 'bg-surface-2'
                      }`}
                    >
                      <Icon className={`size-5 ${usage === id ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <span className={`text-sm font-medium ${usage === id ? 'text-foreground' : 'text-foreground-secondary'}`}>
                      {label}
                    </span>
                    {usage === id && <IconCheck className="ml-auto size-5 text-primary" />}
                  </button>
                ))}
              </div>

              <Button
                type="button"
                onClick={next}
                disabled={!usage}
                size="lg"
                className="w-full"
              >
                Continue
                <IconArrowRight />
              </Button>
            </div>
          )}

          {step === 'setup' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-accent-soft">
                  <IconCrown className="size-7 text-primary" />
                </div>
                <h1 className="text-h2 font-display">Choose your plan</h1>
                <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
                  Upgrade anytime from your dashboard.
                </p>
              </div>

              <div className="space-y-4">
                {/* Premium Plan */}
                <div className="rounded-2xl border border-primary/40 bg-accent-soft/40 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconCrown className="size-6 text-primary" />
                      <div>
                        <p className="font-display text-lg font-bold">Premium</p>
                        <p className="text-sm text-foreground-secondary">
                          $5 <span className="text-muted-foreground">one-time</span>
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Recommended
                    </span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {['Custom themes & colors', 'Exclusive badges & effects', 'Priority support', 'Custom domain support', 'Advanced analytics'].map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-foreground">
                        <IconCheck className="size-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-5 w-full">
                    <a href="/pricing">
                      Get Premium
                      <IconSparkles />
                    </a>
                  </Button>
                </div>

                {/* Free Plan */}
                <div className="rounded-2xl border border-border bg-surface p-6">
                  <div className="flex items-center gap-3">
                    <IconBolt className="size-6 text-muted-foreground" />
                    <div>
                      <p className="font-display text-lg font-bold">Free</p>
                      <p className="text-sm text-foreground-secondary">
                        $0 <span className="text-muted-foreground">forever</span>
                      </p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {['Custom bio & avatar', 'Social links', 'Basic themes', 'Music player'].map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-foreground-secondary">
                        <IconCheck className="size-4 shrink-0 text-foreground-secondary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    onClick={next}
                    variant="secondary"
                    className="mt-5 w-full"
                  >
                    Continue with Free
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-accent-soft">
                  <IconCheck className="size-7 text-primary" />
                </div>
                <h1 className="text-h2 font-display">You&apos;ve reached the end!</h1>
                <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
                  Your account is ready. Here are some quick links to get started.
                </p>
              </div>

              <div className="space-y-3">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-accent-soft">
                    <IconLayoutGrid className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Dashboard</p>
                    <p className="text-xs text-muted-foreground">Manage your profile and settings</p>
                  </div>
                  <IconChevronRight className="ml-auto size-5 text-muted-foreground" />
                </Link>

                <Link
                  href="/dashboard/customize"
                  className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-accent-soft">
                    <IconPalette className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Appearance</p>
                    <p className="text-xs text-muted-foreground">Customize your theme and colors</p>
                  </div>
                  <IconChevronRight className="ml-auto size-5 text-muted-foreground" />
                </Link>

                <Link
                  href="/dashboard/links"
                  className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-accent-soft">
                    <IconLink className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Links</p>
                    <p className="text-xs text-muted-foreground">Add your social links and buttons</p>
                  </div>
                  <IconChevronRight className="ml-auto size-5 text-muted-foreground" />
                </Link>
              </div>

              <Button asChild size="lg" className="w-full">
                <Link href="/dashboard">
                  Go to Dashboard
                  <IconArrowRight />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
