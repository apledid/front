'use client'

import { useMemo, useRef, useState } from 'react'
import { IconPhoto, IconWorld, IconTrash, IconUpload, IconLoader2, IconEye, IconPalette } from '@tabler/icons-react'
import type { Profile } from '@/lib/types'
import { toast } from 'sonner'
import { UnsavedChangesBar } from '@/components/dashboard/unsaved-changes-bar'
import { uploadFile as sharedUpload } from '@/lib/upload'

// 6 preset colors users can pick with one click. Tuned to be visually
// distinct on the Discord embed accent strip.
const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: 'Halo pink',     value: '#e87fa0' },
  { label: 'Royal purple',  value: '#a855f7' },
  { label: 'Mint',          value: '#34d399' },
  { label: 'Gold',          value: '#fbbf24' },
  { label: 'Crimson',       value: '#ef4444' },
  { label: 'Electric blue', value: '#3b82f6' },
]

function SectionHeading({ icon: Icon, title }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  title: string
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-accent-soft">
        <Icon className="size-4 text-primary" />
      </span>
      <h2 className="text-[1.15rem] font-bold tracking-tight text-foreground">
        {title}
      </h2>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-border bg-surface p-5 backdrop-blur-sm hover:border-border-strong"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.5)' }}
    >
      {children}
    </div>
  )
}

interface Props {
  profile: Profile
}

interface FormState {
  embed_title: string
  embed_description: string
  embed_image_url: string
  favicon_url: string
  embed_color: string
}

function fromProfile(p: Profile): FormState {
  return {
    embed_title: p.embed_title || '',
    embed_description: p.embed_description || '',
    embed_image_url: p.embed_image_url || '',
    favicon_url: p.favicon_url || '',
    embed_color: p.embed_color || '#e87fa0',
  }
}

