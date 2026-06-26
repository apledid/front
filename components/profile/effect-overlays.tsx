"use client"

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ParticleBackground } from '@/components/profile/particle-background'
import { hexToRgba } from '@/lib/profile-style'

const SPARKLE_ASSETS: Record<string, string> = {
  'white-sparkles': '/effects/sparkle_white.gif',
  'red-sparkles': '/effects/sparkle_red.webp',
  'yellow-sparkles': '/effects/sparkle_yellow.gif',
  'pink-sparkles': '/effects/sparkle_pink.webp',
  'green-sparkles': '/effects/sparkle_green.webp',
  'blue-sparkles': '/effects/sparkle_blue.webp',
}

export function CustomFontFace({ url, slots }: { url?: string | null; slots?: Array<string | null | undefined> }) {
  // Build @font-face declarations for the legacy single font (backwards
  // compat) plus up to 4 named slots used by the multi-font feature. Each
  // slot becomes a unique font-family so different elements can render in
  // different fonts simultaneously.
  // A font URL flows verbatim into url("...") inside the <style> below, which
  // React renders WITHOUT escaping. Only emit URLs that contain no CSS/HTML
  // breakout characters, so a malicious value can't close the string / the
  // <style> tag and inject markup. isAllowedMediaUrl rejects these on save too;
  // this is the defense-in-depth at the sink.
  const safeFontUrl = (u: string | null | undefined): u is string =>
    typeof u === 'string' && u.length > 0 && !/[\s"'()<>;\\`]/.test(u)

  const declarations: string[] = []
  if (safeFontUrl(url)) {
    declarations.push(`@font-face { font-family: "ProfileCustomFont"; src: url("${url}"); font-display: swap; }`)
  }
  if (slots) {
    slots.forEach((slotUrl, idx) => {
      if (!safeFontUrl(slotUrl)) return
      const family = `ProfileCustomFont${idx + 1}`
      declarations.push(`@font-face { font-family: "${family}"; src: url("${slotUrl}"); font-display: swap; }`)
    })
  }
  if (declarations.length === 0) return null
  return <style>{declarations.join('\n')}</style>
}

/**
 * Floating shapes - sakura petals, confetti, hearts
 */
function FloatingShapes({ effect, mult, accentColor, embedded }: { effect: string; mult: number; accentColor: string; embedded: boolean }) {
  const positionClass = embedded ? 'absolute inset-0' : 'fixed inset-0'
  const count = Math.round(Math.max(8, 35 * mult))
  const items = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * -20,
    duration: 8 + Math.random() * 12,
    size: 12 + Math.random() * 16,
    drift: -20 + Math.random() * 40,
    rotate: Math.random() * 360,
    spinDir: Math.random() > 0.5 ? 1 : -1,
    confColor: ['#ff5757', '#ff9f43', '#feca57', '#1dd1a1', '#54a0ff', '#5f27cd', '#ff00ff'][Math.floor(Math.random() * 7)],
  })), [count])

  const renderShape = (item: typeof items[number]) => {
    if (effect === 'sakura') {
      return (
        <svg viewBox="0 0 24 24" width={item.size} height={item.size} style={{ filter: `drop-shadow(0 0 4px ${hexToRgba('#ec4899', 0.45)})` }}>
          <path fill="#fbcfe8" d="M12 2c1.5 2.5 4 3 4 6 0 1.4-.7 2.6-1.7 3.4 1.5.4 2.7 1.7 2.7 3.3 0 1.6-1 2.9-2.4 3.3 0 2-2 3.5-2.6 4-.6-.5-2.6-2-2.6-4-1.4-.4-2.4-1.7-2.4-3.3 0-1.6 1.2-2.9 2.7-3.3-1-.8-1.7-2-1.7-3.4 0-3 2.5-3.5 4-6z"/>
          <circle cx="12" cy="12" r="2" fill="#f472b6" />
        </svg>
      )
    }
    if (effect === 'hearts') {
      return (
        <svg viewBox="0 0 24 24" width={item.size} height={item.size} style={{ filter: `drop-shadow(0 0 6px ${hexToRgba(accentColor, 0.55)})` }}>
          <path fill={accentColor} d="M12 21l-1.45-1.32C5.4 14.94 2 11.9 2 8.18 2 5.42 4.42 3 7.18 3c1.66 0 3.27.79 4.32 2.04C12.55 3.79 14.16 3 15.82 3 18.58 3 21 5.42 21 8.18c0 3.72-3.4 6.76-8.55 11.5L12 21z"/>
        </svg>
      )
    }
    // confetti - colorful rectangles
    return (
      <span style={{ display: 'block', width: item.size * 0.5, height: item.size * 1.2, background: item.confColor, borderRadius: '2px', boxShadow: `0 0 6px ${item.confColor}aa` }} />
    )
  }

  return (
    <div className={`${positionClass} pointer-events-none overflow-hidden`}>
      {items.map((item) => (
        <span
          key={item.id}
          style={{
            position: 'absolute',
            top: '-10%',
            left: `${item.left}%`,
            animation: `falling-${effect} ${item.duration}s linear ${item.delay}s infinite`,
            ['--drift' as any]: `${item.drift}px`,
            ['--rotate' as any]: `${item.rotate}deg`,
            ['--spin' as any]: `${item.spinDir * 720}deg`,
          }}
        >
          {renderShape(item)}
        </span>
      ))}
      <style>{`
        @keyframes falling-sakura { 0% { transform: translate(0, 0) rotate(var(--rotate)); opacity: 0; } 5% { opacity: 1; } 100% { transform: translate(var(--drift), 110vh) rotate(calc(var(--rotate) + var(--spin))); opacity: 0.85; } }
        @keyframes falling-confetti { 0% { transform: translate(0, 0) rotate(var(--rotate)); opacity: 0; } 5% { opacity: 1; } 100% { transform: translate(var(--drift), 110vh) rotate(calc(var(--rotate) + var(--spin))); opacity: 0.9; } }
        @keyframes falling-hearts { 0% { transform: translate(0, 0) scale(0.9); opacity: 0; } 10% { opacity: 1; } 50% { transform: translate(calc(var(--drift) * 0.5), 50vh) scale(1.05); } 100% { transform: translate(var(--drift), -10vh) scale(0.85); opacity: 0; } }
      `}</style>
    </div>
  )
}

