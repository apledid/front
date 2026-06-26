// Based on the upstream oneko.js project by adryd325 and the CursorBuddy usage in Equicord.
// Source references:
// - https://github.com/adryd325/oneko.js
// - https://github.com/Equicord/Equicord/tree/main/src/equicordplugins/cursorBuddy

type OnekoOptions = {
  speed?: number
  fps?: number
  image?: string
  persistPosition?: boolean
  zIndex?: number
  id?: string
}

export function startOneko(options: OnekoOptions = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}

  const {
    speed = 10,
    fps = 10,
    image = '/cursor-buddy/oneko.gif',
    persistPosition = false,
    zIndex = 9999,
    id = 'oneko',
  } = options

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  if (reducedMotion) return () => {}

  // Remove any existing oneko element
  const existing = document.getElementById(id)
  if (existing) existing.remove()

  const nekoEl = document.createElement('div')
  let nekoPosX = 32
  let nekoPosY = 32
  let mousePosX = 0
  let mousePosY = 0
  let frameCount = 0
  let idleTime = 0
  let idleAnimation: string | null = null
  let idleAnimationFrame = 0
  let lastFrameTimestamp = 0
  let raf = 0

  const spriteSets: Record<string, number[][]> = {
    idle: [[-3, -3]],
    alert: [[-7, -3]],
    scratchSelf: [[-5, 0], [-6, 0], [-7, 0]],
    scratchWallN: [[0, 0], [0, -1]],
    scratchWallS: [[-7, -1], [-6, -2]],
    scratchWallE: [[-2, -2], [-2, -3]],
    scratchWallW: [[-4, 0], [-4, -1]],
    tired: [[-3, -2]],
    sleeping: [[-2, 0], [-2, -1]],
    N: [[-1, -2], [-1, -3]],
    NE: [[0, -2], [0, -3]],
    E: [[-3, 0], [-3, -1]],
    SE: [[-5, -1], [-5, -2]],
    S: [[-6, -3], [-7, -2]],
    SW: [[-5, -3], [-6, -1]],
    W: [[-4, -2], [-4, -3]],
    NW: [[-1, 0], [-1, -1]],
  }

  if (persistPosition) {
    try {
      const stored = JSON.parse(window.localStorage.getItem('oneko') || 'null')
      if (stored) {
        nekoPosX = stored.nekoPosX ?? nekoPosX
        nekoPosY = stored.nekoPosY ?? nekoPosY
        mousePosX = stored.mousePosX ?? mousePosX
        mousePosY = stored.mousePosY ?? mousePosY
        frameCount = stored.frameCount ?? frameCount
        idleTime = stored.idleTime ?? idleTime
        idleAnimation = stored.idleAnimation ?? idleAnimation
        idleAnimationFrame = stored.idleAnimationFrame ?? idleAnimationFrame
      }
    } catch {}
  }

  nekoEl.id = id
  nekoEl.setAttribute('aria-hidden', 'true')
  Object.assign(nekoEl.style, {
    width: '32px',
    height: '32px',
    position: 'fixed',
    pointerEvents: 'none',
    imageRendering: 'pixelated',
    left: `${nekoPosX - 16}px`,
    top: `${nekoPosY - 16}px`,
    zIndex: String(zIndex),
    backgroundImage: `url(${image})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: '256px 128px',
    willChange: 'transform,left,top,background-position',
  } as CSSStyleDeclaration)

  const setSprite = (name: string, frame: number) => {
    const sprite = spriteSets[name]?.[frame % spriteSets[name].length]
    if (!sprite) return
    nekoEl.style.backgroundPosition = `${sprite[0] * 32}px ${sprite[1] * 32}px`
  }

  const resetIdleAnimation = () => {
    idleAnimation = null
    idleAnimationFrame = 0
  }

  const idle = () => {
    idleTime += 1

    if (idleTime > 10 && Math.floor(Math.random() * 200) === 0 && idleAnimation == null) {
      const available = ['sleeping', 'scratchSelf']
      if (nekoPosX < 32) available.push('scratchWallW')
      if (nekoPosY < 32) available.push('scratchWallN')
      if (nekoPosX > window.innerWidth - 32) available.push('scratchWallE')
      if (nekoPosY > window.innerHeight - 32) available.push('scratchWallS')
      idleAnimation = available[Math.floor(Math.random() * available.length)]
    }

    switch (idleAnimation) {
      case 'sleeping':
        if (idleAnimationFrame < 8) {
          setSprite('tired', 0)
          break
        }
        setSprite('sleeping', Math.floor(idleAnimationFrame / 4))
        if (idleAnimationFrame > 192) resetIdleAnimation()
        break
      case 'scratchWallN':
      case 'scratchWallS':
      case 'scratchWallE':
      case 'scratchWallW':
      case 'scratchSelf':
        setSprite(idleAnimation, idleAnimationFrame)
        if (idleAnimationFrame > 9) resetIdleAnimation()
        break
      default:
        setSprite('idle', 0)
        return
    }
    idleAnimationFrame += 1
  }

  const frame = () => {
    frameCount += 1
    const diffX = nekoPosX - mousePosX
    const diffY = nekoPosY - mousePosY
    const distance = Math.sqrt(diffX ** 2 + diffY ** 2)

    if (distance < speed || distance < 48) {
      idle()
      return
    }

    idleAnimation = null
    idleAnimationFrame = 0

    if (idleTime > 1) {
      setSprite('alert', 0)
      idleTime = Math.min(idleTime, 7)
      idleTime -= 1
      return
    }

    let direction = ''
    direction += diffY / distance > 0.5 ? 'N' : ''
    direction += diffY / distance < -0.5 ? 'S' : ''
    direction += diffX / distance > 0.5 ? 'W' : ''
    direction += diffX / distance < -0.5 ? 'E' : ''
    setSprite(direction || 'idle', frameCount)

    nekoPosX -= (diffX / distance) * speed
    nekoPosY -= (diffY / distance) * speed
    nekoPosX = Math.min(Math.max(16, nekoPosX), window.innerWidth - 16)
    nekoPosY = Math.min(Math.max(16, nekoPosY), window.innerHeight - 16)
    nekoEl.style.left = `${nekoPosX - 16}px`
    nekoEl.style.top = `${nekoPosY - 16}px`
  }

  const onMove = (event: MouseEvent) => {
    mousePosX = event.clientX
    mousePosY = event.clientY
  }

  const onBeforeUnload = () => {
    if (!persistPosition) return
    try {
      window.localStorage.setItem('oneko', JSON.stringify({
        nekoPosX,
        nekoPosY,
        mousePosX,
        mousePosY,
        frameCount,
        idleTime,
        idleAnimation,
        idleAnimationFrame,
        bgPos: nekoEl.style.backgroundPosition,
      }))
    } catch {}
  }

  const onAnimationFrame = (timestamp: number) => {
    if (!nekoEl.isConnected) return
    if (!lastFrameTimestamp) lastFrameTimestamp = timestamp
    if (timestamp - lastFrameTimestamp > 1000 / fps) {
      lastFrameTimestamp = timestamp
      frame()
    }
    raf = window.requestAnimationFrame(onAnimationFrame)
  }

  document.body.appendChild(nekoEl)
  document.addEventListener('mousemove', onMove)
  window.addEventListener('mouseenter', onMove as any)
  window.addEventListener('beforeunload', onBeforeUnload)
  setSprite('idle', 0)
  raf = window.requestAnimationFrame(onAnimationFrame)

  return () => {
    if (raf) window.cancelAnimationFrame(raf)
    document.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseenter', onMove as any)
    window.removeEventListener('beforeunload', onBeforeUnload)
    nekoEl.remove()
  }
}
