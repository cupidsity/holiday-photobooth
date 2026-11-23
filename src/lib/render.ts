import { Frame, Sticker, loadImage } from './assets'
import { PhotoFilter, cssFilter, developPhoto, supportsCanvasFilter } from './filters'
import { FOOTER_HEIGHT, FOOTER_TOP, STRIP, drawCover, photoRect } from './strip'

export type PlacedSticker = {
  // unique per placement, not per sticker kind, since the same sticker can be
  // dropped on the strip more than once
  key: string
  stickerId: string
  glyph?: string
  src?: string
  // centre position as a fraction of the strip, so the preview and the export
  // agree no matter what size the preview is drawn at
  x: number
  y: number
  // width as a fraction of the strip width
  size: number
  rotation: number
}

export type StripOptions = {
  shots: HTMLCanvasElement[]
  frame: Frame
  filter: PhotoFilter
  caption: string
  subcaption: string
  stickers: PlacedSticker[]
}

export const CAPTION_FONT = 'Caveat'
export const STICKER_FONT = `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`

export async function ensureFonts() {
  if (!document.fonts) return
  try {
    await Promise.all([
      document.fonts.load(`700 96px "${CAPTION_FONT}"`),
      document.fonts.load(`400 64px "${CAPTION_FONT}"`),
    ])
  } catch {
    // the caption just falls back to a cursive system font
  }
}

function drawCaption(ctx: CanvasRenderingContext2D, frame: Frame, caption: string, subcaption: string) {
  const centerX = STRIP.width / 2
  const baseY = FOOTER_TOP + FOOTER_HEIGHT / 2
  ctx.save()
  ctx.fillStyle = frame.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (caption.trim()) {
    ctx.font = `700 88px "${CAPTION_FONT}", "Brush Script MT", cursive`
    ctx.fillText(caption, centerX, baseY - 26, STRIP.width - STRIP.sidePadding * 2)
  }
  if (subcaption.trim()) {
    ctx.globalAlpha = 0.75
    ctx.font = `400 46px "${CAPTION_FONT}", "Brush Script MT", cursive`
    ctx.fillText(subcaption, centerX, baseY + 52, STRIP.width - STRIP.sidePadding * 2)
  }
  ctx.restore()
}

function drawEmptyCell(ctx: CanvasRenderingContext2D, frame: Frame, index: number) {
  const rect = photoRect(index)
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.fillStyle = frame.ink
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
  ctx.restore()
}

export async function renderStripBase(ctx: CanvasRenderingContext2D, options: StripOptions) {
  const { shots, frame, filter } = options
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

  drawCaption(ctx, frame, options.caption, options.subcaption)
}

async function drawSticker(ctx: CanvasRenderingContext2D, sticker: PlacedSticker) {
  const size = sticker.size * STRIP.width
  const centerX = sticker.x * STRIP.width
  const centerY = sticker.y * STRIP.height

  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate(sticker.rotation)
  if (sticker.src) {
    try {
      const art = await loadImage(sticker.src)
      const aspect = art.naturalWidth && art.naturalHeight ? art.naturalHeight / art.naturalWidth : 1
      ctx.drawImage(art, -size / 2, (-size * aspect) / 2, size, size * aspect)
    } catch {
      // skip a sticker whose file disappeared rather than failing the export
    }
  } else if (sticker.glyph) {
    ctx.font = `${size}px ${STICKER_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(sticker.glyph, 0, 0)
  }
  ctx.restore()
}

export async function renderStrip(options: StripOptions): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = STRIP.width
  canvas.height = STRIP.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('this browser will not give us a 2d canvas')

  await ensureFonts()
  await renderStripBase(ctx, options)
  for (const sticker of options.stickers) {
    await drawSticker(ctx, sticker)
  }
  return canvas
}

export function stickerPreviewSize(sticker: PlacedSticker, previewWidth: number): number {
  return sticker.size * previewWidth
}

export function describeSticker(sticker: Sticker): string {
  return sticker.name
}
