// the strip is the size of the drawn frames, cropped to the art itself: the
// pngs are 1000x1800 with the frame centred in them, so the strip is the 680px
// the art actually occupies
export const STRIP = {
  width: 680,
  height: 1800,
  photoCount: 4,
} as const

export type Window = { x: number; y: number; width: number; height: number }

// the opaque bounds of a drawn frame inside its own file. the strip is cropped
// to this, so the padding a frame was exported with never shows as a margin
export type ArtBox = {
  left: number
  top: number
  width: number
  height: number
  // the size of the file the art was measured in
  source: { width: number; height: number }
  // how far the art carries on above the crop: the bow, the snowflakes, the
  // gingerbread man. the strip is drawn taller by this much so they stay whole
  bleedTop?: number
}

// how much a frame's art is scaled to meet the strip's width
export function artScale(art?: ArtBox): number {
  return art ? STRIP.width / art.width : 1
}

// a frame as tall as its own art, rather than every frame forced to one height
export function stripHeight(art?: ArtBox): number {
  return art ? Math.round(art.height * artScale(art)) : STRIP.height
}

// the room above the strip that the overhanging part of the art needs
export function bleedTop(art?: ArtBox): number {
  return art?.bleedTop ? Math.round(art.bleedTop * artScale(art)) : 0
}

// where the photos sit when a frame does not bring its own windows. nothing is
// printed over a plain stock, so all four are the same size: a drawn frame's
// own openings are what make its windows uneven
export const DEFAULT_WINDOWS: Window[] = [
  { x: 80, y: 200, width: 520, height: 320 },
  { x: 80, y: 530, width: 520, height: 320 },
  { x: 80, y: 860, width: 520, height: 320 },
  { x: 80, y: 1190, width: 520, height: 320 },
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
