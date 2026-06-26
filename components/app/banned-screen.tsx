import Link from 'next/link'
import { IconBan } from '@tabler/icons-react'

export function BannedScreen({
  reason,
  staff,
}: {
  reason?: string | null
  staff?: string | null
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="w-full max-w-xl rounded-3xl border border-destructive/25 bg-destructive/[0.06] px-8 py-12">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-destructive/[0.12] text-destructive">
          <IconBan className="size-11" />
        </div>
        <h1 className="mt-6 text-h1 font-display text-foreground">Access revoked</h1>
        <p className="mt-4 text-base leading-7 text-foreground-secondary">
          You have been banned from{' '}
          <span className="font-medium text-foreground">halo.rip</span>
          {reason ? (
            <>
              {' '}
              for the following reason:{' '}
              <span className="font-medium text-foreground">{reason}</span>
            </>
          ) : (
            '.'
          )}
          {staff ? (
            <>
              {' '}
              by staff <span className="font-medium text-destructive">@{staff}</span>.
            </>
          ) : null}
        </p>
        <div className="mt-8 rounded-2xl border border-border bg-surface px-4 py-4 text-sm text-muted-foreground">
          If you believe this was a mistake, contact the halo.rip staff team from
          another account.
        </div>
        <div className="mt-8 flex items-center justify-center">
          <Link
            href="/"
            className="rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-foreground-secondary transition-colors hover:bg-surface-3 hover:text-foreground"
          >
            Return home
          </Link>
        </div>
      </div>
    </main>
  )
}
