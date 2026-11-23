import QRCode from 'qrcode'
import { INK, TreeCell, buildTree, colorFor } from './tree'

export type ScenePoint = {
  // column on screen, shared by both views
  column: number
  // height in the tree view
  row: number
  // depth, which becomes the vertical axis once the view swings overhead
  depth: number
  glyph: string
  color: string
  snow: boolean
}

export type Scene = {
  points: ScenePoint[]
  // module count of the qr code, which is also the grid width and depth
  size: number
  gridHeight: number
}

const SNOW_GLYPHS = ['.', '*', '+', '·']

function freeRowsFor(gridHeight: number, taken: Set<number>, column: number): number[] {
  const free: number[] = []
  for (let row = 0; row < gridHeight; row += 1) if (!taken.has(row)) free.push(row)
  // deterministic shuffle so snow does not twitch between renders
  return free
    .map((row) => ({ row, weight: Math.abs(Math.sin((row + 1) * 91.17 + (column + 1) * 13.7)) }))
    .sort((left, right) => left.weight - right.weight)
    .map((entry) => entry.row)
}

// where this glyph would sit if the tree were a real cone: on the shell, at the
// depth that matches how far the glyph is from the trunk on its own row. half
// the glyphs take the front of the shell and half the back
function coneDepth(cell: TreeCell, center: number, centerDepth: number): number {
  const across = cell.column - center
  const inside = cell.radius * cell.radius - across * across
  if (inside <= 0) return centerDepth
  const front = Math.abs(Math.sin((cell.column * 7.3 + cell.row * 3.1) * 1.7)) > 0.5 ? 1 : -1
  return centerDepth + front * Math.sqrt(inside)
}

/**
 * builds one cloud of glyphs that reads two ways: head-on it is a christmas
 * tree with real depth, and from directly above every glyph lands on a dark
 * module of the qr code.
 *
 * each glyph is a single point, so neither view is a cheat. the tree's glyphs
 * are pushed to whichever dark module sits nearest the cone they would occupy
 * if the tree were solid, which is what lets the invite turn the tree on its
 * axis without it smearing into noise.
 */
export function buildScene(url: string): Scene {
  const code = QRCode.create(url, { errorCorrectionLevel: 'M' })
  const size = code.modules.size
  const modules = code.modules.data
  const gridHeight = size
  const center = (size - 1) >> 1
  const centerDepth = (size - 1) / 2

  const treeByColumn = new Map<number, TreeCell[]>()
  for (const cell of buildTree(size, gridHeight)) {
    const column = treeByColumn.get(cell.column)
    if (column) column.push(cell)
    else treeByColumn.set(cell.column, [cell])
  }

  const points: ScenePoint[] = []

  for (let column = 0; column < size; column += 1) {
    const darkDepths: number[] = []
    for (let depth = 0; depth < size; depth += 1) {
      if (modules[depth * size + column]) darkDepths.push(depth)
    }
    // a column with no dark modules cannot carry any glyph without printing a
    // module that should stay light, so the tree simply has a gap there
    if (darkDepths.length === 0) continue

    const cells = (treeByColumn.get(column) ?? []).slice().sort((left, right) => left.row - right.row)
    const used = new Set<number>()

    for (const cell of cells) {
      const wanted = coneDepth(cell, center, centerDepth)
      // the nearest module to the cone that nothing has claimed yet, so the
      // tree keeps its shape and the code still gets every module covered
      let chosen = darkDepths[0]
      let bestGap = Infinity
      for (const depth of darkDepths) {
        if (used.has(depth)) continue
        const gap = Math.abs(depth - wanted)
        if (gap < bestGap) {
          bestGap = gap
          chosen = depth
        }
      }
      if (bestGap === Infinity) {
        // every module in this column already carries a glyph, so stack this
        // one on the nearest of them: two glyphs at one module look the same
        // from above
        for (const depth of darkDepths) {
          const gap = Math.abs(depth - wanted)
          if (gap < bestGap) {
            bestGap = gap
            chosen = depth
          }
        }
      }
      used.add(chosen)
      points.push({
        column,
        row: cell.row,
        depth: chosen,
        glyph: cell.glyph,
        color: colorFor(cell.kind, column, cell.row),
        snow: false,
      })
    }

    const leftover = darkDepths.filter((depth) => !used.has(depth))
    const freeRows = freeRowsFor(gridHeight, new Set(cells.map((cell) => cell.row)), column)
    leftover.forEach((depth, index) => {
      const row = freeRows.length ? freeRows[index % freeRows.length] : index % gridHeight
      points.push({
        column,
        row,
        depth,
        glyph: SNOW_GLYPHS[(column + row) % SNOW_GLYPHS.length],
        color: INK.snow,
        snow: true,
      })
    })
  }

  return { points, size, gridHeight }
}
