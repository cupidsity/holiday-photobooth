import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import {
  PALETTE,
  SHOOTING_LIFE,
  advanceShootingStar,
  buildField,
  buildShootingStars,
  buildSnow,
  buildTree,
  glyphAt,
  launchShootingStar,
  rasterise,
  shootingGlyph,
} from '../invite/asciiTree'
import { BOOTH_NAME, PARTY_NAME, PARTY_YEAR } from '../lib/config'
import '../styles/invite.css'

const FOCAL = 900
// how long the tree takes to grow in when the screen is first opened
const REVEAL_MS = 3200
const AUTO_SPIN = 0.32
// the flash: blow-out, white, gone
const FLASH_MS = 950
// the view tips up over the tree but never under it: from below the cone turns
// inside out and the whole thing stops reading as a tree
const PITCH_LOW = 0
const PITCH_HIGH = 1.1

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value
}

function packedToCss(packed: number): string {
  return `rgb(${(packed >> 16) & 255}, ${(packed >> 8) & 255}, ${packed & 255})`
}

// the same colour with the light taken out of it, for the blow-out
function mixPacked(packed: number, to: string, amount: number): string {
  const toRed = parseInt(to.slice(1, 3), 16)
  const toGreen = parseInt(to.slice(3, 5), 16)
  const toBlue = parseInt(to.slice(5, 7), 16)
  const blend = (left: number, right: number) => Math.round(left + (right - left) * amount)
  return `rgb(${blend((packed >> 16) & 255, toRed)}, ${blend((packed >> 8) & 255, toGreen)}, ${blend(packed & 255, toBlue)})`
}

