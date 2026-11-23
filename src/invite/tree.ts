export type TreeKind = 'star' | 'needle' | 'ornament' | 'trunk'

export type TreeCell = {
  column: number
  row: number
  glyph: string
  kind: TreeKind
  // half-width of the tree at this row. the scene uses it as the radius of the
  // cone the glyph sits on, which is what gives the tree depth
  radius: number
}

// printed ink on warm paper. the code needs dark glyphs on a pale ground to
// scan, so the holiday colours all sit at the dark end
export const INK = {
  needle: '#1a5636',
  needleDeep: '#123c26',
  ornamentRed: '#a3162b',
  ornamentGold: '#8a6212',
  trunk: '#5a3718',
  star: '#9a6f14',
  snow: '#7d8a93',
  // everything collapses to this when the view swings overhead, so the code
  // reads as near-black on paper for the scanner
  code: '#14241a',
} as const

const NEEDLES = ['*', '*', '*', '^', '^', '+', '~']
const ORNAMENTS = ['o', 'O', '@']
const TIERS = 3

// a tiny deterministic hash keeps each cell's glyph stable between frames
function pick<T>(options: readonly T[], column: number, row: number, salt = 0): T {
  const mixed = Math.abs(Math.sin((column + 1) * 12.9898 + (row + 1) * 78.233 + salt) * 43758.5453)
  return options[Math.floor(mixed % options.length)]
}

// resamples the tier silhouette to exactly `wanted` rows so the tree fills the
// height it is given instead of leaving a band of empty sky
function silhouette(maxHalf: number, wanted: number): number[] {
  const base: number[] = []
  for (let tier = 0; tier < TIERS; tier += 1) {
    const widest = Math.max(2, Math.round((maxHalf * (tier + 1)) / TIERS))
    const narrowest = Math.max(1, Math.round(widest * 0.45))
    for (let half = narrowest; half <= widest; half += 1) base.push(half)
  }
  if (wanted <= 0) return []
  const stretched: number[] = []
  for (let row = 0; row < wanted; row += 1) {
    const sourceRow = Math.min(base.length - 1, Math.floor((row * base.length) / wanted))
    stretched.push(base[sourceRow])
  }
  return stretched
}

export function buildTree(width: number, gridHeight: number): TreeCell[] {
  const center = (width - 1) >> 1
  const maxHalf = Math.max(2, Math.floor((width - 1) / 2) - 1)
  const trunkHeight = Math.max(2, Math.round(width * 0.1))
  const skyRows = 2
  const foliageRows = Math.max(4, gridHeight - skyRows - 1 - trunkHeight)
  const halves = silhouette(maxHalf, foliageRows)

  const cells: TreeCell[] = []
  const topRow = Math.max(0, gridHeight - (1 + halves.length + trunkHeight))

  // the star is a drawn character in the ascii art, not an icon in the interface
  cells.push({ column: center, row: topRow, glyph: '★', kind: 'star', radius: 0 }) // taste-skill-ignore

  halves.forEach((half, index) => {
    const row = topRow + 1 + index
    for (let column = center - half; column <= center + half; column += 1) {
      if (column < 0 || column >= width) continue
      const isEdge = column === center - half || column === center + half
      const ornamentHere = !isEdge && Math.abs(Math.sin((column * 5 + row * 9) * 1.7)) > 0.955
      if (ornamentHere) {
        cells.push({ column, row, glyph: pick(ORNAMENTS, column, row), kind: 'ornament', radius: half })
      } else {
        cells.push({ column, row, glyph: pick(NEEDLES, column, row, isEdge ? 3 : 0), kind: 'needle', radius: half })
      }
    }
  })

  for (let index = 0; index < trunkHeight; index += 1) {
    const row = topRow + 1 + halves.length + index
    for (let column = center - 1; column <= center + 1; column += 1) {
      cells.push({ column, row, glyph: '▓', kind: 'trunk', radius: 1.4 })
    }
  }

  return cells
}

export function colorFor(kind: TreeKind, column: number, row: number): string {
  switch (kind) {
    case 'star':
      return INK.star
    case 'trunk':
      return INK.trunk
    case 'ornament':
      return pick([INK.ornamentRed, INK.ornamentGold, INK.ornamentRed], column, row, 7)
    default:
      return pick([INK.needle, INK.needle, INK.needleDeep], column, row, 11)
  }
}
