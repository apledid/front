'use client'

/**
 * Premium custom click + entrance sound uploads. Rendered in the customize
 * page behind a PremiumGate; the matching column write in /api/upload and the
 * playback in guns-profile.tsx are gated to premium the same way.
 */

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { IconVolume, IconLoader2, IconPlayerPlay, IconPlayerPause, IconX, IconClick, IconDoor } from '@tabler/icons-react'
import { uploadFile } from '@/lib/upload'

type SoundType = 'click-sound' | 'enter-sound'

/** Read a local audio file's duration (seconds) before uploading. */
function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const probe = new Audio()
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(probe.duration)
    }
    probe.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that audio file'))
    }
    probe.src = url
  })
}

function SoundRow({
  label,
  hint,
  icon: Icon,
  value,
  type,
  maxSeconds,
  onChange,
  volume,
  onVolumeChange,
}: {
  label: string
  hint: string
  icon: typeof IconVolume
  value: string
  type: SoundType
  maxSeconds: number
  onChange: (url: string) => void
  volume: number
  onVolumeChange: (v: number) => void
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  async function handle(file: File) {
    setUploading(true)
    try {
      const duration = await getAudioDuration(file)
      if (Number.isFinite(duration) && duration > maxSeconds) {
        toast.error(`${label} must be ${maxSeconds} seconds or less (yours is ${duration.toFixed(1)}s)`, { id: 'sound-upload' })
        return
      }
      const r = await uploadFile(file, type)
      onChange(r.url)
      toast.success(`${label} uploaded`)
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed', { id: 'sound-upload' })
    } finally {
      setUploading(false)
    }
  }

  function togglePreview() {
    if (!value) return
    let a = audioRef.current
    if (!a) {
      a = new Audio()
      audioRef.current = a
      a.addEventListener('play', () => setPlaying(true))
      a.addEventListener('pause', () => setPlaying(false))
      a.addEventListener('ended', () => setPlaying(false))
      a.addEventListener('error', () => setPlaying(false))
    }
    // Currently playing -> pause (the 'pause' listener flips the icon back).
    if (!a.paused) {
      a.pause()
      return
    }
    // Paused/idle -> (re)load the current clip and play from the start.
    if (a.getAttribute('src') !== value) a.src = value
    try { a.currentTime = 0 } catch {}
    a.volume = Math.max(0, Math.min(1, (volume ?? 100) / 100))
    a.play().catch(() => setPlaying(false))
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <span className="text-sm font-medium text-foreground-secondary">{label}</span>
        {value ? (
          <button
            type="button"
            onClick={togglePreview}
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground-secondary"
          >
            {playing ? <IconPlayerPause className="size-3" /> : <IconPlayerPlay className="size-3" />} {playing ? 'Pause' : 'Preview'}
          </button>
        ) : null}
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground-secondary transition hover:bg-white/[0.05] disabled:opacity-50"
        >
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) handle(f)
            }}
          />
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <IconLoader2 className="size-4 animate-spin" /> Uploading…
            </span>
          ) : value ? (
            'Replace sound'
          ) : (
            'Upload sound'
          )}
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Remove"
            className="rounded-lg border border-border px-3 py-2 text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
          >
            <IconX className="size-4" />
          </button>
        ) : null}
      </div>
      {value ? (
        <div className="mt-3 flex items-center gap-2.5">
          <IconVolume className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label={`${label} volume`}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-primary"
          />
          <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{volume}%</span>
        </div>
      ) : null}
    </div>
  )
}

export function SoundEffectsCard({
  form,
  patch,
}: {
  form: { click_sound_url: string; enter_sound_url: string; click_sound_volume: number; enter_sound_volume: number }
  patch: (u: Partial<{ click_sound_url: string; enter_sound_url: string; click_sound_volume: number; enter_sound_volume: number }>) => void
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <IconVolume className="size-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground-secondary">Sound Effects</h3>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SoundRow
            label="Entrance Sound"
            hint="Plays once the moment a visitor clicks to enter. Max 10 seconds."
            icon={IconDoor}
            value={form.enter_sound_url}
            type="enter-sound"
            maxSeconds={10}
            onChange={(url) => patch({ enter_sound_url: url })}
            volume={form.enter_sound_volume}
            onVolumeChange={(v) => patch({ enter_sound_volume: v })}
          />
          <SoundRow
            label="Click Sound"
            hint="Plays on every click while the profile is open. Max 5 seconds."
            icon={IconClick}
            value={form.click_sound_url}
            type="click-sound"
            maxSeconds={5}
            onChange={(url) => patch({ click_sound_url: url })}
            volume={form.click_sound_volume}
            onVolumeChange={(v) => patch({ click_sound_volume: v })}
          />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Short MP3, OGG or WAV clips work best (max 2MB). Keep them subtle.
        </p>
      </div>
    </section>
  )
}
