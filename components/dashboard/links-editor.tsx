"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { IconPlus, IconTrash, IconLoader2, IconExternalLink, IconPencil, IconX, IconCheck, IconWorld, IconPhoto, IconLink } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { SOCIAL_PLATFORMS } from "@/lib/types"
import { SocialIcon } from "@/components/profile/social-icon"
import { buildSocialUrl, validateSocialUrl } from "@/lib/url-validation"
import { uploadFile } from "@/lib/upload"
import { UploadingOverlay } from "@/components/ui/uploading-overlay"

interface SocialLink {
  id: string
  user_id: string
  platform: string
  url: string
  display_order: number
  created_at: string
  label?: string | null
  icon_url?: string | null
}

interface LinksEditorProps {
  userId: string
  socialLinks: SocialLink[]
  customButtons: any[] // Keep for backward compatibility but won't use
}

function LinkPreview({ link }: { link: SocialLink }) {
  const platform = SOCIAL_PLATFORMS.find((item) => item.id === link.platform)

  if (link.platform === "custom") {
    return (
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface">
        {link.icon_url ? (
          <div className="flex h-full w-full items-center justify-center p-2">
            <img src={link.icon_url} alt={link.label || "Custom link"} className="max-h-full max-w-full rounded-md object-contain" />
          </div>
        ) : (
          <IconWorld className="size-5 text-muted-foreground" />
        )}
      </div>
    )
  }

  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-xl border border-border"
      style={{ backgroundColor: `${platform?.color}15` }}
    >
      <SocialIcon platform={link.platform} className="h-6 w-6" style={{ color: platform?.color }} />
    </div>
  )
}

