"use client"

import { useEffect, useRef } from "react"

interface ParticleBackgroundProps {
  type: string
  count: number
  color: string
  embedded?: boolean
  className?: string
}

export function ParticleBackground({
  type,
  count,
  color,
  embedded = false,
  className,
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId = 0
    let particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      size: number
      opacity: number
      char?: string
    }> = []

    const getBounds = () => {
      if (embedded && canvas.parentElement) {
        return {
          width: canvas.parentElement.clientWidth || 300,
          height: canvas.parentElement.clientHeight || 500,
        }
      }

      return {
        width: window.innerWidth,
        height: window.innerHeight,
      }
    }

    const resize = () => {
      const { width, height } = getBounds()
      canvas.width = width
      canvas.height = height
      initParticles()
    }

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result
        ? {
            r: Number.parseInt(result[1], 16),
            g: Number.parseInt(result[2], 16),
            b: Number.parseInt(result[3], 16),
          }
        : { r: 255, g: 255, b: 255 }
    }

    const rgb = hexToRgb(color)

    const initParticles = () => {
      particles = []
      const actualCount = Math.min(count, embedded ? 80 : 200)

      for (let i = 0; i < actualCount; i++) {
        const particle: (typeof particles)[number] = {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: 0,
          vy: 0,
          size: 0,
          opacity: 0,
        }

        switch (type) {
          case "stars":
            particle.vx = (Math.random() - 0.5) * 0.2
            particle.vy = (Math.random() - 0.5) * 0.2
            particle.size = Math.random() * 2 + 0.5
            particle.opacity = Math.random() * 0.8 + 0.2
            break
          case "snow":
            particle.vx = (Math.random() - 0.5) * 0.5
            particle.vy = Math.random() * 1 + 0.5
            particle.size = Math.random() * 3 + 1
            particle.opacity = Math.random() * 0.6 + 0.2
            break
          case "rain":
            particle.vx = 0.5
            particle.vy = Math.random() * 8 + 4
            particle.size = Math.random() * 2 + 1
            particle.opacity = Math.random() * 0.3 + 0.1
            break
          case "fireflies":
            particle.vx = (Math.random() - 0.5) * 0.5
            particle.vy = (Math.random() - 0.5) * 0.5
            particle.size = Math.random() * 3 + 2
            particle.opacity = Math.random()
            break
          case "bubbles":
            particle.vx = (Math.random() - 0.5) * 0.3
            particle.vy = -(Math.random() * 1 + 0.5)
            particle.size = Math.random() * 8 + 4
            particle.opacity = Math.random() * 0.3 + 0.1
            break
          case "matrix":
            particle.y = Math.random() * canvas.height - canvas.height
            particle.vx = 0
            particle.vy = Math.random() * 3 + 2
            particle.size = 14
            particle.opacity = Math.random() * 0.8 + 0.2
            particle.char = String.fromCharCode(0x30A0 + Math.random() * 96)
            break
          default:
            particle.vx = (Math.random() - 0.5) * 0.3
            particle.vy = (Math.random() - 0.5) * 0.3
            particle.size = Math.random() * 2 + 1
            particle.opacity = Math.random() * 0.5 + 0.2
        }

        particles.push(particle)
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p) => {
        ctx.save()

        if (type === "matrix") {
          ctx.font = `${p.size}px monospace`
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity})`
          ctx.fillText(p.char || "0", p.x, p.y)
          if (Math.random() > 0.95) {
            p.char = String.fromCharCode(0x30A0 + Math.random() * 96)
          }
        } else if (type === "rain") {
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x + 1, p.y + p.size * 5)
          ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity})`
          ctx.lineWidth = 1
          ctx.stroke()
        } else if (type === "bubbles") {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity})`
          ctx.lineWidth = 1
          ctx.stroke()
        } else if (type === "fireflies") {
          const pulse = Math.sin(Date.now() * 0.003 + p.x) * 0.5 + 0.5
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity * pulse})`
          ctx.fill()

          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3)
          gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity * pulse * 0.5})`)
          gradient.addColorStop(1, "transparent")
          ctx.fillStyle = gradient
          ctx.fillRect(p.x - p.size * 3, p.y - p.size * 3, p.size * 6, p.size * 6)
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity})`
          ctx.fill()
        }

        ctx.restore()

        p.x += p.vx
        p.y += p.vy

        if (type === "snow" || type === "rain" || type === "matrix") {
          if (p.y > canvas.height) {
            p.y = -10
            p.x = Math.random() * canvas.width
          }
        } else if (type === "bubbles") {
          if (p.y < -p.size) {
            p.y = canvas.height + p.size
            p.x = Math.random() * canvas.width
          }
        } else {
          if (p.x < 0) p.x = canvas.width
          if (p.x > canvas.width) p.x = 0
          if (p.y < 0) p.y = canvas.height
          if (p.y > canvas.height) p.y = 0
        }

        if (type === "fireflies" && Math.random() > 0.99) {
          p.vx = (Math.random() - 0.5) * 0.5
          p.vy = (Math.random() - 0.5) * 0.5
        }
      })

      if (type === "stars") {
        particles.forEach((p1, i) => {
          particles.slice(i + 1).forEach((p2) => {
            const dx = p1.x - p2.x
            const dy = p1.y - p2.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance < 100) {
              ctx.beginPath()
              ctx.moveTo(p1.x, p1.y)
              ctx.lineTo(p2.x, p2.y)
              ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.1 * (1 - distance / 100)})`
              ctx.lineWidth = 0.5
              ctx.stroke()
            }
          })
        })
      }

      animationFrameId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener("resize", resize)
    draw()

    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [type, count, color, embedded])

  return (
    <canvas
      ref={canvasRef}
      className={className || (embedded ? "pointer-events-none absolute inset-0 z-0" : "pointer-events-none fixed inset-0 z-0")}
    />
  )
}
