'use client'

import { useState } from 'react'
import { IconCreditCard, IconInfoCircle, IconLoader2, IconCrown, IconEye } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { HexColorPicker } from 'react-colorful'

type CardStyle = 'classic' | 'frosted-square' | 'frosted-soft' | 'outlined' | 'aurora' | 'transparent'
type CardRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface ProfileCardSettingsProps {
  profile: {
    card_style?: string
    card_color?: string
    card_radius?: string
    card_transparent?: boolean
    inner_card_transparent?: boolean
    card_background?: string
    card_border_color?: string
    card_border_width?: number
    card_shadow?: string
    card_blur?: number
    card_gradient_enabled?: boolean
    card_gradient_from?: string
    card_gradient_to?: string
    inner_card_background?: string
    inner_card_border_color?: string
  }
  onSave?: (updates: Record<string, unknown>) => Promise<void>
}

export function ProfileCardSettings({ profile, onSave }: ProfileCardSettingsProps) {
  const [advanced, setAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cardStyle, setCardStyle] = useState<CardStyle>((profile.card_style as CardStyle) || 'classic')
  const [cardColor, setCardColor] = useState(profile.card_color || '#a855f7')
  const [cardRadius, setCardRadius] = useState<CardRadius>((profile.card_radius as CardRadius) || 'lg')
  const [cardTransparent, setCardTransparent] = useState(profile.card_transparent || false)
  const [innerCardTransparent, setInnerCardTransparent] = useState(profile.inner_card_transparent || false)
  const [cardBackground, setCardBackground] = useState(profile.card_background || '#0a0a0f')
  const [cardBorderColor, setCardBorderColor] = useState(profile.card_border_color || '#ffffff15')
  const [cardBorderWidth, setCardBorderWidth] = useState(profile.card_border_width || 1)
  const [cardShadow, setCardShadow] = useState(profile.card_shadow || 'none')
  const [cardBlur, setCardBlur] = useState(profile.card_blur || 0)
  const [cardGradientEnabled, setCardGradientEnabled] = useState(profile.card_gradient_enabled || false)
  const [cardGradientFrom, setCardGradientFrom] = useState(profile.card_gradient_from || '#a855f7')
  const [cardGradientTo, setCardGradientTo] = useState(profile.card_gradient_to || '#ec4899')
  const [innerCardBackground, setInnerCardBackground] = useState(profile.inner_card_background || '#0a0a0f')
  const [innerCardBorderColor, setInnerCardBorderColor] = useState(profile.inner_card_border_color || '#ffffff10')
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    try {
      const updates = {
        card_style: cardStyle,
        card_color: cardColor,
        card_radius: cardRadius,
        card_transparent: cardTransparent,
        inner_card_transparent: innerCardTransparent,
        card_background: cardBackground,
        card_border_color: cardBorderColor,
        card_border_width: cardBorderWidth,
        card_shadow: cardShadow,
        card_blur: cardBlur,
        card_gradient_enabled: cardGradientEnabled,
        card_gradient_from: cardGradientFrom,
        card_gradient_to: cardGradientTo,
        inner_card_background: innerCardBackground,
        inner_card_border_color: innerCardBorderColor,
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
      toast.success('Profile card settings saved')
    } catch {
      toast.error('Failed to save profile card settings')
    } finally {
      setSaving(false)
    }
  }

  const cardStyles: { id: CardStyle; label: string }[] = [
    { id: 'classic', label: 'classic' },
    { id: 'frosted-square', label: 'frosted square' },
    { id: 'frosted-soft', label: 'frosted soft' },
    { id: 'outlined', label: 'outlined' },
    { id: 'aurora', label: 'aurora' },
    { id: 'transparent', label: 'transparent' },
  ]

  const radiusOptions: { id: CardRadius; className: string }[] = [
    { id: 'none', className: 'rounded-none' },
    { id: 'sm', className: 'rounded-sm' },
    { id: 'md', className: 'rounded-md' },
    { id: 'lg', className: 'rounded-lg' },
    { id: 'xl', className: 'rounded-xl' },
    { id: 'full', className: 'rounded-2xl' },
  ]

  return (
    <div className="space-y-6 rounded-[32px] border border-border bg-surface/80 p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconCreditCard className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Profile Card</h2>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-foreground-secondary">Advanced</span>
          <Switch checked={advanced} onCheckedChange={setAdvanced} />
        </div>
      </div>

      <p className="text-sm text-foreground-secondary">This is the center piece of your profile. Most of your profile elements will be built around it.</p>

      {!advanced ? (
        <>
          {/* Card Style Selection */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {cardStyles.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => setCardStyle(style.id)}
                className={cn(
                  'group relative rounded-2xl border p-3 text-center transition',
                  cardStyle === style.id
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-dashed border-border bg-surface hover:bg-white/[0.04]'
                )}
              >
                {/* Preview mockup */}
                <div className={cn(
                  'relative mb-2 flex h-24 items-center justify-center overflow-hidden rounded-xl',
                  style.id === 'classic' && 'bg-gradient-to-br from-primary/20 to-primary/10',
                  style.id === 'frosted-square' && 'bg-primary/10 backdrop-blur-sm',
                  style.id === 'frosted-soft' && 'bg-primary/5 backdrop-blur-md rounded-2xl',
                  style.id === 'outlined' && 'border border-dashed border-border-strong bg-transparent',
                  style.id === 'aurora' && 'bg-gradient-to-br from-primary/20 via-primary/10 to-primary/20',
                  style.id === 'transparent' && 'bg-transparent border border-border'
                )}>
                  {/* View count badge */}
                  <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] text-foreground-secondary">
                    <IconEye className="size-2.5" />
                    <span>0</span>
                  </div>
                  {/* Card content mockup */}
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-[10px] text-foreground-secondary">{style.label}</p>
                    <div className="flex gap-1">
                      <IconCrown className="size-3 text-primary/50" />
                      <IconCrown className="size-3 text-primary/50" />
                      <IconCrown className="size-3 text-primary/50" />
                    </div>
                  </div>
                </div>
                <p className={cn('text-xs', cardStyle === style.id ? 'text-primary' : 'text-muted-foreground')}>
                  {style.label}
                </p>
              </button>
            ))}
          </div>

          {/* Color and Radius */}
          <div className="flex gap-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Color</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowColorPicker(showColorPicker === 'cardColor' ? null : 'cardColor')}
                  className="h-10 w-10 rounded-full border-2 border-border-strong"
                  style={{ backgroundColor: cardColor }}
                />
                {showColorPicker === 'cardColor' && (
                  <div className="absolute z-10 mt-2">
                    <HexColorPicker color={cardColor} onChange={setCardColor} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-foreground">Radius</p>
              <div className="flex gap-2">
                {radiusOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setCardRadius(option.id)}
                    className={cn(
                      'h-10 w-10 border transition',
                      option.className,
                      cardRadius === option.id
                        ? 'border-primary bg-primary/20'
                        : 'border-border bg-white/5 hover:bg-white/10'
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Advanced: Heads up notice */}
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-accent-soft p-4">
            <IconInfoCircle className="mt-0.5 size-4 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Heads up!</p>
              <p className="text-xs text-foreground-secondary">
                Going transparent? Toggling back won&apos;t restore your old settings - you&apos;ll need to redo them yourself.
              </p>
            </div>
          </div>

          {/* Transparency buttons */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => setCardTransparent(!cardTransparent)}
              className={cn(
                'h-12 rounded-xl border-border',
                cardTransparent ? 'bg-primary/20 text-primary' : 'bg-white/5'
              )}
            >
              <IconCrown className="mr-2 size-4" />
              Make Profile Card Transparent
            </Button>
            <Button
              variant="outline"
              onClick={() => setInnerCardTransparent(!innerCardTransparent)}
              className={cn(
                'h-12 rounded-xl border-border',
                innerCardTransparent ? 'bg-primary/20 text-primary' : 'bg-white/5'
              )}
            >
              <IconCrown className="mr-2 size-4" />
              Make Inner Card Transparent
            </Button>
          </div>

          {/* Profile Card Section */}
          <fieldset className="space-y-4 rounded-2xl border border-dashed border-border p-4">
            <legend className="px-2 text-sm font-medium text-foreground">Profile Card</legend>

            {/* Background */}
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded" style={{ backgroundColor: cardBackground }} />
                  <span className="text-sm text-foreground-secondary">Background</span>
                </div>
              </summary>
              <div className="mt-2 p-2">
                <HexColorPicker color={cardBackground} onChange={setCardBackground} />
              </div>
            </details>

            {/* Border */}
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded border-2" style={{ borderColor: cardBorderColor }} />
                  <span className="text-sm text-foreground-secondary">Border</span>
                </div>
              </summary>
              <div className="mt-2 space-y-3 p-2">
                <HexColorPicker color={cardBorderColor} onChange={setCardBorderColor} />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-secondary">Width</span>
                    <span className="text-xs text-primary">{cardBorderWidth}px</span>
                  </div>
                  <Slider
                    value={[cardBorderWidth]}
                    onValueChange={([value]) => setCardBorderWidth(value)}
                    min={0}
                    max={4}
                    step={1}
                  />
                </div>
              </div>
            </details>

            {/* Shadow */}
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-white/10 shadow-lg" />
                  <span className="text-sm text-foreground-secondary">Shadow</span>
                </div>
              </summary>
              <div className="mt-2 grid grid-cols-3 gap-2 p-2">
                {['none', 'sm', 'md', 'lg', 'xl', '2xl'].map((shadow) => (
                  <button
                    key={shadow}
                    type="button"
                    onClick={() => setCardShadow(shadow)}
                    className={cn(
                      'rounded-lg border p-2 text-xs transition',
                      cardShadow === shadow
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-border bg-white/5 text-foreground-secondary hover:bg-white/10'
                    )}
                  >
                    {shadow}
                  </button>
                ))}
              </div>
            </details>

            {/* Blur */}
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-white/20 backdrop-blur-sm" />
                  <span className="text-sm text-foreground-secondary">Blur</span>
                </div>
              </summary>
              <div className="mt-2 space-y-2 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground-secondary">Intensity</span>
                  <span className="text-xs text-primary">{cardBlur}px</span>
                </div>
                <Slider
                  value={[cardBlur]}
                  onValueChange={([value]) => setCardBlur(value)}
                  min={0}
                  max={20}
                  step={1}
                />
              </div>
            </details>

            {/* Gradient */}
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded"
                    style={{ background: `linear-gradient(135deg, ${cardGradientFrom}, ${cardGradientTo})` }}
                  />
                  <span className="text-sm text-foreground-secondary">Gradient</span>
                </div>
              </summary>
              <div className="mt-2 space-y-3 p-2">
                <div className="flex items-center gap-2">
                  <Switch checked={cardGradientEnabled} onCheckedChange={setCardGradientEnabled} />
                  <span className="text-xs text-foreground-secondary">Enable gradient</span>
                </div>
                {cardGradientEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <span className="text-xs text-foreground-secondary">From</span>
                      <HexColorPicker color={cardGradientFrom} onChange={setCardGradientFrom} />
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs text-foreground-secondary">To</span>
                      <HexColorPicker color={cardGradientTo} onChange={setCardGradientTo} />
                    </div>
                  </div>
                )}
              </div>
            </details>
          </fieldset>

          {/* Inner Card Section */}
          <fieldset className="space-y-4 rounded-2xl border border-dashed border-border p-4">
            <legend className="px-2 text-sm font-medium text-foreground">Inner Card</legend>

            {/* Inner Background */}
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded" style={{ backgroundColor: innerCardBackground }} />
                  <span className="text-sm text-foreground-secondary">Background</span>
                </div>
              </summary>
              <div className="mt-2 p-2">
                <HexColorPicker color={innerCardBackground} onChange={setInnerCardBackground} />
              </div>
            </details>

            {/* Inner Border */}
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded border-2" style={{ borderColor: innerCardBorderColor }} />
                  <span className="text-sm text-foreground-secondary">Border</span>
                </div>
              </summary>
              <div className="mt-2 p-2">
                <HexColorPicker color={innerCardBorderColor} onChange={setInnerCardBorderColor} />
              </div>
            </details>
          </fieldset>
        </>
      )}

      {/* Save Button */}
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
