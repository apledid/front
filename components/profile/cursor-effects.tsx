"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { hexToRgba, cssUrl } from '@/lib/profile-style'
import { startOneko } from '@/lib/cursor-buddy/oneko'
import dynamic from 'next/dynamic'

const SplashCursor = dynamic(() => import('@/components/effects/splash-cursor'), { ssr: false })

const GHOST_CURSOR_SVG = 'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2234%22 viewBox=%220 0 24 34%22%3E%3Cpath d=%22M2 1 L2 27 L9.4 20.9 L12.8 31.2 L16.7 29.7 L13.1 19.9 L22 19.9 Z%22 fill=%22white%22 stroke=%22%230d0d0d%22 stroke-width=%221.1%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E'

type GhostNode = { x: number; y: number }

/**
 * Bubble cursor - small filled-and-stroked bubbles drift upward from the
 * cursor as it moves. Direct port of the canonical canvas-cursor-effects
 * implementation, wrapped into a React component so it tears down on
 * unmount and uses the profile's chosen cursorColor for both stroke and
 * (translucent) fill.
 */
function BubbleCursor({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = window.innerWidth
    let height = window.innerHeight
    let raf = 0
    const cursor = { x: width / 2, y: height / 2 }
    const particles: Particle[] = []

    // Honour reduced-motion preferences - same gate the original library
    // uses. We never spawn bubbles when the user opted out of animation.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    // Translucent variant of the chosen color for the fill - keeps the
    // bubble readable without overpowering the background.
    const fillColor = hexToRgba(color, 0.18)
    const strokeColor = color

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height
    }

    class Particle {
      lifeSpan: number
      initialLifeSpan: number
      velocity: { x: number; y: number }
      position: { x: number; y: number }
      baseDimension = 4
      constructor(x: number, y: number) {
        this.lifeSpan = Math.floor(Math.random() * 60 + 60)
        this.initialLifeSpan = this.lifeSpan
        this.velocity = {
          x: (Math.random() < 0.5 ? -1 : 1) * (Math.random() / 10),
          y: -0.4 + Math.random() * -1,
        }
        this.position = { x, y }
      }
      update(c: CanvasRenderingContext2D) {
        this.position.x += this.velocity.x
        this.position.y += this.velocity.y
        this.velocity.x += ((Math.random() < 0.5 ? -1 : 1) * 2) / 75
        this.velocity.y -= Math.random() / 600
        this.lifeSpan--
        const scale = 0.2 + (this.initialLifeSpan - this.lifeSpan) / this.initialLifeSpan
        c.fillStyle = fillColor
        c.strokeStyle = strokeColor
        c.beginPath()
        c.arc(
          this.position.x - (this.baseDimension / 2) * scale,
          this.position.y - this.baseDimension / 2,
          this.baseDimension * scale,
          0,
          Math.PI * 2,
        )
        c.stroke()
        c.fill()
        c.closePath()
      }
    }

    const onMove = (e: MouseEvent) => {
      if (reduceMotion.matches) return
      cursor.x = e.clientX
      cursor.y = e.clientY
      particles.push(new Particle(cursor.x, cursor.y))
    }

    const loop = () => {
      if (particles.length > 0) {
        ctx.clearRect(0, 0, width, height)
        for (const p of particles) p.update(ctx)
        for (let i = particles.length - 1; i >= 0; i--) {
          if (particles[i].lifeSpan < 0) particles.splice(i, 1)
        }
      }
      raf = window.requestAnimationFrame(loop)
    }

    resize()
    loop()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('resize', resize)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', resize)
    }
  }, [color])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 9999, width: '100%', height: '100%' }}
    />
  )
}

/**
 * Neon cursor - a glowing, smoothed curve that traces the cursor's recent
 * path. We could load threejs-toys for the WebGL version but that drags in
 * ~600 KB of Three.js for one effect. This canvas 2D version uses
 * shadowBlur stacking to fake the bloom and gets the same visual vibe at
 * a fraction of the bundle size.
 */
