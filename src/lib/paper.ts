// the grain, specks and soft edges that make a strip read as a print on paper
// rather than a photo in a frame

let grainUrl: string | null = null
let grainTile: HTMLCanvasElement | null = null

export const GRAIN_TILE = 128

function buildTile(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = GRAIN_TILE
  canvas.height = GRAIN_TILE
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(GRAIN_TILE, GRAIN_TILE)
  for (let offset = 0; offset < image.data.length; offset += 4) {
    // a tight spread around mid grey, so the tile does nothing on its own and
    // only bites once it is blended
    const value = 118 + Math.random() * 62
    image.data[offset] = value
    image.data[offset + 1] = value
    image.data[offset + 2] = value
    image.data[offset + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

export function grainCanvas(): HTMLCanvasElement {
  if (!grainTile) grainTile = buildTile()
  return grainTile
}

export function grainDataUrl(): string {
  if (!grainUrl) grainUrl = grainCanvas().toDataURL('image/png')
  return grainUrl
}

export type PaperLook = {
  // 0 leaves the print smooth, 1 is a heavily textured rag paper
  paper: number
}

// the pale flecks where the emulsion never took, which every real sunprint has
function speckle(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) {
  const count = Math.round(width * height * 0.00035 * amount)
  ctx.save()
  ctx.globalCompositeOperation = 'lighten'
  for (let index = 0; index < count; index += 1) {
    const x = Math.random() * width
    const y = Math.random() * height
    const radius = Math.random() * 1.6 + 0.3
    ctx.globalAlpha = 0.25 + Math.random() * 0.5
    ctx.fillStyle = '#eef6ff'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function grainOpacity(paper: number): number {
  return 0.18 + paper * 0.4
}

export function layGrain(ctx: CanvasRenderingContext2D, width: number, height: number, look: PaperLook) {
  if (look.paper <= 0.01) return
  const pattern = ctx.createPattern(grainCanvas(), 'repeat')
  if (!pattern) return
  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = grainOpacity(look.paper)
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

export function laySpeckle(ctx: CanvasRenderingContext2D, width: number, height: number, look: PaperLook) {
  if (look.paper <= 0.01) return
  speckle(ctx, width, height, look.paper)
}
