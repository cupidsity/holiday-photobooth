import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import { PALETTE, buildField, buildSnow, buildTree, glyphAt, rasterise } from '../invite/asciiTree'
import { BOOTH_NAME, PARTY_NAME, PARTY_YEAR, boothUrl } from '../lib/config'
import '../styles/invite.css'

const FOCAL = 900
// how long the tree takes to grow in when the screen is first opened
const REVEAL_MS = 3200
const AUTO_SPIN = 0.32
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

export function Invite() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ pointerId: number; lastX: number; lastY: number; lastTime: number } | null>(null)
  const angleRef = useRef(0.34)
  const pitchRef = useRef(0)
  const velocityRef = useRef(0)
  const spinRef = useRef(true)
  const revealFromRef = useRef(performance.now())
  const [spinning, setSpinning] = useState(true)
  const [readout, setReadout] = useState({ rotation: 0, lights: 0, letters: 0 })
  const url = boothUrl()

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
    const tree = buildTree(TREE_HEIGHT, lightweight ? 0.6 : 1)
    const snow = buildSnow(lightweight ? 70 : 150)
    const field = buildField(lightweight ? 260 : 620)

    let previous = performance.now()
    let frame = 0
    let lastReadout = 0

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

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const bounds = canvas.getBoundingClientRect()
      width = bounds.width
      height = bounds.height
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

      // the grid is set from the rows, not the columns: a character cell is
      // 0.6em wide and a little over 1em tall, so spacing the rows any tighter
      // is what makes glyphs sit on top of each other
      const wantedRows = lightweight ? 46 : 64
      cellHeight = Math.max(8, height / wantedRows)
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

      if (!reducedMotion) {
        if (dragRef.current) {
          // while a finger is down the drag owns the rotation
        } else if (spinRef.current) {
          velocityRef.current += (AUTO_SPIN - velocityRef.current) * Math.min(1, delta * 1.6)
        } else {
          // let a flick run on and die away instead of stopping dead
          velocityRef.current *= Math.pow(0.12, delta)
        }
        angleRef.current += velocityRef.current * delta
      }

      ctx.fillStyle = PALETTE.night
      ctx.fillRect(0, 0, width, height)

      // the tree is taller than its own height: the star sits above the cone and
      // the parcels sit below it, and perspective magnifies whatever is nearest.
      // fit all of that, or the foot of the tree runs off the bottom
      const scale = Math.min(width / 1320, height / 1380)
      const centerX = width / 2
      const centerY = height * 0.52
      const reveal = clamp((now - revealFromRef.current) / REVEAL_MS, 0, 1)

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `${fontSize}px "IBM Plex Mono", ui-monospace, monospace` // taste-skill-ignore

      ctx.fillStyle = PALETTE.rule
      ctx.globalAlpha = 0.5 * reveal
      for (let row = 4; row < rows; row += 9) {
        for (let column = 2; column < columns; column += 4) {
          ctx.fillText(column % 8 === 2 ? '-' : '.', column * cellWidth, row * cellHeight)
        }
      }

      ctx.fillStyle = PALETTE.field
      for (const mark of field) {
        ctx.globalAlpha = (0.2 + mark.dim) * reveal
        ctx.fillText(mark.glyph, mark.x * width, mark.y * height)
      }

      ctx.fillStyle = PALETTE.snow
      for (const flake of snow) {
        flake.y = (flake.y + flake.fall * delta) % 1
        const driftX = (flake.x + Math.sin(now * 0.0003 + flake.y * 9) * 0.01 * flake.drift) % 1
        ctx.globalAlpha = 0.25 + flake.size * 0.2
        ctx.fillText(flake.size > 1.4 ? '*' : '·', driftX * width, flake.y * height)
      }

      const filled = rasterise(
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

      ctx.globalAlpha = 1
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const index = row * columns + column
          const code = glyphBuffer[index]
          if (code <= 0) continue
          ctx.fillStyle = packedToCss(colorBuffer[index])
          ctx.fillText(glyphAt(code), column * cellWidth, row * cellHeight)
        }
      }

      if (now - lastReadout > 220) {
        lastReadout = now
        const turns = ((angleRef.current * 180) / Math.PI) % 360
        setReadout({
          rotation: turns < 0 ? turns + 360 : turns,
          lights: tree.lightCount,
          letters: filled,
        })
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
        setSpinning(spinRef.current)
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
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
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
    drag.lastX = event.clientX
    drag.lastY = event.clientY
    drag.lastTime = now
  }

  function endDrag(event: ReactPointerEvent) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    // a flick hands the tree back to its own momentum rather than the clock
    if (Math.abs(velocityRef.current) > 0.6) {
      spinRef.current = false
      setSpinning(false)
    }
  }

  return (
    <div className="invite">
      <div
        className="invite-card"
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
        </header>

        <canvas ref={canvasRef} className="invite-canvas" />

        <footer className="invite-foot">
          <p className="invite-readout">
            rotation {readout.rotation.toFixed(2)}° · lights {readout.lights} · letters{' '}
            {readout.letters.toLocaleString()} · {spinning ? 'spinning' : 'held'}
          </p>
          <p className="invite-hint">Drag to turn it. Drag down to look over the top.</p>
          <p className="invite-url">{url.replace(/^https?:\/\//, '')}</p>
        </footer>
      </div>
    </div>
  )
}
