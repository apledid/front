/**
 * Bento layout - tile descriptors + default arrangements.
 *
 * When a user switches their layout_mode to 'bento' and they have no
 * saved tile configuration yet, we render one of the preset arrangements
 * below so the profile looks intentional out of the box. Each preset is
 * tuned for a different user shape (creator, gamer, minimalist, etc.).
 *
 * The desktop grid is 4 columns wide; tile columns/rows are 1-based.
 * Container queries in the layout component collapse to 2 columns on
 * tablets and 1 on phones, so users don't have to design their tiles
 * for mobile separately.
 */

export type BentoTileType =
  | 'identity'    // avatar + name + handle + badges
  | 'bio'         // bio text (static or typing)
  | 'socials'     // social link icons
  | 'buttons'     // custom buttons stacked
  | 'music'       // mini music player
  | 'lanyard'     // Discord presence (uses widgets-panel lanyard)
  | 'spotify'     // Spotify embed (uses widgets-panel spotify)
  | 'widget'      // generic widgets-panel widget (last.fm, github, etc.)
  | 'image'       // uploaded image fill
  | 'text'        // markdown text block

export interface BentoTile {
  /** Stable id (nanoid) - survives drag/reorder so React keys don't churn. */
  id: string
  type: BentoTileType
  /** 1-based column start. Valid range 1..4. */
  col: number
  /** 1-based row start. Valid range 1..N. */
  row: number
  /** Column span. 1..4. */
  w: number
  /** Row span. 1..N. */
  h: number
  // Type-specific payload (all optional):
  text?: string         // for 'text'
  imageUrl?: string     // for 'image'
  widgetType?: string   // for 'widget' (e.g. 'lastfm', 'github')
  widgetId?: string     // for 'widget' - references widgets table row
}

/**
 * Cheap nanoid-ish id for default tile creation. We don't depend on the
 * nanoid package here - clientside drag/drop will use the real package.
 */
function tileId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Curated default tile arrangements. The first one is the global
 * fallback when bento_tiles is empty and the user hasn't picked a
 * preset. Each is sized to roughly fill ~5 rows on desktop.
 */
export const BENTO_PRESETS: { id: string; label: string; description: string; tiles: BentoTile[] }[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Identity, socials, music, bio, buttons - for most profiles.',
    tiles: [
      // Rows are minmax(120px, auto) - keep total row count to 4 so a
      // user with one or two custom buttons doesn't see a dead band at
      // the bottom of the tile. The buttons tile centers its content
      // vertically inside h:1; overflow scrolls if the user has more.
      { id: tileId('identity'), type: 'identity', col: 1, row: 1, w: 2, h: 2 },
      { id: tileId('socials'),  type: 'socials',  col: 3, row: 1, w: 2, h: 1 },
      { id: tileId('music'),    type: 'music',    col: 3, row: 2, w: 2, h: 1 },
      { id: tileId('bio'),      type: 'bio',      col: 1, row: 3, w: 4, h: 1 },
      { id: tileId('buttons'),  type: 'buttons',  col: 1, row: 4, w: 4, h: 1 },
    ],
  },
  {
    id: 'creator',
    label: 'Creator',
    description: 'Big identity, prominent buttons, Lanyard + Spotify side by side.',
    tiles: [
      { id: tileId('identity'), type: 'identity', col: 1, row: 1, w: 4, h: 2 },
      { id: tileId('lanyard'),  type: 'lanyard',  col: 1, row: 3, w: 2, h: 1 },
      { id: tileId('spotify'),  type: 'spotify',  col: 3, row: 3, w: 2, h: 1 },
      { id: tileId('buttons'),  type: 'buttons',  col: 1, row: 4, w: 4, h: 2 },
    ],
  },
  {
    id: 'gamer',
    label: 'Gamer',
    description: 'Lanyard front-and-center, music below, socials in a strip.',
    tiles: [
      { id: tileId('identity'), type: 'identity', col: 1, row: 1, w: 2, h: 2 },
      { id: tileId('lanyard'),  type: 'lanyard',  col: 3, row: 1, w: 2, h: 2 },
      { id: tileId('socials'),  type: 'socials',  col: 1, row: 3, w: 4, h: 1 },
      { id: tileId('music'),    type: 'music',    col: 1, row: 4, w: 2, h: 1 },
      { id: tileId('bio'),      type: 'bio',      col: 3, row: 4, w: 2, h: 1 },
      { id: tileId('buttons'),  type: 'buttons',  col: 1, row: 5, w: 4, h: 2 },
    ],
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Identity + bio + socials only. No music, no buttons.',
    tiles: [
      { id: tileId('identity'), type: 'identity', col: 1, row: 1, w: 4, h: 2 },
      { id: tileId('bio'),      type: 'bio',      col: 1, row: 3, w: 4, h: 1 },
      { id: tileId('socials'),  type: 'socials',  col: 1, row: 4, w: 4, h: 1 },
    ],
  },
]

/** The arrangement used when no user data and no explicit preset. */
export const DEFAULT_BENTO_TILES: BentoTile[] = BENTO_PRESETS[0].tiles

/** Validate + normalise an incoming `bento_tiles` payload from a client.
 *  Drops malformed entries silently, clamps numeric fields. */
export function validateBentoTiles(input: unknown): BentoTile[] {
  if (!Array.isArray(input)) return []
  const ALLOWED_TYPES: BentoTileType[] = [
    'identity', 'bio', 'socials', 'buttons', 'music',
    'lanyard', 'spotify', 'widget', 'image', 'text',
  ]
  const out: BentoTile[] = []
  for (const raw of input.slice(0, 32)) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as any
    if (typeof r.id !== 'string' || !r.id) continue
    if (!ALLOWED_TYPES.includes(r.type)) continue
    const col = Number(r.col); const row = Number(r.row)
    const w = Number(r.w); const h = Number(r.h)
    if (!Number.isFinite(col) || !Number.isFinite(row) || !Number.isFinite(w) || !Number.isFinite(h)) continue
    out.push({
      id: String(r.id).slice(0, 64),
      type: r.type,
      col: Math.max(1, Math.min(4, Math.round(col))),
      row: Math.max(1, Math.min(64, Math.round(row))),
      w:   Math.max(1, Math.min(4, Math.round(w))),
      h:   Math.max(1, Math.min(8, Math.round(h))),
      text:       typeof r.text === 'string' ? r.text.slice(0, 500) : undefined,
      imageUrl:   typeof r.imageUrl === 'string' ? r.imageUrl.slice(0, 500) : undefined,
      widgetType: typeof r.widgetType === 'string' ? r.widgetType.slice(0, 32) : undefined,
      widgetId:   typeof r.widgetId === 'string' ? r.widgetId.slice(0, 64) : undefined,
    })
  }
  return out
}
