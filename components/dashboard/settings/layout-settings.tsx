'use client'

import { useState } from 'react'
import { IconLayoutDashboard, IconCrown, IconLoader2, IconLock } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

type LayoutMode = 'default' | 'modern' | 'portfolio' | 'minimal' | 'banner'
type AvatarShape = 'circle' | 'soft' | 'squircle' | 'rounded' | 'square'
type EnterAnim = 'none' | 'slide' | 'vertical-split' | 'horizontal-split'

interface LayoutSettingsProps {
  profile: {
    layout_mode?: string
    layout_style?: string
    avatar_shape?: string | null
    profile_opacity?: number
    profile_blur?: number
    profile_radius?: number
    profile_border_color?: string | null
    profile_enter_animation?: string | null
    avatar_position?: string | null
  }
  username?: string
  onSave?: (updates: Record<string, unknown>) => Promise<void>
}

const OPACITY_STEPS = [0, 25, 50, 75, 100]
const BLUR_STEPS = [0, 10, 20, 40, 80]
const RADIUS_STEPS = [0, 10, 20, 40, 50]

const ENTER_ANIMATIONS: { id: EnterAnim; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'slide', label: 'Slide' },
  { id: 'vertical-split', label: 'Vertical Split' },
  { id: 'horizontal-split', label: 'Horizontal Split' },
]

function WipBadge() {
  return (
    <span className="ml-1.5 rounded-md border border-border-strong bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      WIP
    </span>
  )
}

function PillRow<T extends number>({
  value,
  options,
  onChange,
  suffix = '',
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  suffix?: string
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'rounded-xl border px-3 py-2 text-xs font-medium transition',
            value === opt
              ? 'border-primary/50 bg-primary/10 text-foreground'
              : 'border-border bg-surface text-foreground-secondary hover:bg-white/[0.05]',
          )}
        >
          {opt}{suffix}
        </button>
      ))}
    </div>
  )
}

function LayoutTile({
  id,
  label,
  active,
  onClick,
  wip = false,
}: {
  id: LayoutMode
  label: string
  active: boolean
  onClick: () => void
  wip?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={wip}
      className={cn(
        'group rounded-2xl border p-3 text-left transition',
        wip
          ? 'cursor-not-allowed border-border bg-surface opacity-50'
          : active
            ? 'border-primary/50 bg-primary/5'
            : 'border-border bg-surface hover:border-border-strong',
      )}
    >
      <div
        className={cn(
          'mb-3 flex aspect-[5/4] w-full items-center justify-center rounded-xl border',
          wip
            ? 'border-border bg-surface'
            : active
              ? 'border-primary/40 bg-primary/5'
              : 'border-border bg-surface',
        )}
      >
        {id === 'default' && (
          <div className="flex h-full w-full flex-col p-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-white/20" />
              <div className="flex-1 space-y-1">
                <div className="h-1.5 w-16 rounded bg-white/25" />
                <div className="flex gap-1">
                  <div className="h-1 w-4 rounded bg-white/15" />
                  <div className="h-1 w-4 rounded bg-white/15" />
                  <div className="h-1 w-4 rounded bg-white/15" />
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1">
              <div className="h-5 rounded bg-white/10" />
              <div className="h-5 rounded bg-white/10" />
              <div className="h-5 rounded bg-white/10" />
              <div className="h-5 rounded bg-white/10" />
            </div>
          </div>
        )}
        {id === 'modern' && (
          <div className="flex h-full w-full flex-col items-center justify-start p-4">
            <div className="h-8 w-8 rounded-full bg-white/25" />
            <div className="mt-1 h-1.5 w-14 rounded bg-white/20" />
            <div className="mt-1 flex gap-1">
              <div className="h-1 w-3 rounded bg-white/15" />
              <div className="h-1 w-3 rounded bg-white/15" />
              <div className="h-1 w-3 rounded bg-white/15" />
            </div>
            <div className="mt-auto grid w-full grid-cols-2 gap-1">
              <div className="h-4 rounded bg-white/10" />
              <div className="h-4 rounded bg-white/10" />
            </div>
          </div>
        )}
        {id === 'portfolio' && (
          <div className="grid h-full w-full grid-cols-2 gap-1 p-4">
            <div className="rounded bg-white/10" />
            <div className="rounded bg-white/10" />
            <div className="col-span-2 rounded bg-white/10" />
            <div className="col-span-2 rounded bg-white/10" />
          </div>
        )}
        {id === 'minimal' && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4">
            {wip && <IconLock className="mb-1 size-4 text-muted-foreground" />}
            <div className="h-6 w-6 rounded-full bg-white/20" />
            <div className="h-1.5 w-12 rounded bg-white/20" />
            <div className="space-y-1">
              <div className="h-1.5 w-20 rounded bg-white/10" />
              <div className="h-1.5 w-16 rounded bg-white/10" />
            </div>
          </div>
        )}
        {id === 'banner' && (
          <div className="flex h-full w-full flex-col overflow-hidden p-4">
            {wip && <IconLock className="mb-1 size-4 text-muted-foreground self-center" />}
            <div className="h-8 w-full rounded-t bg-white/15" />
            <div className="flex flex-col items-center gap-1 pt-2">
              <div className="h-1.5 w-14 rounded bg-white/20" />
              <div className="mt-1 grid w-full grid-cols-2 gap-1">
                <div className="h-4 rounded bg-white/10" />
                <div className="h-4 rounded bg-white/10" />
              </div>
            </div>
          </div>
        )}
      </div>
      <p className={cn('flex items-center text-sm font-medium', wip ? 'text-muted-foreground' : active ? 'text-foreground' : 'text-foreground-secondary')}>
        {label}
        {wip && <WipBadge />}
      </p>
    </button>
  )
}

