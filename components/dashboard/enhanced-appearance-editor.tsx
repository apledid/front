'use client'

import { useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IconLoader2, IconPalette, IconTypography, IconPhoto, IconSun, IconUpload, IconX, IconCrown } from '@tabler/icons-react'
import type { Profile } from '@/lib/types'
import { uploadFile } from '@/lib/upload'
import Link from 'next/link'
import { UnsavedChangesBar } from './unsaved-changes-bar'

const FONT_FAMILIES = [
  'Inter', 'Playfair Display', 'Montserrat', 'Roboto', 'Poppins',
  'Raleway', 'Open Sans', 'Lato', 'Ubuntu', 'Comfortaa',
  'Space Mono', 'JetBrains Mono', 'Fira Code', 'Dancing Script', 'Pacifico',
  'Oswald', 'Bebas Neue', 'Manrope', 'DM Sans', 'Sora',
]

const BACKGROUND_EFFECTS = [
  { value: 'none', label: 'None' },
  { value: 'aurora', label: 'Aurora Borealis' },
  { value: 'snowflakes', label: 'Snowflakes' },
  { value: 'rain', label: 'Rain' },
  { value: 'blurred', label: 'Blurred' },
  { value: 'old-tv', label: 'Old TV' },
  { value: 'dither', label: 'Dither' },
  { value: 'plasma', label: 'Plasma' },
  { value: 'matrix', label: 'Matrix' },
]

const CARD_STYLES = [
  { value: 'glass', label: 'Glass' },
  { value: 'solid', label: 'Solid' },
  { value: 'outline', label: 'Outline' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'neon', label: 'Neon' },
  { value: 'frosted', label: 'Frosted' },
  { value: 'elevated', label: 'Elevated' },
]

const BORDER_STYLES = [
  { value: 'none', label: 'None' },
  { value: 'glow', label: 'Glow' },
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'double', label: 'Double' },
  { value: 'soft', label: 'Soft' },
]

const THEME_PRESETS = [
  { name: 'Midnight', preview: ['#06b6d4', '#0f0f23'], values: { accentColor: '#06b6d4', textColor: '#ffffff', backgroundColor: '#0f0f23', iconColor: '#06b6d4', cardStyle: 'glass', borderStyle: 'glow', glowColor: '#06b6d4', outlineColor: '#06b6d4' } },
  { name: 'Crimson', preview: ['#ef4444', '#1a0000'], values: { accentColor: '#ef4444', textColor: '#ffffff', backgroundColor: '#1a0000', iconColor: '#ef4444', cardStyle: 'glass', borderStyle: 'glow', glowColor: '#ef4444', outlineColor: '#ef4444' } },
  { name: 'Galaxy', preview: ['#a855f7', '#0d0020'], values: { accentColor: '#a855f7', textColor: '#ffffff', backgroundColor: '#0d0020', iconColor: '#a855f7', cardStyle: 'glass', borderStyle: 'glow', glowColor: '#a855f7', outlineColor: '#a855f7' } },
  { name: 'Forest', preview: ['#10b981', '#021a0e'], values: { accentColor: '#10b981', textColor: '#ffffff', backgroundColor: '#021a0e', iconColor: '#10b981', cardStyle: 'solid', borderStyle: 'solid', glowColor: '#10b981', outlineColor: '#10b981' } },
  { name: 'Sunset', preview: ['#f97316', '#1a0800'], values: { accentColor: '#f97316', textColor: '#ffffff', backgroundColor: '#1a0800', iconColor: '#f97316', cardStyle: 'glass', borderStyle: 'glow', glowColor: '#f97316', outlineColor: '#f97316' } },
  { name: 'Rose Quartz', preview: ['#fb7185', '#240b1a'], values: { accentColor: '#fb7185', textColor: '#fff1f5', backgroundColor: '#240b1a', iconColor: '#fb7185', cardStyle: 'glass', borderStyle: 'gradient', glowColor: '#fb7185', outlineColor: '#fb7185' } },
  { name: 'Cyber Lime', preview: ['#84cc16', '#060b02'], values: { accentColor: '#84cc16', textColor: '#f7fee7', backgroundColor: '#060b02', iconColor: '#84cc16', cardStyle: 'neon', borderStyle: 'glow', glowColor: '#84cc16', outlineColor: '#84cc16' } },
  { name: 'Ice Glass', preview: ['#7dd3fc', '#07131d'], values: { accentColor: '#7dd3fc', textColor: '#e0f2fe', backgroundColor: '#07131d', iconColor: '#7dd3fc', cardStyle: 'glass', borderStyle: 'solid', glowColor: '#7dd3fc', outlineColor: '#7dd3fc' } },
  { name: 'Royal Gold', preview: ['#facc15', '#140f02'], values: { accentColor: '#facc15', textColor: '#fefce8', backgroundColor: '#140f02', iconColor: '#facc15', cardStyle: 'outline', borderStyle: 'gradient', glowColor: '#facc15', outlineColor: '#facc15' } },
  { name: 'Cherry Pop', preview: ['#f43f5e', '#15030b'], values: { accentColor: '#f43f5e', textColor: '#ffe4e6', backgroundColor: '#15030b', iconColor: '#f43f5e', cardStyle: 'neon', borderStyle: 'glow', glowColor: '#f43f5e', outlineColor: '#f43f5e' } },
  { name: 'Deep Ocean', preview: ['#0ea5e9', '#03111c'], values: { accentColor: '#0ea5e9', textColor: '#e0f2fe', backgroundColor: '#03111c', iconColor: '#0ea5e9', cardStyle: 'minimal', borderStyle: 'solid', glowColor: '#0ea5e9', outlineColor: '#0ea5e9' } },
  { name: 'Violet Haze', preview: ['#8b5cf6', '#0a0517'], values: { accentColor: '#8b5cf6', textColor: '#ede9fe', backgroundColor: '#0a0517', iconColor: '#a78bfa', cardStyle: 'glass', borderStyle: 'glow', glowColor: '#a78bfa', outlineColor: '#8b5cf6' } },
]

