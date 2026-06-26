import type { ReactNode } from 'react'

interface FeatureRowProps {
  eyebrow: string
  title: string
  body: ReactNode
  /** Anything renderable: a collage div, a video, an image grid, etc. */
  visual: ReactNode
  /** Which side the visual sits on at desktop. Defaults to "right". */
  side?: 'left' | 'right'
}

/**
 * Alternating text+visual rows used inside the feature-spotlight section.
 * Stacks the visual above the text on mobile regardless of `side`.
 */
export function FeatureRow({ eyebrow, title, body, visual, side = 'right' }: FeatureRowProps) {
  return (
    <div className={`hp-feature-row ${side === 'left' ? 'hp-feature-row-flip' : ''}`}>
      <div className="hp-feature-text">
        <span className="hp-feature-eyebrow">{eyebrow}</span>
        <h3 className="hp-feature-title">{title}</h3>
        <div className="hp-feature-body">{body}</div>
      </div>
      <div className="hp-feature-visual">{visual}</div>
    </div>
  )
}