// Avatar shape tile
function ShapeTile({
  shape,
  active,
  onClick,
  wip = false,
}: {
  shape: AvatarShape
  active: boolean
  onClick: () => void
  wip?: boolean
}) {
  const labels: Record<AvatarShape, string> = {
    circle:   'Circle',
    soft:     'Soft',
    squircle: 'Squircle',
    rounded:  'Rounded',
    square:   'Square',
  }

  const shapePreview: Record<AvatarShape, React.CSSProperties> = {
    circle:   { borderRadius: '50%' },
    soft:     { borderRadius: '35%' },
    squircle: { borderRadius: '22%' },
    rounded:  { borderRadius: '8px' },
    square:   { borderRadius: '2px' },
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={wip}
      className={cn(
        'flex flex-col items-center gap-2 rounded-2xl border p-3 transition',
        wip
          ? 'cursor-not-allowed border-border bg-surface opacity-50'
          : active
            ? 'border-primary/50 bg-primary/5'
            : 'border-border bg-surface hover:border-border-strong',
      )}
    >
      <div
        className="h-10 w-10 bg-white/25"
        style={shapePreview[shape]}
      />
      <p className={cn('flex items-center text-xs font-medium', wip ? 'text-muted-foreground' : active ? 'text-foreground' : 'text-foreground-secondary')}>
        {labels[shape]}
        {wip && <WipBadge />}
      </p>
    </button>
  )
}

