"use client"

import React, { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconLoader2, IconPlus, IconTrash, IconUpload, IconUser, IconPhoto, IconLayout, IconTypography, IconDoor } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { UnsavedChangesBar } from '@/components/dashboard/unsaved-changes-bar'
import type { Profile } from '@/lib/types'
import { uploadFile } from '@/lib/upload'

interface ProfileEditorProps {
  profile: Profile
  isPremium?: boolean
}

type FormState = {
  display_name: string
  bio: string
  location: string
  avatar_url: string
  background_url: string
  panel_size: string
  avatar_position: string
  avatar_placement: string
  avatar_shape: string
  layout_mode: string
  show_avatar: boolean
  show_name: boolean
  typing_bio: boolean
  typing_speed: number
  bio_texts: string[]
  enter_enabled: boolean
  enter_title: string
  enter_subtitle: string
  enter_show_profile: boolean
  enter_show_title: boolean
  enter_show_subtitle: boolean
}

const PANEL_WIDTHS = ['small', 'medium', 'large', 'xlarge']
const TYPING_PRESETS = [
  { label: 'Very Fast', value: 20 },
  { label: 'Fast', value: 45 },
  { label: 'Normal', value: 80 },
  { label: 'Slow', value: 130 },
  { label: 'Very Slow', value: 200 },
  { label: 'Extra Slow', value: 280 },
]

function getInitialState(profile: Profile): FormState {
  return {
    display_name: profile.display_name || '',
    bio: profile.bio || '',
    location: profile.location || '',
    avatar_url: profile.avatar_url || '',
    background_url: profile.background_url || '',
    panel_size: profile.panel_size || 'medium',
    avatar_position: profile.avatar_position === 'center' ? 'center' : 'left',
    avatar_placement: profile.avatar_placement === 'inside' ? 'inside' : 'outside',
    avatar_shape: profile.avatar_shape || 'circle',
    layout_mode: profile.layout_mode || 'default',
    show_avatar: profile.show_avatar !== false,
    show_name: profile.show_name !== false,
    typing_bio: profile.typing_bio || false,
    typing_speed: profile.typing_speed ?? 80,
    bio_texts: Array.isArray(profile.bio_texts) ? profile.bio_texts : [],
    enter_enabled: (profile as any).enter_enabled !== false,
    enter_title: (profile as any).enter_title || profile.display_name || profile.username || '',
    enter_subtitle: (profile as any).enter_subtitle || 'Click anywhere to enter',
    enter_show_profile: (profile as any).enter_show_profile !== false,
    enter_show_title: (profile as any).enter_show_title !== false,
    enter_show_subtitle: (profile as any).enter_show_subtitle !== false,
  }
}

