"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { IconLoader2, IconUpload, IconSparkles, IconPointer, IconArrowsMove, IconEye } from "@tabler/icons-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { UnsavedChangesBar } from "@/components/dashboard/unsaved-changes-bar"
import type { Profile } from "@/lib/types"
import { uploadFile } from "@/lib/upload"

interface EffectsEditorProps {
  profile: Profile
}

const HOVER_EFFECTS = ["none", "glow", "lift", "shake", "pulse"]
const ENTRANCE_ANIMATIONS = ["none", "fade", "slide", "scale", "bounce"]
const CURSOR_EFFECTS = ["none", "glow", "trail", "both"]

type EffectsState = {
  particleEnabled: boolean
  particleColor: string
  particleCount: number
  cursorEffect: string
  customCursorUrl: string
  tiltEffect: boolean
  hoverEffect: string
  entranceAnimation: string
  showViewCount: boolean
  showBadges: boolean
}

function getInitialState(profile: Profile): EffectsState {
  const getCursorEffect = () => {
    if (profile.cursor_glow_enabled && profile.cursor_trail_enabled) return "both"
    if (profile.cursor_glow_enabled) return "glow"
    if (profile.cursor_trail_enabled) return "trail"
    return "none"
  }

  return {
    particleEnabled: profile.particle_enabled ?? false,
    particleColor: profile.particle_color || "#06b6d4",
    particleCount: profile.particle_count || 50,
    cursorEffect: getCursorEffect(),
    customCursorUrl: profile.custom_cursor_url || "",
    tiltEffect: profile.tilt_effect ?? true,
    hoverEffect: profile.hover_effect || "glow",
    entranceAnimation: profile.entrance_animation || "fade",
    showViewCount: profile.show_view_count ?? true,
    showBadges: profile.show_badges ?? true,
  }
}

export function EffectsEditor({ profile }: EffectsEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [uploadingCursor, setUploadingCursor] = useState(false)
  
  const initialState = useRef(getInitialState(profile))
  const [state, setState] = useState<EffectsState>(getInitialState(profile))

  // Check if there are unsaved changes
  const hasChanges = JSON.stringify(state) !== JSON.stringify(initialState.current)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/effects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          particle_enabled: state.particleEnabled,
          particle_color: state.particleColor,
          particle_count: state.particleCount,
          cursor_effect: state.cursorEffect,
          custom_cursor_url: state.customCursorUrl,
          tilt_effect: state.tiltEffect,
          hover_effect: state.hoverEffect,
          entrance_animation: state.entranceAnimation,
          show_view_count: state.showViewCount,
          show_badges: state.showBadges,
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || "Failed to save effects")
      }

      initialState.current = { ...state }
      toast.success("Effects saved successfully")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save effects")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setState(initialState.current)
  }

  const handleChange = <K extends keyof EffectsState>(field: K, value: EffectsState[K]) => {
    setState(prev => ({ ...prev, [field]: value }))
  }

  // Handle cursor image upload
  const handleCursorUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCursor(true)
    try {
      const result = await uploadFile(file, "cursor")
      handleChange("customCursorUrl", result.url)
      toast.success("Cursor image uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed", { id: 'upload-error' })
    } finally {
      setUploadingCursor(false)
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Particles */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IconSparkles className="size-5" /> Particles
          </CardTitle>
          <CardDescription>Add animated particles to your background</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Enable Particles</label>
            <Switch checked={state.particleEnabled} onCheckedChange={(v) => handleChange("particleEnabled", v)} />
          </div>

          {state.particleEnabled && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium">Particle Count ({state.particleCount})</label>
                <Slider
                  value={[state.particleCount]}
                  onValueChange={([value]) => handleChange("particleCount", value)}
                  min={10}
                  max={200}
                  step={10}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Particle Color</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={state.particleColor}
                    onChange={(e) => handleChange("particleColor", e.target.value)}
                    className="h-10 w-14 cursor-pointer p-1"
                  />
                  <Input
                    value={state.particleColor}
                    onChange={(e) => handleChange("particleColor", e.target.value)}
                    className="w-28 bg-background/50 font-mono text-sm"
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Cursor Effects */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IconPointer className="size-5" /> Cursor Effects
          </CardTitle>
          <CardDescription>Add effects that follow the mouse cursor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {CURSOR_EFFECTS.map((effect) => (
              <button
                key={effect}
                onClick={() => handleChange("cursorEffect", effect)}
                className={`rounded-lg border p-3 text-center text-sm transition-all ${
                  state.cursorEffect === effect
                    ? "border-primary bg-accent-soft"
                    : "border-border/50 hover:border-border"
                }`}
              >
                {effect.charAt(0).toUpperCase() + effect.slice(1)}
              </button>
            ))}
          </div>

          {/* Custom Cursor Upload */}
          <div className="pt-4 border-t border-border/50">
            <label className="mb-2 block text-sm font-medium">Custom Cursor Image</label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-secondary cursor-pointer hover:bg-secondary/80">
              {uploadingCursor ? <IconLoader2 className="size-4 animate-spin" /> : <IconUpload className="size-4" />}
              <span>{state.customCursorUrl ? 'Replace cursor' : 'Upload cursor'} (max 25MB)</span>
              <input type="file" accept="image/*" onChange={handleCursorUpload} className="hidden" />
            </label>
            {state.customCursorUrl && (
              <div className="mt-2 p-3 bg-muted/30 rounded-lg inline-flex items-center gap-2">
                <img src={state.customCursorUrl} alt="Custom cursor" className="w-8 h-8 object-contain" />
                <span className="text-sm text-muted-foreground">Preview</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card Effects */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IconArrowsMove className="size-5" /> Card Effects
          </CardTitle>
          <CardDescription>Control how your profile card behaves</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Magnetic Tilt Effect</label>
              <p className="text-xs text-muted-foreground">Card tilts toward cursor (guns.lol style)</p>
            </div>
            <Switch checked={state.tiltEffect} onCheckedChange={(v) => handleChange("tiltEffect", v)} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Hover Effect</label>
            <Select value={state.hoverEffect} onValueChange={(v) => handleChange("hoverEffect", v)}>
              <SelectTrigger className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOVER_EFFECTS.map((effect) => (
                  <SelectItem key={effect} value={effect}>
                    {effect.charAt(0).toUpperCase() + effect.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Entrance Animation</label>
            <Select value={state.entranceAnimation} onValueChange={(v) => handleChange("entranceAnimation", v)}>
              <SelectTrigger className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTRANCE_ANIMATIONS.map((anim) => (
                  <SelectItem key={anim} value={anim}>
                    {anim.charAt(0).toUpperCase() + anim.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Display Options */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IconEye className="size-5" /> Display Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Show View Count</label>
              <p className="text-xs text-muted-foreground">Display profile view counter</p>
            </div>
            <Switch checked={state.showViewCount} onCheckedChange={(v) => handleChange("showViewCount", v)} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Show Badges</label>
              <p className="text-xs text-muted-foreground">Display earned badges</p>
            </div>
            <Switch checked={state.showBadges} onCheckedChange={(v) => handleChange("showBadges", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Unsaved Changes Bar */}
      <UnsavedChangesBar
        show={hasChanges}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
      />
    </div>
  )
}
