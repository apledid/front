// Manually-curated avatar decoration entries that we self-host out of
// `public/decorations/`. These are merged onto the upstream-generated
// catalog (lib/avatar-decorations.generated.ts) so they survive the next
// `tsx scripts/sync-decor-catalog.ts` run.
//
// To add a new self-hosted decoration:
//   1. Drop the PNG into `public/decorations/<slug>.png`
//   2. Add the slug to SELF_HOSTED_SLUGS in lib/avatar-decoration-url.ts
//   3. Add an { slug, name } entry below

import type { AvatarDecoration } from './avatar-decorations'

export const LOCAL_DECORATIONS: AvatarDecoration[] = [
  // Sanrio collab (Discord store, May 2026) - upstream mirror hadn't
  // picked these up yet so we host the assets ourselves.
  { slug: 'hello_kitty',   name: 'Hello Kitty' },
  { slug: 'cinnamoroll',   name: 'Cinnamoroll' },
  { slug: 'pompompurin',   name: 'Pompompurin' },
  { slug: 'kuromi',        name: 'Kuromi' },
  { slug: 'my_melody',     name: 'My Melody' },
  { slug: 'pochacco',      name: 'Pochacco' },
  // COSMOS collection (Discord store, May 2026). Pulled from
  // cdn.discordapp.com/media/v1/collectibles-shop/<sku>/animated -
  // these aren't on the Kadantte upstream mirror yet because the
  // mirror only indexes the older avatar-decoration-presets path.
  { slug: 'cosmic_rainbow', name: 'Cosmic Rainbow' },
]