function NeonCursor({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduceMotion.matches) return

    let width = window.innerWidth
    let height = window.innerHeight
    let raf = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)

    // Smoothed trail of recent pointer positions. ~16 points is enough to
    // get a clearly curved shape without sluggish lag.
    const POINTS = 18
    const trail: { x: number; y: number }[] = []
    const pointer = { x: width / 2, y: height / 2 }
    for (let i = 0; i < POINTS; i++) trail.push({ x: pointer.x, y: pointer.y })

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const onMove = (e: MouseEvent) => {
      pointer.x = e.clientX
      pointer.y = e.clientY
    }

    const draw = () => {
      // Drag each point toward the next-newer point in the trail; head
      // chases the cursor. Spring-like easing keeps the curve smooth.
      trail[0].x += (pointer.x - trail[0].x) * 0.35
      trail[0].y += (pointer.y - trail[0].y) * 0.35
      for (let i = 1; i < trail.length; i++) {
        trail[i].x += (trail[i - 1].x - trail[i].x) * 0.45
        trail[i].y += (trail[i - 1].y - trail[i].y) * 0.45
      }

      ctx.clearRect(0, 0, width, height)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // Three passes from broad-soft to narrow-bright. The shadowBlur on
      // the broad pass does most of the glow work; the narrow inner pass
      // gives the line a hot core. shadowBlur is GPU-accelerated in
      // modern browsers so this stays cheap.
      const passes: Array<{ width: number; alpha: number; blur: number }> = [
        { width: 18, alpha: 0.22, blur: 32 },
        { width: 8,  alpha: 0.55, blur: 18 },
        { width: 3,  alpha: 0.95, blur: 8  },
      ]

      for (const pass of passes) {
        ctx.strokeStyle = hexToRgba(color, pass.alpha)
        ctx.lineWidth = pass.width
        ctx.shadowColor = color
        ctx.shadowBlur = pass.blur
        ctx.beginPath()
        ctx.moveTo(trail[0].x, trail[0].y)
        // Quadratic bezier through the midpoints - smoother than lineTo.
        for (let i = 1; i < trail.length - 1; i++) {
          const xc = (trail[i].x + trail[i + 1].x) / 2
          const yc = (trail[i].y + trail[i + 1].y) / 2
          ctx.quadraticCurveTo(trail[i].x, trail[i].y, xc, yc)
        }
        ctx.stroke()
      }
      ctx.shadowBlur = 0

      raf = window.requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('resize', resize)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', resize)
    }
  }, [color])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 9999, width: '100%', height: '100%' }}
    />
  )
}

// Rainbow cursor component
function RainbowCursor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const cursorRef = useRef({ x: 0, y: 0 })
  const particlesRef = useRef<{ x: number; y: number }[]>([])
  const initedRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const colors = ["#FE0000", "#FD8C00", "#FFE500", "#119F0B", "#0644B3", "#C22EDC"]
    const size = 3
    const totalParticles = 20

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()

    const onMove = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY }
      if (!initedRef.current) {
        initedRef.current = true
        for (let i = 0; i < totalParticles; i++) {
          particlesRef.current.push({ x: e.clientX, y: e.clientY })
        }
      }
    }

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      let x = cursorRef.current.x
      let y = cursorRef.current.y
      const sets: { x: number; y: number }[] = []

      particlesRef.current.forEach((p, i) => {
        const next = particlesRef.current[i + 1] || particlesRef.current[0]
        p.x = x
        p.y = y
        sets.push({ x, y })
        x += (next.x - p.x) * 0.4
        y += (next.y - p.y) * 0.4
      })

      colors.forEach((color, idx) => {
        ctx.beginPath()
        ctx.strokeStyle = color
        if (sets.length) ctx.moveTo(sets[0].x, sets[0].y + idx * (size - 1))
        sets.forEach((s, pi) => {
          if (pi !== 0) ctx.lineTo(s.x, s.y + idx * size)
        })
        ctx.lineWidth = size
        ctx.stroke()
      })

      animationRef.current = requestAnimationFrame(loop)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('resize', resize)
    loop()

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        width: '100%',
        height: '100%',
      }}
    />
  )
}
type ClickBurst = {
  id: number
  x: number
  y: number
  life: number
  maxLife: number
  size: number
  driftX: number
  driftY: number
}

