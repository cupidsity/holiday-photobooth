import { Frame, loadImage } from './assets'
import { PhotoFilter, cssFilter, developPhoto, supportsCanvasFilter, withExposure } from './filters'
import { layGrain, layHalation, laySpeckle, layVignette, stampCanvas } from './paper'
import {
  DEFAULT_CAPTION_Y,
  DEFAULT_WINDOWS,
  STRIP,
  Window,
  artScale,
  bleedTop,
  drawCover,
  stripHeight,
} from './strip'

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

// one place for the caption's measurements, so the preview's own caption layer
// lands exactly where the exported one does
export function captionLayout(face: CaptionFace, scale = 1) {
  const base =
    face === 'script'
      ? { big: 92, small: 48, bigShift: -26, smallShift: 44, weight: 700 }
      : { big: 64, small: 34, bigShift: -26, smallShift: 44, weight: 400 }
  return {
    ...base,
    big: base.big * scale,
    small: base.small * scale,
    bigShift: base.bigShift * scale,
    smallShift: base.smallShift * scale,
  }
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

// a frame brings its own windows and caption line; the paper stocks fall back
// to the shape the drawn frames share
function windowsOf(frame: Frame): Window[] {
  return frame.windows ?? DEFAULT_WINDOWS
}

function drawCaption(ctx: CanvasRenderingContext2D, options: StripOptions) {
  const { frame, caption, subcaption, captionFace } = options
  if (frame.caption === null) return
  const family = captionFamily(captionFace)
  const centerX = STRIP.width / 2
  const baseY = frame.caption ?? DEFAULT_CAPTION_Y
  const metrics = captionLayout(captionFace, frame.captionScale ?? 1)

  ctx.save()
  ctx.fillStyle = frame.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (caption.trim()) {
    ctx.font = `${metrics.weight} ${metrics.big}px ${family}`
    ctx.fillText(caption, centerX, baseY + metrics.bigShift, STRIP.width - 120)
  }
  if (subcaption.trim()) {
    ctx.globalAlpha = 0.72
    ctx.font = `400 ${metrics.small}px ${family}`
    ctx.fillText(subcaption, centerX, baseY + metrics.smallShift, STRIP.width - 120)
  }
  ctx.restore()
}

async function drawSticker(ctx: CanvasRenderingContext2D, sticker: PlacedSticker, options: StripOptions) {
  const size = sticker.size * STRIP.width
  const centerX = sticker.x * STRIP.width
  const centerY = sticker.y * stripHeight(options.frame.art)

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

  const height = stripHeight(frame.art)
  // everything below sits on the strip itself; the art's overhang lives in the
  // space above it. the preview keeps the overhang in its own dom layer, so it
  // only needs the strip
  const bleed = forPreview ? 0 : bleedTop(frame.art)
  ctx.save()
  ctx.translate(0, bleed)
  if (frame.background) {
    ctx.save()
    ctx.fillStyle = frame.background
    ctx.fillRect(0, 0, STRIP.width, height)
    ctx.restore()
  }

  for (let index = 0; index < STRIP.photoCount; index += 1) {
    const shot = shots[index]
    // a window with no photo in it is left clear rather than tinted: the only
    // strip that has one is the blank sample on the first screen
    if (!shot) continue
    const rect = windowsOf(frame)[index]
    if (!rect) continue
    ctx.save()
    if (nativeFilter) ctx.filter = cssFilter(filter)
    drawCover(ctx, shot, shot.width, shot.height, rect.x, rect.y, rect.width, rect.height)
    ctx.restore()
    developPhoto(ctx, rect, filter, nativeFilter)
    layHalation(ctx, rect, options.paper)
    layVignette(ctx, rect, options.paper)
  }

  laySpeckle(ctx, STRIP.width, height, { paper: options.paper })
  if (forPreview) {
    ctx.restore()
    return
  }

  for (const sticker of options.stickers) {
    await drawSticker(ctx, sticker, options)
  }

  if (frame.src) {
    try {
      const art = await loadImage(frame.src)
      if (frame.kind === 'photo') {
        for (let index = 0; index < STRIP.photoCount; index += 1) {
          if (!shots[index]) continue
          const rect = windowsOf(frame)[index]
          if (rect) ctx.drawImage(art, rect.x, rect.y, rect.width, rect.height)
        }
      } else if (frame.art) {
        // a drawn frame is laid down cropped to its own bounds and scaled to
        // the strip's width, so the padding it was exported with never shows
        const scale = artScale(frame.art)
        ctx.drawImage(
          art,
          -frame.art.left * scale,
          -frame.art.top * scale,
          art.naturalWidth * scale,
          art.naturalHeight * scale,
        )
      } else {
        ctx.drawImage(art, 0, 0, STRIP.width, STRIP.height)
      }
    } catch {
      // a frame whose art went missing still prints as plain paper
    }
  }

  // the caption sits on the frame's own caption band, so it goes down after
  // the art rather than under it
  drawCaption(ctx, options)

  // the grain goes on last so it runs across photos, silhouettes and paper
  // alike, which is what stops anything looking stuck on afterwards
  layGrain(ctx, STRIP.width, height, { paper: options.paper })
  ctx.restore()
}

export async function renderStrip(options: StripOptions): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = STRIP.width
  canvas.height = stripHeight(options.frame.art) + bleedTop(options.frame.art)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('this browser will not give us a 2d canvas')

  await ensureFonts()
  await renderStripBase(ctx, options)
  return canvas
}