export function BackgroundEffectsOverlay({
  effect,
  accentColor,
  glowColor,
  effectColor,
  embedded = false,
  strength = 50,
}: {
  effect?: string | null
  accentColor: string
  glowColor?: string | null
  /** Advanced Text Colors → Background Effects override. When set,
   *  replaces `accentColor` as the primary tint for the rendered
   *  effect (snowflakes, fireflies, aurora gradients, plasma, etc.).
   *  Null/empty = inherit from accent_color (legacy behaviour). */
  effectColor?: string | null
  embedded?: boolean
  strength?: number
}) {
  const positionClass = embedded ? 'absolute inset-0' : 'fixed inset-0'
  // Primary effect tint: respect the per-profile override if set, else
  // fall back to accent_color (the historical default).
  const effective = effectColor || accentColor
  // Secondary tint: explicit glow_color wins, otherwise track the
  // primary so both gradient stops shift together when only effectColor
  // is set.
  const secondary = glowColor || effective
  // strength: 0–100, where 50 = normal. Convert to multiplier (0 = invisible, 100 = 2x)
  const mult = Math.max(0, (strength ?? 50)) / 50

  if (!effect || effect === 'none') return null

  if (effect === 'snowflakes' || effect === 'snow') return <ParticleBackground type="snow" count={Math.round(Math.max(10, 90 * mult))} color={effective} embedded={embedded} />
  if (effect === 'rain') return <ParticleBackground type="rain" count={Math.round(Math.max(10, 110 * mult))} color={effectColor || '#cbd5e1'} embedded={embedded} />
  if (effect === 'matrix') return <ParticleBackground type="matrix" count={Math.round(Math.max(10, 80 * mult))} color={effectColor || secondary || '#22c55e'} embedded={embedded} />
  if (effect === 'fireflies') return <ParticleBackground type="fireflies" count={Math.round(Math.max(5, 50 * mult))} color={effective} embedded={embedded} />
  if (effect === 'stars') return <ParticleBackground type="stars" count={Math.round(Math.max(20, 110 * mult))} color={effectColor || '#ffffff'} embedded={embedded} />
  if (effect === 'bubbles') return <ParticleBackground type="bubbles" count={Math.round(Math.max(8, 50 * mult))} color={effective} embedded={embedded} />

  if (effect === 'sakura' || effect === 'confetti' || effect === 'hearts') {
    return <FloatingShapes effect={effect} mult={mult} accentColor={effective} embedded={embedded} />
  }

  if (effect === 'aurora') {
    return (
      <div className={`${positionClass} pointer-events-none overflow-hidden`}>
        <div
          className="absolute inset-[-25%] animate-gradient blur-3xl"
          style={{
            opacity: Math.min(1, 0.6 * mult),
            backgroundImage: `radial-gradient(circle at 20% 20%, ${hexToRgba(effective, 0.38)}, transparent 35%), radial-gradient(circle at 80% 15%, ${hexToRgba(secondary, 0.32)}, transparent 32%), radial-gradient(circle at 50% 80%, ${hexToRgba('#34d399', 0.2)}, transparent 28%)`,
          }}
        />
      </div>
    )
  }

  if (effect === 'blurred') {
    return (
      <div className={`${positionClass} pointer-events-none overflow-hidden`}>
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full blur-3xl animate-float" style={{ backgroundColor: hexToRgba(effective, Math.min(0.6, 0.2 * mult)) }} />
        <div className="absolute -right-10 bottom-10 h-80 w-80 rounded-full blur-3xl animate-float" style={{ backgroundColor: hexToRgba(secondary, Math.min(0.6, 0.18 * mult)), animationDelay: '1s' } as CSSProperties} />
      </div>
    )
  }

  if (effect === 'old-tv') {
    return (
      <div className={`${positionClass} pointer-events-none overflow-hidden`} style={{ opacity: Math.min(1, 0.45 * mult) }}>
        <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 2px, transparent 4px)' }} />
        <div className="absolute inset-0 animate-pulse" style={{ background: 'radial-gradient(circle at 50% 50%, transparent 45%, rgba(0,0,0,0.35) 100%)' }} />
      </div>
    )
  }

  if (effect === 'dither') {
    return (
      <div
        className={`${positionClass} pointer-events-none`}
        style={{
          opacity: Math.min(1, 0.25 * mult),
          backgroundImage: `radial-gradient(${hexToRgba(effectColor || '#ffffff', 0.28)} 0.6px, transparent 0.6px)`,
          backgroundSize: '8px 8px',
        }}
      />
    )
  }

  if (effect === 'plasma') {
    return (
      <div className={`${positionClass} pointer-events-none overflow-hidden`}>
        <div
          className="absolute inset-[-20%] animate-spin-slow blur-3xl"
          style={{
            opacity: Math.min(1, 0.4 * mult),
            background: `conic-gradient(from 180deg at 50% 50%, ${hexToRgba(effective, 0.3)}, ${hexToRgba(secondary, 0.22)}, transparent, ${hexToRgba('#60a5fa', 0.18)}, ${hexToRgba(effective, 0.3)})`,
          }}
        />
      </div>
    )
  }

  return null
}