function hexToRgbTuple(hex: string) {
  const normalized = (hex || '#ffffff').replace('#', '')
  const value = Number.parseInt(normalized.length === 6 ? normalized : 'ffffff', 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const
}

export function CursorEffectsLayer({
  cursorEffect,
  cursorColor,
  clickEffect,
  clickColor,
  customCursorUrl,
  hoverCursorUrl,
  ghostUseCustomCursor,
}: {
  cursorEffect?: string | null
  cursorColor: string
  clickEffect?: string | null
  clickColor?: string | null
  customCursorUrl?: string | null
  hoverCursorUrl?: string | null
  ghostUseCustomCursor?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const particleRef = useRef<any[]>([])
  const pointerRef = useRef({ x: 0, y: 0, px: 0, py: 0, visible: false })
  const burstIdRef = useRef(0)

  const [position, setPosition] = useState({ x: 0, y: 0, visible: false })
  const [interactiveHover, setInteractiveHover] = useState(false)
  const [ghostNodes, setGhostNodes] = useState<GhostNode[]>(() => Array.from({ length: 16 }, () => ({ x: -100, y: -100 })))
  const [ghostVisible, setGhostVisible] = useState(false)
  const [clickBursts, setClickBursts] = useState<ClickBurst[]>([])

  // Custom cursor renders alongside ALL effects except those that draw their
  // own cursor sprite ('cat') or take over the cursor surface entirely
  // ('splash'). Trails, glow, ghost, falling-spark, rainbow all run in addition
  // to the user's chosen cursor image.
  const overlayCursorAllowed = cursorEffect !== 'cat' && cursorEffect !== 'splash'
  const activeCursor = overlayCursorAllowed ? (interactiveHover && hoverCursorUrl ? hoverCursorUrl : customCursorUrl) : ''
  const glowEnabled = cursorEffect === 'glow'
  const clickBurstColor = clickColor || cursorColor
  const activeTrailMode = cursorEffect && ['spark-trail', 'falling-spark'].includes(cursorEffect) ? cursorEffect : 'none'
  const showGhostTrail = cursorEffect === 'ghost-trail'
  const showCatTrail = cursorEffect === 'cat'
  const showSplashCursor = cursorEffect === 'splash'
  const showRainbowCursor = cursorEffect === 'rainbow'
  const showBubbleCursor = cursorEffect === 'bubble'
  const showNeonCursor = cursorEffect === 'neon'

  const cursorCoreStyle = useMemo(() => ({
    // cssUrl() escapes any quote / paren / scheme chars in the URL so
    // legacy malicious values from the DB can't break out of url() and
    // inject arbitrary CSS rules.
    backgroundImage: activeCursor ? cssUrl(activeCursor) : undefined,
    filter: activeCursor ? `drop-shadow(0 0 8px ${hexToRgba(cursorColor, 0.22)})` : undefined,
  }), [activeCursor, cursorColor])

  useEffect(() => {
    if (activeTrailMode === 'none') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    const [r, g, b] = hexToRgbTuple(cursorColor)

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const rand = (min: number, max: number) => Math.random() * (max - min) + min

    const spawnSpark = (x: number, y: number, motionX: number, motionY: number, falling: boolean) => {
      if (falling) {
        particleRef.current.push({
          x,
          y,
          vx: rand(-0.25, 0.25) + motionX * 0.002,
          vy: rand(1.8, 3.8) + Math.max(0, motionY) * 0.025,
          life: rand(40, 70),
          maxLife: rand(40, 70),
          size: rand(2.2, 4.5),
          rotation: rand(0, Math.PI * 2),
          spin: rand(-0.02, 0.02),
          twinkle: Math.random() > 0.35,
          mode: 'falling',
        })
        return
      }

      const angle = Math.atan2(motionY, motionX) + rand(-0.9, 0.9)
      const speed = rand(0.8, 2.9)
      particleRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed + motionX * 0.018,
        vy: Math.sin(angle) * speed + motionY * 0.018,
        life: rand(24, 46),
        maxLife: rand(24, 46),
        size: rand(1.4, 3),
        mode: 'spark',
      })
    }

    const emitAlongPath = (x1: number, y1: number, x2: number, y2: number, falling: boolean) => {
      const dx = x2 - x1
      const dy = y2 - y1
      const dist = Math.hypot(dx, dy)
      const steps = Math.max(1, Math.floor(dist / (falling ? 4 : 6)))
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps
        const x = x1 + dx * t
        const y = y1 + dy * t
        spawnSpark(x, y, dx, dy, falling)
        if (falling && Math.random() > 0.48) spawnSpark(x, y, dx * 0.2, dy * 0.2, true)
        if (!falling && Math.random() > 0.55) spawnSpark(x, y, dx * 0.5, dy * 0.5, false)
      }
    }

    const drawSparkParticle = (p: any) => {
      const alpha = Math.max(0, p.life / p.maxLife)
      ctx.beginPath()
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.95})`
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.26})`
      ctx.arc(p.x, p.y, p.size * 2.7, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawFallingParticle = (p: any) => {
      const alpha = Math.max(0, p.life / p.maxLife)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.95})`
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.moveTo(-p.size * 1.5, 0)
      ctx.lineTo(p.size * 1.5, 0)
      ctx.moveTo(0, -p.size * 1.5)
      ctx.lineTo(0, p.size * 1.5)
      ctx.stroke()
      if (p.twinkle) {
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.55})`
        ctx.lineWidth = 1.3
        ctx.beginPath()
        ctx.moveTo(-p.size, -p.size)
        ctx.lineTo(p.size, p.size)
        ctx.moveTo(p.size, -p.size)
        ctx.lineTo(-p.size, p.size)
        ctx.stroke()
      }
      ctx.restore()
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      const next: any[] = []
      for (const p of particleRef.current) {
        if (p.mode === 'falling') {
          p.x += p.vx
          p.y += p.vy
          p.vx *= 0.995
          p.vy += 0.03
          p.rotation += p.spin
          p.life -= 1
          if (p.life > 0 && p.y <= height + 24) {
            drawFallingParticle(p)
            next.push(p)
          }
        } else {
          p.x += p.vx
          p.y += p.vy
          p.vx *= 0.985
          p.vy *= 0.985
          p.vy += 0.012
          p.life -= 1
          if (p.life > 0) {
            drawSparkParticle(p)
            next.push(p)
          }
        }
      }
      particleRef.current = next
      animationRef.current = window.requestAnimationFrame(animate)
    }

    resize()
    animate()

    const onMove = (event: MouseEvent) => {
      pointerRef.current.visible = true
      pointerRef.current.px = pointerRef.current.x || event.clientX
      pointerRef.current.py = pointerRef.current.y || event.clientY
      pointerRef.current.x = event.clientX
      pointerRef.current.y = event.clientY
      emitAlongPath(pointerRef.current.px, pointerRef.current.py, pointerRef.current.x, pointerRef.current.y, activeTrailMode === 'falling-spark')
    }

    const onLeave = () => {
      pointerRef.current.visible = false
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseenter', onMove)
    window.addEventListener('mouseleave', onLeave)
    window.addEventListener('resize', resize)

    return () => {
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current)
      particleRef.current = []
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseenter', onMove)
      window.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', resize)
    }
  }, [activeTrailMode, cursorColor])

  useEffect(() => {
    if (!showGhostTrail) return

    let animationFrame = 0
    const nodes = Array.from({ length: 16 }, () => ({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 }))
    const pointer = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 }

    const animate = () => {
      let leadX = pointer.x
      let leadY = pointer.y
      const next = nodes.map((node, index) => {
        const ease = Math.max(0.18, 0.42 - index * 0.012)
        node.x += (leadX - node.x) * ease
        node.y += (leadY - node.y) * ease
        leadX = node.x
        leadY = node.y
        return { x: node.x, y: node.y }
      })
      setGhostNodes(next)
      animationFrame = window.requestAnimationFrame(animate)
    }

    const onMove = (event: MouseEvent) => {
      pointer.x = event.clientX
      pointer.y = event.clientY
      setGhostVisible(true)
    }
    const onLeave = () => setGhostVisible(false)

    animate()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseenter', onMove)
    window.addEventListener('mouseleave', onLeave)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseenter', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [showGhostTrail])

  useEffect(() => {
    if (!showCatTrail) return
    
    let cleanup: (() => void) | undefined
    
    // Small delay to ensure DOM is ready
    const timeoutId = window.setTimeout(() => {
      try {
        cleanup = startOneko({
          speed: 10,
          fps: 12,
          image: '/cursor-buddy/oneko.gif',
          persistPosition: false,
          zIndex: 9999,
          id: 'profile-oneko',
        })
      } catch (err) {
        console.error('[cursor] Cat cursor error:', err)
      }
    }, 200)
    
    return () => {
      window.clearTimeout(timeoutId)
      if (cleanup) cleanup()
      // Also directly remove the element as backup
      document.getElementById('profile-oneko')?.remove()
    }
  }, [showCatTrail])

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      setPosition({ x: event.clientX, y: event.clientY, visible: true })
      const target = event.target as HTMLElement | null
      setInteractiveHover(Boolean(target?.closest('a, button, [role="button"]')))
    }
    const onLeave = () => setPosition((current) => ({ ...current, visible: false }))
    const spawnClickBurst = (event: MouseEvent) => {
      if (!clickEffect || clickEffect === 'none') return
      const count = clickEffect === 'falling' ? 16 : 11
      const next: ClickBurst[] = []
      for (let i = 0; i < count; i += 1) {
        burstIdRef.current += 1
        next.push({
          id: burstIdRef.current,
          x: event.clientX,
          y: event.clientY,
          life: 30,
          maxLife: 30,
          size: 2 + Math.random() * 3,
          driftX: (Math.random() - 0.5) * 4.2,
          driftY: clickEffect === 'falling' ? Math.random() * 1.5 + 0.2 : (Math.random() - 0.5) * 4.2,
        })
      }
      setClickBursts((current) => [...current.slice(-80), ...next])
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseenter', onMove)
    window.addEventListener('mouseleave', onLeave)
    window.addEventListener('click', spawnClickBurst)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseenter', onMove)
      window.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('click', spawnClickBurst)
    }
  }, [clickEffect])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClickBursts((current) => current
        .map((item) => ({
          ...item,
          x: item.x + item.driftX,
          y: item.y + item.driftY,
          driftY: clickEffect === 'falling' ? item.driftY + 0.08 : item.driftY,
          life: item.life - 1,
        }))
        .filter((item) => item.life > 0))
    }, 16)
    return () => window.clearInterval(interval)
  }, [clickEffect])


  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[9999] h-full w-full" />
      
      {showSplashCursor && <SplashCursor />}

      {showRainbowCursor && <RainbowCursor />}

      {showBubbleCursor && <BubbleCursor color={cursorColor} />}

      {showNeonCursor && <NeonCursor color={cursorColor} />}

      {showGhostTrail && ghostNodes.map((node, index) => {
        // When enabled, the ghost trail mirrors the user's own custom cursor
        // image instead of the default white arrow. Falls back to the arrow
        // when no custom cursor is set. Available to everyone.
        const useCustom = Boolean(ghostUseCustomCursor && customCursorUrl)
        return (
          <img
            key={`ghost-${index}`}
            src={useCustom ? customCursorUrl! : GHOST_CURSOR_SVG}
            alt=""
            aria-hidden
            className="pointer-events-none fixed z-[9999] select-none"
            style={{
              left: 0,
              top: 0,
              width: useCustom ? 26 : 14,
              height: useCustom ? 26 : 20,
              objectFit: 'contain',
              opacity: ghostVisible ? 1 : 0,
              transform: `translate(${node.x - (useCustom ? 13 : 2)}px, ${node.y - (useCustom ? 13 : 2)}px)`,
              filter: 'none',
              willChange: 'transform, opacity',
            }}
          />
        )
      })}


      {clickBursts.map((node) => {
        const alpha = node.life / node.maxLife
        return (
          <div
            key={node.id}
            className="pointer-events-none fixed z-[9999] rounded-full"
            style={{
              left: node.x - node.size / 2,
              top: node.y - node.size / 2,
              width: node.size,
              height: node.size,
              backgroundColor: hexToRgba(clickBurstColor, alpha),
              boxShadow: `0 0 ${node.size * 7}px ${hexToRgba(clickBurstColor, alpha * 0.58)}`,
            }}
          />
        )
      })}

      {(glowEnabled || activeCursor) && position.visible && (
        <>
          {glowEnabled && (
            <div
              className="pointer-events-none fixed z-[9999] rounded-full"
              style={{
                left: position.x - 36,
                top: position.y - 36,
                width: 72,
                height: 72,
                background: `radial-gradient(circle, ${hexToRgba(cursorColor, 0.16)} 0%, ${hexToRgba(cursorColor, 0.08)} 48%, transparent 75%)`,
                filter: 'blur(8px)',
              }}
            />
          )}
          {activeCursor && (
            <div
              className="pointer-events-none fixed z-[9999]"
              style={{
                left: position.x - 14,
                top: position.y - 14,
                width: 28,
                height: 28,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                transform: interactiveHover && hoverCursorUrl ? 'scale(1.05)' : 'scale(1)',
                ...cursorCoreStyle,
              }}
            />
          )}
        </>
      )}
    </>
  )
}
