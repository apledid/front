import { decorationUrl } from '@/lib/avatar-decoration-url'

// 12 hand-picked decoration slugs that exist in the upstream Kadantte mirror
// (verified against lib/avatar-decorations.generated.ts). Mix of seasonal,
// gaming, and aesthetic so the grid feels varied.
const SAMPLE_SLUGS = [
  'cat_ears',
  'crystal_elk',
  'bloodthirsty_gold',
  'autumn_crown',
  'akuma',
  'fire',
  'all_might',
  'angel',
  'confetti_fire',
  'donut_cat',
  'champions_tactibear',
  'victory_crown',
]

/**
 * 4×3 grid of animated decoration thumbnails. Each tile renders the
 * actual APNG asset served from the jsdelivr CDN - same source the
 * dashboard picker and live profiles use, so visitors see exactly what
 * they'd get on their own profile.
 */
export function DecorationStrip() {
  return (
    <div className="hp-decoration-strip">
      {SAMPLE_SLUGS.map((slug) => (
        <div key={slug} className="hp-decoration-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={decorationUrl(slug)}
            alt=""
            loading="lazy"
            className="hp-decoration-img"
          />
        </div>
      ))}
      <div className="hp-decoration-more">+600 more</div>
    </div>
  )
}
