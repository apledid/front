import Link from 'next/link'

import { Button } from '@/components/ui/button'

/**
 * Rendered by app/[username]/page.tsx when no profile owns the handle
 * but the handle is otherwise valid (format + not reserved). Pivots a
 * 404 into a soft claim CTA. Server component; the signup form picks up
 * the `username` query param and prefills.
 */
export function UnclaimedUsernamePage({ username }: { username: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)]">
        <div
          className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent-soft font-display text-3xl font-bold text-primary"
          aria-hidden
        >
          !
        </div>

        <h1 className="text-h3 font-display text-foreground">Username not claimed</h1>

        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-foreground-secondary">
          <b className="font-semibold text-primary">@{username}</b> is up for grabs.
          Claim it before someone else does.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <Button asChild variant="secondary">
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild>
            <Link href={`/signup?username=${encodeURIComponent(username)}`}>Claim it</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
