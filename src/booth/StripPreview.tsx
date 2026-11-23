import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import { PlacedSticker, StripOptions, captionFamily, ensureFonts, renderStripBase } from '../lib/render'
import { GRAIN_TILE, grainDataUrl, grainOpacity } from '../lib/paper'
import { STRIP } from '../lib/strip'
import { LiftIcon, ResizeIcon } from './icons'

type Props = {
  options: StripOptions
  selectedKey: string | null
  onSelect: (key: string | null) => void
  onChange: (stickers: PlacedSticker[]) => void
}

type DragKind = 'move' | 'transform'

type Drag = {
  kind: DragKind
  key: string
  pointerId: number
  // where the pointer sat relative to the sticker centre when the drag began,
  // so the sticker does not jump under the finger
  offsetX: number
  offsetY: number
  startSize: number
  startRotation: number
  startAngle: number
  startDistance: number
}

const MIN_SIZE = 0.05
const MAX_SIZE = 0.9

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

export function StripPreview({ options, selectedKey, onSelect, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [surfaceWidth, setSurfaceWidth] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = STRIP.width
    canvas.height = STRIP.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let stale = false
    ensureFonts().then(() => {
      if (stale) return
      ctx.clearRect(0, 0, STRIP.width, STRIP.height)
      return renderStripBase(ctx, options, true)
    })
    return () => {
      stale = true
    }
  }, [options])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const measure = () => setSurfaceWidth(surface.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(surface)
    return () => observer.disconnect()
  }, [])

  function stickerByKey(key: string): PlacedSticker | undefined {
    return options.stickers.find((sticker) => sticker.key === key)
  }

  function updateSticker(key: string, patch: Partial<PlacedSticker>) {
    onChange(options.stickers.map((sticker) => (sticker.key === key ? { ...sticker, ...patch } : sticker)))
  }

  function beginDrag(event: ReactPointerEvent, key: string, kind: DragKind) {
    const surface = surfaceRef.current
    const sticker = stickerByKey(key)
    if (!surface || !sticker) return
    event.stopPropagation()
    const rect = surface.getBoundingClientRect()
    const centerX = rect.left + sticker.x * rect.width
    const centerY = rect.top + sticker.y * rect.height
    const pointerX = event.clientX - centerX
    const pointerY = event.clientY - centerY
    dragRef.current = {
      kind,
      key,
      pointerId: event.pointerId,
      offsetX: pointerX,
      offsetY: pointerY,
      startSize: sticker.size,
      startRotation: sticker.rotation,
      startAngle: Math.atan2(pointerY, pointerX),
      startDistance: Math.hypot(pointerX, pointerY) || 1,
    }
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    onSelect(key)
  }

  function handlePointerMove(event: ReactPointerEvent) {
    const drag = dragRef.current
    const surface = surfaceRef.current
    if (!drag || !surface || drag.pointerId !== event.pointerId) return
    const sticker = stickerByKey(drag.key)
    if (!sticker) return
    const rect = surface.getBoundingClientRect()

    if (drag.kind === 'move') {
      const x = (event.clientX - drag.offsetX - rect.left) / rect.width
      const y = (event.clientY - drag.offsetY - rect.top) / rect.height
      updateSticker(drag.key, { x: clamp(x, 0, 1), y: clamp(y, 0, 1) })
      return
    }

    // the transform handle turns distance from the sticker centre into size and
    // the angle swept since grabbing it into rotation
    const centerX = rect.left + sticker.x * rect.width
    const centerY = rect.top + sticker.y * rect.height
    const pointerX = event.clientX - centerX
    const pointerY = event.clientY - centerY
    const distance = Math.hypot(pointerX, pointerY) || 1
    const angle = Math.atan2(pointerY, pointerX)
    updateSticker(drag.key, {
      size: clamp((drag.startSize * distance) / drag.startDistance, MIN_SIZE, MAX_SIZE),
      rotation: drag.startRotation + (angle - drag.startAngle),
    })
  }

  function endDrag(event: ReactPointerEvent) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  const previewHeight = surfaceWidth * (STRIP.height / STRIP.width)
  const grainScale = surfaceWidth ? (GRAIN_TILE * surfaceWidth) / STRIP.width : GRAIN_TILE

  return (
    <div
      className="strip-surface"
      ref={surfaceRef}
      onPointerDown={() => onSelect(null)}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ height: previewHeight ? `${previewHeight}px` : undefined }}
    >
      <canvas ref={canvasRef} className="strip-canvas" />

      {options.stickers.map((sticker) => {
        const pixelSize = sticker.size * surfaceWidth
        const selected = sticker.key === selectedKey
        return (
          <div
            key={sticker.key}
            className={`pressed${selected ? ' selected' : ''}${sticker.text ? ' word' : ''}`}
            style={{
              left: `${sticker.x * 100}%`,
              top: `${sticker.y * 100}%`,
              width: sticker.text ? undefined : `${pixelSize}px`,
              fontSize: sticker.text ? `${pixelSize}px` : undefined,
              fontFamily: sticker.text ? captionFamily(options.captionFace) : undefined,
              fontWeight: sticker.text && options.captionFace === 'script' ? 700 : 400,
              color: sticker.text ? options.frame.ink : undefined,
              transform: `translate(-50%, -50%) rotate(${sticker.rotation}rad)`,
            }}
            onPointerDown={(event) => beginDrag(event, sticker.key, 'move')}
          >
            {sticker.text ? sticker.text : <img src={sticker.src} alt="" draggable={false} />}

            {selected && (
              <>
                <button
                  className="sticker-handle remove"
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    onChange(options.stickers.filter((item) => item.key !== sticker.key))
                    onSelect(null)
                  }}
                  aria-label="lift this one off"
                >
                  <LiftIcon />
                </button>
                <button
                  className="sticker-handle transform"
                  onPointerDown={(event) => beginDrag(event, sticker.key, 'transform')}
                  aria-label="resize and turn"
                >
                  <ResizeIcon />
                </button>
              </>
            )}
          </div>
        )
      })}

      {options.frame.src && <img className="strip-frame-art" src={options.frame.src} alt="" draggable={false} />}

      <div
        className="strip-grain"
        aria-hidden="true"
        style={{
          backgroundImage: `url(${grainDataUrl()})`,
          backgroundSize: `${grainScale}px ${grainScale}px`,
          opacity: grainOpacity(options.paper),
        }}
      />
    </div>
  )
}
