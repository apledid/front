import Link from 'next/link'

export const metadata = {
  title: 'Page not found | halo.rip',
  description: "That page doesn't exist on halo.rip.",
}

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#06060b] px-6 text-center">
      <div className="max-w-md">
        <div className="mb-6 font-['Syne'] text-[28px] font-extrabold tracking-tight">
          <span className="text-white">halo</span>
          <span className="text-white/20">.</span>
          <span className="text-[#e87fa0]">rip</span>
        </div>
        <h1 className="mb-3 text-7xl font-extrabold tracking-tight text-white">404</h1>
        <p className="mb-8 text-base text-white/55">
          That page doesn&apos;t exist. The user might have changed their handle, or you
          followed an old link.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-[#f290b0] to-[#d66f90] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_16px_-4px_rgba(232,127,160,0.5)]"
          >
            Take me home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.05]"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
