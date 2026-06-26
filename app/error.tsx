'use client'

import { useEffect } from 'react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to console for debugging; production builds also surface this in
    // the runtime error overlay.
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#06060b] px-6 text-center">
      <div className="max-w-md">
        <div className="mb-6 font-['Syne'] text-[24px] font-extrabold tracking-tight">
          <span className="text-white">halo</span>
          <span className="text-white/20">.</span>
          <span className="text-[#e87fa0]">rip</span>
        </div>
        <h1 className="mb-3 text-3xl font-bold text-white">Something went wrong</h1>
        <p className="mb-8 text-sm text-white/55">
          An unexpected error happened while loading this page. Try again, and if
          the problem keeps happening, let us know in our Discord.
        </p>
        {error.digest ? (
          <p className="mb-6 font-mono text-[11px] text-white/25">ref: {error.digest}</p>
        ) : null}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-[#f290b0] to-[#d66f90] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_16px_-4px_rgba(232,127,160,0.5)]"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.05]"
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  )
}
