import { useEffect, useMemo, useRef, useState } from 'react'
import { buildScene } from '../invite/scene'
import { INK } from '../invite/tree'
import { BOOTH_NAME, PARTY_NAME, PARTY_YEAR, boothUrl } from '../lib/config'
import '../styles/invite.css'

const PAPER = '#f6efe2'
const QUIET_MODULES = 4

// one full cycle of the invite, in milliseconds
const HOLD_TREE = 6000
const TURN = 2400
const HOLD_CODE = 9000
const CYCLE = HOLD_TREE + TURN + HOLD_CODE + TURN

type Lock = 'auto' | 'tree' | 'code'

function easeInOut(progress: number): number {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
}

// 0 is head-on (the tree), 1 is straight down (the qr code)
function tiltAt(elapsed: number, reducedMotion: boolean): number {
  const time = elapsed % CYCLE
  if (time < HOLD_TREE) return 0
  if (time < HOLD_TREE + TURN) {
    const progress = (time - HOLD_TREE) / TURN
    return reducedMotion ? (progress > 0.5 ? 1 : 0) : easeInOut(progress)
  }
  if (time < HOLD_TREE + TURN + HOLD_CODE) return 1
  const progress = (time - HOLD_TREE - TURN - HOLD_CODE) / TURN
  return reducedMotion ? (progress > 0.5 ? 0 : 1) : 1 - easeInOut(progress)
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function mixHex(from: string, to: string, amount: number): string {
  const parse = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  const [fromRed, fromGreen, fromBlue] = parse(from)
  const [toRed, toGreen, toBlue] = parse(to)
  const blend = (left: number, right: number) => Math.round(left + (right - left) * amount)
  return `rgb(${blend(fromRed, toRed)}, ${blend(fromGreen, toGreen)}, ${blend(fromBlue, toBlue)})`
}

export function Invite() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lockRef = useRef<Lock>('auto')
  const [lock, setLock] = useState<Lock>('auto')
  const [showingCode, setShowingCode] = useState(false)
  const url = useMemo(boothUrl, [])
  const scene = useMemo(() => buildScene(url), [url])

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('view')
    if (requested === 'tree' || requested === 'code') {
      lockRef.current = requested
      setLock(requested)
    }
  }, [])

  useEffect(() => {
    lockRef.current = lock
  }, [lock])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const startedAt = performance.now()
    let frame = 0
    let lastCodeState: boolean | null = null

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const bounds = canvas.getBoundingClientRect()
      canvas.width = Math.round(bounds.width * ratio)
      canvas.height = Math.round(bounds.height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const draw = (now: number) => {
      const bounds = canvas.getBoundingClientRect()
      const width = bounds.width
      const height = bounds.height
      const current = lockRef.current
      const tilt = current === 'auto' ? tiltAt(now - startedAt, reducedMotion) : current === 'code' ? 1 : 0

      const isCode = tilt > 0.75
      if (isCode !== lastCodeState) {
        lastCodeState = isCode
        setShowingCode(isCode)
      }

      ctx.fillStyle = PAPER
      ctx.fillRect(0, 0, width, height)

      const cell = Math.min(
        width / (scene.size + QUIET_MODULES * 2),
        height / (scene.gridHeight + QUIET_MODULES * 2),
      )
      const centerX = width / 2
      const centerY = height / 2
      const angle = (tilt * Math.PI) / 2
      const cosine = Math.cos(angle)
      const sine = Math.sin(angle)

      // the tree turns on its trunk while it is being looked at head on, and
      // the turn is scaled by how far the view has tipped so that it is exactly
      // zero at the overhead hold, where the code has to be square
      const upright = 1 - tilt
      const spin = reducedMotion ? 0 : Math.sin((now - startedAt) / 4300) * 0.52 * upright
      const spinCos = Math.cos(spin)
      const spinSin = Math.sin(spin)
      const perspective = 0.02 * upright

      // the glyphs fade into solid modules near the top of the swing, so the
      // final frame is a clean code rather than a grid of punctuation
      const blockMix = clamp01((tilt - 0.6) / 0.34) ** 1.5
      const glyphAlpha = 1 - blockMix

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const halfWidth = (scene.size - 1) / 2
      const halfHeight = (scene.gridHeight - 1) / 2
      const halfDepth = (scene.size - 1) / 2

      // nearest last, so the front of the tree covers the back of it
      const order = scene.points
        .map((point, index) => {
          const acrossSpun = (point.column - halfWidth) * spinCos + (point.depth - halfDepth) * spinSin
          const deepSpun = (point.depth - halfDepth) * spinCos - (point.column - halfWidth) * spinSin
          const high = point.row - halfHeight
          return {
            index,
            acrossSpun,
            screenHigh: high * cosine + deepSpun * sine,
            toward: deepSpun * cosine - high * sine,
          }
        })
        .sort((left, right) => right.toward - left.toward)

      let currentFont = 0
      for (const seat of order) {
        const point = scene.points[seat.index]
        const scale = 1 / (1 + seat.toward * perspective)
        const screenX = centerX + seat.acrossSpun * cell * scale
        const screenY = centerY + seat.screenHigh * cell * scale

        if (glyphAlpha > 0.01) {
          // what is close to the eye prints heavier, which is most of what
          // makes a field of characters read as a solid thing
          const nearness = clamp01(0.5 - seat.toward / (scene.size * 1.6))
          const depthFade = 1 - upright * 0.45 * (1 - nearness)
          const fontSize = Math.round(cell * (point.snow ? 0.8 : 1.08) * scale * 2) / 2
          if (fontSize !== currentFont) {
            currentFont = fontSize
            ctx.font = `${fontSize}px "IBM Plex Mono", ui-monospace, monospace`
          }
          ctx.globalAlpha = (point.snow ? glyphAlpha * 0.5 : glyphAlpha) * depthFade
          ctx.fillStyle = mixHex(point.color, INK.code, blockMix)
          ctx.fillText(point.glyph, screenX, screenY)
        }
        if (blockMix > 0.01) {
          ctx.globalAlpha = blockMix
          ctx.fillStyle = INK.code
          ctx.fillRect(
            Math.round(screenX - cell / 2),
            Math.round(screenY - cell / 2),
            Math.ceil(cell),
            Math.ceil(cell),
          )
        }
      }

      ctx.globalAlpha = 1
      frame = requestAnimationFrame(draw)
    }

    resize()
    frame = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [scene])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault()
        setLock((current) => (current === 'auto' ? 'code' : 'auto'))
      }
      if (event.key === 'ArrowUp') setLock('code')
      if (event.key === 'ArrowDown') setLock('tree')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="invite">
      <div className="invite-card" onClick={() => setLock((current) => (current === 'code' ? 'auto' : 'code'))}>
        <header className="invite-head">
          <h1 className="invite-title">{BOOTH_NAME}</h1>
          <p className="invite-lead">
            Three photographs, one strip. {PARTY_NAME}, {PARTY_YEAR}.
          </p>
        </header>

        <canvas ref={canvasRef} className="invite-canvas" />

        <footer className="invite-foot">
          <p className={`invite-hint${showingCode ? ' code' : ''}`}>
            {showingCode ? 'Scan it to start your strip' : 'Watch the tree from above'}
          </p>
          <p className="invite-url">{url.replace(/^https?:\/\//, '')}</p>
        </footer>
      </div>
    </div>
  )
}
