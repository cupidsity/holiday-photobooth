// the blends that behave the same in canvas and css, so a wash looks identical
// in the live preview and on the exported strip
export type StripWash = 'soft-light' | 'overlay' | 'multiply' | 'screen'

export type FilterParams = {
  brightness: number
  contrast: number
  saturate: number
  sepia: number
  grayscale: number
  hueRotate: number
}

export type PhotoFilter = {
  id: string
  name: string
  params: Partial<FilterParams>
  // a flat wash painted over the photo after the colour work, which is how the
  // warmer presets get their tint without crushing the whites
  wash?: { color: string; blend: StripWash; alpha: number }
}

const NEUTRAL: FilterParams = {
  brightness: 1,
  contrast: 1,
  saturate: 1,
  sepia: 0,
  grayscale: 0,
  hueRotate: 0,
}

export const FILTERS: PhotoFilter[] = [
  { id: 'plain', name: 'as-is', params: {} },
  {
    id: 'noel',
    name: 'noel',
    params: { sepia: 0.3, saturate: 1.3, contrast: 1.05, brightness: 1.04 },
    wash: { color: '#ff7a4d', blend: 'soft-light', alpha: 0.28 },
  },
  {
    id: 'frost',
    name: 'frost',
    params: { saturate: 0.85, brightness: 1.08, contrast: 0.95, hueRotate: 185 },
    wash: { color: '#9fd8ff', blend: 'soft-light', alpha: 0.35 },
  },
  {
    id: 'cocoa',
    name: 'cocoa',
    params: { sepia: 0.55, saturate: 1.15, contrast: 1.1, brightness: 0.98 },
    wash: { color: '#7b3f1d', blend: 'soft-light', alpha: 0.3 },
  },
  {
    id: 'candycane',
    name: 'candy cane',
    params: { saturate: 1.6, contrast: 1.15, brightness: 1.05 },
    wash: { color: '#ff2b4a', blend: 'soft-light', alpha: 0.24 },
  },
  { id: 'noir', name: 'north pole noir', params: { grayscale: 1, contrast: 1.25, brightness: 1.05 } },
  {
    id: 'twinkle',
    name: 'twinkle',
    params: { brightness: 1.14, contrast: 0.92, saturate: 1.2 },
    wash: { color: '#ffd98a', blend: 'overlay', alpha: 0.32 },
  },
]

export function filterById(id: string): PhotoFilter {
  return FILTERS.find((filter) => filter.id === id) ?? FILTERS[0]
}

function resolve(filter: PhotoFilter): FilterParams {
  return { ...NEUTRAL, ...filter.params }
}

// one string that drives both the css preview and ctx.filter, so what the
// camera shows is what lands on the strip
export function cssFilter(filter: PhotoFilter): string {
  const params = resolve(filter)
  const parts: string[] = []
  if (params.grayscale) parts.push(`grayscale(${params.grayscale})`)
  if (params.sepia) parts.push(`sepia(${params.sepia})`)
  if (params.hueRotate) parts.push(`hue-rotate(${params.hueRotate}deg)`)
  if (params.saturate !== 1) parts.push(`saturate(${params.saturate})`)
  if (params.contrast !== 1) parts.push(`contrast(${params.contrast})`)
  if (params.brightness !== 1) parts.push(`brightness(${params.brightness})`)
  return parts.length ? parts.join(' ') : 'none'
}

let canvasFilterSupport: boolean | null = null

export function supportsCanvasFilter(): boolean {
  if (canvasFilterSupport !== null) return canvasFilterSupport
  const probe = document.createElement('canvas').getContext('2d')
  canvasFilterSupport = !!probe && 'filter' in probe
  return canvasFilterSupport
}

const SATURATION_WEIGHTS = { red: 0.213, green: 0.715, blue: 0.072 }

function clamp255(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value
}

// pixel-by-pixel stand-in for ctx.filter, matching the css filter spec closely
// enough that older safari builds still get the right looking strip
function applyParamsManually(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; width: number; height: number }, filter: PhotoFilter) {
  const params = resolve(filter)
  const image = ctx.getImageData(rect.x, rect.y, rect.width, rect.height)
  const pixels = image.data
  const hueRadians = (params.hueRotate * Math.PI) / 180
  const hueCos = Math.cos(hueRadians)
  const hueSin = Math.sin(hueRadians)

  for (let offset = 0; offset < pixels.length; offset += 4) {
    let red = pixels[offset]
    let green = pixels[offset + 1]
    let blue = pixels[offset + 2]

    if (params.grayscale) {
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
      red += (luminance - red) * params.grayscale
      green += (luminance - green) * params.grayscale
      blue += (luminance - blue) * params.grayscale
    }

    if (params.sepia) {
      const sepiaRed = 0.393 * red + 0.769 * green + 0.189 * blue
      const sepiaGreen = 0.349 * red + 0.686 * green + 0.168 * blue
      const sepiaBlue = 0.272 * red + 0.534 * green + 0.131 * blue
      red += (sepiaRed - red) * params.sepia
      green += (sepiaGreen - green) * params.sepia
      blue += (sepiaBlue - blue) * params.sepia
    }

    if (params.hueRotate) {
      const rotatedRed =
        red * (0.213 + hueCos * 0.787 - hueSin * 0.213) +
        green * (0.715 - hueCos * 0.715 - hueSin * 0.715) +
        blue * (0.072 - hueCos * 0.072 + hueSin * 0.928)
      const rotatedGreen =
        red * (0.213 - hueCos * 0.213 + hueSin * 0.143) +
        green * (0.715 + hueCos * 0.285 + hueSin * 0.14) +
        blue * (0.072 - hueCos * 0.072 - hueSin * 0.283)
      const rotatedBlue =
        red * (0.213 - hueCos * 0.213 - hueSin * 0.787) +
        green * (0.715 - hueCos * 0.715 + hueSin * 0.715) +
        blue * (0.072 + hueCos * 0.928 + hueSin * 0.072)
      red = rotatedRed
      green = rotatedGreen
      blue = rotatedBlue
    }

    if (params.saturate !== 1) {
      const luminance =
        SATURATION_WEIGHTS.red * red + SATURATION_WEIGHTS.green * green + SATURATION_WEIGHTS.blue * blue
      red = luminance + (red - luminance) * params.saturate
      green = luminance + (green - luminance) * params.saturate
      blue = luminance + (blue - luminance) * params.saturate
    }

    if (params.contrast !== 1) {
      const shift = 127.5 * (1 - params.contrast)
      red = red * params.contrast + shift
      green = green * params.contrast + shift
      blue = blue * params.contrast + shift
    }

    if (params.brightness !== 1) {
      red *= params.brightness
      green *= params.brightness
      blue *= params.brightness
    }

    pixels[offset] = clamp255(red)
    pixels[offset + 1] = clamp255(green)
    pixels[offset + 2] = clamp255(blue)
  }

  ctx.putImageData(image, rect.x, rect.y)
}

// runs the colour work on a rect that has already been drawn, picking the
// native path when the browser has one
export function developPhoto(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  filter: PhotoFilter,
  nativeFilterAlreadyApplied: boolean,
) {
  if (!nativeFilterAlreadyApplied) applyParamsManually(ctx, rect, filter)
  if (!filter.wash) return
  ctx.save()
  ctx.beginPath()
  ctx.rect(rect.x, rect.y, rect.width, rect.height)
  ctx.clip()
  ctx.globalCompositeOperation = filter.wash.blend
  ctx.globalAlpha = filter.wash.alpha
  ctx.fillStyle = filter.wash.color
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
  ctx.restore()
}