export function LinksEditor({ userId: _userId, socialLinks: initialSocialLinks }: LinksEditorProps) {
  const router = useRouter()
  const [socialLinks, setSocialLinks] = useState(initialSocialLinks)
  const [saving, setSaving] = useState(false)
  const [uploadingCustomLinkIcon, setUploadingCustomLinkIcon] = useState(false)
  const [newSocialPlatform, setNewSocialPlatform] = useState("")
  const [newSocialUrl, setNewSocialUrl] = useState("")
  const [newCustomLinkLabel, setNewCustomLinkLabel] = useState("")
  const [newCustomLinkIcon, setNewCustomLinkIcon] = useState("")
  const [editingLink, setEditingLink] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<"link" | "text">("link")
  // Explicit ref + click instead of <label htmlFor> / nested <input>
  // because the previous label wrapper had flaky click propagation
  // inside Radix's DialogContent - the focus trap would sometimes
  // intercept the click before it reached the `display:none` input,
  // so picking an icon for a brand-new custom link silently did
  // nothing.
  const customLinkIconInputRef = useRef<HTMLInputElement>(null)

  // Hard cap for the reusable `custom` platform tile. Mirrors the
  // server-side cap in app/api/social-links/route.ts so the user
  // doesn't waste a click and get a 400 toast - the tile just
  // disappears once they hit the limit.
  const CUSTOM_LINK_CAP = 10
  const customLinkCount = useMemo(
    () => socialLinks.filter((link) => link.platform === 'custom').length,
    [socialLinks],
  )

  const selectablePlatforms = useMemo(
    // Hide a platform tile after the user adds one of that platform - except
    // for `custom`, which is meant to be reused (people can have several
    // custom links pointing at different URLs) up to CUSTOM_LINK_CAP.
    () => SOCIAL_PLATFORMS.filter((platform) => {
      if (platform.id === 'custom') return customLinkCount < CUSTOM_LINK_CAP
      return !socialLinks.some((link) => link.platform === platform.id)
    }),
    [socialLinks, customLinkCount],
  )

  const uploadMedia = async (file: File, type: "button-media" | "cursor") => {
    const result = await uploadFile(file, type)
    return result.url
  }

  const resetNewLink = () => {
    setNewSocialPlatform("")
    setNewSocialUrl("")
    setNewCustomLinkLabel("")
    setNewCustomLinkIcon("")
  }

  const addSocialLink = async () => {
    // Text mode: paste raw URL + label. For the custom platform this is
    // the only path users take (custom defaults to text mode in the
    // platform picker since there's no username pattern to build from).
    if (addMode === "text") {
      if (!newSocialUrl.trim()) {
        toast.error("Enter a URL")
        return
      }
      if (!/^https?:\/\//i.test(newSocialUrl.trim())) {
        toast.error("URL must start with https://")
        return
      }
      // Custom links need a label - that's how they're identified in
      // the link row UI and the tooltip / aria-label on the rendered
      // icon. Without this gate, custom links could be added blank.
      if (newSocialPlatform === "custom" && !newCustomLinkLabel.trim()) {
        toast.error("Please enter a label for your custom link")
        return
      }
      const pl = SOCIAL_PLATFORMS.find(p => p.id === newSocialPlatform) as any
      const autoLabel = pl?.name || "Custom Link"
      setSaving(true)
      try {
        const res = await fetch("/api/social-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: newSocialPlatform || "custom",
            url: newSocialUrl.trim(),
            display_order: socialLinks.length,
            // Pass the form's label + icon_url through for custom
            // platforms. Before this, text mode hardcoded both to null,
            // so the icon the user just uploaded got discarded on
            // submit and the custom link rendered with the default
            // chain icon.
            label: newSocialPlatform === "custom" ? newCustomLinkLabel.trim() || null : null,
            icon_url: newSocialPlatform === "custom" ? newCustomLinkIcon || null : null,
          }),
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload.error || "Failed to add link")
        setSocialLinks([...socialLinks, payload.link])
        resetNewLink()
        toast.success("Link added")
        router.refresh()
      } catch (error: any) {
        toast.error(error.message || "Failed to add link")
      } finally {
        setSaving(false)
      }
      return
    }

    if (!newSocialPlatform || !newSocialUrl) {
      toast.error("Please select a platform and enter a username/URL")
      return
    }
    if (newSocialPlatform === "custom" && !newCustomLinkLabel.trim()) {
      toast.error("Please enter a label for your custom link")
      return
    }

    // Validate the URL/username
    const validation = validateSocialUrl(newSocialUrl, newSocialPlatform)
    if (!validation.valid) {
      toast.error(validation.error || "Invalid input")
      return
    }

    // Build the full URL from username
    const fullUrl = buildSocialUrl(newSocialUrl, newSocialPlatform)

    setSaving(true)
    try {
      const res = await fetch("/api/social-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: newSocialPlatform,
          url: fullUrl,
          display_order: socialLinks.length,
          label: newSocialPlatform === "custom" ? newCustomLinkLabel.trim() : null,
          icon_url: newSocialPlatform === "custom" ? newCustomLinkIcon || null : null,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "Failed to add link")
      setSocialLinks([...socialLinks, payload.link])
      resetNewLink()
      toast.success("Link added successfully")
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || "Failed to add link")
    } finally {
      setSaving(false)
    }
  }

  const updateSocialLink = async (id: string, updates: Partial<SocialLink>) => {
    const res = await fetch("/api/social-links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    })
    const payload = await res.json().catch(() => ({}))
    if (res.ok) {
      setSocialLinks(socialLinks.map((link) => (link.id === id ? { ...link, ...payload.link } : link)))
      setEditingLink(null)
      toast.success("Link updated")
      router.refresh()
    } else {
      toast.error(payload.error || "Failed to update link")
    }
  }

  const deleteSocialLink = async (id: string) => {
    const res = await fetch("/api/social-links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setSocialLinks(socialLinks.filter((link) => link.id !== id))
      toast.success("Link deleted")
      router.refresh()
    } else {
      toast.error("Failed to delete link")
    }
  }

  const reorderSocialLinks = async (srcId: string, dstId: string) => {
    if (srcId === dstId) return
    const sorted = [...socialLinks].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    const fromIdx = sorted.findIndex(x => x.id === srcId)
    const toIdx = sorted.findIndex(x => x.id === dstId)
    if (fromIdx < 0 || toIdx < 0) return
    const moved = sorted.splice(fromIdx, 1)[0]
    sorted.splice(toIdx, 0, moved)
    const next = sorted.map((l, i) => ({ ...l, display_order: i }))
    setSocialLinks(next)
    await Promise.all(next.map(l =>
      fetch('/api/social-links', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: l.id, display_order: l.display_order }) })
    ))
  }

  const moveSocialLink = async (id: string, dir: 'up' | 'down') => {
    const sorted = [...socialLinks].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    const idx = sorted.findIndex(x => x.id === id)
    if (idx < 0) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const a = sorted[idx]
    const b = sorted[swapIdx]
    const aOrder = a.display_order ?? idx
    const bOrder = b.display_order ?? swapIdx
    setSocialLinks(prev => prev.map(l => l.id === a.id ? { ...l, display_order: bOrder } : l.id === b.id ? { ...l, display_order: aOrder } : l))
    await Promise.all([
      fetch('/api/social-links', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, display_order: bOrder }) }),
      fetch('/api/social-links', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, display_order: aOrder }) }),
    ])
  }

  const uploadCustomLinkIcon = async (file: File) => {
    setUploadingCustomLinkIcon(true)
    try {
      const url = await uploadMedia(file, "button-media")
      setNewCustomLinkIcon(url)
      toast.success("Icon uploaded")
    } catch (error: any) {
      // Stable id so back-to-back upload failures (e.g. hitting the
      // upload rate limit while spamming the file picker) collapse
      // into a single toast instead of piling up dozens.
      toast.error(error.message || "Failed to upload icon", { id: 'upload-error' })
    } finally {
      setUploadingCustomLinkIcon(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Current Links */}
        <Card className="border-border bg-surface backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
                <IconLink className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg text-foreground">Your Links</CardTitle>
                <CardDescription className="text-muted-foreground">Click any link to edit it</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {socialLinks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 py-12">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2">
                  <IconLink className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No links added yet</p>
                <p className="text-xs text-muted-foreground">Add your first link below</p>
              </div>
            ) : (
              <div className="space-y-2">
                {socialLinks.map((link) => {
                  const platform = SOCIAL_PLATFORMS.find((item) => item.id === link.platform)
                  const isEditing = editingLink === link.id

                  if (isEditing) {
                    return (
                      <div key={link.id} className="rounded-xl border border-primary/30 bg-accent-soft p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <LinkPreview link={link} />
                          <div className="flex flex-1 flex-wrap items-center gap-2">
                            {link.platform === "custom" && (
                              <Input
                                value={link.label || ""}
                                onChange={(e) => setSocialLinks(socialLinks.map((item) => (item.id === link.id ? { ...item, label: e.target.value } : item)))}
                                placeholder="Label"
                                className="w-32 border-border bg-surface-2"
                              />
                            )}
                            <Input
                              value={link.url}
                              onChange={(e) => setSocialLinks(socialLinks.map((item) => (item.id === link.id ? { ...item, url: e.target.value } : item)))}
                              placeholder="URL"
                              className="min-w-[200px] flex-1 border-border bg-surface-2"
                              autoFocus
                            />
                            {link.platform === "custom" && (
                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-3 py-2 text-xs transition hover:bg-surface-2">
                                <input
                                  type="file"
                                  accept="image/*,image/gif"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    try {
                                      const url = await uploadMedia(file, "button-media")
                                      setSocialLinks(socialLinks.map((item) => (item.id === link.id ? { ...item, icon_url: url } : item)))
                                    } catch (error: any) {
                                      toast.error(error.message || "Failed to upload icon", { id: 'upload-error' })
                                    }
                                  }}
                                  className="hidden"
                                />
                                <IconPhoto className="size-3.5 text-muted-foreground" />
                                <span className="text-foreground-secondary">Icon</span>
                              </label>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateSocialLink(link.id, { url: link.url, label: link.label, icon_url: link.icon_url })}
                              className="h-9 w-9 rounded-lg text-primary hover:bg-accent-soft hover:text-primary"
                            >
                              <IconCheck className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingLink(null)}
                              className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground-secondary"
                            >
                              <IconX className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteSocialLink(link.id)}
                              className="h-9 w-9 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <IconTrash className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={link.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', link.id); e.dataTransfer.effectAllowed = 'move' }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                      onDrop={(e) => { e.preventDefault(); const srcId = e.dataTransfer.getData('text/plain'); if (srcId) reorderSocialLinks(srcId, link.id) }}
                      onClick={() => setEditingLink(link.id)}
                      className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-surface p-3 transition-all hover:border-border-strong hover:bg-surface-2"
                    >
                      <span className="cursor-grab text-muted-foreground hover:text-foreground-secondary active:cursor-grabbing" title="Drag to reorder" onClick={(e) => e.stopPropagation()}>
                        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
                      </span>
                      <LinkPreview link={link} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {link.platform === "custom" ? (link.label || "Custom Link") : platform?.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{link.url}</p>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <button onClick={(e) => { e.stopPropagation(); moveSocialLink(link.id, 'up') }} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-surface-2 hover:text-foreground-secondary" title="Move up">
                          <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); moveSocialLink(link.id, 'down') }} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-surface-2 hover:text-foreground-secondary" title="Move down">
                          <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); window.open(link.url, "_blank") }}
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground-secondary"
                        >
                          <IconExternalLink className="size-3.5" />
                        </Button>
                        <IconPencil className="size-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add New Link */}
        <Card className="border-border bg-surface backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
                <IconPlus className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg text-foreground">Add New Link</CardTitle>
                <CardDescription className="text-muted-foreground">Choose a platform or create a custom link</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Platform tile grid - click a tile to open the add modal */}
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {selectablePlatforms.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => {
                    setNewSocialPlatform(platform.id)
                    setNewSocialUrl("")
                    setNewCustomLinkLabel("")
                    setNewCustomLinkIcon("")
                    setAddMode(platform.id === "custom" ? "text" : "link")
                  }}
                  className="group flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface p-2 transition hover:border-border-strong hover:bg-surface-2"
                  style={{ boxShadow: `inset 0 0 0 1px ${(platform as any).color}12` }}
                >
                  {platform.id === "custom" ? (
                    <IconWorld className="size-6 text-foreground-secondary" />
                  ) : (
                    <SocialIcon platform={platform.id} className="h-6 w-6" style={{ color: (platform as any).color }} />
                  )}
                  <span className="truncate text-[10px] font-medium text-muted-foreground group-hover:text-foreground-secondary">
                    {platform.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Add modal */}
            <Dialog
              open={!!newSocialPlatform}
              onOpenChange={(open) => { if (!open) { setNewSocialPlatform(""); resetNewLink() } }}
            >
              <DialogContent
                className="border-border bg-surface text-foreground sm:max-w-lg"
                style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 20px 50px -20px rgba(0,0,0,0.55)' }}
              >
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-foreground">
                    {newSocialPlatform && newSocialPlatform !== "custom" ? (
                      <>
                        <SocialIcon
                          platform={newSocialPlatform}
                          className="h-5 w-5"
                          style={{ color: (SOCIAL_PLATFORMS.find(p => p.id === newSocialPlatform) as any)?.color }}
                        />
                        Add {(SOCIAL_PLATFORMS.find(p => p.id === newSocialPlatform) as any)?.name}
                      </>
                    ) : (
                      <><IconWorld className="size-5" /> Add Custom Link</>
                    )}
                  </DialogTitle>
                </DialogHeader>

                {/* Mode toggle (only for normal platforms with a URL template) */}
                {(() => {
                  const pl = SOCIAL_PLATFORMS.find(p => p.id === newSocialPlatform) as any
                  const isCopyOnly = pl?.copyOnly
                  const hasTemplate = !!pl?.urlTemplate
                  if (!newSocialPlatform || newSocialPlatform === "custom" || isCopyOnly || !hasTemplate) return null
                  return (
                    <div className="inline-flex self-start rounded-xl border border-border bg-surface p-1">
                      <button
                        type="button"
                        onClick={() => { setAddMode("link"); setNewSocialUrl(""); setNewCustomLinkLabel("") }}
                        className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${addMode === "link" ? "bg-accent-soft text-primary" : "text-muted-foreground hover:text-foreground-secondary"}`}
                      >
                        Link
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAddMode("text"); setNewSocialUrl(""); setNewCustomLinkLabel("") }}
                        className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${addMode === "text" ? "bg-accent-soft text-primary" : "text-muted-foreground hover:text-foreground-secondary"}`}
                      >
                        Text
                      </button>
                    </div>
                  )
                })()}

                <div className="space-y-3">
                  {(() => {
                    const pl = SOCIAL_PLATFORMS.find(p => p.id === newSocialPlatform) as any
                    const isCopyOnly = pl?.copyOnly
                    const hasTemplate = !!pl?.urlTemplate
                    const isCustom = newSocialPlatform === "custom"

                    // Crypto / copyOnly: single raw address field
                    if (isCopyOnly) {
                      return (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Wallet address</label>
                          <Input
                            value={newSocialUrl}
                            onChange={(e) => setNewSocialUrl(e.target.value)}
                            placeholder={pl.placeholder}
                            className="h-11 border-border bg-surface-2 font-mono focus:border-primary/40"
                          />
                          <p className="text-[11px] text-muted-foreground">Visitors will copy this address with one click, no URL built.</p>
                        </div>
                      )
                    }

                    // Custom link: full UI with label + URL + icon uploader.
                    // Lives in the same dialog (used to be edit-only - moved
                    // here so people can build a custom link from scratch
                    // without saving an empty row first).
                    if (isCustom) {
                      return (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Label</label>
                            <Input
                              value={newCustomLinkLabel}
                              onChange={(e) => setNewCustomLinkLabel(e.target.value)}
                              placeholder="e.g. My Portfolio"
                              maxLength={60}
                              className="h-11 border-border bg-surface-2 focus:border-primary/40"
                              autoFocus
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">URL</label>
                            <Input
                              value={newSocialUrl}
                              onChange={(e) => setNewSocialUrl(e.target.value)}
                              placeholder="https://example.com"
                              className="h-11 border-border bg-surface-2 focus:border-primary/40"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">
                              Icon <span className="text-muted-foreground">(optional, up to 5 MB)</span>
                            </label>
                            <div
                              role="button"
                              tabIndex={uploadingCustomLinkIcon ? -1 : 0}
                              aria-disabled={uploadingCustomLinkIcon}
                              onClick={() => { if (!uploadingCustomLinkIcon) customLinkIconInputRef.current?.click() }}
                              onKeyDown={(e) => {
                                if (uploadingCustomLinkIcon) return
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  customLinkIconInputRef.current?.click()
                                }
                              }}
                              className={`relative flex h-20 items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed border-border bg-surface px-3 transition hover:border-primary/30 hover:bg-surface-2 focus:outline-none focus:ring-1 focus:ring-primary/40 ${uploadingCustomLinkIcon ? 'cursor-wait' : 'cursor-pointer'}`}
                            >
                              {/* The input is rendered as a sibling
                                  (not nested in a label) and triggered
                                  programmatically via the ref above.
                                  Avoids the Radix DialogContent focus-
                                  trap quirk that swallowed clicks on
                                  hidden inputs nested in labels. */}
                              <input
                                ref={customLinkIconInputRef}
                                type="file"
                                accept="image/*,image/gif"
                                disabled={uploadingCustomLinkIcon}
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) uploadCustomLinkIcon(f)
                                  e.target.value = ''
                                }}
                                className="hidden"
                              />
                              {newCustomLinkIcon ? (
                                <>
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2 p-1.5">
                                    <img src={newCustomLinkIcon} alt="" className="max-h-full max-w-full rounded object-contain" />
                                  </div>
                                  <div className="flex-1 text-left">
                                    <p className="text-sm font-medium text-foreground">Icon ready</p>
                                    <p className="text-xs text-muted-foreground">Click to replace</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNewCustomLinkIcon("") }}
                                    className="rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/20"
                                  >
                                    <IconTrash className="size-3" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2">
                                    <IconPhoto className="size-4 text-muted-foreground" />
                                  </div>
                                  <div className="text-left">
                                    <p className="text-sm font-medium text-foreground-secondary">Click to upload icon</p>
                                    <p className="text-[11px] text-muted-foreground">PNG / JPG / WebP / GIF · up to 5 MB</p>
                                  </div>
                                </>
                              )}
                              {uploadingCustomLinkIcon && <UploadingOverlay />}
                            </div>
                          </div>
                        </>
                      )
                    }

                    // Link mode with URL template: show prefix
                    if (addMode === "link" && hasTemplate) {
                      return (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Username</label>
                          <div className="flex items-stretch overflow-hidden rounded-xl border border-border bg-surface-2 focus-within:border-primary/40">
                            <span className="flex items-center bg-surface-3 px-3 text-xs text-muted-foreground">
                              {(pl.urlTemplate || "").replace(/^https?:\/\//, "").replace("{username}", "")}
                            </span>
                            <Input
                              value={newSocialUrl}
                              onChange={(e) => setNewSocialUrl(e.target.value)}
                              placeholder={pl.placeholder || "username..."}
                              className="h-11 flex-1 border-0 bg-transparent focus-visible:ring-0"
                            />
                          </div>
                        </div>
                      )
                    }

                    // Text mode or no template - show URL field only
                    return (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">URL</label>
                        <Input
                          value={newSocialUrl}
                          onChange={(e) => setNewSocialUrl(e.target.value)}
                          placeholder="https://example.com"
                          className="h-11 border-border bg-surface-2 focus:border-primary/40"
                          autoFocus
                        />
                      </div>
                    )
                  })()}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="ghost"
                      onClick={() => { setNewSocialPlatform(""); resetNewLink() }}
                      className="text-foreground-secondary hover:text-foreground"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={addSocialLink}
                      disabled={saving || uploadingCustomLinkIcon || !newSocialUrl || (newSocialPlatform === "custom" && !newCustomLinkLabel.trim())}
                      className="rounded-xl bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? <IconLoader2 className="size-4 animate-spin" /> : <><IconPlus className="mr-1 size-4" />Add Link</>}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
