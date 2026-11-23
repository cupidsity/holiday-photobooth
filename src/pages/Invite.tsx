import { useEffect, useMemo, useRef, useState } from 'react'
import { PALETTE, TreePoint, buildSnow, buildTree3D } from '../invite/tree3d'
import { codeGrid } from '../invite/qr'
import { BOOTH_NAME, PARTY_NAME, PARTY_YEAR, boothUrl } from '../lib/config'
import '../styles/invite.css'

const QUIET_MODULES = 4
const FOCAL = 850

// one full cycle of the invite, in milliseconds
const HOLD_TREE = 9000
const TURN = 2600
const HOLD_CODE = 9000
const CYCLE = HOLD_TREE + TURN + HOLD_CODE + TURN

type Lock = 'auto' | 'tree' | 'code'

type Landing = {
  // where this glyph ends up once the code has formed, in module coordinates
  column: number
  row: number
}

function easeInOut(progress: number): number {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

// 0 is the tree turning, 1 is the code formed and held
function formedAt(elapsed: number): number {
  const time = elapsed % CYCLE
  if (time < HOLD_TREE) return 0
  if (time < HOLD_TREE + TURN) return easeInOut((time - HOLD_TREE) / TURN)
  if (time < HOLD_TREE + TURN + HOLD_CODE) return 1
  return 1 - easeInOut((time - HOLD_TREE - TURN - HOLD_CODE) / TURN)
}

function parseHex(hex: string): [number, number, number] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number]
}

function mixHex(from: string, to: string, amount: number): string {
  const [fromRed, fromGreen, fromBlue] = parseHex(from)
  const [toRed, toGreen, toBlue] = parseHex(to)
  const blend = (left: number, right: number) => Math.round(left + (right - left) * amount)
  return `rgb(${blend(fromRed, toRed)}, ${blend(fromGreen, toGreen)}, ${blend(fromBlue, toBlue)})`
}

/**
 * every dark module of the code is handed the tree glyph that is already
 * nearest to where it needs to land, measured on the tree's own axis. the
 * assignment is made once, so each glyph flies a short, steady path into place
 * instead of swapping with its neighbours every frame.
 */
function assignLandings(points: TreePoint[], cells: Landing[], size: number, height: number): (Landing | null)[] {
  const landings: (Landing | null)[] = points.map(() => null)
  const taken = new Set<number>()
  const spread = height * 0.75

  for (const cell of cells) {
    // the module's place on the tree's own scale, so the match is made in one
    // coordinate system
    const wantX = ((cell.column - (size - 1) / 2) / size) * spread
    const wantY = ((cell.row - (size - 1) / 2) / size) * spread
    let best = -1
    let bestGap = Infinity
    for (let index = 0; index < points.length; index += 1) {
      if (taken.has(index)) continue
      const point = points[index]
      const gap = (point.x - wantX) ** 2 + (point.y - wantY) ** 2 + point.z ** 2 * 0.25
      if (gap < bestGap) {
        bestGap = gap
        best = index
      }
    }
    if (best < 0) break
    taken.add(best)
    landings[best] = cell
  }
  return landings
}