export function Invite({ onEnter }: { onEnter: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{
    pointerId: number
    lastX: number
    lastY: number
    lastTime: number
    travel: number
  } | null>(null)
  const angleRef = useRef(0.34)
  const pitchRef = useRef(0)
  const velocityRef = useRef(0)
  const spinRef = useRef(true)
  const revealFromRef = useRef(performance.now())
  const flashFromRef = useRef<number | null>(null)
  // where the finger landed, in canvas pixels: the blow-out starts there
  const flashAtRef = useRef({ x: 0, y: 0 })
  const leavingRef = useRef(false)
  // held in a ref so the render loop never has to be torn down and rebuilt
  const enterRef = useRef(onEnter)
  enterRef.current = onEnter
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lightweight =
      window.matchMedia('(pointer: coarse)').matches ||
      window.innerWidth < 760 ||
      (navigator.hardwareConcurrency ?? 8) <= 4

    const TREE_HEIGHT = 1000
    // a portrait screen is the one case where the tree's own width is what
    // stops it being drawn bigger
    const portrait = window.innerHeight / window.innerWidth > 1.3
    const tree = buildTree(
      TREE_HEIGHT,
      lightweight ? 0.62 : 1,
      portrait ? 0.9 : 1,
      portrait ? 0.41 : 0.46,
    )
    const snow = buildSnow(lightweight ? 70 : 150)
    const field = buildField(lightweight ? 260 : 620)
    const shooting = buildShootingStars(lightweight ? 2 : 3)

    let previous = performance.now()
    let frame = 0

    let width = 0
    let height = 0
    let columns = 0
    let rows = 0
    let cellWidth = 0
    let cellHeight = 0
    let fontSize = 0
    let depthBuffer = new Float32Array(0)
    let glyphBuffer = new Int16Array(0)
    let colorBuffer = new Int32Array(0)
    let scale = 1
    let centerY = 0

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const bounds = canvas.getBoundingClientRect()
      width = bounds.width
      height = bounds.height
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

      // fit the whole model, star and parcels included. perspective magnifies
      // whatever is nearest the eye and the amount it magnifies by depends on
      // the scale, so the fit settles over a few passes
      const span = tree.bottomY - tree.topY
      scale = Math.min(width / (tree.reach * 2), height / span)
      let nearest = 1
      for (let pass = 0; pass < 4; pass += 1) {
        nearest = FOCAL / (FOCAL - tree.reach * scale)
        scale = Math.min(
          (width * 0.99) / (tree.reach * 2 * nearest),
          (height * 0.99) / (span * nearest),
        )
      }
      // sit the tree a little above centre, but only as far as the spare room
      // allows: when the fit is already tight this shift is nothing and the
      // parcels stay on screen
      const usedHeight = span * scale * nearest
      const lift = Math.min(height * 0.07, Math.max(0, height - usedHeight) * 0.45)
      centerY = height / 2 - ((tree.topY + tree.bottomY) / 2) * scale * nearest - lift

      // the grid is sized from the tree rather than from the canvas, so the
      // weave stays the same whatever shape the screen is. a character cell is
      // 0.6em wide and a little over 1em tall, and spacing the rows any tighter
      // is what makes glyphs sit on top of each other
      const treeRows = lightweight ? 48 : 60
      cellHeight = Math.max(7, (span * scale * nearest) / treeRows)
      fontSize = cellHeight / 1.06
      cellWidth = fontSize * 0.6
      columns = Math.ceil(width / cellWidth) + 1
      rows = Math.ceil(height / cellHeight) + 1
      const size = columns * rows
      depthBuffer = new Float32Array(size)
      glyphBuffer = new Int16Array(size)
      colorBuffer = new Int32Array(size)
    }

    const draw = (now: number) => {
      const delta = Math.min(0.05, (now - previous) / 1000)
      previous = now

      const flashFrom = flashFromRef.current
      const flash = flashFrom === null ? 0 : clamp((now - flashFrom) / FLASH_MS, 0, 1)
      // the blow-out races out from the tap, then the whole sheet goes white
      const blowOut = clamp(flash / 0.4, 0, 1)
      const reach = (1 - (1 - blowOut) ** 2) * Math.hypot(width, height) * 1.15
      const wash = clamp((flash - 0.34) / 0.24, 0, 1)
      const standing = 1

      // the tree holds still under a finger and picks its spin back up the
      // moment it is let go
      if (!reducedMotion && !dragRef.current && flash === 0) {
        const wanted = spinRef.current ? AUTO_SPIN : 0
        velocityRef.current += (wanted - velocityRef.current) * Math.min(1, delta * 2.2)
        angleRef.current += velocityRef.current * delta
      }

      ctx.fillStyle = PALETTE.night
      ctx.fillRect(0, 0, width, height)

      const centerX = width / 2
      const reveal = clamp((now - revealFromRef.current) / REVEAL_MS, 0, 1)

      rasterise(
        tree,
        {
          columns,
          rows,
          cellWidth,
          cellHeight,
          angle: angleRef.current,
          pitch: pitchRef.current,
          reveal,
          scale,
          centerX,
          centerY,
          focal: FOCAL,
          time: now,
        },
        depthBuffer,
        glyphBuffer,
        colorBuffer,
      )

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `${fontSize}px "IBM Plex Mono", ui-monospace, monospace` // taste-skill-ignore

      ctx.fillStyle = PALETTE.rule
      ctx.globalAlpha = 0.5 * reveal * standing
      for (let row = 4; row < rows; row += 9) {
        for (let column = 2; column < columns; column += 4) {
          ctx.fillText(column % 8 === 2 ? '-' : '.', column * cellWidth, row * cellHeight)
        }
      }

      ctx.fillStyle = PALETTE.field
      for (const mark of field) {
        ctx.globalAlpha = (0.2 + mark.dim) * reveal * standing
        ctx.fillText(mark.glyph, mark.x * width, mark.y * height)
      }

      // the odd shooting star burning across the back of the sky, one cell of
      // the grid at a time
      const seconds = now / 1000
      for (const star of shooting) {
        if (star.waitingUntil > 0) {
          if (seconds > star.waitingUntil) launchShootingStar(star, columns, rows, seconds, Math.random)
          continue
        }
        if (seconds < star.flyingUntil) {
          advanceShootingStar(star, delta, seconds)
        } else {
          while (star.trail.length && seconds - star.trail[0].litAt > SHOOTING_LIFE) star.trail.shift()
          if (star.trail.length === 0) {
            star.waitingUntil = seconds + 3 + Math.random() * 7
            continue
          }
        }

        for (const mark of star.trail) {
          const age = seconds - mark.litAt
          if (age > SHOOTING_LIFE) continue
          if (mark.column < 0 || mark.column >= columns || mark.row < 0 || mark.row >= rows) continue
          if (glyphBuffer[mark.row * columns + mark.column] > 0) continue
          const heat = 1 - age / SHOOTING_LIFE
          ctx.globalAlpha = heat * reveal * standing
          ctx.fillStyle = heat > 0.82 ? '#ffffff' : PALETTE.snow
          ctx.fillText(shootingGlyph(age), mark.column * cellWidth, mark.row * cellHeight)
        }
      }

      ctx.fillStyle = PALETTE.snow
      for (const flake of snow) {
        flake.y = (flake.y + flake.fall * delta) % 1
        const driftX = (flake.x + Math.sin(now * 0.0003 + flake.y * 9) * 0.01 * flake.drift) % 1
        ctx.globalAlpha = (0.25 + flake.size * 0.2) * standing
        ctx.fillText(flake.size > 1.4 ? '*' : '·', driftX * width, flake.y * height)
      }

      ctx.globalAlpha = 1
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const index = row * columns + column
          const code = glyphBuffer[index]
          if (code <= 0) continue

          const atX = column * cellWidth
          const atY = row * cellHeight

          if (flash === 0) {
            ctx.globalAlpha = 1
            ctx.fillStyle = packedToCss(colorBuffer[index])
            ctx.fillText(glyphAt(code), atX, atY)
            continue
          }

          // everything the blow-out has reached burns out: the character
          // thickens to a solid and the light takes its colour
          const away = Math.hypot(atX - flashAtRef.current.x, atY - flashAtRef.current.y)
          const burn = clamp((reach - away) / (cellHeight * 26), 0, 1)
          ctx.globalAlpha = 1
          ctx.fillStyle =
            burn > 0 ? mixPacked(colorBuffer[index], '#ffffff', burn) : packedToCss(colorBuffer[index])
          ctx.fillText(burn > 0.55 ? '@' : burn > 0.22 ? '%' : glyphAt(code), atX, atY)
        }
      }

      if (wash > 0) {
        ctx.globalAlpha = wash
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1
      }

      // the booth comes up while the glare is still on the screen, so there is
      // never a frame of nothing between the two
      if (flash >= 0.55 && !leavingRef.current) {
        leavingRef.current = true
        enterRef.current()
      }

      frame = requestAnimationFrame(draw)
    }

    resize()
    frame = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault()
        spinRef.current = !spinRef.current
      }
      if (event.key.toLowerCase() === 'r') {
        revealFromRef.current = performance.now()
        angleRef.current = 0.34
        pitchRef.current = 0
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function startDrag(event: ReactPointerEvent) {
    if (flashFromRef.current !== null) return
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      travel: 0,
    }
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }

  function moveDrag(event: ReactPointerEvent) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const now = performance.now()
    const across = event.clientX - drag.lastX
    const down = event.clientY - drag.lastY
    angleRef.current += across * 0.009
    pitchRef.current = clamp(pitchRef.current + down * 0.004, PITCH_LOW, PITCH_HIGH)
    const elapsed = Math.max(1, now - drag.lastTime)
    velocityRef.current = clamp((across * 0.009 * 1000) / elapsed, -5, 5)
    drag.travel += Math.abs(across) + Math.abs(down)
    drag.lastX = event.clientX
    drag.lastY = event.clientY
    drag.lastTime = now
  }

  function endDrag(event: ReactPointerEvent) {
    const drag = dragRef.current
    if (drag?.pointerId !== event.pointerId) return
    dragRef.current = null
    // a tap rather than a turn: fire the flash and open the booth
    if (drag.travel < 6 && flashFromRef.current === null) {
      const bounds = canvasRef.current?.getBoundingClientRect()
      flashAtRef.current = {
        x: event.clientX - (bounds?.left ?? 0),
        y: event.clientY - (bounds?.top ?? 0),
      }
      flashFromRef.current = performance.now()
      setLeaving(true)
    }
  }

  return (
    <div className="invite">
      <div
        className={`invite-card${leaving ? ' leaving' : ''}`}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <header className="invite-head">
          <h1 className="invite-title">{BOOTH_NAME}</h1>
          <p className="invite-lead">
            Three photographs, one strip. {PARTY_NAME}, {PARTY_YEAR}.
          </p>
          <p className="invite-call">Tap the tree to start</p>
        </header>

        <canvas ref={canvasRef} className="invite-canvas" />
      </div>
    </div>
  )
}
