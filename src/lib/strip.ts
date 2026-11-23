// the strip is the size of the drawn frames, cropped to the art itself: the
// pngs are 1000x1800 with the frame centred in them, so the strip is the 680px
// the art actually occupies
export const STRIP = {
  width: 680,
  height: 1800,
  photoCount: 4,
} as const

export type Window = { x: number; y: number; width: number; height: number }

// where the photos sit when a frame does not bring its own windows: the shape
// the drawn frames share, shifted into strip space
export const DEFAULT_WINDOWS: Window[] = [
  { x: 80, y: 260, width: 520, height: 240 },
  { x: 80, y: 530, width: 520, height: 320 },
  { x: 80, y: 860, width: 520, height: 320 },
  { x: 80, y: 1190, width: 520, height: 290 },
]

export const DEFAULT_CAPTION_Y = 1620

// the shape the viewfinder is cropped to: the two middle windows, which every
// frame draws the same and which the other two are close to
export const PHOTO_ASPECT = 520 / 320

// draws source into a destination rect using cover-fit, so a 16:9 webcam feed
// fills a photo window without squashing anyone's face
export function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  destX: number,
  destY: number,
  destWidth: number,
  destHeight: number,
) {
  const scale = Math.max(destWidth / sourceWidth, destHeight / sourceHeight)
  const cropWidth = destWidth / scale
  const cropHeight = destHeight / scale
  ctx.drawImage(
    source,
    (sourceWidth - cropWidth) / 2,
    (sourceHeight - cropHeight) / 2,
    cropWidth,
    cropHeight,
    destX,
    destY,
    destWidth,
    destHeight,
  )
}

// the size a captured frame is stored at: generous enough that any window can
// crop out of it without softening
export const CAPTURE_WIDTH = 1040
export const CAPTURE_HEIGHT = 640
