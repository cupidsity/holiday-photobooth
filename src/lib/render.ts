import { Frame, loadImage } from './assets'
import { PhotoFilter, cssFilter, developPhoto, supportsCanvasFilter, withExposure } from './filters'
import { layGrain, layHalation, laySpeckle, layVignette, stampCanvas } from './paper'
import { FOOTER_HEIGHT, FOOTER_TOP, STRIP, drawCover, photoRect } from './strip'

export type CaptionFace = 'script' | 'serif'

export type PlacedSticker = {
  // unique per placement, not per sticker kind, since the same sticker can be
  // pressed onto the strip more than once
  key: string
  stickerId: string
  src?: string
  text?: string
  // centre position as a fraction of the strip, so the preview and the export
  // agree no matter what size the preview is drawn at
  x: number
  y: number
  // for a silhouette this is the width as a fraction of the strip width, for a
  // word it is the font size as a fraction of the strip width
  size: number
  rotation: number
}

export type StripOptions = {
  shots: (HTMLCanvasElement | null)[]
  frame: Frame
  filter: PhotoFilter
  // how long the print sat in the sun: deeper blue, more contrast
  exposure: number
  // how much the paper's grain and flecks come through
  paper: number
  caption: string
  subcaption: string
  captionFace: CaptionFace
  stickers: PlacedSticker[]
}

export const SCRIPT_FONT = '"Caveat", "Brush Script MT", cursive'
export const SERIF_FONT = '"Instrument Serif", "Iowan Old Style", Georgia, serif'

export function captionFamily(face: CaptionFace): string {
  return face === 'script' ? SCRIPT_FONT : SERIF_FONT
}

export async function ensureFonts() {
  if (!document.fonts) return
  try {
    await Promise.all([
      document.fonts.load('700 96px "Caveat"'),
      document.fonts.load('400 72px "Instrument Serif"'),
    ])
  } catch {
    // the caption just falls back to a system face
  }
}

function drawCaption(ctx: CanvasRenderingContext2D, options: StripOptions) {
  const { frame, caption, subcaption, captionFace } = options
  const family = captionFamily(captionFace)
  const centerX = STRIP.width / 2
  const baseY = FOOTER_TOP + FOOTER_HEIGHT / 2
  const bigSize = captionFace === 'script' ? 88 : 62
  const smallSize = captionFace === 'script' ? 46 : 32

  ctx.save()
  ctx.fillStyle = frame.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (caption.trim()) {
    ctx.font = `${captionFace === 'script' ? 700 : 400} ${bigSize}px ${family}`
    ctx.fillText(caption, centerX, baseY - 22, STRIP.width - STRIP.sidePadding * 2)
  }
  if (subcaption.trim()) {
    ctx.globalAlpha = 0.72
    ctx.font = `400 ${smallSize}px ${family}`
    ctx.fillText(subcaption, centerX, baseY + 46, STRIP.width - STRIP.sidePadding * 2)
  }
  ctx.restore()
}

function drawEmptyCell(ctx: CanvasRenderingContext2D, frame: Frame, index: number) {
  const rect = photoRect(index)
  ctx.save()
  ctx.globalAlpha = 0.14
  ctx.fillStyle = frame.ink
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
  ctx.restore()
}

async function drawSticker(ctx: CanvasRenderingContext2D, sticker: PlacedSticker, options: StripOptions) {
  const size = sticker.size * STRIP.width
  const centerX = sticker.x * STRIP.width
  const centerY = sticker.y * STRIP.height

  ctx.save()
  // a photogram does not sit on the print, it is part of it: lighten lets the
  // shape bleach the exposure underneath instead of painting over it
  ctx.globalCompositeOperation = 'lighten'
  ctx.translate(centerX, centerY)
  ctx.rotate(sticker.rotation)

  if (sticker.text) {
    ctx.font = `${options.captionFace === 'script' ? 700 : 400} ${size}px ${captionFamily(options.captionFace)}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = options.frame.ink
    ctx.fillText(sticker.text, 0, 0)
    ctx.restore()
    return
  }

  if (!sticker.src) {
    ctx.restore()
    return
  }

  try {
    const art = await loadImage(sticker.src)
    const aspect = art.naturalWidth && art.naturalHeight ? art.naturalHeight / art.naturalWidth : 1
    const width = Math.max(1, Math.round(size))
    const height = Math.max(1, Math.round(size * aspect))

    // the shape is inked on its own first and the stamp mask eats into it,
    // then it goes down in one piece: masking it on the strip would eat the
    // photograph underneath as well
    const inked = document.createElement('canvas')
    inked.width = width
    inked.height = height
    const inkedCtx = inked.getContext('2d')
    if (!inkedCtx) throw new Error('no 2d context for the stamp')
    inkedCtx.drawImage(art, 0, 0, width, height)
    const grain = inkedCtx.createPattern(stampCanvas(), 'repeat')
    if (grain) {
      inkedCtx.globalCompositeOperation = 'destination-in'
      inkedCtx.fillStyle = grain
      inkedCtx.fillRect(0, 0, width, height)
    }

    ctx.globalAlpha = 0.9
    ctx.drawImage(inked, -size / 2, (-size * aspect) / 2, size, size * aspect)
  } catch {
    // skip a sticker whose file disappeared rather than failing the export
  }
  ctx.restore()
}

// the preview leaves the silhouettes, the frame art and the grain to the dom so
// a sticker can still be dragged, and layers them in this same order on top
export async function renderStripBase(
  ctx: CanvasRenderingContext2D,
  options: StripOptions,
  forPreview = false,
) {
  const { shots, frame } = options
  const filter = withExposure(options.filter, options.exposure)
  const nativeFilter = supportsCanvasFilter()

  ctx.save()
  ctx.fillStyle = frame.background
  ctx.fillRect(0, 0, STRIP.width, STRIP.height)
  ctx.restore()

  for (let index = 0; index < STRIP.photoCount; index += 1) {
    const shot = shots[index]
    if (!shot) {
      drawEmptyCell(ctx, frame, index)
      continue
    }
    const rect = photoRect(index)
    ctx.save()
    if (nativeFilter) ctx.filter = cssFilter(filter)
    drawCover(ctx, shot, shot.width, shot.height, rect.x, rect.y, rect.width, rect.height)
    ctx.restore()
    developPhoto(ctx, rect, filter, nativeFilter)
    layHalation(ctx, rect, options.paper)
    layVignette(ctx, rect, options.paper)
  }

  drawCaption(ctx, options)
  laySpeckle(ctx, STRIP.width, STRIP.height, { paper: options.paper })
  if (forPreview) return

  for (const sticker of options.stickers) {
    await drawSticker(ctx, sticker, options)
  }

  if (frame.src) {
    try {
      const art = await loadImage(frame.src)
      if (frame.kind === 'photo') {
        for (let index = 0; index < STRIP.photoCount; index += 1) {
          if (!shots[index]) continue
          const rect = photoRect(index)
          ctx.drawImage(art, rect.x, rect.y, rect.width, rect.height)
        }
      } else {
        ctx.drawImage(art, 0, 0, STRIP.width, STRIP.height)
      }
    } catch {
      // a frame whose art went missing still prints as plain paper
    }
  }

  // the grain goes on last so it runs across photos, silhouettes and paper
  // alike, which is what stops anything looking stuck on afterwards
  layGrain(ctx, STRIP.width, STRIP.height, { paper: options.paper })
}

export async function renderStrip(options: StripOptions): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = STRIP.width
  canvas.height = STRIP.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('this browser will not give us a 2d canvas')

  await ensureFonts()
  await renderStripBase(ctx, options)
  return canvas
}
