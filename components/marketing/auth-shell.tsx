import Link from 'next/link'

/**
 * Centered auth card shell shared across login / signup / reset flows.
 * Brand header up top, a single bordered surface card in the middle,
 * optional footer line beneath. All auth screens inherit this so the
 * account surfaces stay visually identical.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="ds-container flex h-16 items-center">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label="halo.rip home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-7 w-auto" />
          <span className="font-display text-lg font-semibold tracking-tight">
            <span className="text-foreground">halo</span>
            <span className="text-primary">.rip</span>
          </span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border bg-surface p-7 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] sm:p-8">
            <div className="mb-6 text-center">
              <h1 className="text-h2 font-display">{title}</h1>
              {subtitle ? (
                <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {children}
          </div>
          {footer ? (
            <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
