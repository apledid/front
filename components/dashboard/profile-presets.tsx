'use client'

/**
 * Profile Presets v2 - five named slots with thumbnail previews and
 * a selective Reset dialog.
 *
 * Slot card structure:
 *   - inline-editable name (defaults to "Preset N")
 *   - "Active" badge on whichever slot was loaded most recently
 *   - mini profile-card preview rendered from the saved config's
 *     accent color + background + avatar + handle counts
 *   - actions: Save / Load / Rename / Delete (rename + delete only
 *     when the slot is filled)
 *
 * Reset dialog:
 *   - replaces the single "Reset to defaults" button with a checkbox
 *     list of 9 categories (Theme, Layout, Background, Bio, Socials,
 *     Buttons, Badges, Music, Effects)
 *   - "Select all" toggle for the legacy nuke-everything behavior
 *   - posts the selected list to /api/profile/reset which only
 *     resets columns + child tables for the checked categories
 */

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  IconBookmark, IconRotateClockwise, IconDeviceFloppy, IconUpload, IconTrash, IconPencil, IconCheck, IconX,
  IconLoader2, IconRosetteDiscountCheck,
} from '@tabler/icons-react'

interface PresetPreview {
  avatar_url: string | null
  display_name: string | null
  username: string | null
  bio: string | null
  accent_color: string | null
  background_color: string | null
  background_url: string | null
  card_style: string | null
  social_count: number
  button_count: number
}

interface SlotInfo {
  slot: number
  filled: boolean
  name: string | null
  saved_at: string | null
  last_loaded_at: string | null
  active: boolean
  preview: PresetPreview | null
}

type ResetCategory =
  | 'theme' | 'layout' | 'background' | 'bio'
  | 'socials' | 'buttons' | 'badges' | 'music' | 'effects'

const RESET_CATEGORY_LIST: { id: ResetCategory; label: string; desc: string }[] = [
  { id: 'theme',      label: 'Theme & colors',     desc: 'Accent, text, fonts, glow, gradients, outline, badges look' },
  { id: 'layout',     label: 'Layout & card',      desc: 'Layout mode, panel size, avatar position, card style + widgets (VALORANT, Discord, etc.)' },
  { id: 'background', label: 'Background',         desc: 'Wallpaper image / video, particles, effect strength' },
  { id: 'bio',        label: 'Bio, avatar & name', desc: 'Bio text, display name, avatar / PFP, avatar decoration, location, typing-bio' },
  { id: 'socials',    label: 'Social links',       desc: 'Removes every social link on your profile' },
  { id: 'buttons',    label: 'Custom buttons',     desc: 'Removes every custom button' },
  { id: 'badges',     label: 'Badge loadout',      desc: 'Unequips all badges + titles (you keep the unlocks themselves)' },
  { id: 'music',      label: 'Music',              desc: 'Music settings + the track list' },
  { id: 'effects',    label: 'Effects',            desc: 'Hover effect, cursor effect, username effect, entrance animation' },
]

