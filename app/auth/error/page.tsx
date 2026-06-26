import Link from 'next/link'
import { IconAlertTriangle } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'

export default function AuthErrorPage() {
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
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/15">
            <IconAlertTriangle className="size-7 text-destructive" />
          </span>
          <h1 className="mt-5 text-h2 font-display">Authentication error</h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
            Something went wrong during authentication. The link may have expired
            or is invalid.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button asChild className="w-full">
              <Link href="/login">Back to login</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/signup">Create new account</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