export type AppearanceState = {
  accentColor: string
  textColor: string
  backgroundColor: string
  iconColor: string
  fontFamily: string
  customFontUrl: string
  backgroundEffect: string
  backgroundType: string
  backgroundGradient: string
  backgroundUrl: string
  profileOpacity: number
  profileBlur: number
  profileGradientEnabled: boolean
  profileGradientPrimary: string
  profileGradientSecondary: string
  glowUsername: boolean
  glowSocials: boolean
  glowBadges: boolean
  glowIntensity: number
  glowColor: string
  socialsGlowMono?: boolean
  socialsBelowWidgets?: boolean
  outlineEnabled: boolean
  outlineColor: string
  outlineWidth: number
  cardStyle: string
  borderStyle: string
  profileRadius: number
  backgroundEffectStrength: number
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-1" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#000000" className="h-11 flex-1 border-border bg-surface-2 font-mono text-sm" />
      </div>
    </div>
  )
}

interface Props {
  profile: Profile
  onChange?: (state: AppearanceState) => void
  isPremium?: boolean
}

export function EnhancedAppearanceEditor({ profile, onChange, isPremium = false }: Props) {
  const [saving, setSaving] = useState(false)
  const [appliedPreset, setAppliedPreset] = useState<string | null>(null)
  const [uploadingFont, setUploadingFont] = useState(false)
  const initialDataRef = useRef<AppearanceState | null>(null)

  const getInitialData = (): AppearanceState => ({
    accentColor: profile.accent_color || '#e87fa0',
    textColor: profile.text_color || '#ffffff',
    backgroundColor: profile.background_color || '#080809',
    iconColor: profile.icon_color || '#e87fa0',
    fontFamily: profile.font_family || 'Inter',
    customFontUrl: profile.custom_font_url || '',
    backgroundEffect: profile.background_effect || 'none',
    backgroundType: profile.background_type || 'solid',
    backgroundGradient: profile.background_gradient || '',
    backgroundUrl: profile.background_url || '',
    profileOpacity: profile.profile_opacity ?? 100,
    profileBlur: profile.profile_blur ?? 0,
    profileGradientEnabled: profile.profile_gradient_enabled ?? false,
    profileGradientPrimary: profile.profile_gradient_primary || '#e87fa0',
    profileGradientSecondary: profile.profile_gradient_secondary || '#8b5cf6',
    glowUsername: profile.glow_username ?? false,
    glowSocials: profile.glow_socials ?? false,
    glowBadges: profile.glow_badges ?? false,
    glowIntensity: profile.glow_intensity ?? 50,
    glowColor: profile.glow_color || '#e87fa0',
    outlineEnabled: profile.outline_enabled ?? false,
    outlineColor: profile.outline_color || '#e87fa0',
    outlineWidth: profile.outline_width ?? 2,
    cardStyle: profile.card_style || 'glass',
    borderStyle: profile.border_style || 'glow',
    profileRadius: profile.profile_radius ?? 26,
    backgroundEffectStrength: (profile as any).background_effect_strength ?? 50,
  })

  const [formData, setFormData] = useState<AppearanceState>(() => {
    const initial = getInitialData()
    initialDataRef.current = initial
    return initial
  })

  const update = useCallback((patch: Partial<AppearanceState>) => {
    setFormData((previous) => {
      const next = { ...previous, ...patch }
      onChange?.(next)
      return next
    })
  }, [onChange])

  const saveAppearance = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/appearance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accent_color: formData.accentColor,
          text_color: formData.textColor,
          background_color: formData.backgroundColor,
          icon_color: formData.iconColor,
          font_family: formData.fontFamily,
          custom_font_url: formData.customFontUrl,
          background_type: formData.backgroundType,
          background_url: formData.backgroundUrl,
          background_gradient: formData.backgroundGradient,
          background_effect: formData.backgroundEffect,
          card_style: formData.cardStyle,
          border_style: formData.borderStyle,
          profile_opacity: formData.profileOpacity,
          profile_blur: formData.profileBlur,
          profile_gradient_enabled: formData.profileGradientEnabled,
          profile_gradient_primary: formData.profileGradientPrimary,
          profile_gradient_secondary: formData.profileGradientSecondary,
          glow_username: formData.glowUsername,
          glow_socials: formData.glowSocials,
          glow_badges: formData.glowBadges,
          glow_intensity: formData.glowIntensity,
          glow_color: formData.glowColor,
          outline_enabled: formData.outlineEnabled,
          outline_color: formData.outlineColor,
          outline_width: formData.outlineWidth,
          profile_radius: formData.profileRadius,
          background_effect_strength: formData.backgroundEffectStrength,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Failed to save appearance')
      initialDataRef.current = formData
      toast.success('Appearance saved!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to save appearance')
    } finally {
      setSaving(false)
    }
  }, [formData])

  const uploadFont = useCallback(async (file: File) => {
    setUploadingFont(true)
    try {
      const result = await uploadFile(file, 'font')
      update({ customFontUrl: result.url })
      toast.success('Custom font uploaded')
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload font', { id: 'upload-error' })
    } finally {
      setUploadingFont(false)
    }
  }, [update])

  const handleReset = useCallback(() => {
    if (initialDataRef.current) {
      setFormData(initialDataRef.current)
      onChange?.(initialDataRef.current)
    }
  }, [onChange])

  const hasChanges = initialDataRef.current ? JSON.stringify(formData) !== JSON.stringify(initialDataRef.current) : false

  const applyPreset = (preset: typeof THEME_PRESETS[number]) => {
    setAppliedPreset(preset.name)
    update({
      accentColor: preset.values.accentColor,
      textColor: preset.values.textColor,
      backgroundColor: preset.values.backgroundColor,
      iconColor: preset.values.iconColor,
      cardStyle: preset.values.cardStyle,
      borderStyle: preset.values.borderStyle,
      glowColor: preset.values.glowColor,
      outlineColor: preset.values.outlineColor,
    })
  }

  return (
    <div className="space-y-6 pb-20">
      <Tabs defaultValue="colors" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-4 rounded-xl border border-border bg-surface p-1">
          <TabsTrigger value="colors" className="rounded-lg py-2 text-xs text-muted-foreground sm:text-sm data-[state=active]:bg-surface-2 data-[state=active]:text-foreground"><span className="flex items-center gap-1.5"><IconPalette className="size-3.5" /><span className="hidden sm:inline">Colors</span></span></TabsTrigger>
          <TabsTrigger value="fonts" className="rounded-lg py-2 text-xs text-muted-foreground sm:text-sm data-[state=active]:bg-surface-2 data-[state=active]:text-foreground"><span className="flex items-center gap-1.5"><IconTypography className="size-3.5" /><span className="hidden sm:inline">Fonts</span></span></TabsTrigger>
          <TabsTrigger value="background" className="rounded-lg py-2 text-xs text-muted-foreground sm:text-sm data-[state=active]:bg-surface-2 data-[state=active]:text-foreground"><span className="flex items-center gap-1.5"><IconPhoto className="size-3.5" /><span className="hidden sm:inline">Background</span></span></TabsTrigger>
          <TabsTrigger value="glow" className="rounded-lg py-2 text-xs text-muted-foreground sm:text-sm data-[state=active]:bg-surface-2 data-[state=active]:text-foreground"><span className="flex items-center gap-1.5"><IconSun className="size-3.5" /><span className="hidden sm:inline">Glow</span></span></TabsTrigger>
        </TabsList>

        {/* Theme Presets removed per user request */}

        <TabsContent value="colors" className="mt-6 space-y-4">
          <Card className="border-border bg-surface backdrop-blur-sm">
            <CardHeader className="pb-4"><CardTitle className="text-lg text-foreground">Core Colors</CardTitle><CardDescription className="text-muted-foreground">These colors drive the whole card, text, and icon palette.</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <ColorPicker label="Accent Color" value={formData.accentColor} onChange={(value) => update({ accentColor: value })} />
              <ColorPicker label="Text Color" value={formData.textColor} onChange={(value) => update({ textColor: value })} />
              <ColorPicker label="Background Color" value={formData.backgroundColor} onChange={(value) => update({ backgroundColor: value })} />
              <ColorPicker label="Icon Color" value={formData.iconColor} onChange={(value) => update({ iconColor: value })} />
            </CardContent>
          </Card>

          <Card className="border-border bg-surface backdrop-blur-sm">
            <CardHeader className="pb-4"><CardTitle className="text-lg text-foreground">Card Style</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">{CARD_STYLES.map((style) => (
              <button key={style.value} onClick={() => update({ cardStyle: style.value })} className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${formData.cardStyle === style.value ? 'border-primary/50 bg-accent-soft text-primary' : 'border-border bg-surface text-foreground-secondary hover:bg-surface-2'}`}>{style.label}</button>
            ))}</CardContent>
          </Card>

          <Card className="border-border bg-surface backdrop-blur-sm">
            <CardHeader className="pb-4"><CardTitle className="text-lg text-foreground">Border Style</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">{BORDER_STYLES.map((style) => (
              <button key={style.value} onClick={() => update({ borderStyle: style.value })} className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${formData.borderStyle === style.value ? 'border-primary/50 bg-accent-soft text-primary' : 'border-border bg-surface text-foreground-secondary hover:bg-surface-2'}`}>{style.label}</button>
            ))}</CardContent>
          </Card>

          <Card className="border-border bg-surface backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-foreground">Card Shape</CardTitle>
              <CardDescription className="text-muted-foreground">Adjust the corner rounding of your profile card.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Corner Radius</label>
                <span className="text-xs font-mono text-foreground-secondary">{formData.profileRadius}px</span>
              </div>
              <Slider
                min={0} max={50} step={1}
                value={[formData.profileRadius]}
                onValueChange={([v]) => update({ profileRadius: v })}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Sharp</span><span>Rounded</span><span>Pill</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fonts" className="mt-6">
          <Card className="border-border bg-surface backdrop-blur-sm">
            <CardHeader className="pb-4"><CardTitle className="text-lg text-foreground">Fonts</CardTitle><CardDescription className="text-muted-foreground">Use a built-in font or upload your own custom font file.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Font Family</label>
                <Select value={formData.fontFamily} onValueChange={(value) => update({ fontFamily: value })}>
                  <SelectTrigger className="h-11 border-border bg-surface-2"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-border bg-surface-2">{FONT_FAMILIES.map((font) => <SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">Custom Font {!isPremium && <Link href="/pricing" className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-primary"><IconCrown className="size-2.5" />PRO</Link>}</label>
                  {formData.customFontUrl && isPremium && <button type="button" onClick={() => update({ customFontUrl: '' })} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"><IconX className="size-3.5" /> Remove</button>}
                </div>
                {isPremium ? (
                  <>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-4 text-sm text-foreground-secondary transition hover:bg-surface-2">
                      <input type="file" accept=".ttf,.otf,.woff,.woff2,.ttx,font/*" onChange={(e) => e.target.files?.[0] && void uploadFont(e.target.files[0])} className="hidden" />
                      {uploadingFont ? <IconLoader2 className="size-4 animate-spin" /> : <IconUpload className="size-4" />}
                      <span>{formData.customFontUrl ? 'Replace custom font' : 'Upload custom font'} (max 25MB)</span>
                    </label>
                    {formData.customFontUrl && <p className="text-xs text-muted-foreground truncate">Current: {formData.customFontUrl.split('/').pop()}</p>}
                  </>
                ) : (
                  <Link href="/pricing" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/20 bg-accent-soft px-4 py-4 text-sm text-primary transition hover:bg-primary/15">
                    <IconCrown className="size-4" />
                    <span>Unlock custom fonts with Lifetime</span>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="background" className="mt-6 space-y-4">
          <Card className="border-border bg-surface backdrop-blur-sm">
            <CardHeader className="pb-4"><CardTitle className="text-lg text-foreground">Background</CardTitle><CardDescription className="text-muted-foreground">Background effects layer over your uploaded media.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Background Effect</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{BACKGROUND_EFFECTS.map((effect) => (
                  <button key={effect.value} onClick={() => update({ backgroundEffect: effect.value })} className={`rounded-xl border px-3 py-3 text-sm font-medium transition-all ${formData.backgroundEffect === effect.value ? 'border-primary/50 bg-accent-soft text-primary' : 'border-border bg-surface text-foreground-secondary hover:bg-surface-2'}`}>{effect.label}</button>
                ))}</div>
              </div>

              {formData.backgroundEffect && formData.backgroundEffect !== 'none' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Effect Strength</label>
                    <span className="text-xs font-mono text-foreground-secondary">{formData.backgroundEffectStrength}%</span>
                  </div>
                  <Slider
                    min={0} max={100} step={1}
                    value={[formData.backgroundEffectStrength]}
                    onValueChange={([v]) => update({ backgroundEffectStrength: v })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Subtle</span><span>Normal</span><span>Intense</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Background Type</label>
                <Select value={formData.backgroundType} onValueChange={(value) => update({ backgroundType: value })}>
                  <SelectTrigger className="h-11 border-border bg-surface-2"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-border bg-surface-2">
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="gradient">Gradient</SelectItem>
                    <SelectItem value="media">Image / Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Background Gradient CSS</label>
                <Input value={formData.backgroundGradient} onChange={(e) => update({ backgroundGradient: e.target.value })} placeholder="linear-gradient(135deg, #0f172a, #020617)" className="h-11 border-border bg-surface-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-surface backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-foreground">Panel Blend</CardTitle>
                {!isPremium && <Link href="/pricing" className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-primary"><IconCrown className="size-2.5" />PRO</Link>}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {isPremium ? (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"><div><p className="text-sm font-medium text-foreground">Gradient Overlay</p><p className="mt-0.5 text-xs text-muted-foreground">Blend the panel with a soft two-color gradient.</p></div><Switch checked={formData.profileGradientEnabled} onCheckedChange={(checked) => update({ profileGradientEnabled: checked })} /></div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ColorPicker label="Panel Gradient Primary" value={formData.profileGradientPrimary} onChange={(value) => update({ profileGradientPrimary: value })} />
                    <ColorPicker label="Panel Gradient Secondary" value={formData.profileGradientSecondary} onChange={(value) => update({ profileGradientSecondary: value })} />
                  </div>
                  <div className="space-y-3"><div className="flex items-center justify-between"><label className="text-xs font-medium text-muted-foreground">Profile Opacity</label><span className="text-sm font-mono text-muted-foreground">{formData.profileOpacity}%</span></div><Slider value={[formData.profileOpacity]} onValueChange={([value]) => update({ profileOpacity: value })} min={0} max={100} step={1} className="w-full" /></div>
                  <div className="space-y-3"><div className="flex items-center justify-between"><label className="text-xs font-medium text-muted-foreground">Profile Blur</label><span className="text-sm font-mono text-muted-foreground">{formData.profileBlur}px</span></div><Slider value={[formData.profileBlur]} onValueChange={([value]) => update({ profileBlur: value })} min={0} max={30} step={1} className="w-full" /></div>
                </>
              ) : (
                <Link href="/pricing" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/20 bg-accent-soft px-4 py-6 text-sm text-primary transition hover:bg-primary/15">
                  <IconCrown className="size-4" />
                  <span>Unlock gradient overlay with Lifetime</span>
                </Link>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="glow" className="mt-6 space-y-4">
          <Card className="border-border bg-surface backdrop-blur-sm">
            <CardHeader className="pb-4"><CardTitle className="text-lg text-foreground">Glow</CardTitle><CardDescription className="text-muted-foreground">Layered glow effects for names, icons, badges, and borders.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[
                { key: 'glowUsername', label: 'Glow Username' },
                { key: 'glowSocials', label: 'Glow Social Icons' },
                { key: 'glowBadges', label: 'Glow Badges' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"><span className="text-sm font-medium text-foreground">{item.label}</span><Switch checked={formData[item.key as keyof AppearanceState] as boolean} onCheckedChange={(checked) => update({ [item.key]: checked } as Partial<AppearanceState>)} /></div>
              ))}</div>
              <ColorPicker label="Glow Color" value={formData.glowColor} onChange={(value) => update({ glowColor: value })} />
              <div className="space-y-3"><div className="flex items-center justify-between"><label className="text-xs font-medium text-muted-foreground">Glow Intensity</label><span className="text-sm font-mono text-muted-foreground">{formData.glowIntensity}</span></div><Slider value={[formData.glowIntensity]} onValueChange={([value]) => update({ glowIntensity: value })} min={0} max={100} step={1} className="w-full" /></div>
            </CardContent>
          </Card>

          <Card className="border-border bg-surface backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-foreground">Outline / Border Glow</CardTitle>
                {!isPremium && <Link href="/pricing" className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-primary"><IconCrown className="size-2.5" />PRO</Link>}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {isPremium ? (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"><div><p className="text-sm font-medium text-foreground">Enable Outline</p><p className="mt-0.5 text-xs text-muted-foreground">Adds a glowing border around the panel.</p></div><Switch checked={formData.outlineEnabled} onCheckedChange={(checked) => update({ outlineEnabled: checked })} /></div>
                  <ColorPicker label="Outline Color" value={formData.outlineColor} onChange={(value) => update({ outlineColor: value })} />
                  <div className="space-y-3"><div className="flex items-center justify-between"><label className="text-xs font-medium text-muted-foreground">Outline Width</label><span className="text-sm font-mono text-muted-foreground">{formData.outlineWidth}px</span></div><Slider value={[formData.outlineWidth]} onValueChange={([value]) => update({ outlineWidth: value })} min={1} max={8} step={1} className="w-full" /></div>
                </>
              ) : (
                <Link href="/pricing" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/20 bg-accent-soft px-4 py-6 text-sm text-primary transition hover:bg-primary/15">
                  <IconCrown className="size-4" />
                  <span>Unlock outline glow with Lifetime</span>
                </Link>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <UnsavedChangesBar
        show={hasChanges}
        saving={saving}
        onSave={saveAppearance}
        onReset={handleReset}
        label="appearance"
      />
    </div>
  )
}
