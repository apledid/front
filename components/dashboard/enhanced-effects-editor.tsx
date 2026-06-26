'use client'

import { useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IconLoader2, IconTypography, IconPointer, IconSettings2, IconUpload, IconX, IconCrown } from '@tabler/icons-react'
import type { Profile } from '@/lib/types'
import { PREMIUM_USERNAME_EFFECTS, PREMIUM_CURSOR_EFFECTS, PREMIUM_HOVER_EFFECTS } from '@/lib/premium-features'
import { uploadFile } from '@/lib/upload'
import Link from 'next/link'
import { UnsavedChangesBar } from './unsaved-changes-bar'

const USERNAME_EFFECTS = [
  { value: 'none', label: 'None' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'shuffle', label: 'Shuffle' },
  { value: 'white-sparkles', label: 'White Sparkles' },
  { value: 'red-sparkles', label: 'Red Sparkles' },
  { value: 'yellow-sparkles', label: 'Yellow Sparkles' },
  { value: 'pink-sparkles', label: 'Pink Sparkles' },
  { value: 'green-sparkles', label: 'Green Sparkles' },
  { value: 'blue-sparkles', label: 'Blue Sparkles' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'wave', label: 'Wave' },
]

const CURSOR_EFFECTS = [
  { value: 'none', label: 'None' },
  { value: 'glow', label: 'Glow' },
  { value: 'spark-trail', label: 'Spark Trail' },
  { value: 'ghost-trail', label: 'Ghost Trail' },
  { value: 'falling-spark', label: 'Falling Sparks' },
  { value: 'cat', label: 'Cat' },
  { value: 'splash', label: 'Splash Cursor' },
  { value: 'rainbow', label: 'Rainbow' },
]

const CLICK_EFFECTS = [
  { value: 'none', label: 'None' },
  { value: 'spark', label: 'Spark Burst' },
  { value: 'falling', label: 'Falling Sparks' },
]

const HOVER_EFFECTS = [
  { value: 'none', label: 'None' },
  { value: 'lift', label: 'Lift' },
  { value: 'glow', label: 'Glow' },
  { value: 'shake', label: 'Shake' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'scale', label: 'Scale' },
]

const ENTRANCE_ANIMATIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade In' },
  { value: 'slide', label: 'Slide Up' },
  { value: 'scale', label: 'Scale Up' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'zoom', label: 'Zoom' },
]

export type EffectsState = {
  usernameEffect: string
  cursorEffect: string
  cursorGlowEnabled: boolean
  cursorTrailEnabled: boolean
  customCursorUrl: string
  hoverCursorUrl: string
  cursorColor: string
  cursorClickEffect: string
  cursorClickColor: string
  tiltEffect: boolean
  hoverEffect: string
  hoverEffectColor: string
  entranceAnimation: string
  showViewCount: boolean
  viewsLocationPosition: string
  animateViewCount: boolean
  viewsBadgeBackground: boolean
  showBadges: boolean
  monochromeIcons: boolean
  animatedTitle: boolean
  swapBoxColors: boolean
  showLikes: boolean
  volumeControl: boolean
}

interface Props {
  profile: Profile
  onChange?: (state: EffectsState) => void
  isPremium?: boolean
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <Input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border-border p-1" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-11 border-border bg-surface-2 font-mono text-sm" />
      </div>
    </div>
  )
}