// "Saved just now" / "Loaded 5m ago" / "3d ago" / fallback to date.
function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export function ProfilePresets() {
  const router = useRouter()
  const [slots, setSlots] = useState<SlotInfo[]>([])
  const [slotCount, setSlotCount] = useState(5)
  const [loading, setLoading] = useState(true)
  const [busySlot, setBusySlot] = useState<number | 'reset' | null>(null)
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [confirmState, setConfirmState] = useState<
    null | { title: string; body: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }
  >(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/presets', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load presets')
      const json = await res.json()
      setSlots(json.slots ?? [])
      setSlotCount(json.slotCount ?? 5)
    } catch (err: any) {
      console.error('[ProfilePresets] refresh failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function saveSlot(slot: number, name?: string | null) {
    setBusySlot(slot)
    try {
      const res = await fetch('/api/profile/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, name: name ?? slots.find((s) => s.slot === slot)?.name ?? null }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed')
      toast.success(`Saved preset ${slot}`)
      await refresh()
    } catch (err: any) {
      toast.error(err.message || 'Save failed')
    } finally {
      setBusySlot(null)
    }
  }

  function loadSlot(slot: number) {
    // Styled confirm instead of window.confirm(): Chrome silently suppresses
    // native dialogs after a few in a row (returns false), which made Load /
    // Delete look like they "did nothing".
    setConfirmState({
      title: 'Load this preset?',
      body: 'This replaces your current profile. Save your current look to another slot first if you want to keep it.',
      confirmLabel: 'Load preset',
      onConfirm: () => { setConfirmState(null); performLoad(slot) },
    })
  }

  async function performLoad(slot: number) {
    setBusySlot(slot)
    try {
      const res = await fetch('/api/profile/presets/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Load failed')
      toast.success(`Loaded preset ${slot}`)
      router.refresh()
      await refresh()
    } catch (err: any) {
      toast.error(err.message || 'Load failed')
    } finally {
      setBusySlot(null)
    }
  }

  function deleteSlot(slot: number) {
    setConfirmState({
      title: 'Delete this preset?',
      body: 'The saved snapshot will be permanently removed. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => { setConfirmState(null); performDelete(slot) },
    })
  }

  async function performDelete(slot: number) {
    setBusySlot(slot)
    try {
      const res = await fetch('/api/profile/presets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Delete failed')
      toast.success(`Cleared preset ${slot}`)
      await refresh()
    } catch (err: any) {
      toast.error(err.message || 'Delete failed')
    } finally {
      setBusySlot(null)
    }
  }

  async function renameSlot(slot: number, name: string) {
    setBusySlot(slot)
    try {
      const res = await fetch('/api/profile/presets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, name }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Rename failed')
      toast.success('Renamed')
      setEditingSlot(null)
      setEditingName('')
      await refresh()
    } catch (err: any) {
      toast.error(err.message || 'Rename failed')
    } finally {
      setBusySlot(null)
    }
  }

  function startEdit(slot: SlotInfo) {
    setEditingSlot(slot.slot)
    setEditingName(slot.name || `Preset ${slot.slot}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <IconLoader2 className="size-5 animate-spin" />
      </div>
    )
  }

  return (
    <>
      {/* Selective reset bar. Sits at the very top so users see the
          reset option immediately. Opens a dialog with per-category
          checkboxes; Select all does a true full wipe. */}
      <div className="-mt-2 mb-4 flex flex-col gap-3 rounded-xl border border-destructive/15 bg-destructive/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Reset profile</p>
          <p className="text-[11px] text-muted-foreground">
            Pick exactly what to wipe (theme, links, music, badges, or all of it). Save a preset first if you want to keep your current look.
          </p>
        </div>
        <button
          type="button"
          disabled={busySlot === 'reset'}
          onClick={() => setResetOpen(true)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/[0.08] px-3 text-xs font-medium text-destructive transition hover:bg-destructive/15 disabled:opacity-50"
        >
          {busySlot === 'reset' ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconRotateClockwise className="size-3.5" />}
          Choose what to reset
        </button>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        Save up to {slotCount} complete profiles (theme, bio, links, music, badges, everything) and switch between them with one click. The slot you loaded most recently is marked Active.
      </p>

      {/* 5-slot grid. Responsive: 1 col on mobile → 2 → 3 → 5 across.
          Each slot is a self-contained card with its own state (filled
          / empty / busy / editing). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {slots.map((s) => (
          <SlotCard
            key={s.slot}
            slot={s}
            busy={busySlot === s.slot}
            editing={editingSlot === s.slot}
            editingName={editingName}
            onStartEdit={() => startEdit(s)}
            onCancelEdit={() => { setEditingSlot(null); setEditingName('') }}
            onCommitEdit={() => renameSlot(s.slot, editingName.trim().slice(0, 40) || `Preset ${s.slot}`)}
            onEditingNameChange={setEditingName}
            onSave={() => saveSlot(s.slot)}
            onLoad={() => loadSlot(s.slot)}
            onDelete={() => deleteSlot(s.slot)}
          />
        ))}
      </div>

      {resetOpen && (
        <ResetDialog
          onClose={() => setResetOpen(false)}
          onConfirm={async (categories) => {
            setResetOpen(false)
            setBusySlot('reset')
            try {
              const res = await fetch('/api/profile/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categories }),
              })
              if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Reset failed')
              toast.success(`Reset ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`)
              router.refresh()
            } catch (err: any) {
              toast.error(err.message || 'Reset failed')
            } finally {
              setBusySlot(null)
            }
          }}
        />
      )}

      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          body={confirmState.body}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onCancel={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
        />
      )}
    </>
  )
}

// Styled yes/no dialog (portal). Replaces window.confirm(), which browsers
// suppress after repeated use - the cause of "Load/Delete does nothing".
function ConfirmDialog({
  title, body, confirmLabel, danger, onCancel, onConfirm,
}: {
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <div className="px-5 py-4">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground-secondary transition hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              danger
                ? 'rounded-lg bg-destructive/15 px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/25'
                : 'rounded-lg bg-primary/15 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/25'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SlotCard({
  slot, busy, editing, editingName, onStartEdit, onCancelEdit, onCommitEdit,
  onEditingNameChange, onSave, onLoad, onDelete,
}: {
  slot: SlotInfo
  busy: boolean
  editing: boolean
  editingName: string
  onStartEdit: () => void
  onCancelEdit: () => void
  onCommitEdit: () => void
  onEditingNameChange: (v: string) => void
  onSave: () => void
  onLoad: () => void
  onDelete: () => void
}) {
  const displayName = slot.name || `Preset ${slot.slot}`
  return (
    <div
      className={`group relative flex flex-col gap-3 rounded-xl border p-3 transition-all ${
        slot.active
          ? 'border-primary/40 bg-accent-soft shadow-[0_0_0_1px_rgba(232,127,160,0.15)_inset]'
          : slot.filled
            ? 'border-primary/25 bg-accent-soft'
            : 'border-dashed border-border bg-surface'
      }`}
    >
      {/* Active pill in the corner */}
      {slot.active && (
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
          <IconRosetteDiscountCheck className="size-2.5" />
          Active
        </span>
      )}

      {/* Header: slot number tag + inline-editable name */}
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
          #{slot.slot}
        </span>
        {editing ? (
          <input
            autoFocus
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitEdit()
              if (e.key === 'Escape') onCancelEdit()
            }}
            maxLength={40}
            className="min-w-0 flex-1 rounded-md border border-primary/40 bg-white/[0.04] px-1.5 py-0.5 text-sm font-semibold text-foreground outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={slot.filled ? onStartEdit : undefined}
            disabled={!slot.filled}
            className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-foreground disabled:cursor-default"
            title={slot.filled ? 'Click to rename' : ''}
          >
            {slot.filled ? displayName : 'Empty slot'}
          </button>
        )}
        {editing ? (
          <>
            <button type="button" onClick={onCommitEdit} aria-label="Confirm" className="rounded p-1 text-primary hover:bg-primary/15">
              <IconCheck className="size-3.5" />
            </button>
            <button type="button" onClick={onCancelEdit} aria-label="Cancel" className="rounded p-1 text-muted-foreground hover:bg-white/10">
              <IconX className="size-3.5" />
            </button>
          </>
        ) : slot.filled ? (
          <button
            type="button"
            onClick={onStartEdit}
            aria-label="Rename"
            className="rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-foreground-secondary"
          >
            <IconPencil className="size-3" />
          </button>
        ) : null}
      </div>

      {/* Thumbnail preview. Filled = mini profile-card render.
          Empty = subtle bookmark icon. */}
      {slot.filled && slot.preview ? (
        <Thumbnail preview={slot.preview} />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-border bg-surface">
          <IconBookmark className="size-6 text-muted-foreground" />
        </div>
      )}

      {/* Meta - saved-at + last-loaded-at timestamps */}
      <div className="space-y-0.5 text-[10px] text-muted-foreground">
        {slot.filled ? (
          <>
            <p>Saved {relativeTime(slot.saved_at)}</p>
            {slot.last_loaded_at && <p>Loaded {relativeTime(slot.last_loaded_at)}</p>}
          </>
        ) : (
          <p>Save your current profile here</p>
        )}
      </div>

      {/* Action row. Save is always available; Load + Delete only
          when filled. */}
      <div className="mt-auto flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/[0.08] px-2 text-[11px] font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-50"
        >
          {busy ? <IconLoader2 className="size-3 animate-spin" /> : <IconDeviceFloppy className="size-3" />}
          {slot.filled ? 'Overwrite' : 'Save'}
        </button>
        <button
          type="button"
          disabled={busy || !slot.filled}
          onClick={onLoad}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-2 text-[11px] font-semibold text-foreground-secondary transition hover:bg-white/[0.06] hover:text-foreground disabled:opacity-30"
        >
          <IconUpload className="size-3" />
          Load
        </button>
        <button
          type="button"
          disabled={busy || !slot.filled}
          onClick={onDelete}
          aria-label="Delete slot"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/[0.06] hover:text-destructive disabled:opacity-30"
        >
          <IconTrash className="size-3" />
        </button>
      </div>
    </div>
  )
}

// Mini profile-card render driven by the preset's preview blob.
// Used as the thumbnail on each filled slot card.
function Thumbnail({ preview }: { preview: PresetPreview }) {
  const accent = preview.accent_color || '#e87fa0'
  const bg = preview.background_color || '#0a0a0f'
  const initial = (preview.display_name || preview.username || '?')[0]?.toUpperCase() ?? '?'
  return (
    <div
      className="relative h-24 overflow-hidden rounded-lg border border-border"
      style={{ backgroundColor: bg }}
    >
      {/* Soft accent glow */}
      <div
        aria-hidden
        className="absolute -left-6 -top-6 h-16 w-16 rounded-full opacity-50 blur-2xl"
        style={{ backgroundColor: accent }}
      />
      <div className="relative flex h-full items-center gap-2 p-2.5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2"
          style={{ borderColor: accent }}
        >
          {preview.avatar_url ? (
            <img
              src={preview.avatar_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-xs font-bold" style={{ color: accent }}>{initial}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-foreground">
            {preview.display_name || preview.username || 'unnamed'}
          </p>
          {preview.bio && (
            <p className="truncate text-[9px] leading-tight text-muted-foreground">{preview.bio}</p>
          )}
          <div className="mt-1 flex gap-1 text-[9px] text-muted-foreground">
            {preview.social_count > 0 && <span>{preview.social_count} link{preview.social_count === 1 ? '' : 's'}</span>}
            {preview.button_count > 0 && <span>· {preview.button_count} btn{preview.button_count === 1 ? '' : 's'}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ResetDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (categories: ResetCategory[]) => void
}) {
  // Default to everything selected. "Choose what to reset" implies a
  // destructive operation where Reset Everything is the headline intent,
  // and the picture matches all-checked. User opts OUT of categories
  // they want to keep, not IN to categories they want to wipe.
  const [selected, setSelected] = useState<Set<ResetCategory>>(
    () => new Set(RESET_CATEGORY_LIST.map((c) => c.id)),
  )
  const allSelected = selected.size === RESET_CATEGORY_LIST.length
  const noneSelected = selected.size === 0

  function toggle(id: ResetCategory) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(RESET_CATEGORY_LIST.map((c) => c.id)))
  }

  // SSR guard - createPortal needs document, which doesn't exist on
  // the server. ResetDialog only renders when the user clicks "Choose
  // what to reset" so this is effectively always client-side, but the
  // check keeps SSR clean.
  if (typeof document === 'undefined') return null

  // Portal to document.body. Required because the dialog is rendered
  // inside a Card with backdrop-blur-sm, and CSS backdrop-filter
  // creates a containing block for ALL descendants including
  // position:fixed ones. Without the portal, `fixed inset-0` would
  // anchor to the Card's box and clip the footer below it. Same
  // pattern as components/profile/link-confirm-dialog.tsx.
  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold text-foreground">Reset which parts of your profile?</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick any combination. Identity (username, premium, badges you own) is never affected.
          </p>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-2 py-2">
          <button
            type="button"
            onClick={toggleAll}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${allSelected ? 'bg-destructive/[0.06]' : 'hover:bg-white/[0.03]'}`}
          >
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${allSelected ? 'border-destructive bg-destructive' : 'border-border-strong'}`}>
              {allSelected && <IconCheck className="size-3 text-destructive-foreground" strokeWidth={3} />}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {allSelected ? 'Deselect all' : 'Reset everything'}
            </span>
          </button>

          <div className="my-1 border-t border-border" />

          {RESET_CATEGORY_LIST.map((cat) => {
            const checked = selected.has(cat.id)
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggle(cat.id)}
                className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition ${checked ? 'bg-destructive/[0.06]' : 'hover:bg-white/[0.03]'}`}
              >
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${checked ? 'border-destructive bg-destructive' : 'border-border-strong'}`}>
                  {checked && <IconCheck className="size-3 text-destructive-foreground" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{cat.label}</span>
                  <span className="block text-[11px] leading-relaxed text-muted-foreground">{cat.desc}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground-secondary transition hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={noneSelected}
            onClick={() => onConfirm(Array.from(selected))}
            className="rounded-lg bg-destructive/15 px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset {selected.size > 0 ? `${selected.size} categor${selected.size === 1 ? 'y' : 'ies'}` : 'nothing'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export { IconBookmark as ProfilePresetsIcon }
