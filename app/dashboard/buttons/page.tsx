"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IconPlus, IconTrash, IconExternalLink, IconLoader2, IconUpload, IconPhoto, IconPointer, IconPencil, IconX } from "@tabler/icons-react"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import type { CustomButton } from "@/lib/types"
import { uploadFile, maxSizeFor, formatBytes } from "@/lib/upload"

// Source-of-truth limit string for button icons. Pulled from the
// shared MAX_SIZE_BY_TYPE map so the UI label can never drift away
// from the actual server cap. Hard-coding "max 25MB" here previously
// confused users who hit a 5MB rejection toast from the upload route.
const BUTTON_ICON_LIMIT_LABEL = `max ${formatBytes(maxSizeFor('button-media'))}`

type EditableButton = CustomButton & {
  media_url?: string | null
  media_type?: string | null
  disable_background?: boolean | null
}

export default function ButtonsPage() {
  const [buttons, setButtons] = useState<EditableButton[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [editingButton, setEditingButton] = useState<string | null>(null)
  const [editedButtonData, setEditedButtonData] = useState<Partial<EditableButton>>({})
  const [newButton, setNewButton] = useState({
    label: "",
    url: "",
    bg_color: "#e87fa0",
    text_color: "#ffffff",
    media_url: "",
    media_type: "image",
    disable_background: false,
  })

  useEffect(() => {
    async function fetchData() {
      const buttonsRes = await fetch("/api/custom-buttons/list")
      if (buttonsRes.ok) {
        const { buttons: buttonsData } = await buttonsRes.json()
        setButtons(buttonsData || [])
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const startEditing = (button: EditableButton) => {
    setEditingButton(button.id)
    setEditedButtonData({ ...button })
  }

  const handleEditChange = (field: keyof EditableButton, value: string) => {
    setEditedButtonData(prev => ({ ...prev, [field]: value }))
  }

  const saveButtonEdits = async () => {
    if (!editingButton || !editedButtonData) return
    setSaving(true)
    try {
      const res = await fetch("/api/custom-buttons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingButton, ...editedButtonData }),
      })
      if (res.ok) {
        setButtons(buttons.map((btn) => (btn.id === editingButton ? { ...btn, ...editedButtonData } : btn)))
        setEditingButton(null)
        setEditedButtonData({})
        toast.success("Button saved!")
      }
    } catch (error) {
      toast.error("Failed to save button")
    } finally {
      setSaving(false)
    }
  }

  const cancelEditing = () => {
    setEditingButton(null)
    setEditedButtonData({})
  }

  const uploadButtonMedia = async (file: File, forNew: boolean = true) => {
    setUploadingMedia(true)
    try {
      const result = await uploadFile(file, "button-media")
      const mediaType = file.type.includes("gif") ? "gif" : "image"
      
      if (forNew) {
        setNewButton((current) => ({ ...current, media_url: result.url, media_type: mediaType }))
      } else {
        setEditedButtonData(prev => ({ ...prev, media_url: result.url, media_type: mediaType }))
      }
      toast.success("Media uploaded")
    } catch (error: any) {
      toast.error(error.message || "Failed to upload media", { id: 'upload-error' })
    } finally {
      setUploadingMedia(false)
    }
  }

  const handleAddButton = async () => {
    if (!newButton.label || !newButton.url) {
      toast.error("Please fill in both label and URL")
      return
    }
    if (buttons.length >= 3) {
      toast.error("Maximum 3 buttons allowed")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/custom-buttons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newButton.label,
          url: newButton.url,
          bg_color: newButton.bg_color,
          text_color: newButton.text_color,
          display_order: buttons.length,
          media_url: newButton.media_url || null,
          media_type: newButton.media_type || null,
          disable_background: newButton.disable_background || false,
        }),
      })

      if (res.ok) {
        const { button } = await res.json()
        setButtons([...buttons, button])
        setNewButton({
          label: "",
          url: "",
          bg_color: "#e87fa0",
          text_color: "#ffffff",
          media_url: "",
          media_type: "image",
          disable_background: false,
        })
        toast.success("Button added!")
      } else {
        const error = await res.json()
        toast.error(error.error || "Failed to add button")
      }
    } catch (error) {
      toast.error("Failed to add button")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteButton = async (id: string) => {
    try {
      const res = await fetch("/api/custom-buttons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      if (res.ok) {
        setButtons(buttons.filter((button) => button.id !== id))
        toast.success("Button deleted")
      } else {
        const error = await res.json()
        toast.error(error.error || "Failed to delete button")
      }
    } catch (error) {
      toast.error("Failed to delete button")
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <IconLoader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Custom Buttons</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add call-to-action buttons with custom styling</p>
      </div>

      {/* Current Buttons */}
      <Card className="border-border bg-surface backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
              <IconPointer className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">Your Buttons</CardTitle>
              <CardDescription className="text-muted-foreground">{buttons.length}/3 buttons used</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {buttons.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-2 py-12">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-3">
                <IconPointer className="size-6 text-muted-foreground/70" />
              </div>
              <p className="text-sm text-muted-foreground">No buttons added yet</p>
              <p className="text-xs text-muted-foreground/60">Create your first button below</p>
            </div>
          ) : (
            <div className="space-y-3">
              {buttons.map((button) => {
                const isEditing = editingButton === button.id
                const editData = isEditing ? editedButtonData : button
                
                if (isEditing) {
                  return (
                    <div key={button.id} className="rounded-xl border border-primary/30 bg-accent-soft p-4 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Label</label>
                          <Input
                            value={editData.label || ""}
                            onChange={(e) => handleEditChange("label", e.target.value)}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">URL</label>
                          <Input
                            value={editData.url || ""}
                            onChange={(e) => handleEditChange("url", e.target.value)}
                            className="h-11"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Background</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={editData.bg_color || "#e87fa0"}
                              onChange={(e) => handleEditChange("bg_color", e.target.value)}
                              className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Text</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={editData.text_color || "#ffffff"}
                              onChange={(e) => handleEditChange("text_color", e.target.value)}
                              className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Icon <span className="text-muted-foreground/60">({BUTTON_ICON_LIMIT_LABEL})</span></label>
                          <label className={`flex h-11 items-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 px-3 text-xs transition hover:bg-surface-3 ${uploadingMedia ? 'cursor-wait opacity-80' : 'cursor-pointer'}`}>
                            <input
                              type="file"
                              accept="image/*,image/gif"
                              disabled={uploadingMedia}
                              onChange={(e) => e.target.files?.[0] && uploadButtonMedia(e.target.files[0], false)}
                              className="hidden"
                            />
                            {uploadingMedia ? (
                              <IconLoader2 className="size-4 animate-spin text-primary" />
                            ) : editData.media_url ? (
                              <img src={editData.media_url} alt="" className="h-6 w-6 rounded object-cover" />
                            ) : (
                              <IconPhoto className="size-4 text-muted-foreground" />
                            )}
                            <span className={uploadingMedia ? 'text-primary' : 'text-foreground-secondary'}>
                              {uploadingMedia ? 'Uploading…' : editData.media_url ? 'Replace' : 'Upload'}
                            </span>
                          </label>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">No Background</label>
                          <div className="flex h-11 items-center">
                            <Switch
                              checked={editData.disable_background || false}
                              onCheckedChange={(checked) => setEditedButtonData(prev => ({ ...prev, disable_background: checked }))}
                            />
                          </div>
                        </div>
                        <div className="flex-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEditing}
                          className="rounded-lg"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={saveButtonEdits}
                          disabled={saving}
                          className="rounded-lg"
                        >
                          {saving ? <IconLoader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteButton(button.id)}
                          className="rounded-lg text-destructive hover:bg-destructive/10"
                        >
                          <IconTrash className="mr-1.5 size-3.5" />
                          Delete
                        </Button>
                      </div>
                      <div className="pt-2 border-t border-border">
                        <label className="text-xs font-medium text-muted-foreground">Preview</label>
                        <div className="mt-2">
                          <div 
                            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium shadow-lg"
                            style={{ 
                              backgroundColor: editData.disable_background ? 'transparent' : (editData.bg_color || "#e87fa0"), 
                              color: editData.text_color || "#ffffff",
                              border: editData.disable_background ? '1px solid rgba(255,255,255,0.1)' : undefined
                            }}
                          >
                            {editData.media_url && <img src={editData.media_url} alt="" className="h-5 w-5 rounded object-cover" />}
                            {editData.label}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <div 
                    key={button.id} 
                    onClick={() => startEditing(button)}
                    className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-surface-2 p-4 transition-all hover:border-border-strong hover:bg-surface-3"
                  >
                    <div 
                      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm"
                      style={{ 
                        backgroundColor: button.disable_background ? 'transparent' : (button.bg_color || "#e87fa0"), 
                        color: button.text_color || "#ffffff",
                        border: button.disable_background ? '1px solid rgba(255,255,255,0.1)' : undefined
                      }}
                    >
                      {button.media_url && <img src={button.media_url} alt="" className="h-5 w-5 rounded object-cover" />}
                      {button.label}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-muted-foreground/70">{button.url}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); window.open(button.url, "_blank") }}
                        className="h-8 w-8 rounded-lg text-muted-foreground/70 hover:bg-white/[0.04] hover:text-foreground-secondary"
                      >
                        <IconExternalLink className="size-3.5" />
                      </Button>
                      <IconPencil className="size-3.5 text-muted-foreground/70" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add New Button */}
      {buttons.length < 3 && (
        <Card className="border-border bg-surface backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
                <IconPlus className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg text-foreground">Add New Button</CardTitle>
                <CardDescription className="text-muted-foreground">Create a custom call-to-action button</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Button Label</label>
                <Input
                  value={newButton.label}
                  onChange={(e) => setNewButton({ ...newButton, label: e.target.value })}
                  placeholder="Join Discord"
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">URL</label>
                <Input
                  value={newButton.url}
                  onChange={(e) => setNewButton({ ...newButton, url: e.target.value })}
                  placeholder="https://discord.gg/..."
                  className="h-12"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Background Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={newButton.bg_color}
                    onChange={(e) => setNewButton({ ...newButton, bg_color: e.target.value })}
                    className="h-12 w-16 cursor-pointer rounded-xl border border-border bg-transparent p-1"
                  />
                  <Input
                    value={newButton.bg_color}
                    onChange={(e) => setNewButton({ ...newButton, bg_color: e.target.value })}
                    className="h-12 w-24 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Text Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={newButton.text_color}
                    onChange={(e) => setNewButton({ ...newButton, text_color: e.target.value })}
                    className="h-12 w-16 cursor-pointer rounded-xl border border-border bg-transparent p-1"
                  />
                  <Input
                    value={newButton.text_color}
                    onChange={(e) => setNewButton({ ...newButton, text_color: e.target.value })}
                    className="h-12 w-24 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Icon (optional) <span className="text-muted-foreground/60">({BUTTON_ICON_LIMIT_LABEL})</span></label>
                <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 px-4 text-sm transition hover:bg-surface-3">
                  <input
                    type="file"
                    accept="image/*,image/gif"
                    onChange={(e) => e.target.files?.[0] && uploadButtonMedia(e.target.files[0])}
                    className="hidden"
                  />
                  {uploadingMedia ? (
                    <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : newButton.media_url ? (
                    <img src={newButton.media_url} alt="" className="h-6 w-6 rounded object-cover" />
                  ) : (
                    <IconUpload className="size-4 text-muted-foreground" />
                  )}
                  <span className="text-foreground-secondary">{newButton.media_url ? "Replace" : "Upload"}</span>
                </label>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">No Background</label>
                <div className="flex h-12 items-center">
                  <Switch
                    checked={newButton.disable_background}
                    onCheckedChange={(checked) => setNewButton({ ...newButton, disable_background: checked })}
                  />
                </div>
              </div>
              {newButton.media_url && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setNewButton({ ...newButton, media_url: "" })}
                  className="h-12 w-12 rounded-xl text-muted-foreground hover:bg-white/[0.04] hover:text-foreground-secondary"
                >
                  <IconX className="size-4" />
                </Button>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <label className="text-xs font-medium text-muted-foreground">Preview</label>
              <div className="mt-3">
                <div 
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium shadow-lg transition-transform hover:scale-[1.02]"
                  style={{ 
                    backgroundColor: newButton.disable_background ? 'transparent' : newButton.bg_color, 
                    color: newButton.text_color,
                    border: newButton.disable_background ? '1px solid rgba(255,255,255,0.1)' : undefined
                  }}
                >
                  {newButton.media_url && <img src={newButton.media_url} alt="" className="h-5 w-5 rounded object-cover" />}
                  {newButton.label || "Button Label"}
                </div>
              </div>
            </div>

            <Button
              onClick={handleAddButton}
              disabled={saving || !newButton.label || !newButton.url}
              className="h-12 w-full rounded-xl font-semibold disabled:opacity-50"
            >
              {saving ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconPlus className="mr-2 size-4" />}
              Add Button
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
