import { IconArrowRight } from '@tabler/icons-react'

/**
 * Maintenance page. Routed-to via middleware when the operator flips the
 * global maintenance flag. Branded shell with the wordmark, a soft pulsing
 * accent, and the Discord invite for status updates. Pure CSS, no JS.
 */
export default function MaintenancePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div
          className="h-[520px] w-[520px] rounded-full opacity-40"
          style={{
            background:
              'radial-gradient(circle, rgba(232,127,160,0.32) 0%, rgba(232,127,160,0.08) 45%, transparent 70%)',
            animation: 'maintenance-pulse 4.5s ease-in-out infinite',
          }}
        />
      </div>

      <div className="relative z-10 flex max-w-md flex-col items-center">
        <span className="mb-7 font-display text-2xl font-semibold tracking-tight">
          <span className="text-foreground">halo</span>
          <span className="text-primary">.rip</span>
        </span>

        <h1 className="text-h1 font-display">briefly under maintenance</h1>
        <p className="mt-3 text-base leading-relaxed text-foreground-secondary">
          we&apos;re shipping an update right now. should be back in a few minutes
          - thanks for hanging tight.
        </p>

        <a
          href="https://discord.gg/NgVh45gXbD"
          target="_blank"
          rel="noreferrer"
          className="mt-7 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-accent-soft px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:border-primary/60"
        >
          status updates on Discord
          <IconArrowRight className="size-4" />
        </a>
      </div>

      <style>{`
        @keyframes maintenance-pulse {
          0%, 100% { transform: scale(1);   opacity: 0.40; }
          50%      { transform: scale(1.08); opacity: 0.55; }
        }
      `}</style>
    </div>
  )
}
