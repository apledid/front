import { spawn } from 'node:child_process'
import { readdir, readFile, rm, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Deezer-backed full-song resolver for Quick Import. No proxy, no YouTube, no
 * SoundCloud: Deezer's free public API finds the exact original track (by
 * title/artist/duration), and streamrip downloads the real audio from Deezer
 * using the account ARL (configured in /root/.config/streamrip/config.toml).
 * streamrip + ffmpeg must be installed on the host.
 */

const RIP = process.env.RIP_PATH || '/opt/streamrip-venv/bin/rip'
// Explicit config path (holds the Deezer ARL) so it doesn't depend on the PM2
// process's HOME resolving to /root.
const RIP_CONFIG = process.env.RIP_CONFIG || '/root/.config/streamrip/config.toml'
const MAX_BYTES = 25 * 1024 * 1024

const VARIANT_WORDS = [
  'remix', 'slowed', 'sped up', 'speed up', 'nightcore', '8d', 'bass boost', 'reverb',
  'cover', 'instrumental', 'karaoke', 'mashup', 'edit', 'flip', 'bootleg', 'live',
  'acoustic', 'version', 'radio edit', 'extended',
]

// Pick the best-matching Deezer track id for a song. Deezer's search is already
// relevance-ranked; we additionally reward an exact duration match and penalise
// unrequested variant keywords so the ORIGINAL wins over remixes.
export async function deezerSearchBestId(title: string, artist: string, targetDur = 0): Promise<number | null> {
  const q = [artist, title].filter(Boolean).join(' ').trim()
  if (!q) return null
  try {
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=15`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    const tracks: any[] = Array.isArray(data?.data) ? data.data : []
    if (!tracks.length) return null

    const qlc = q.toLowerCase()
    let best = tracks[0]
    let bestScore = -Infinity
    tracks.forEach((t, idx) => {
      const titleLc = (t.title || '').toLowerCase()
      let s = 0
      for (const v of VARIANT_WORDS) if (titleLc.includes(v) && !qlc.includes(v)) s -= 7
      if (targetDur > 0 && t.duration > 0) {
        const diff = Math.abs(t.duration - targetDur)
        if (diff <= 2) s += 12
        else if (diff <= 5) s += 6
        else if (diff > 30) s -= 10
      }
      s += Math.log10((t.rank || 0) + 1) // Deezer popularity
      s += Math.max(0, 3 - idx * 0.3)    // respect Deezer's own relevance order
      if (s > bestScore) { bestScore = s; best = t }
    })
    return Number.isInteger(best?.id) ? best.id : (Number(best?.id) || null)
  } catch {
    return null
  }
}

// Download a Deezer track id to MP3 via streamrip (-q 0 = 128kbps, the cap for
// a free Deezer account). Returns the bytes; cleans up the temp dir.
export async function downloadDeezerMp3(trackId: number): Promise<Buffer | null> {
  if (!Number.isInteger(trackId) || trackId <= 0) return null
  let dir: string | null = null
  try {
    dir = await mkdtemp(join(tmpdir(), 'dz-'))
    const url = `https://www.deezer.com/track/${trackId}`
    await new Promise<void>((resolve) => {
      const proc = spawn(RIP, ['--config-path', RIP_CONFIG, '-q', '0', '-f', dir!, '--no-progress', '--no-db', 'url', url], { stdio: 'ignore' })
      const timer = setTimeout(() => { try { proc.kill('SIGKILL') } catch {} ; resolve() }, 90_000)
      proc.on('error', () => { clearTimeout(timer); resolve() })
      proc.on('close', () => { clearTimeout(timer); resolve() })
    })

    const entries = await readdir(dir, { recursive: true }).catch(() => [] as string[])
    const rel = entries.find((f) => typeof f === 'string' && f.toLowerCase().endsWith('.mp3'))
    if (!rel) return null
    const buf = await readFile(join(dir, rel)).catch(() => null)
    if (!buf || buf.length === 0 || buf.length > MAX_BYTES) return null
    return buf
  } catch {
    return null
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
