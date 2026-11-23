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
// how long the tree takes to pack itself into a strip
const FOLD_MS = 1300
// the strip's own paper and ink, so what the characters settle into matches the
// strip waiting on the booth screen
const STRIP_PAPER = '#16412a'
const STRIP_INK = '#eef3e9'
// the night warms toward the strip's paper as the fold runs, so the strip is
// arriving in its own light rather than sitting on a black field
const FOLD_FIELD = '#0d2718'
// the view tips up over the tree but never under it: from below the cone turns
// inside out and the whole thing stops reading as a tree
const PITCH_LOW = 0
const PITCH_HIGH = 1.1

function easeInOut(progress: number): number {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value
}

function mixHex(from: string, to: string, amount: number): string {
  const read = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))
  const [fromRed, fromGreen, fromBlue] = read(from)
  const [toRed, toGreen, toBlue] = read(to)
  const blend = (left: number, right: number) => Math.round(left + (right - left) * amount)
  return `rgb(${blend(fromRed, toRed)}, ${blend(fromGreen, toGreen)}, ${blend(fromBlue, toBlue)})`
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
  const foldFromRef = useRef<number | null>(null)
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

      const foldFrom = foldFromRef.current
      const folding = foldFrom === null ? 0 : clamp((now - foldFrom) / FOLD_MS, 0, 1)
      const fold = easeInOut(folding)
      const standing = 1 - fold

      // the tree holds still under a finger and picks its spin back up the
      // moment it is let go
      if (!reducedMotion && !dragRef.current && folding === 0) {
        const wanted = spinRef.current ? AUTO_SPIN : 0
        velocityRef.current += (wanted - velocityRef.current) * Math.min(1, delta * 2.2)
        angleRef.current += velocityRef.current * delta
      }

      ctx.fillStyle = fold > 0 ? mixHex(PALETTE.night, FOLD_FIELD, fold) : PALETTE.night
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

      if (folding === 0) {
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const index = row * columns + column
            const code = glyphBuffer[index]
            if (code <= 0) continue
            ctx.fillStyle = packedToCss(colorBuffer[index])
            ctx.fillText(glyphAt(code), column * cellWidth, row * cellHeight)
          }
        }
      } else {
        // the strip the tree is packing itself into: 2x6 proportions, three
        // windows and a caption band, the same shape the booth prints
        const paperWidth = Math.min(width * 0.2, height * 0.3)
        const paperHeight = paperWidth * 3
        const paperLeft = centerX - paperWidth / 2
        const paperTop = centerY - paperHeight / 2
        const inset = paperWidth * 0.09
        const windowWidth = paperWidth - inset * 2
        const windowHeight = (paperHeight * 0.74) / 3
        const windowGap = paperHeight * 0.025
        const firstWindow = paperTop + paperHeight * 0.05
        const insideWindow = (x: number, y: number) => {
          if (x < paperLeft + inset || x > paperLeft + inset + windowWidth) return false
          for (let slot = 0; slot < 3; slot += 1) {
            const top = firstWindow + slot * (windowHeight + windowGap)
            if (y >= top && y <= top + windowHeight) return true
          }
          return false
        }

        ctx.globalAlpha = fold
        ctx.fillStyle = STRIP_PAPER
        ctx.fillRect(paperLeft, paperTop, paperWidth, paperHeight)
        ctx.fillStyle = '#0e2d1c'
        for (let slot = 0; slot < 3; slot += 1) {
          ctx.fillRect(
            paperLeft + inset,
            firstWindow + slot * (windowHeight + windowGap),
            windowWidth,
            windowHeight,
          )
        }
        ctx.globalAlpha = 1

        // the places on the strip that characters can land: the paper, not
        // the windows. mapping the tree straight onto the strip instead piles
        // everything into the bottom, because that is where a cone's
        // characters are
        const paperColumns = Math.ceil(paperWidth / cellWidth)
        const paperRows = Math.ceil(paperHeight / cellHeight)
        const landings: number[] = []
        for (let row = 0; row < paperRows; row += 1) {
          for (let column = 0; column < paperColumns; column += 1) {
            const spotX = paperLeft + column * cellWidth
            const spotY = paperTop + row * cellHeight
            if (insideWindow(spotX, spotY)) continue
            landings.push(spotX, spotY)
          }
        }
        const landingCount = landings.length / 2

        let standingCount = 0
        for (let index = 0; index < rows * columns; index += 1) {
          if (glyphBuffer[index] > 0) standingCount += 1
        }

        // both lists run top-left to bottom-right, so the mapping is in order
        // and nothing has to cross the strip to find its place
        let taken = 0
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const index = row * columns + column
            const code = glyphBuffer[index]
            if (code <= 0) continue

            const slot = Math.min(
              landingCount - 1,
              Math.floor((taken * landingCount) / Math.max(1, standingCount)),
            )
            taken += 1
            const landedX = landings[slot * 2]
            const landedY = landings[slot * 2 + 1]
            const x = column * cellWidth + (landedX - column * cellWidth) * fold
            const y = row * cellHeight + (landedY - row * cellHeight) * fold

            ctx.globalAlpha = 1
            // the characters take the strip's ink before they land, so what
            // settles is already the strip's own colour
            ctx.fillStyle = mixPacked(colorBuffer[index], STRIP_INK, clamp(fold * 1.35, 0, 1))
            ctx.fillText(glyphAt(code), x, y)
          }
        }
        ctx.globalAlpha = 1
      }

      // the strip is allowed to finish and stand for a moment before the booth
      // comes up over it
      if (folding >= 1 && !leavingRef.current) {
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
    if (foldFromRef.current !== null) return
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
    // a tap rather than a turn: pack the tree into a strip and open the booth
    if (drag.travel < 6 && foldFromRef.current === null) {
      foldFromRef.current = performance.now()
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
