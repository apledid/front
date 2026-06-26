'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from '@tabler/icons-react'

/**
 * "Are you sure? You are going to visit X" confirmation dialog shown on
 * the public profile when a visitor clicks a custom link. Custom links
 * point at arbitrary URLs the profile owner pasted in, so giving the
 * visitor a 1-click confirmation before navigating is a defence against
 * surprise-redirect / phishing attempts.
 *
 * Rendered via portal so it sits above the profile background video and
 * any cursor-effects canvas without z-index gymnastics.
 */
export function LinkConfirmDialog({
  open,
  url,
  onConfirm,
  onCancel,
}: {
  open: boolean
  url: string
  onConfirm: () => void
  onCancel: () => void
}) {
  // ESC to close. We listen on `window` instead of an element so it works
  // even when focus is somewhere weird (e.g. an autoplaying audio control).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  // Lock body scroll while the dialog is open so the page underneath
  // doesn't slide when the user taps on mobile.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  // Strip the protocol for the visible URL so it matches the screenshot
  // shape ("twitter.com/foo" rather than "https://twitter.com/foo"). The
  // actual link target keeps the full URL.
  const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '')

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm external link"
      onClick={onCancel}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[3px] animate-in fade-in duration-150"
    >
      <div
        // Stop click-through so clicking the dialog body doesn't dismiss it
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px] rounded-2xl border border-white/[0.08] bg-[#0e0e11] p-5 shadow-2xl"
        style={{ boxShadow: '0 0 0 1px rgba(232,127,160,0.10), 0 20px 60px -20px rgba(232,127,160,0.35)' }}
      >
        {/* Close X */}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/[0.06] hover:text-white/80 transition"
        >
          <IconX className="h-4 w-4" />
        </button>

        <p className="text-sm font-semibold text-white">Are you sure?</p>

        <div className="mt-4 flex flex-col items-center">
          <p className="text-sm text-white/55">You are going to visit</p>
          <p
            className="mt-2 max-w-full truncate rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-white/85"
            title={url}
          >
            {displayUrl}
          </p>
        </div>

        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="rounded-full bg-[#e87fa0] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#d66f90] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e87fa0]/60"
          >
            Visit
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/[0.10] bg-white/[0.03] px-5 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
