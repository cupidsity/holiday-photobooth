// every measurement below is in pixels on the exported strip, sized like a
// real 2x6 inch photobooth strip at 300dpi
export const STRIP = {
  width: 600,
  height: 1800,
  sidePadding: 36,
  topPadding: 36,
  photoGap: 24,
  photoCount: 3,
} as const

export const PHOTO_WIDTH = STRIP.width - STRIP.sidePadding * 2
export const PHOTO_HEIGHT = Math.round(
  (STRIP.height - STRIP.topPadding - 216 - STRIP.photoGap * (STRIP.photoCount - 1)) / STRIP.photoCount,
)
// whatever is left under the last photo holds the caption
export const FOOTER_TOP =
  STRIP.topPadding + PHOTO_HEIGHT * STRIP.photoCount + STRIP.photoGap * (STRIP.photoCount - 1)
export const FOOTER_HEIGHT = STRIP.height - FOOTER_TOP

export const PHOTO_ASPECT = PHOTO_WIDTH / PHOTO_HEIGHT

export function photoRect(index: number) {
  return {
    x: STRIP.sidePadding,
    y: STRIP.topPadding + index * (PHOTO_HEIGHT + STRIP.photoGap),
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
  }
}

// draws source into a destination rect using cover-fit, so a 16:9 webcam feed
// fills a near-square photo cell without squashing anyone's face
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
