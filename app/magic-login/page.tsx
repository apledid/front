'use client'

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { IconLoader2, IconAlertTriangle } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Landing page for owner-issued recovery links produced by the
// Discord bot's /user magic-login. The token comes in as
// ?token=<64 hex>. Flow:
//
//   1. On mount, GET /api/auth/magic-login?token=... to validate
//      the token is still good (not consumed, not expired). This
//      does NOT consume the token - just confirms it's usable so
//      we don't show the form for a dead link.
//   2. If valid, show "set new email + new password" form.
//   3. On submit, POST { token, email, password } to the same
//      endpoint. The POST atomically consumes the token, updates
//      the profile's email + password_hash, revokes all other
//      sessions, and mints a new session cookie for this browser.
//   4. On success, hard-navigate to /dashboard.
//
// The two-call design (GET to check, POST to apply) keeps the
// token unconsumed until the user actually has new credentials
// locked in. A failed submission (validation error, taken email)
// doesn't burn the token - the user can fix the input and try
// again. The token IS consumed on the first successful POST,
// even if later steps fail, because by that point the
// credentials are valid and committing the recovery is the
// right move.

function Shell({ children }: { children: React.ReactNode }) {
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
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}

function MagicLoginInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [checking, setChecking] = useState(true)
  const [valid, setValid] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── Token validity check on mount ───────────────────────────
  useEffect(() => {
    if (!token) {
      setError('No recovery token in URL. Ask whoever sent you the link for a fresh one.')
      setChecking(false)
      return
    }

    let aborted = false
    fetch(`/api/auth/magic-login?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      credentials: 'include',
    })
      .then(async (res) => {
        if (aborted) return
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.valid) {
          setValid(true)
        } else {
          setError(data.error || 'Recovery link is invalid')
        }
      })
      .catch(() => {
        if (aborted) return
        setError('Could not check the recovery link. Try refreshing.')
      })
      .finally(() => {
        if (aborted) return
        setChecking(false)
      })

    return () => { aborted = true }
  }, [token])

  // ── Form submit ──────────────────────────────────────────────
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords don’t match')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/magic-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token,
          email: trimmedEmail,
          password,
        }),
      })

      if (res.ok) {
        // Session cookies set; hard-navigate so /dashboard's
        // server components pick them up immediately.
        window.location.href = '/dashboard'
        return
      }

      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Recovery failed. Try again.')
      // If the token got consumed (e.g. server returned 400
      // "invalid or already used"), the link is dead. Mark valid
      // false so the form goes away and the user only sees the
      // error + back-to-login.
      if (res.status === 400 && (data.error || '').toLowerCase().includes('invalid or already used')) {
        setValid(false)
      }
    } catch {
      setError('Network error. Try again in a moment.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)]">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-soft">
            <IconLoader2 className="size-7 animate-spin text-primary" />
          </span>
          <h1 className="mt-5 text-h2 font-display">Checking your recovery link</h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
            Hang tight while we verify the link is still valid…
          </p>
        </div>
      </Shell>
    )
  }

  if (!valid) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)]">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/15">
            <IconAlertTriangle className="size-7 text-destructive" />
          </span>
          <h1 className="mt-5 text-h2 font-display">Recovery failed</h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
            {error || 'The recovery link is no longer valid.'}
          </p>
          <Button asChild className="mt-6 w-full">
            <Link href="/login">Back to login</Link>
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="rounded-2xl border border-border bg-surface p-7 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] sm:p-8">
        <h1 className="text-h2 font-display">Set your new login</h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
          You&apos;re recovering your account. Pick a new email and password - these are what you&apos;ll use to log in from now on.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" autoComplete="on">
          <div>
            <label className="mb-1.5 block text-eyebrow uppercase text-muted-foreground">
              New email
            </label>
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-eyebrow uppercase text-muted-foreground">
              New password
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-eyebrow uppercase text-muted-foreground">
              Confirm password
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              placeholder="Repeat password"
            />
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <Button type="submit" disabled={submitting} size="lg" className="w-full">
            {submitting ? (
              <>
                <IconLoader2 className="size-4 animate-spin" />
                Recovering…
              </>
            ) : (
              'Recover account & sign in'
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            This link is single-use and expires in 15 minutes from when it was issued.
          </p>
        </form>
      </div>
    </Shell>
  )
}

// Suspense wrapper because useSearchParams() suspends during SSR.
export default function MagicLoginPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)]">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-soft">
              <IconLoader2 className="size-7 animate-spin text-primary" />
            </span>
            <h1 className="mt-5 text-h2 font-display">Loading…</h1>
          </div>
        </Shell>
      }
    >
      <MagicLoginInner />
    </Suspense>
  )
}
