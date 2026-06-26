'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { IconLoader2 } from '@tabler/icons-react'

interface UnsavedChangesBarProps {
  show: boolean
  saving: boolean
  onSave: () => void
  onReset: () => void
  label?: string
}

function getOrCreateStack(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  let el = document.getElementById('unsaved-bars-stack')
  if (!el) {
    el = document.createElement('div')
    el.id = 'unsaved-bars-stack'
    el.className =
      'pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-2 px-3 sm:px-4'
    // Respect iOS safe-area-inset so the bar never sits under the home indicator
    el.style.paddingBottom = 'calc(1rem + env(safe-area-inset-bottom))'
    document.body.appendChild(el)
  }
  return el
}

export function UnsavedChangesBar({
  show,
  saving,
  onSave,
  onReset,
  label,
}: UnsavedChangesBarProps) {
  const [stack, setStack] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setStack(getOrCreateStack())
  }, [])

  if (!show || !stack) return null

  return createPortal(
    <div className="pointer-events-auto mx-auto w-full max-w-3xl animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border bg-surface/95 px-4 py-3 shadow-xl backdrop-blur-xl sm:px-5">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground-secondary sm:text-sm">
          {label ? `Unsaved ${label} changes!` : 'You have unsaved changes!'}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={saving}
            className="text-foreground-secondary hover:text-foreground hover:bg-white/10"
          >
            Reset
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[96px]"
          >
            {saving ? (
              <>
                <IconLoader2 className="mr-2 size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>,
    stack,
  )
}