function useTypewriterText(text: string, enabled: boolean) {
  const [display, setDisplay] = useState(enabled ? '' : text)

  useEffect(() => {
    if (!enabled) {
      setDisplay(text)
      return
    }
    setDisplay('')
    let frame = 0
    const interval = window.setInterval(() => {
      frame += 1
      const next = text.slice(0, frame)
      setDisplay(next)
      if (frame >= text.length) window.clearInterval(interval)
    }, 170)
    return () => window.clearInterval(interval)
  }, [enabled, text])

  return display
}

function useShuffleText(text: string, enabled: boolean) {
  const [display, setDisplay] = useState(text)

  useEffect(() => {
    if (!enabled) {
      setDisplay(text)
      return
    }
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let frame = 0
    const interval = window.setInterval(() => {
      frame += 1
      const reveal = Math.min(text.length, Math.floor(frame / 3.1))
      const next = text
        .split('')
        .map((char, index) => {
          if (char === ' ') return ' '
          if (index < reveal) return text[index]
          return letters[Math.floor(Math.random() * letters.length)]
        })
        .join('')
      setDisplay(next)
      if (reveal >= text.length) {
        window.clearInterval(interval)
        setDisplay(text)
      }
    }, 78)
    return () => window.clearInterval(interval)
  }, [enabled, text])

  return display
}

function useGlitchPhase(enabled: boolean) {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const interval = window.setInterval(() => setPhase((value) => (value + 1) % 28), 88)
    return () => window.clearInterval(interval)
  }, [enabled])
  return phase
}

