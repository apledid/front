import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'

/**
 * Branded link-embed cover (Discord / Twitter OG image) for the marketing
 * pages. Profiles render their own OG image via app/[username]
 * generateMetadata, so this only shows for routes that inherit the root
 * metadata (home, pricing, leaderboard).
 *
 * guns.lol-style banner: a smooth pink/plum gradient (lighter toward the
 * upper-centre), a faint + sparse + scattered skull pattern, and the big
 * "halo.rip" wordmark centred.
 *
 * The pattern is a single super-tile (4 skulls at varied rotations baked into a
 * large transparent square via sharp) referenced once and tiled with CSS
 * background-repeat. Placing hundreds of <img> tiles makes Satori bail and only
 * render a centre cluster; one reference + background-repeat tiles reliably.
 *
 * Bump the ?v= query in app/layout.tsx whenever this design changes so the
 * CDN / Discord don't serve a stale cached copy.
 */
const TILE = 520

async function loadInter(weight: number): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-${weight}-normal.woff`,
    )
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

/** Build the sparse, scattered skull super-tile as a base64 PNG. */
async function buildPatternTile(): Promise<string | null> {
  try {
    const logoBuf = await readFile(join(process.cwd(), 'public', 'logo.png'))
    // Muted skull so it reads as a tonal texture (like guns.lol's guns) rather
    // than full pink; the low layer opacity does the rest.
    const base = await sharp(logoBuf)
      .resize(132, 132, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .modulate({ saturation: 0.6 })
      .png()
      .toBuffer()
    const rot = (deg: number) =>
      sharp(base).rotate(deg, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    const [a, b, c, d] = await Promise.all([rot(-12), rot(17), rot(-26), rot(12)])
    const tile = await sharp({
      create: { width: TILE, height: TILE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        { input: a, top: 50, left: 46 },
        { input: b, top: 38, left: 300 },
        { input: c, top: 300, left: 64 },
        { input: d, top: 312, left: 308 },
      ])
      .png()
      .toBuffer()
    return `data:image/png;base64,${tile.toString('base64')}`
  } catch {
    return null
  }
}

// The font + skull tile are deterministic for a deployment (logo.png + fixed
// constants + a fixed font URL), so build them once per process instead of on
// every cold request. The immutable Cache-Control already protects the CDN; this
// removes the sharp + jsdelivr cost on cache misses / cold nodes / version bumps.
const fontPromise = loadInter(800)
const tilePromise = buildPatternTile()

export async function GET() {
  const [extrabold, patternSrc] = await Promise.all([fontPromise, tilePromise])
  const fonts: { name: string; data: ArrayBuffer; weight: 800; style: 'normal' }[] = []
  if (extrabold) fonts.push({ name: 'Inter', data: extrabold, weight: 800, style: 'normal' })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          // Single smooth radial gradient: lighter plum toward the upper-centre,
          // darkening to the corners + bottom (guns.lol's gradient shape). One
          // gradient on the root = no seams, unlike a separate glow box.
          backgroundColor: '#160d12',
          backgroundImage: 'radial-gradient(circle at 50% 24%, #3a2331 0%, #25161f 38%, #170e14 70%, #110a0f 100%)',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Faint, sparse, scattered skull pattern - tiled once via background-repeat. */}
        {patternSrc ? (
          <div
            style={{
              position: 'absolute',
              left: -360,
              top: -360,
              width: 1920,
              height: 1360,
              opacity: 0.16,
              transform: 'rotate(-7deg)',
              backgroundImage: `url(${patternSrc})`,
              backgroundRepeat: 'repeat',
              backgroundSize: `${TILE}px ${TILE}px`,
            }}
          />
        ) : null}

        {/* Centered wordmark, guns.lol-style (no mark, no tagline). */}
        <div style={{ position: 'relative', display: 'flex', fontSize: 196, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1 }}>
          <span style={{ color: '#ffffff' }}>halo</span>
          <span style={{ color: '#e87fa0' }}>.rip</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      ...(fonts.length ? { fonts } : {}),
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable' },
    },
  )
}
