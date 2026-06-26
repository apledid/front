'use client'

import { useEffect, useState } from 'react'
import { IconCopy, IconLoader2, IconPencil, IconPlus } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { TemplateRow } from './template-card'

export type TemplateFormMode = 'create' | 'edit' | 'duplicate'

interface TemplateFormState {
  name: string
  description: string
  preview_image: string
  tags: string
  visibility: 'public' | 'private'
}

function defaultsFor(mode: TemplateFormMode, source?: TemplateRow | null): TemplateFormState {
  if (mode === 'edit' && source) {
    return {
      name: source.name || '',
      description: source.description || '',
      preview_image: source.preview_image || '',
      tags: (source.tags || []).join(', '),
      visibility: source.visibility === 'private' ? 'private' : 'public',
    }
  }
  if (mode === 'duplicate' && source) {
    return {
      name: `${source.name || 'Template'} remix`,
      description: source.description || '',
      preview_image: source.preview_image || '',
      tags: (source.tags || []).join(', '),
      visibility: 'public',
    }
  }
  return { name: '', description: '', preview_image: '', tags: '', visibility: 'public' }
}

const MODE_META: Record<TemplateFormMode, { title: string; submitLabel: string; icon: React.ComponentType<{ className?: string }>; hint: string }> = {
  create: {
    title: 'Create Template',
    submitLabel: 'Create Template',
    icon: IconPlus,
    hint: 'Snapshots your current profile styling, social links, buttons, music tracks and widgets. Free accounts get 3 slots, premium gets 10.',
  },
  edit: {
    title: 'Edit Template',
    submitLabel: 'Save changes',
    icon: IconPencil,
    hint: 'Update the listing details. The captured styling stays the same - to update the look, delete and re-create.',
  },
  duplicate: {
    title: 'Duplicate Template',
    submitLabel: 'Save as my template',
    icon: IconCopy,
    hint: 'Clones the styling, links, buttons, music and widgets from the source template into a new template you own. Doesn\'t touch your current live profile.',
  },
}

interface TemplateFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: TemplateFormMode
  source?: TemplateRow | null
  /** Called with the new/updated template after a successful save. */
  onSuccess?: (template: TemplateRow) => void
}

export function TemplateFormModal({ open, onOpenChange, mode, source, onSuccess }: TemplateFormModalProps) {
  const [form, setForm] = useState<TemplateFormState>(() => defaultsFor(mode, source))
  const [busy, setBusy] = useState(false)
  const [uploadingPreview, setUploadingPreview] = useState(false)

  // Reset form whenever the modal re-opens with a different source or mode
  // (e.g. user clicks Edit on one template, closes, then clicks Edit on another).
  useEffect(() => {
    if (open) setForm(defaultsFor(mode, source))
  }, [open, mode, source])

  const meta = MODE_META[mode]
  const Icon = meta.icon

  async function uploadPreview(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Only images allowed')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Max 4MB')
      return
    }
    setUploadingPreview(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'button-media')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Upload failed')
      setForm((f) => ({ ...f, preview_image: j.url }))
      toast.success('Preview uploaded')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploadingPreview(false)
    }
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error('Name required')
      return
    }
    setBusy(true)
    try {
      const tagsArr = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      let res: Response
      if (mode === 'edit') {
        if (!source) throw new Error('No template to edit')
        res = await fetch('/api/templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: source.id,
            name: form.name,
            description: form.description,
            preview_image: form.preview_image,
            tags: tagsArr,
            visibility: form.visibility,
          }),
        })
      } else {
        // create + duplicate both POST; duplicate passes source_template_id
        // to clone the source's config instead of snapshotting the user's
        // current profile.
        res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            preview_image: form.preview_image,
            tags: tagsArr,
            visibility: form.visibility,
            ...(mode === 'duplicate' && source ? { source_template_id: source.id } : {}),
          }),
        })
      }

      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || 'Failed')

      onSuccess?.(j.template as TemplateRow)
      onOpenChange(false)

      if (mode === 'edit') toast.success('Template updated')
      else if (mode === 'duplicate') toast.success('Duplicated to your templates')
      else toast.success('Template created from your current profile')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-4 text-primary" />
            {meta.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-foreground-secondary">{meta.hint}</p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Template Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value.slice(0, 80) })}
              placeholder="My New Template"
              className="h-11 border-border bg-surface-2"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 500) })}
              placeholder="Describe your template (optional)"
              className="min-h-[80px] w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Preview Image (optional)</label>
            {form.preview_image ? (
              <div className="relative overflow-hidden rounded-xl border border-border bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.preview_image} alt="Preview" className="h-40 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, preview_image: '' })}
                  className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-[10px] text-foreground-secondary hover:bg-black/80"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label
                className={`flex h-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-surface-2 text-xs text-muted-foreground transition hover:border-border-strong hover:text-foreground-secondary ${
                  uploadingPreview ? 'opacity-60' : ''
                }`}
              >
                {uploadingPreview ? <IconLoader2 className="size-4 animate-spin" /> : 'Click to upload preview image (max 4MB)'}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingPreview}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) uploadPreview(f)
                    e.target.value = ''
                  }}
                  className="hidden"
                />
              </label>
            )}
            <Input
              value={form.preview_image}
              onChange={(e) => setForm({ ...form, preview_image: e.target.value })}
              placeholder="or paste image URL"
              className="h-9 border-border bg-surface-2 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tags (comma separated)</label>
            <Input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="aesthetic, dark, minimal"
              className="h-11 border-border bg-surface-2"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Visibility</label>
            <select
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value as 'public' | 'private' })}
              className="h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm text-foreground outline-none focus:border-primary/40"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>

          <Button
            disabled={busy || !form.name.trim()}
            onClick={submit}
            className="w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {busy ? <IconLoader2 className="size-4 animate-spin" /> : meta.submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