export function EnhancedEffectsEditor({ profile, onChange, isPremium = false }: Props) {
  const [saving, setSaving] = useState(false)
  const [uploadingCursor, setUploadingCursor] = useState(false)
  const initialDataRef = useRef<EffectsState | null>(null)

  const getInitialData = (): EffectsState => ({
    usernameEffect: profile.username_effect || 'none',
    cursorEffect: profile.cursor_effect || 'none',
    cursorGlowEnabled: profile.cursor_glow_enabled ?? false,
    cursorTrailEnabled: false,
    customCursorUrl: profile.custom_cursor_url || '',
    hoverCursorUrl: (profile as any).custom_cursor_hover_url || '',
    cursorColor: profile.cursor_color || profile.accent_color || '#e87fa0',
    cursorClickEffect: profile.cursor_click_effect || 'none',
    cursorClickColor: profile.cursor_click_color || profile.cursor_color || profile.accent_color || '#e87fa0',
    tiltEffect: profile.tilt_effect ?? true,
    hoverEffect: profile.hover_effect || 'glow',
    hoverEffectColor: profile.hover_effect_color || profile.accent_color || '#e87fa0',
    entranceAnimation: profile.entrance_animation || 'fade',
    showViewCount: profile.show_view_count ?? true,
    viewsLocationPosition: (profile as any).views_location_position || 'top-right',
    animateViewCount: (profile as any).animate_view_count ?? false,
    viewsBadgeBackground: (profile as any).views_badge_background ?? false,
    showBadges: profile.show_badges ?? true,
    monochromeIcons: profile.monochrome_icons ?? false,
    animatedTitle: profile.animated_title ?? true,
    swapBoxColors: profile.swap_box_colors ?? false,
    showLikes: (profile as any).show_likes ?? false,
    volumeControl: profile.volume_control ?? true,
  })

  const [formData, setFormData] = useState<EffectsState>(() => {
    const initial = getInitialData()
    initialDataRef.current = initial
    return initial
  })

  const update = useCallback((patch: Partial<EffectsState>) => {
    setFormData((previous) => {
      const next = { ...previous, ...patch }
      onChange?.(next)
      return next
    })
  }, [onChange])

  const saveEffects = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/effects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username_effect: formData.usernameEffect,
          cursor_effect: formData.cursorEffect,
          cursor_glow_enabled: formData.cursorEffect === 'glow' || formData.cursorGlowEnabled,
          custom_cursor_url: formData.customCursorUrl,
          custom_cursor_hover_url: formData.hoverCursorUrl,
          cursor_color: formData.cursorColor,
          cursor_click_effect: formData.cursorClickEffect,
          cursor_click_color: formData.cursorClickColor,
          tilt_effect: formData.tiltEffect,
          hover_effect: formData.hoverEffect,
          hover_effect_color: formData.hoverEffectColor,
          entrance_animation: formData.entranceAnimation,
          show_view_count: formData.showViewCount,
          views_location_position: formData.viewsLocationPosition,
          animate_view_count: formData.animateViewCount,
          views_badge_background: formData.viewsBadgeBackground,
          show_badges: formData.showBadges,
          monochrome_icons: formData.monochromeIcons,
          animated_title: formData.animatedTitle,
          swap_box_colors: formData.swapBoxColors,
          volume_control: formData.volumeControl,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Failed to save effects')
      initialDataRef.current = formData
      toast.success('Effects saved!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to save effects')
    } finally {
      setSaving(false)
    }
  }, [formData])

  const uploadCursor = useCallback(async (file: File) => {
    setUploadingCursor(true)
    try {
      const result = await uploadFile(file, 'cursor')
      update({ customCursorUrl: result.url })
      toast.success('Cursor uploaded')
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload cursor', { id: 'upload-error' })
    } finally {
      setUploadingCursor(false)
    }
  }, [update])
  
  const uploadHoverCursor = useCallback(async (file: File) => {
    setUploadingCursor(true)
    try {
      const result = await uploadFile(file, 'cursor')
      update({ hoverCursorUrl: result.url })
      toast.success('Hover cursor uploaded')
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload hover cursor', { id: 'upload-error' })
    } finally {
      setUploadingCursor(false)
    }
  }, [update])

  const handleReset = useCallback(() => {
    if (initialDataRef.current) {
      setFormData(initialDataRef.current)
      onChange?.(initialDataRef.current)
    }
  }, [onChange])

  const hasChanges = initialDataRef.current ? JSON.stringify(formData) !== JSON.stringify(initialDataRef.current) : false

  const ToggleCard = ({ label, desc, checked, onToggle }: { label: string; desc: string; checked: boolean; onToggle: (value: boolean) => void }) => (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
      <div><p className="text-sm font-medium text-foreground">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{desc}</p></div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  )

  return (
    <div className="space-y-6 pb-20">
      <Tabs defaultValue="username" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl border border-border bg-surface p-1">
          <TabsTrigger value="username" className="rounded-lg py-2 text-xs text-muted-foreground sm:text-sm data-[state=active]:bg-surface-2 data-[state=active]:text-foreground"><span className="flex items-center gap-1.5"><IconTypography className="size-3.5" /><span className="hidden sm:inline">Username</span></span></TabsTrigger>
          <TabsTrigger value="cursor" className="rounded-lg py-2 text-xs text-muted-foreground sm:text-sm data-[state=active]:bg-surface-2 data-[state=active]:text-foreground"><span className="flex items-center gap-1.5"><IconPointer className="size-3.5" /><span className="hidden sm:inline">Cursor</span></span></TabsTrigger>
          <TabsTrigger value="other" className="rounded-lg py-2 text-xs text-muted-foreground sm:text-sm data-[state=active]:bg-surface-2 data-[state=active]:text-foreground"><span className="flex items-center gap-1.5"><IconSettings2 className="size-3.5" /><span className="hidden sm:inline">Other</span></span></TabsTrigger>
        </TabsList>

        <TabsContent value="username" className="mt-6 space-y-4">
          <Card className="border-border bg-surface backdrop-blur-sm">
            <CardHeader className="pb-4"><CardTitle className="text-lg text-foreground">Username Effects</CardTitle><CardDescription className="text-muted-foreground">Typewriter and shuffle run once at a slower pace, sparkle assets sit behind the username.</CardDescription></CardHeader>
            <CardContent><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{USERNAME_EFFECTS.map((effect) => {
              const needsPremium = PREMIUM_USERNAME_EFFECTS.includes(effect.value)
              const isLocked = needsPremium && !isPremium
              return (
              <button 
                key={effect.value} 
                onClick={() => !isLocked && update({ usernameEffect: effect.value })} 
                disabled={isLocked}
                className={`relative rounded-xl border px-4 py-3 text-sm font-medium transition-all ${formData.usernameEffect === effect.value ? 'border-primary/50 bg-accent-soft text-primary' : 'border-border bg-surface text-foreground-secondary hover:bg-surface-2'} ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {effect.label}
                {needsPremium && <IconCrown className="absolute right-2 top-2 size-3 text-primary" />}
              </button>
            )})}</div>
            {!isPremium && <Link href="/pricing" className="mt-3 flex items-center gap-2 text-xs text-primary hover:text-primary/80"><IconCrown className="size-3" /> Unlock premium effects</Link>}
            </CardContent>
          </Card>

          <Card className="border-border bg-surface backdrop-blur-sm">
            <CardHeader className="pb-4"><CardTitle className="text-lg text-foreground">Entrance & Hover Animations</CardTitle><CardDescription className="text-muted-foreground">Animation choices for the public card and preview.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Entrance Animation</label><div className="grid grid-cols-3 gap-2">{ENTRANCE_ANIMATIONS.map((animation) => (
                <button key={animation.value} onClick={() => update({ entranceAnimation: animation.value })} className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${formData.entranceAnimation === animation.value ? 'border-primary/50 bg-accent-soft text-primary' : 'border-border bg-surface text-foreground-secondary hover:bg-surface-2'}`}>{animation.label}</button>
              ))}</div></div>
              <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Hover Effect</label><div className="grid grid-cols-3 gap-2">{HOVER_EFFECTS.map((effect) => {
                const needsPremium = PREMIUM_HOVER_EFFECTS.includes(effect.value)
                const isLocked = needsPremium && !isPremium
                return (
                <button 
                  key={effect.value} 
                  onClick={() => !isLocked && update({ hoverEffect: effect.value })} 
                  disabled={isLocked}
                  className={`relative rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${formData.hoverEffect === effect.value ? 'border-primary/50 bg-accent-soft text-primary' : 'border-border bg-surface text-foreground-secondary hover:bg-surface-2'} ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {effect.label}
                  {needsPremium && <IconCrown className="absolute -right-0.5 -top-0.5 size-3 text-primary" />}
                </button>
              )})}</div></div>
              {(formData.hoverEffect === 'glow' || formData.hoverEffect === 'pulse') && (
                <ColorInput label="Hover Effect Color" value={formData.hoverEffectColor} onChange={(value) => update({ hoverEffectColor: value })} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cursor" className="mt-6 space-y-4">
          <Card className="border-border bg-surface backdrop-blur-sm">
            <CardHeader className="pb-4"><CardTitle className="text-lg text-foreground">Cursor Effects</CardTitle><CardDescription className="text-muted-foreground">Glow plus trail styles. Hover cursor swaps to a second image on links.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{CURSOR_EFFECTS.map((effect) => {
                const needsPremium = PREMIUM_CURSOR_EFFECTS.includes(effect.value)
                const isLocked = needsPremium && !isPremium
                return (
                <button 
                  key={effect.value} 
                  onClick={() => !isLocked && update({ cursorEffect: effect.value, cursorGlowEnabled: effect.value === 'glow' })} 
                  disabled={isLocked}
                  className={`relative rounded-xl border px-4 py-3 text-sm font-medium transition-all ${formData.cursorEffect === effect.value ? 'border-primary/50 bg-accent-soft text-primary' : 'border-border bg-surface text-foreground-secondary hover:bg-surface-2'} ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {effect.label}
                  {needsPremium && <IconCrown className="absolute right-2 top-2 size-3 text-primary" />}
                </button>
              )})}</div>
              {!isPremium && <Link href="/pricing" className="mt-3 flex items-center gap-2 text-xs text-primary hover:text-primary/80"><IconCrown className="size-3" /> Unlock premium cursor effects</Link>}

              {formData.cursorEffect !== 'cat' ? <ColorInput label="Cursor Color" value={formData.cursorColor} onChange={(value) => update({ cursorColor: value })} /> : (
                <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">Cat uses its own built-in sprite and chase animation, so custom cursor images and cursor recoloring stay disabled for this effect.</div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Click Cursor Effect</label>
                <Select value={formData.cursorClickEffect} onValueChange={(value) => update({ cursorClickEffect: value })}>
                  <SelectTrigger className="h-11 border-border bg-surface-2"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-border bg-surface-2">{CLICK_EFFECTS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {formData.cursorEffect !== 'cat' ? <ColorInput label="Click Effect Color" value={formData.cursorClickColor} onChange={(value) => update({ cursorClickColor: value })} /> : null}

              <ToggleCard label="Tilt Effect" desc="Profile card tilts with the pointer." checked={formData.tiltEffect} onToggle={(value) => update({ tiltEffect: value })} />

              {formData.cursorEffect !== 'cat' ? (
              <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Default Cursor Image / GIF</label>
                  {formData.customCursorUrl && <button type="button" onClick={() => update({ customCursorUrl: '' })} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"><IconX className="size-3.5" /> Remove</button>}
                </div>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-4 text-sm text-foreground-secondary transition hover:bg-surface-2">
                  <input type="file" accept="image/*,image/gif" onChange={(e) => e.target.files?.[0] && void uploadCursor(e.target.files[0])} className="hidden" />
                  {uploadingCursor ? <IconLoader2 className="size-4 animate-spin" /> : <IconUpload className="size-4" />}
                  <span>{formData.customCursorUrl ? 'Replace default cursor' : 'Upload default cursor'} (max 25MB)</span>
                </label>
                {formData.customCursorUrl && <p className="text-xs text-muted-foreground truncate">Current: {formData.customCursorUrl.split('/').pop()}</p>}

                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Hover Cursor Image / GIF</label>
                    {formData.hoverCursorUrl && <button type="button" onClick={() => update({ hoverCursorUrl: '' })} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"><IconX className="size-3.5" /> Remove</button>}
                  </div>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-sm text-foreground-secondary transition hover:bg-surface-2">
                    <input type="file" accept="image/*,image/gif" onChange={(e) => e.target.files?.[0] && void uploadHoverCursor(e.target.files[0])} className="hidden" />
                    {uploadingCursor ? <IconLoader2 className="size-4 animate-spin" /> : <IconUpload className="size-4" />}
                    <span>{formData.hoverCursorUrl ? 'Replace hover cursor' : 'Upload hover cursor'} (max 25MB)</span>
                  </label>
                  {formData.hoverCursorUrl && <p className="text-xs text-muted-foreground truncate">Current: {formData.hoverCursorUrl.split('/').pop()}</p>}
                  <p className="text-xs text-muted-foreground">When you hover a link or icon, the cursor swaps to this image.</p>
                </div>
              </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="other" className="mt-6 space-y-4">
          <Card className="border-border bg-surface backdrop-blur-sm">
            <CardHeader className="pb-4"><CardTitle className="text-lg text-foreground">Other Effects</CardTitle><CardDescription className="text-muted-foreground">These toggles auto-save from the effects page.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <ToggleCard label="Show View Count" desc="Display the visit counter on the card." checked={formData.showViewCount} onToggle={(value) => update({ showViewCount: value })} />
              {formData.showViewCount && (
                <div className="ml-4 space-y-2 border-l border-border pl-4">
                  <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Location &amp; Views Position</p>
                      <p className="text-xs text-muted-foreground">Where the counter and location appear on your card.</p>
                    </div>
                    <Select value={formData.viewsLocationPosition} onValueChange={(v) => update({ viewsLocationPosition: v })}>
                      <SelectTrigger className="h-9 w-36 border-border bg-surface-2 text-xs text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-surface-2 text-foreground">
                        <SelectItem value="top-left">Top Left</SelectItem>
                        <SelectItem value="top-right">Top Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                        <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <ToggleCard label="Animate View Count" desc="Count up from 0 to the real number when someone opens your profile." checked={formData.animateViewCount} onToggle={(v) => update({ animateViewCount: v })} />
                  <ToggleCard label="Badge Background" desc="Show a frosted glass pill behind the view count and location." checked={formData.viewsBadgeBackground} onToggle={(v) => update({ viewsBadgeBackground: v })} />
                </div>
              )}
              <ToggleCard label="Show Badges" desc="Display badges next to your username." checked={formData.showBadges} onToggle={(value) => update({ showBadges: value })} />
              <ToggleCard label="Animated Tab Title" desc="Animate the browser tab title after entering the profile." checked={formData.animatedTitle} onToggle={(value) => update({ animatedTitle: value })} />
              <ToggleCard label="Volume Control" desc="Show the music volume button when music is enabled." checked={formData.volumeControl} onToggle={(value) => update({ volumeControl: value })} />
              <div className="relative">
                <ToggleCard label="Monochrome Icons" desc="Use your chosen icon color instead of brand colors." checked={formData.monochromeIcons} onToggle={(value) => isPremium && update({ monochromeIcons: value })} />
                {!isPremium && <div className="absolute right-12 top-1/2 -translate-y-1/2"><Link href="/pricing" className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-primary"><IconCrown className="size-2.5" />PRO</Link></div>}
              </div>
              <ToggleCard label="Swap Box Colors" desc="Lean harder into the accent color on icons and buttons." checked={formData.swapBoxColors} onToggle={(value) => update({ swapBoxColors: value })} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <UnsavedChangesBar
        show={hasChanges}
        saving={saving}
        onSave={saveEffects}
        onReset={handleReset}
        label="effects"
      />
    </div>
  )
}
