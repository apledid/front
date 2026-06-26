'use client'

import { IconLoader2 } from '@tabler/icons-react'

/**
 * Absolute-positioned overlay that sits on top of an existing media preview
 * (background image, font slot, button icon, etc.) so the user gets clear
 * visual feedback when they replace an already-uploaded file.
 *
 * Wrap the content in a `relative` parent and render this conditionally:
 *
 *   <div className="relative">
 *     <img src={url} ... />
 *     {uploading && <UploadingOverlay phase={phase} />}
 *   </div>
 *
 * The overlay dims the underlying content, centers a spinner, and shows a
 * one-line status - "Compressing video…" during the optional video transcode
 * phase, "Uploading…" while the bytes are flying. Falls back to "Uploading…"
 * when no phase is provided.
 */
export function UploadingOverlay({
  phase,
  label,
}: {
  phase?: 'compressing' | 'uploading' | null
  /** Optional override - defaults derive from `phase`. */
  label?: string
}) {
  const resolvedLabel =
    label ??
    (phase === 'compressing'
      ? 'Compressing video…'
      : phase === 'uploading'
        ? 'Uploading…'
        : 'Uploading…')

  return (
    <div
      // pointer-events-auto so clicks while uploading don't accidentally
      // re-trigger the underlying button's file picker.
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[inherit] bg-black/60 backdrop-blur-[2px] pointer-events-auto"
      role="status"
      aria-live="polite"
    >
      <IconLoader2 className="h-8 w-8 animate-spin text-[#e87fa0]" />
      <p className="text-xs font-medium text-white/85">{resolvedLabel}</p>
    </div>
  )
}

/**
 * Inline pill variant for tight UI like the buttons page's "Icon" picker
 * where a full overlay would be visually heavy. Renders a small spinner +
 * "Uploading…" text on a single line.
 */
export function UploadingPill({
  label = 'Uploading…',
}: {
  label?: string
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[#e87fa0]"
      role="status"
      aria-live="polite"
    >
      <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
      <span className="text-xs font-medium">{label}</span>
    </span>
  )
}
