'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { IconCircleCheck, IconLoader2, IconAlertTriangle } from '@tabler/icons-react'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="ds-container flex h-16 items-center">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight">
          <span className="text-foreground">halo</span>
          <span className="text-primary">.rip</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)]">
          {children}
        </div>
      </main>
    </div>
  )
}

function ConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    async function confirmEmail() {
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      if (!token_hash || !type) {
        setStatus('error')
        setError('Invalid confirmation link')
        return
      }

      const supabase = createClient()

      const { error } = await supabase.auth.verifyOtp({
        type: type as 'signup' | 'email',
        token_hash,
      })

      if (error) {
        setStatus('error')
        setError(error.message)
        return
      }

      setStatus('success')

      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    }

    confirmEmail()
  }, [searchParams, router])

  return (
    <Shell>
      {status === 'loading' && (
        <>
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-soft">
            <IconLoader2 className="size-7 animate-spin text-primary" />
          </span>
          <h1 className="mt-5 text-h2 font-display">Verifying your email</h1>
          <p className="mt-2 text-sm text-foreground-secondary">
            Please wait while we confirm your email address…
          </p>
        </>
      )}

      {status === 'success' && (
        <>
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-soft">
            <IconCircleCheck className="size-7 text-primary" />
          </span>
          <h1 className="mt-5 text-h2 font-display">Email verified</h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
            Your email is confirmed. Redirecting you to your dashboard…
          </p>
          <Button asChild className="mt-6">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </>
      )}

      {status === 'error' && (
        <>
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/15">
            <IconAlertTriangle className="size-7 text-destructive" />
          </span>
          <h1 className="mt-5 text-h2 font-display">Verification failed</h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
            {error || 'The verification link may have expired or is invalid.'}
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button asChild className="w-full">
              <Link href="/login">Back to login</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/signup">Create new account</Link>
            </Button>
          </div>
        </>
      )}
    </Shell>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-soft">
            <IconLoader2 className="size-7 animate-spin text-primary" />
          </span>
          <h1 className="mt-5 text-h2 font-display">Loading…</h1>
        </Shell>
      }
    >
      <ConfirmContent />
    </Suspense>
  )
}
