import { PlacedSticker } from '../lib/render'
import { BORDER_PIECES } from './borderPieces'

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
    id: 'border',
    name: 'border',
    // the pressed border, as loose pieces: drop it on and then move any one of
    // them
    pieces: BORDER_PIECES,
  },
  {
    id: 'filigree',
    name: 'filigree',
    pieces: [
      { src: '/stickers/vine-scroll.svg', x: 0.18, y: 0.3, size: 0.26, rotation: 0 },
      { src: '/stickers/vine-scroll.svg', x: 0.82, y: 0.68, size: 0.26, rotation: 3.14 },
      { src: '/stickers/vine-curl.svg', x: 0.74, y: 0.11, size: 0.32, rotation: 0 },
      { src: '/stickers/vine-sprig.svg', x: 0.24, y: 0.85, size: 0.22, rotation: 0.2 },
      { src: '/stickers/vine-bloom.svg', x: 0.78, y: 0.93, size: 0.26, rotation: -0.2 },
    ],
  },
  {
    id: 'flash',
    name: 'fine line',
    pieces: [
      { src: '/stickers/vine-trail.svg', x: 0.16, y: 0.24, size: 0.2, rotation: 0.06 },
      { src: '/stickers/lily.svg', x: 0.8, y: 0.2, size: 0.34, rotation: 0.3 },
      { src: '/stickers/baby-breath.svg', x: 0.18, y: 0.64, size: 0.26, rotation: -0.1 },
      { src: '/stickers/butterfly-line.svg', x: 0.79, y: 0.6, size: 0.34, rotation: 0.14 },
      { src: '/stickers/star-spark.svg', x: 0.5, y: 0.05, size: 0.22, rotation: 0 },
      { src: '/stickers/tendril.svg', x: 0.5, y: 0.95, size: 0.26, rotation: 0 },
    ],
  },
  {
    id: 'scatter',
    name: 'scattered',
    pieces: [
      { src: '/stickers/sparkle.svg', x: 0.24, y: 0.12, size: 0.18, rotation: 0.2 },
      { src: '/stickers/star.svg', x: 0.78, y: 0.22, size: 0.15, rotation: -0.2 },
      { src: '/stickers/moon.svg', x: 0.3, y: 0.42, size: 0.2, rotation: 0 },
      { src: '/stickers/sparkle.svg', x: 0.75, y: 0.56, size: 0.2, rotation: -0.1 },
      { src: '/stickers/snowflake.svg', x: 0.26, y: 0.74, size: 0.18, rotation: 0.3 },
      { src: '/stickers/star.svg', x: 0.76, y: 0.88, size: 0.14, rotation: 0.3 },
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