export function Invite() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lockRef = useRef<Lock>('auto')
  const dragRef = useRef<{ pointerId: number; lastX: number; lastTime: number } | null>(null)
  const angleRef = useRef(0.34)
  const velocityRef = useRef(0)
  const spinRef = useRef(true)
  const [lock, setLock] = useState<Lock>('auto')
  const [showingCode, setShowingCode] = useState(false)
  const url = useMemo(boothUrl, [])
  const grid = useMemo(() => codeGrid(url), [url])

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
    let previous = startedAt
    let frame = 0
    let lastCodeState: boolean | null = null

    const TREE_HEIGHT = 1000
    const tree = buildTree3D(TREE_HEIGHT)
    const snow = buildSnow(150)
    const landings = assignLandings(tree.points, grid.cells, grid.size, TREE_HEIGHT)
    const order = Array.from({ length: tree.points.length }, (_item, index) => index)

    let width = 0
    let height = 0

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const bounds = canvas.getBoundingClientRect()
      width = bounds.width
      height = bounds.height
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const draw = (now: number) => {
      const delta = Math.min(0.05, (now - previous) / 1000)
      previous = now

      const current = lockRef.current
      const formed =
        current === 'auto' ? formedAt(now - startedAt) : current === 'code' ? 1 : 0

      const isCode = formed > 0.6
      if (isCode !== lastCodeState) {
        lastCodeState = isCode
        setShowingCode(isCode)
      }

      // the tree keeps turning while it is a tree, and holds still from the
      // moment the glyphs start moving into the code
      const turning = 1 - formed
      if (!reducedMotion) {
        const wanted = spinRef.current && !dragRef.current ? 0.32 : 0
        velocityRef.current += (wanted - velocityRef.current) * Math.min(1, delta * 2.4)
        angleRef.current += velocityRef.current * delta * turning
      }

      ctx.fillStyle = mixHex(PALETTE.night, PALETTE.paper, formed)
      ctx.fillRect(0, 0, width, height)

      const scale = Math.min(width / 760, height / 1180)
      const centerX = width / 2
      const centerY = height / 2
      const cell = Math.min(width / (grid.size + QUIET_MODULES * 2), height / (grid.size + QUIET_MODULES * 2))
      const angleCos = Math.cos(angleRef.current)
      const angleSin = Math.sin(angleRef.current)
      const settle = easeInOut(clamp01((formed - 0.05) / 0.9))

      // snow falls while the tree is up and clears as the code forms
      if (turning > 0.01) {
        ctx.save()
        ctx.fillStyle = PALETTE.snow
        for (const flake of snow) {
          flake.y = (flake.y + flake.fall * delta) % 1
          const driftX = (flake.x + Math.sin(now * 0.0003 + flake.y * 9) * 0.01 * flake.drift) % 1
          ctx.globalAlpha = 0.5 * turning
          ctx.beginPath()
          ctx.arc(driftX * width, flake.y * height, flake.size, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      const projected = order.map((index) => {
        const point = tree.points[index]
        const spunX = point.x * angleCos - point.z * angleSin
        const spunZ = point.x * angleSin + point.z * angleCos
        const perspective = FOCAL / (FOCAL - spunZ * scale)
        const treeX = centerX + spunX * scale * perspective
        const treeY = centerY + point.y * scale * perspective
        const landing = landings[index]

        let targetX = treeX
        let targetY = treeY
        if (landing) {
          targetX = centerX + (landing.column - (grid.size - 1) / 2) * cell
          targetY = centerY + (landing.row - (grid.size - 1) / 2) * cell
        }

        return {
          index,
          point,
          depth: spunZ,
          perspective,
          // a glyph with nowhere to land simply falls away as the code forms
          screenX: treeX + (targetX - treeX) * settle,
          screenY: treeY + (targetY - treeY) * settle,
          landing,
        }
      })

      projected.sort((left, right) => left.depth - right.depth)

      const baseSize = 11 * scale
      let currentFont = 0
      for (const seat of projected) {
        const { point, landing } = seat
        if (!landing && settle > 0.98) continue

        const depthLight = clamp01((seat.depth + tree.radius * 1.4) / (tree.radius * 2.8))
        const twinkle =
          point.kind === 'light' ? 0.52 + 0.48 * (0.5 + 0.5 * Math.sin(now * 0.004 + point.phase)) : 1
        const fade = landing ? 1 : 1 - settle
        const size = Math.max(
          5,
          Math.round(baseSize * point.weight * (seat.perspective * turning + settle) * 2) / 2,
        )
        if (size !== currentFont) {
          currentFont = size
          ctx.font = `700 ${size}px "IBM Plex Mono", ui-monospace, monospace`
        }

        ctx.globalAlpha = (0.34 + depthLight * 0.66) * twinkle * fade
        ctx.fillStyle = mixHex(point.color, PALETTE.ink, settle)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(point.glyph, seat.screenX, seat.screenY)

        // once everything has arrived the glyphs give way to solid modules, so
        // the last frame is a code a phone can actually read
        if (settle > 0.86 && landing) {
          ctx.globalAlpha = clamp01((settle - 0.86) / 0.14)
          ctx.fillStyle = PALETTE.ink
          ctx.fillRect(
            Math.round(seat.screenX - cell / 2),
            Math.round(seat.screenY - cell / 2),
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
  }, [grid])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault()
        spinRef.current = !spinRef.current
      }
      if (event.key === 'ArrowUp') setLock('code')
      if (event.key === 'ArrowDown') setLock('tree')
      if (event.key === 'Escape') setLock('auto')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function startDrag(event: React.PointerEvent) {
    dragRef.current = { pointerId: event.pointerId, lastX: event.clientX, lastTime: performance.now() }
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }

  function moveDrag(event: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const now = performance.now()
    const travel = event.clientX - drag.lastX
    angleRef.current += travel * 0.009
    const elapsed = Math.max(1, now - drag.lastTime)
    velocityRef.current = Math.max(-4, Math.min(4, (travel * 0.009 * 1000) / elapsed))
    drag.lastX = event.clientX
    drag.lastTime = now
  }

  function endDrag(event: React.PointerEvent) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  return (
    <div className="invite">
      <div
        className={`invite-card${showingCode ? ' formed' : ''}`}
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
          <p className="invite-hint">
            {showingCode ? 'Scan it to start your strip' : 'Drag the tree. Watch what it becomes.'}
          </p>
          <p className="invite-url">{url.replace(/^https?:\/\//, '')}</p>
        </footer>
      </div>
    </div>
  )
}