export default function MetadataClient({ profile }: Props) {
  const [form, setForm] = useState<FormState>(() => fromProfile(profile))
  // savedSnapshot is the last successfully persisted form. We compare
  // `form` against it for the dirty check. The original `profile` prop
  // never refreshes (server component prop), so without this the bar
  // would stay open after every successful save.
  const [savedSnapshot, setSavedSnapshot] = useState<FormState>(() => fromProfile(profile))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'embed-image' | 'favicon' | null>(null)
  const imageFileRef = useRef<HTMLInputElement>(null)
  const faviconFileRef = useRef<HTMLInputElement>(null)

  const patch = (u: Partial<FormState>) => setForm((p) => ({ ...p, ...u }))

  const save = async () => {
    setSaving(true)
    // Snapshot the form at the moment of save - if the user edits while
    // the request is in-flight, we still record the saved payload
    // accurately and the new edits will register as dirty again.
    const payload = form
    try {
      const res = await fetch('/api/appearance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embed_title: payload.embed_title || null,
          embed_description: payload.embed_description || null,
          embed_image_url: payload.embed_image_url || null,
          favicon_url: payload.favicon_url || null,
          embed_color: payload.embed_color || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Save failed')
      setSavedSnapshot(payload)
      toast.success('Profile metadata saved.')
    } catch (e: any) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const uploadFile = async (file: File, type: 'embed-image' | 'favicon') => {
    setUploading(type)
    try {
      // Shared helper enforces per-type size limits + chunks large files.
      // We get "File size too big, file size limit is X MB" for free here.
      const r = await sharedUpload(file, type)
      patch(type === 'favicon' ? { favicon_url: r.url } : { embed_image_url: r.url })
      toast.success(`${type === 'favicon' ? 'Favicon' : 'Embed image'} uploaded.`)
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed')
    } finally {
      setUploading(null)
    }
  }

  const previewTitle = form.embed_title || profile.display_name || profile.username || 'your.handle'
  const previewDescription = form.embed_description || profile.bio || `Check out ${previewTitle}'s profile on halo.rip`
  const previewImage = form.embed_image_url || profile.avatar_url || null
  const previewColor = /^#[0-9a-fA-F]{3,6}$/.test(form.embed_color) ? form.embed_color : '#e87fa0'

  // Dirty state: any field different from the last saved snapshot.
  const dirty = useMemo(() => (
    form.embed_title       !== savedSnapshot.embed_title       ||
    form.embed_description !== savedSnapshot.embed_description ||
    form.embed_image_url   !== savedSnapshot.embed_image_url   ||
    form.favicon_url       !== savedSnapshot.favicon_url       ||
    form.embed_color       !== savedSnapshot.embed_color
  ), [form, savedSnapshot])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-accent-soft">
          <IconWorld className="size-5 text-primary" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profile Metadata</h1>
          <p className="text-sm text-muted-foreground">
            Customize how your profile looks when the link is shared on Discord, Twitter, iMessage, etc.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Form column */}
        <div className="space-y-5">
          {/* Embed Card section */}
          <Card>
            <SectionHeading icon={IconPalette} title="Embed card" />
            <div className="space-y-5">
              {/* Embed Title */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground-secondary">Embed title</span>
                  <span className="text-xs text-muted-foreground/70">{form.embed_title.length}/60</span>
                </div>
                <input
                  type="text"
                  maxLength={60}
                  value={form.embed_title}
                  onChange={(e) => patch({ embed_title: e.target.value })}
                  placeholder={profile.display_name || profile.username || 'Custom title'}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground/60 outline-none focus:border-[color:var(--accent)] transition-colors"
                />
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">Falls back to your username overlay if blank.</p>
              </div>

              {/* Embed Description */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground-secondary">Embed description</span>
                  <span className="text-xs text-muted-foreground/70">{form.embed_description.length}/160</span>
                </div>
                <textarea
                  maxLength={160}
                  rows={3}
                  value={form.embed_description}
                  onChange={(e) => patch({ embed_description: e.target.value })}
                  placeholder={profile.bio || 'A short description shown under the title.'}
                  className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground/60 outline-none focus:border-[color:var(--accent)] transition-colors"
                />
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">Falls back to your bio if blank.</p>
              </div>

              {/* Embed Color */}
              <div>
                <span className="mb-1.5 block text-sm font-medium text-foreground-secondary">Embed color</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={previewColor}
                    onChange={(e) => patch({ embed_color: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent"
                    aria-label="Pick embed color"
                  />
                  <input
                    type="text"
                    value={form.embed_color}
                    onChange={(e) => patch({ embed_color: e.target.value })}
                    placeholder="#e87fa0"
                    className="flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2.5 font-mono text-sm uppercase text-foreground placeholder-muted-foreground/60 outline-none focus:border-[color:var(--accent)] transition-colors"
                  />
                </div>
                {/* Preset swatches - one-click selection */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => patch({ embed_color: p.value })}
                      className="group relative h-7 w-7 rounded-lg border border-border transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                      style={{ background: p.value }}
                      aria-label={`Set embed color to ${p.label}`}
                      title={p.label}
                    >
                      {form.embed_color.toLowerCase() === p.value.toLowerCase() && (
                        <span
                          aria-hidden
                          className="absolute -inset-px rounded-lg ring-2 ring-white"
                        />
                      )}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                  Discord shows this as the accent strip on the left of the embed. Twitter ignores it.
                </p>
              </div>
            </div>
          </Card>

          {/* Uploads section */}
          <Card>
            <SectionHeading icon={IconUpload} title="Uploads" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <UploadTile
                label="Embed image"
                description="Shown when your link is shared. Falls back to your avatar."
                sizeHint="PNG / JPG / WebP / GIF · up to 25 MB"
                accept="image/png,image/jpeg,image/webp,image/gif"
                value={form.embed_image_url}
                onClear={() => patch({ embed_image_url: '' })}
                onFile={(f) => uploadFile(f, 'embed-image')}
                uploading={uploading === 'embed-image'}
                inputRef={imageFileRef}
              />
              <UploadTile
                label="Favicon"
                description="The little icon in browser tabs."
                sizeHint="Square PNG / ICO · up to 4 MB"
                accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg,image/webp"
                value={form.favicon_url}
                onClear={() => patch({ favicon_url: '' })}
                onFile={(f) => uploadFile(f, 'favicon')}
                uploading={uploading === 'favicon'}
                inputRef={faviconFileRef}
              />
            </div>
          </Card>

          <p className="text-center text-[11px] text-white/35">
            Changes can take up to a minute to show up across Discord and Twitter. They cache aggressively.
          </p>
        </div>

        {/* Live Preview column */}
        <aside className="space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <IconEye className="size-3.5" />
            Live preview
          </div>

          {/* Discord-style preview - image shown ABOVE the title for the
              large-image embed layout Discord uses by default. */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0e0e11] p-4">
            <p className="mb-3 text-[11px] uppercase tracking-wider text-white/35">Discord</p>
            <div
              className="overflow-hidden rounded-md border-l-4 bg-[#2b2d31] px-3 py-2.5"
              style={{ borderLeftColor: previewColor }}
            >
              {previewImage && (
                <div className="mb-2 overflow-hidden rounded-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewImage} alt="" className="aspect-[1.91/1] w-full object-cover" />
                </div>
              )}
              <p className="mb-0.5 text-[12px] font-semibold text-white/90">halo.rip</p>
              <p className="text-[14px] font-bold leading-tight text-[#00a8fc]">{previewTitle}</p>
              <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-[#dbdee1]">{previewDescription}</p>
            </div>
          </div>

          {/* Browser tab preview - two stacked rounded tabs so the favicon
              renders at its real ~16px display size in context. */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0e0e11] p-4">
            <p className="mb-3 text-[11px] uppercase tracking-wider text-white/35">Browser tab</p>
            <div className="flex items-end gap-1.5">
              <div className="inline-flex max-w-[180px] items-center gap-2 rounded-t-lg bg-[#202225] px-3 py-2 ring-1 ring-white/[0.04]">
                {form.favicon_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.favicon_url} alt="" className="h-4 w-4 rounded-sm" />
                ) : (
                  <IconWorld className="size-4 text-muted-foreground" />
                )}
                <span className="truncate text-xs text-white/85">@{profile.username}</span>
              </div>
              <div className="inline-flex max-w-[140px] items-center gap-2 rounded-t-lg bg-[#161616] px-3 py-2 opacity-60">
                <div className="h-4 w-4 rounded-sm bg-white/[0.06]" />
                <span className="truncate text-xs text-white/35">discord</span>
              </div>
            </div>
            <div className="mt-px h-px w-full bg-white/[0.06]" />
          </div>
        </aside>
      </div>

      {/* Sticky save bar - shared component used everywhere else in the
          dashboard. Portaled to body, animated slide-in, consistent
          styling. */}
      <UnsavedChangesBar
        show={dirty}
        saving={saving}
        onSave={save}
        onReset={() => setForm(savedSnapshot)}
        label="metadata"
      />
    </div>
  )
}

function UploadTile({
  label,
  description,
  sizeHint,
  accept,
  value,
  onFile,
  onClear,
  uploading,
  inputRef,
}: {
  label: string
  description: string
  /** Small mono-style hint shown under the description. */
  sizeHint?: string
  accept: string
  value: string
  onFile: (f: File) => void
  onClear: () => void
  uploading: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-foreground-secondary">{label}</p>
      <div
        className="relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-2 hover:border-primary/30 hover:bg-surface-3 transition"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] text-white/80 hover:bg-black/90"
            >
              <IconTrash className="size-3" />
              Remove
            </button>
          </>
        ) : uploading ? (
          <div className="flex flex-col items-center gap-2 text-foreground-secondary">
            <IconLoader2 className="size-5 animate-spin" />
            <span className="text-xs">Uploading…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3">
              {label.includes('Favicon') ? <IconWorld className="size-4" /> : <IconPhoto className="size-4" />}
            </div>
            <span className="text-xs">
              <span className="text-foreground-secondary">Click to upload</span>
            </span>
          </div>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{description}</p>
      {sizeHint ? (
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/60">{sizeHint}</p>
      ) : null}
      {value && !uploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-foreground-secondary hover:text-foreground"
        >
          <IconUpload className="size-3" />
          Replace
        </button>
      )}
    </div>
  )
}