export function ProfileEditor({ profile, isPremium = false }: ProfileEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBackground, setUploadingBackground] = useState(false)
  const [newBioText, setNewBioText] = useState('')

  const initialState = useRef(getInitialState(profile))
  const [formData, setFormData] = useState<FormState>(getInitialState(profile))

  // Check if there are unsaved changes
  const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialState.current)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to save profile')
      }
      initialState.current = { ...formData }
      toast.success('Profile saved successfully')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setFormData(initialState.current)
  }

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleUpload = async (file: File, type: 'avatar' | 'background') => {
    const setUploading = type === 'avatar' ? setUploadingAvatar : setUploadingBackground
    setUploading(true)
    try {
      const result = await uploadFile(file, type)
      const field = type === 'avatar' ? 'avatar_url' : 'background_url'
      setFormData(prev => ({ ...prev, [field]: result.url }))
      // Explicitly save to profile immediately - don't rely on the background task in the upload route
      const saveRes = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: result.url }),
      })
      if (!saveRes.ok) {
        const payload = await saveRes.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to save after upload')
      }
      // Mark as saved so unsaved-changes bar doesn't appear just for this field
      initialState.current = { ...initialState.current, [field]: result.url }
      toast.success(type === 'avatar' ? 'Profile picture updated' : 'Background updated')
      // Refresh server data so public profile also shows the new image
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed', { id: 'upload-error' })
    } finally {
      setUploading(false)
    }
  }

  const BIO_TEXTS_LIMIT = 10

  const addBioText = () => {
    if (!newBioText.trim()) return
    if (formData.bio_texts.length >= BIO_TEXTS_LIMIT) return
    handleChange('bio_texts', [...formData.bio_texts, newBioText.trim()])
    setNewBioText('')
  }

  const updateBioText = (index: number, value: string) => {
    const next = [...formData.bio_texts]
    next[index] = value
    handleChange('bio_texts', next)
  }

  const removeBioText = (index: number) => {
    handleChange('bio_texts', formData.bio_texts.filter((_, itemIndex) => itemIndex !== index))
  }

  const typingPreset = TYPING_PRESETS.find((preset) => preset.value === formData.typing_speed)?.label || 'Custom'

  return (
    <div className="space-y-6 pb-20">
      {/* Avatar & Basic Info */}
      <Card className="border-border bg-surface backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
              <IconUser className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">Profile Info</CardTitle>
              <CardDescription className="text-muted-foreground">Your public profile details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center">
            <label className="group relative cursor-pointer">
              <input
                type="file"
                accept="image/*,image/gif"
                onChange={(e) => { if (e.target.files?.[0]) { handleUpload(e.target.files[0], 'avatar'); e.target.value = '' } }}
                className="hidden"
              />
              {/* key forces Radix Avatar to remount when URL changes, ensuring the new image loads */}
              <Avatar key={formData.avatar_url} className="h-28 w-28 border-4 border-primary/20 transition-transform duration-200 group-hover:scale-[1.02]">
                <AvatarImage src={formData.avatar_url || undefined} />
                <AvatarFallback className="bg-accent-soft text-3xl text-primary">
                  {(profile.username?.[0] || 'U').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {uploadingAvatar ? (
                  <IconLoader2 className="size-6 animate-spin text-foreground" />
                ) : (
                  <IconUpload className="size-6 text-foreground" />
                )}
              </div>
            </label>
            <div>
              <p className="text-base font-semibold text-foreground-secondary">@{profile.username}</p>
              <p className="text-xs text-muted-foreground">Click to change avatar (max 25MB)</p>
            </div>
          </div>

          {/* Display Name & Location */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Display Name</label>
              <Input
                value={formData.display_name}
                onChange={(e) => handleChange('display_name', e.target.value)}
                placeholder="Your display name"
                className="h-12 border-border bg-surface-2"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Location</label>
              <Input
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="City, Country"
                className="h-12 border-border bg-surface-2"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Bio</label>
            <Input
              value={formData.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              placeholder="A short bio about yourself"
              className="h-12 border-border bg-surface-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Background */}
      <Card className="border-border bg-surface backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
              <IconPhoto className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">Background</CardTitle>
              <CardDescription className="text-muted-foreground">Upload an image, GIF, or video background (max 25MB)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-8 text-sm transition hover:bg-white/[0.04]">
            <input
              type="file"
              accept="image/*,image/gif,video/*"
              onChange={(e) => { if (e.target.files?.[0]) { handleUpload(e.target.files[0], 'background'); e.target.value = '' } }}
              className="hidden"
            />
            {uploadingBackground ? (
              <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <IconUpload className="size-5 text-muted-foreground" />
            )}
            <span className="text-foreground-secondary">{formData.background_url ? 'Replace background' : 'Upload background media'}</span>
          </label>



          {formData.background_url && (
            <div className="overflow-hidden rounded-xl border border-border">
              {/\.(mp4|webm|mov|m4v|ogv|ogg)(\?|$)/i.test(formData.background_url) ? (
                <video src={formData.background_url} className="h-40 w-full object-cover" muted autoPlay loop playsInline />
              ) : (
                <img src={formData.background_url} alt="Background preview" className="h-40 w-full object-cover" />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Layout Options */}
      <Card className="border-border bg-surface backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
              <IconLayout className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">Layout</CardTitle>
              <CardDescription className="text-muted-foreground">Customize panel and avatar settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Panel Size */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground">Panel Width</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PANEL_WIDTHS.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleChange('panel_size', size)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                    formData.panel_size === size
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-surface text-foreground-secondary hover:bg-white/[0.04] hover:text-foreground-secondary'
                  }`}
                >
                  {size === 'xlarge' ? 'X-Large' : size.charAt(0).toUpperCase() + size.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Avatar Options */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
              <div>
                <p className="text-sm font-medium text-foreground-secondary">Show Avatar</p>
                <p className="text-xs text-muted-foreground">Display on card</p>
              </div>
              <Switch
                checked={formData.show_avatar}
                onCheckedChange={(checked) => handleChange('show_avatar', checked)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Position</label>
              <div className="grid grid-cols-2 gap-2">
                {['left', 'center'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleChange('avatar_position', value)}
                    className={`rounded-xl border px-3 py-2.5 text-sm transition-all ${
                      formData.avatar_position === value
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border bg-surface text-foreground-secondary hover:bg-white/[0.04]'
                    }`}
                  >
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Placement</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'outside', label: 'Outside' },
                  { value: 'inside', label: 'Inside' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleChange('avatar_placement', option.value)}
                    className={`rounded-xl border px-3 py-2.5 text-sm transition-all ${
                      formData.avatar_placement === option.value
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border bg-surface text-foreground-secondary hover:bg-white/[0.04]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Avatar Shape */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">Avatar Shape</label>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {([
                { id: 'circle',    label: 'Circle',    style: { borderRadius: '50%' } as React.CSSProperties },
                { id: 'soft',      label: 'Soft',      style: { borderRadius: '35%' } as React.CSSProperties },
                { id: 'squircle',  label: 'Squircle',  style: { borderRadius: '22%' } as React.CSSProperties },
                { id: 'rounded',   label: 'Rounded',   style: { borderRadius: '8px' } as React.CSSProperties },
                { id: 'square',    label: 'Square',    style: { borderRadius: '2px' } as React.CSSProperties },
              ]).map(({ id, label, style }) => {
                const active = formData.avatar_shape === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleChange('avatar_shape', id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
                      active
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border bg-surface hover:border-border-strong'
                    }`}
                  >
                    <div className="h-8 w-8 bg-white/30" style={style} />
                    <span className={`text-[11px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Typing Bio */}
      <Card className="border-border bg-surface backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
                <IconTypography className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg text-foreground">Typing Bio</CardTitle>
                <CardDescription className="text-muted-foreground">Animate rotating text lines</CardDescription>
              </div>
            </div>
            <Switch
              checked={formData.typing_bio}
              onCheckedChange={(checked) => handleChange('typing_bio', checked)}
            />
          </div>
        </CardHeader>
        {formData.typing_bio && (
          <CardContent className="space-y-4">
            {/* Bio Lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs text-muted-foreground">{formData.bio_texts.length}/{BIO_TEXTS_LIMIT} lines</span>
              </div>
              {formData.bio_texts.map((text, index) => (
                <div key={`${index}-${text}`} className="flex items-center gap-2">
                  <Input
                    value={text}
                    onChange={(e) => updateBioText(index, e.target.value)}
                    className="h-11 border-border bg-surface-2"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeBioText(index)}
                    className="h-11 w-11 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <IconTrash className="size-4" />
                  </Button>
                </div>
              ))}
              {formData.bio_texts.length < BIO_TEXTS_LIMIT ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newBioText}
                    onChange={(e) => setNewBioText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addBioText()}
                    placeholder="Add a text line..."
                    className="h-11 border-border bg-surface-2"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={addBioText}
                    className="h-11 w-11 rounded-lg"
                  >
                    <IconPlus className="size-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-center text-xs text-muted-foreground">Limit reached - remove a line to add more</p>
              )}
            </div>

            {/* Typing Speed */}
            <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground-secondary">Typing Speed</label>
                <span className="font-mono text-xs text-muted-foreground">{formData.typing_speed}ms - {typingPreset}</span>
              </div>
              <Slider 
                value={[formData.typing_speed]} 
                min={15} 
                max={320} 
                step={5} 
                onValueChange={([v]) => handleChange('typing_speed', v)} 
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Enter Page */}
      <Card className="border-border bg-surface backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
                <IconDoor className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg text-foreground">Enter Page</CardTitle>
                <CardDescription className="text-muted-foreground">Show a splash screen before visitors see your profile</CardDescription>
              </div>
            </div>
            <Switch
              checked={formData.enter_enabled}
              onCheckedChange={(checked) => handleChange('enter_enabled', checked)}
            />
          </div>
        </CardHeader>
        {formData.enter_enabled && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input
                  value={formData.enter_title}
                  onChange={(e) => handleChange('enter_title', e.target.value)}
                  placeholder="Welcome to my profile"
                  className="h-12 border-border bg-surface-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Subtitle</label>
                <Input
                  value={formData.enter_subtitle}
                  onChange={(e) => handleChange('enter_subtitle', e.target.value)}
                  placeholder="Click anywhere to enter"
                  className="h-12 border-border bg-surface-2"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-medium text-muted-foreground">Display Options</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
                  <span className="text-sm text-foreground-secondary">Show Avatar</span>
                  <Switch
                    checked={formData.enter_show_profile}
                    onCheckedChange={(checked) => handleChange('enter_show_profile', checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
                  <span className="text-sm text-foreground-secondary">Show Title</span>
                  <Switch
                    checked={formData.enter_show_title}
                    onCheckedChange={(checked) => handleChange('enter_show_title', checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
                  <span className="text-sm text-foreground-secondary">Show Subtitle</span>
                  <Switch
                    checked={formData.enter_show_subtitle}
                    onCheckedChange={(checked) => handleChange('enter_show_subtitle', checked)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Unsaved Changes Bar */}
      <UnsavedChangesBar
        show={hasChanges}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
        label="profile"
      />
    </div>
  )
}