export function UsernameDisplay({
  text,
  effect,
  accentColor,
  className = '',
  style,
  glowUsername = false,
}: {
  text: string
  effect?: string | null
  accentColor: string
  className?: string
  style?: CSSProperties
  /** When the rainbow effect is active AND Glow Username is on, the
   *  drop-shadow cycles through the same rainbow stops as the text
   *  gradient instead of staying a static `accentColor` halo. */
  glowUsername?: boolean
}) {
  const baseClass = `relative inline-flex items-center ${className}`.trim()
  const sparkleAsset = effect ? SPARKLE_ASSETS[effect] : undefined
  const typewriterText = useTypewriterText(text, effect === 'typewriter')
  const shuffleText = useShuffleText(text, effect === 'shuffle')
  const glitchPhase = useGlitchPhase(effect === 'glitch')

  const baseStyle: CSSProperties = { ...style }

  if (!effect || effect === 'none') return <span className={baseClass} style={baseStyle}>{text}</span>

  if (effect === 'wave') {
    return (
      <span className={baseClass} style={baseStyle}>
        {text.split('').map((character, index) => (
          <span
            key={`${character}-${index}`}
            className="inline-block animate-wave-text"
            style={{ animationDelay: `${index * 0.08}s`, animationDuration: '2.1s' }}
          >
            {character === ' ' ? ' ' : character}
          </span>
        ))}
      </span>
    )
  }

  if (effect === 'rainbow') {
    return (
      <span
        className={`${baseClass} bg-[length:500%_100%] bg-clip-text text-transparent`}
        style={{
          ...baseStyle,
          backgroundImage: 'linear-gradient(90deg, #ff1744 0%, #ff6d00 12%, #ffd600 24%, #76ff03 36%, #00e5ff 50%, #2979ff 64%, #7c4dff 78%, #ff00ff 90%, #ff4081 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          // When glow_username is on the `rainbow-glow` keyframes
          // animation drives `filter` (cycling drop-shadow colour
          // through the rainbow stops in phase with the gradient).
          // Setting `filter` inline would override the animation, so
          // skip it in that case.
          filter: glowUsername ? undefined : `drop-shadow(0 0 12px ${hexToRgba(accentColor, 0.34)}) saturate(2.25) brightness(1.24)`,
          animation: glowUsername
            ? 'gradient 2.4s linear infinite, rainbow-glow 2.4s linear infinite'
            : 'gradient 2.4s linear infinite',
        }}
      >
        {text}
      </span>
    )
  }

  if (effect === 'typewriter') {
    // `overflow-hidden` used to live here as a leftover from a
    // width-animated typewriter implementation. It served no purpose
    // (the typed substring grows naturally via `useTypewriterText`)
    // but clipped the `text-shadow` glow inherited from `baseStyle`,
    // so Glow Username + Typewriter rendered with the glow snipped
    // to the element box - i.e. invisible. `whitespace-nowrap`
    // alone keeps the text on a single line; the glow now paints
    // past the box freely.
    return (
      <span className={`${baseClass} whitespace-nowrap`} style={baseStyle}>
        <span>{typewriterText}</span>
        <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-current align-middle" />
      </span>
    )
  }

  if (effect === 'shuffle') {
    return (
      <span className={baseClass} style={{ ...baseStyle, letterSpacing: '0.03em', textShadow: `0 0 10px ${hexToRgba(accentColor, 0.22)}` }}>
        {shuffleText}
      </span>
    )
  }

  if (effect === 'glitch') {
    const topOffset = glitchPhase % 2 === 0 ? -6 : 4
    const middleOffset = glitchPhase % 3 === 0 ? 5 : -3
    const bottomOffset = glitchPhase % 4 < 2 ? 4 : -5
    const jitterY = glitchPhase % 5 === 0 ? -2 : glitchPhase % 7 === 0 ? 3 : 0
    return (
      <span className={baseClass} style={{ ...baseStyle, display: 'inline-grid', filter: `drop-shadow(0 0 12px ${hexToRgba(accentColor, 0.18)})` }}>
        <span className="relative z-20 [grid-area:1/1]" style={{ transform: `translate(${glitchPhase % 2 === 0 ? 2 : -2}px, ${jitterY}px)` }}>{text}</span>
        <span
          aria-hidden
          className="pointer-events-none relative z-10 opacity-95 [grid-area:1/1]"
          style={{
            color: '#ff8c52',
            clipPath: 'polygon(0 0, 100% 0, 100% 22%, 0 30%)',
            transform: `translate(${topOffset}px, -3px) skewX(-10deg)`,
            mixBlendMode: 'screen',
          }}
        >
          {text}
        </span>
        <span
          aria-hidden
          className="pointer-events-none relative z-10 opacity-90 [grid-area:1/1]"
          style={{
            color: '#ffc48c',
            clipPath: 'polygon(0 28%, 100% 20%, 100% 68%, 0 76%)',
            transform: `translate(${middleOffset}px, ${jitterY}px) skewX(11deg)`,
            mixBlendMode: 'screen',
          }}
        >
          {text}
        </span>
        <span
          aria-hidden
          className="pointer-events-none relative z-10 opacity-85 [grid-area:1/1]"
          style={{
            color: '#fff0d6',
            clipPath: 'polygon(0 72%, 100% 60%, 100% 100%, 0 100%)',
            transform: `translate(${bottomOffset}px, 3px) skewX(-8deg)`,
            mixBlendMode: 'screen',
          }}
        >
          {text}
        </span>
      </span>
    )
  }

  if (sparkleAsset) {
    return (
      <span className={`${baseClass}`} style={{ ...baseStyle, position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <img
          src={sparkleAsset}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 scale-[1.08]"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            filter: `drop-shadow(0 0 8px ${hexToRgba(accentColor, 0.58)}) brightness(1.15)`,
            mixBlendMode: 'screen',
            opacity: 0.95,
            animation: 'sparkle-pulse 2s ease-in-out infinite',
          }}
        />
        <span className="relative z-10">{text}</span>
      </span>
    )
  }

  return <span className={baseClass} style={baseStyle}>{text}</span>
}
