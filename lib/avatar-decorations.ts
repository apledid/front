// Avatar decorations catalog - Discord's official store decorations,
// mirrored at github.com/Kadantte/discord-fake-avatar-decorations and
// served via jsdelivr's free CDN.
//
// Each entry is keyed by a slug (e.g. "trick_pumpkin"). The asset is an
// animated APNG that browsers play natively in `<img>` tags - no canvas
// or Lottie runtime needed.
//
// To refresh after upstream adds new decorations:
//   tsx scripts/sync-decor-catalog.ts
// which rewrites `lib/avatar-decorations.generated.ts`.

import { GENERATED_DECORATIONS } from './avatar-decorations.generated'
import { LOCAL_DECORATIONS } from './avatar-decorations.local'

export interface AvatarDecoration {
  /** Slug filename (no extension), e.g. "cat_1". */
  slug: string
  /** Human-friendly label shown in the picker. */
  name: string
}

export { DECOR_CDN, decorationUrl } from './avatar-decoration-url'

// LOCAL entries are merged in alphabetically with the upstream generated
// list. De-dupe by slug in case the upstream eventually picks them up.
const _byName = (a: AvatarDecoration, b: AvatarDecoration) => a.name.localeCompare(b.name)
const _seen = new Set<string>()
export const AVATAR_DECORATIONS: AvatarDecoration[] = [
  ...LOCAL_DECORATIONS,
  ...GENERATED_DECORATIONS,
]
  .filter((d) => (_seen.has(d.slug) ? false : (_seen.add(d.slug), true)))
  .sort(_byName)
