import { PlacedSticker } from '../lib/render'

type PresetPiece = {
  src: string
  x: number
  y: number
  size: number
  rotation: number
}

export type Arrangement = {
  id: string
  name: string
  pieces: PresetPiece[]
}

// ready-made layouts for a guest who does not want to place anything by hand.
// every piece stays draggable afterwards, so a preset is a starting point
export const ARRANGEMENTS: Arrangement[] = [
  {
    id: 'botanical',
    name: 'botanical',
    pieces: [
      { src: '/stickers/fern.svg', x: 0.17, y: 0.1, size: 0.2, rotation: -0.28 },
      { src: '/stickers/queen-annes-lace.svg', x: 0.84, y: 0.12, size: 0.18, rotation: 0.22 },
      { src: '/stickers/lavender.svg', x: 0.13, y: 0.27, size: 0.15, rotation: 0.12 },
      { src: '/stickers/cosmos-flower.svg', x: 0.86, y: 0.42, size: 0.17, rotation: -0.18 },
      { src: '/stickers/daisy.svg', x: 0.15, y: 0.56, size: 0.16, rotation: 0.2 },
      { src: '/stickers/berry-sprig.svg', x: 0.85, y: 0.68, size: 0.16, rotation: -0.1 },
      { src: '/stickers/sparkle.svg', x: 0.2, y: 0.9, size: 0.12, rotation: 0 },
      { src: '/stickers/wild-stem.svg', x: 0.82, y: 0.9, size: 0.14, rotation: 0.16 },
    ],
  },
  {
    id: 'corners',
    name: 'corners',
    pieces: [
      { src: '/stickers/rose.svg', x: 0.16, y: 0.08, size: 0.18, rotation: -0.3 },
      { src: '/stickers/butterfly.svg', x: 0.85, y: 0.3, size: 0.16, rotation: 0.25 },
      { src: '/stickers/clover.svg', x: 0.16, y: 0.62, size: 0.16, rotation: 0.18 },
      { src: '/stickers/bow.svg', x: 0.84, y: 0.88, size: 0.17, rotation: -0.12 },
    ],
  },
  {
    id: 'filigree',
    name: 'filigree',
    pieces: [
      { src: '/stickers/vine-scroll.svg', x: 0.14, y: 0.3, size: 0.16, rotation: 0 },
      { src: '/stickers/vine-scroll.svg', x: 0.86, y: 0.68, size: 0.16, rotation: 3.14 },
      { src: '/stickers/vine-curl.svg', x: 0.76, y: 0.12, size: 0.2, rotation: 0 },
      { src: '/stickers/vine-sprig.svg', x: 0.2, y: 0.84, size: 0.13, rotation: 0.2 },
      { src: '/stickers/vine-bloom.svg', x: 0.82, y: 0.93, size: 0.16, rotation: -0.2 },
    ],
  },
  {
    id: 'flash',
    name: 'fine line',
    pieces: [
      { src: '/stickers/vine-trail.svg', x: 0.12, y: 0.24, size: 0.12, rotation: 0.06 },
      { src: '/stickers/lily.svg', x: 0.84, y: 0.2, size: 0.22, rotation: 0.3 },
      { src: '/stickers/baby-breath.svg', x: 0.15, y: 0.64, size: 0.16, rotation: -0.1 },
      { src: '/stickers/butterfly-line.svg', x: 0.82, y: 0.6, size: 0.22, rotation: 0.14 },
      { src: '/stickers/star-spark.svg', x: 0.5, y: 0.04, size: 0.14, rotation: 0 },
    ],
  },
  {
    id: 'scatter',
    name: 'scattered',
    pieces: [
      { src: '/stickers/sparkle.svg', x: 0.22, y: 0.12, size: 0.11, rotation: 0.2 },
      { src: '/stickers/star.svg', x: 0.8, y: 0.22, size: 0.09, rotation: -0.2 },
      { src: '/stickers/snowflake.svg', x: 0.3, y: 0.44, size: 0.1, rotation: 0.1 },
      { src: '/stickers/sparkle.svg', x: 0.76, y: 0.56, size: 0.12, rotation: -0.1 },
      { src: '/stickers/star.svg', x: 0.24, y: 0.76, size: 0.08, rotation: 0.3 },
      { src: '/stickers/moon.svg', x: 0.78, y: 0.86, size: 0.12, rotation: 0 },
    ],
  },
]

export function placeArrangement(arrangement: Arrangement): PlacedSticker[] {
  const stamp = Date.now().toString(36)
  return arrangement.pieces.map((piece, index) => ({
    key: `${arrangement.id}-${stamp}-${index}`,
    stickerId: arrangement.id,
    src: piece.src,
    x: piece.x,
    y: piece.y,
    size: piece.size,
    rotation: piece.rotation,
  }))
}
