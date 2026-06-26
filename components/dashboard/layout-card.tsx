'use client'

import type { LayoutMeta } from '@/lib/layout-meta'

/**
 * One layout-archetype card for the customize-page Layout picker. Shows
 * the stylised preview, label, and short description. Selected state uses
 * the site accent. "Coming soon" layouts render disabled with a
 * pink chip on the preview corner.
 */
export function LayoutCard({
  meta,
  active,
  onClick,
}: {
  meta: LayoutMeta
  active: boolean
  onClick: () => void
}) {
  const disabled = meta.comingSoon === true
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`group relative flex flex-col gap-2 overflow-hidden rounded-2xl border p-2.5 text-left transition-all ${
        active
          ? 'border-primary/55 bg-accent-soft shadow-[0_0_0_1px_rgba(232,127,160,0.22),0_8px_24px_-12px_rgba(232,127,160,0.45)]'
          : disabled
            ? 'cursor-not-allowed border-border bg-surface/40 opacity-60'
            : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2'
      }`}
    >
      {/* Stylised preview SVG */}
      <div className="relative aspect-[132/100] w-full overflow-hidden rounded-xl border border-border">
        {meta.preview()}
        {disabled && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
            Soon
          </span>
        )}
      </div>

      {/* Label + description */}
      <div className="px-1 pb-1">
        <p className={`text-sm font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>{meta.label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{meta.description}</p>
      </div>
    </button>
  )
}
