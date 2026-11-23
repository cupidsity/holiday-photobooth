// the grain, flecks and halation that make a strip read as film on paper
// rather than a photograph in a frame

export const GRAIN_TILE = 128

let grainUrl: string | null = null
let grainTile: HTMLCanvasElement | null = null
let mottleTile: HTMLCanvasElement | null = null

// `spread` is how far the noise wanders from mid grey: the fine tile is tight
// and reads as film grain, the coarse one is loose and reads as the paper's
// own unevenness
function buildTile(size: number, spread: number, blocky: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(size, size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const cell = blocky > 1 ? Math.floor(x / blocky) * 7919 + Math.floor(y / blocky) * 104729 : x * 7919 + y * 104729
      const noise = Math.abs(Math.sin(cell * 0.000317) * 43758.5453) % 1
      const value = 128 + (noise - 0.5) * spread
      const offset = (y * size + x) * 4
      image.data[offset] = value
      image.data[offset + 1] = value
      image.data[offset + 2] = value
      image.data[offset + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

export function grainCanvas(): HTMLCanvasElement {
  if (!grainTile) grainTile = buildTile(GRAIN_TILE, 96, 1)
  return grainTile
}

function mottleCanvas(): HTMLCanvasElement {
  if (!mottleTile) mottleTile = buildTile(GRAIN_TILE, 52, 7)
  return mottleTile
}

export function grainDataUrl(): string {
  if (!grainUrl) grainUrl = grainCanvas().toDataURL('image/png')
  return grainUrl
}

export type PaperLook = {
  // 0 leaves the print smooth, 1 is a heavily textured rag paper
  paper: number
}

export function grainOpacity(paper: number): number {
  return 0.2 + paper * 0.45
}

export function layGrain(ctx: CanvasRenderingContext2D, width: number, height: number, look: PaperLook) {
  if (look.paper <= 0.01) return

  const mottle = ctx.createPattern(mottleCanvas(), 'repeat')
  if (mottle) {
    ctx.save()
    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = 0.1 + look.paper * 0.22
    ctx.fillStyle = mottle
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  }

  const grain = ctx.createPattern(grainCanvas(), 'repeat')
  if (grain) {
    ctx.save()
    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = grainOpacity(look.paper)
    ctx.fillStyle = grain
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  }
}

// the pale flecks where the emulsion never took, which every real print has
export function laySpeckle(ctx: CanvasRenderingContext2D, width: number, height: number, look: PaperLook) {
  if (look.paper <= 0.01) return
  const count = Math.round(width * height * 0.0006 * (0.4 + look.paper))
  ctx.save()
  ctx.globalCompositeOperation = 'lighten'
  for (let index = 0; index < count; index += 1) {
    const x = Math.random() * width
    const y = Math.random() * height
    const radius = Math.random() < 0.85 ? Math.random() * 1.1 + 0.25 : Math.random() * 2.4 + 0.9
    ctx.globalAlpha = 0.2 + Math.random() * 0.55
    ctx.fillStyle = '#f4f9ff'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// film bleeds light out of its highlights. blurring the photo back over itself
// is the cheap honest version of that halation, and it is what stops a filtered
// photo looking like a photo with a colour filter on it
export function layHalation(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  amount: number,
) {
  if (amount <= 0.01 || !('filter' in ctx)) return
  ctx.save()
  ctx.beginPath()
  ctx.rect(rect.x, rect.y, rect.width, rect.height)
  ctx.clip()
  ctx.filter = `blur(${Math.max(2, rect.width * 0.018)}px)`
  ctx.globalCompositeOperation = 'lighten'
  ctx.globalAlpha = 0.1 + amount * 0.22
  ctx.drawImage(ctx.canvas, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height)
  ctx.restore()
}

// the edges of a hand-coated sheet always take less light than the middle
export function layVignette(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  amount: number,
) {
  if (amount <= 0.01) return
  const gradient = ctx.createRadialGradient(
    rect.x + rect.width / 2,
    rect.y + rect.height / 2,
    Math.min(rect.width, rect.height) * 0.3,
    rect.x + rect.width / 2,
    rect.y + rect.height / 2,
    Math.max(rect.width, rect.height) * 0.75,
  )
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
  gradient.addColorStop(1, `rgba(8, 14, 22, ${0.16 + amount * 0.2})`)
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = gradient
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
  ctx.restore()
}