export function LayoutSettings({ profile, username = '', onSave }: LayoutSettingsProps) {
  const [advanced, setAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)

  const isRez = true // all layout features are now available to everyone

  const [avatarPosition, setAvatarPosition] = useState<string>(profile.avatar_position ?? 'center')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>((profile.layout_mode as LayoutMode) || 'default')
  const [avatarShape, setAvatarShape] = useState<AvatarShape>((profile.avatar_shape as AvatarShape) || 'circle')
  const [opacity, setOpacity] = useState<number>(profile.profile_opacity ?? 50)
  const [blur, setBlur] = useState<number>(profile.profile_blur ?? 20)
  const [radius, setRadius] = useState<number>(profile.profile_radius ?? 40)
  const [borderColor, setBorderColor] = useState<string>(profile.profile_border_color || '#ffffff')
  const [enterAnim, setEnterAnim] = useState<EnterAnim>((profile.profile_enter_animation as EnterAnim) || 'none')

  async function handleSave() {
    setSaving(true)
    try {
      const updates = {
        layout_mode: layoutMode,
        avatar_shape: avatarShape,
        avatar_position: avatarPosition,
        profile_opacity: opacity,
        profile_blur: blur,
        profile_radius: radius,
        profile_border_color: borderColor,
        profile_enter_animation: enterAnim,
      }
      if (onSave) {
        await onSave(updates)
      } else {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (!res.ok) throw new Error('Failed to save')
      }
      toast.success('Layout saved')
    } catch {
      toast.error('Failed to save layout')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 rounded-[32px] border border-border bg-surface/80 p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft">
            <IconLayoutDashboard className="size-4 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Layout</h2>
        </div>
      </div>

      {/* Profile Alignment picker */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground-secondary">Profile Alignment</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Centered option */}
          <button
            type="button"
            onClick={() => setAvatarPosition('center')}
            className={`rounded-2xl border p-3 text-left transition-all ${avatarPosition === 'center' ? 'border-primary/50 bg-primary/10' : 'border-border bg-surface hover:bg-white/[0.04]'}`}
          >
            <div className="mb-2 flex aspect-[5/4] flex-col items-center justify-center gap-1 rounded-xl bg-white/[0.03]">
              <div className="h-6 w-6 rounded-full bg-white/20" />
              <div className="h-1.5 w-16 rounded-full bg-white/15" />
              <div className="h-1.5 w-12 rounded-full bg-white/10" />
            </div>
            <p className="text-xs font-medium text-foreground-secondary">Centered</p>
            <p className="text-[10px] text-muted-foreground">Avatar and content centered</p>
          </button>
          {/* Left-aligned option */}
          <button
            type="button"
            onClick={() => setAvatarPosition('left')}
            className={`rounded-2xl border p-3 text-left transition-all ${avatarPosition === 'left' ? 'border-primary/50 bg-primary/10' : 'border-border bg-surface hover:bg-white/[0.04]'}`}
          >
            <div className="mb-2 flex aspect-[5/4] items-center justify-start gap-2 rounded-xl bg-white/[0.03] px-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-white/20" />
              <div className="space-y-1.5">
                <div className="h-1.5 w-14 rounded-full bg-white/15" />
                <div className="h-1.5 w-10 rounded-full bg-white/10" />
              </div>
            </div>
            <p className="text-xs font-medium text-foreground-secondary">Left-aligned</p>
            <p className="text-[10px] text-muted-foreground">Avatar and content left-aligned</p>
          </button>
        </div>
      </div>

      {/* Layout mode tiles */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground-secondary">Layout Style</h3>
        <div className="grid grid-cols-3 gap-3">
          <LayoutTile id="default" label="Default" active={layoutMode === 'default'} onClick={() => setLayoutMode('default')} />
          <LayoutTile id="modern" label="Modern" active={layoutMode === 'modern'} onClick={() => setLayoutMode('modern')} />
          <LayoutTile id="portfolio" label="Portfolio" active={layoutMode === 'portfolio'} onClick={() => setLayoutMode('portfolio')} />
          <LayoutTile
            id="minimal"
            label="Minimal"
            active={layoutMode === 'minimal'}
            onClick={() => isRez && setLayoutMode('minimal')}
            wip={!isRez}
          />
          <LayoutTile
            id="banner"
            label="Banner"
            active={layoutMode === 'banner'}
            onClick={() => isRez && setLayoutMode('banner')}
            wip={!isRez}
          />
        </div>
      </div>

      {/* Avatar Shape picker */}
      <div>
        <h3 className="mb-1 text-sm font-medium text-foreground-secondary">
          Profile Shape
        </h3>
        <p className="mb-3 text-[11px] text-muted-foreground">Choose the shape of your avatar</p>
        <div className="grid grid-cols-5 gap-3">
          <ShapeTile shape="circle"   active={avatarShape === 'circle'}   onClick={() => setAvatarShape('circle')}   wip={!isRez} />
          <ShapeTile shape="soft"     active={avatarShape === 'soft'}     onClick={() => setAvatarShape('soft')}     wip={!isRez} />
          <ShapeTile shape="squircle" active={avatarShape === 'squircle'} onClick={() => setAvatarShape('squircle')} wip={!isRez} />
          <ShapeTile shape="rounded"  active={avatarShape === 'rounded'}  onClick={() => setAvatarShape('rounded')}  wip={!isRez} />
          <ShapeTile shape="square"   active={avatarShape === 'square'}   onClick={() => setAvatarShape('square')}   wip={!isRez} />
        </div>
      </div>

      {/* Profile Settings section */}
      <div className="space-y-5 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Profile Settings</p>
          <button
            type="button"
            onClick={() => setAdvanced(v => !v)}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1 text-xs text-foreground-secondary hover:bg-white/[0.06]"
          >
            {advanced ? 'Simple' : 'Advanced'}
          </button>
        </div>

        {!advanced ? (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs text-foreground-secondary">Profile Opacity</p>
              <PillRow value={opacity} options={OPACITY_STEPS} onChange={setOpacity} suffix="%" />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-foreground-secondary">Profile Blur</p>
              <PillRow value={blur} options={BLUR_STEPS} onChange={setBlur} suffix="px" />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-foreground-secondary">Profile Radius</p>
              <PillRow value={radius} options={RADIUS_STEPS} onChange={setRadius} suffix="px" />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-foreground-secondary">Profile Border Color</p>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-1">
                <input
                  type="color"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-lg border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-foreground-secondary">Profile Opacity</p>
                <span className="text-xs text-foreground-secondary">{opacity}%</span>
              </div>
              <Slider value={[opacity]} onValueChange={([v]) => setOpacity(v)} min={0} max={100} step={1} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-foreground-secondary">Profile Blur</p>
                <span className="text-xs text-foreground-secondary">{blur}px</span>
              </div>
              <Slider value={[blur]} onValueChange={([v]) => setBlur(v)} min={0} max={80} step={1} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-foreground-secondary">Profile Radius</p>
                <span className="text-xs text-foreground-secondary">{radius}px</span>
              </div>
              <Slider value={[radius]} onValueChange={([v]) => setRadius(v)} min={0} max={50} step={1} />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-foreground-secondary">Profile Border Color</p>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-1">
                <input
                  type="color"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-lg border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Enter animation - always shown */}
        <div className="space-y-2">
          <p className="text-xs text-foreground-secondary">Profile Enter Animation</p>
          <div className="relative">
            <select
              value={enterAnim}
              onChange={(e) => setEnterAnim(e.target.value as EnterAnim)}
              className="h-11 w-full appearance-none rounded-xl border border-border bg-surface-2 px-4 pr-10 text-sm text-foreground outline-none"
            >
              {ENTER_ANIMATIONS.map(a => (
                <option key={a.id} value={a.id} className="bg-surface">{a.label}</option>
              ))}
            </select>
            <IconCrown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
          </div>
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="h-12 w-full rounded-xl bg-primary font-semibold hover:opacity-90"
      >
        {saving ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : null}
        Save
      </Button>
    </div>
  )
}
