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

function shuffledFreeRows(gridHeight: number, taken: Set<number>, column: number): number[] {
  const free: number[] = []
  for (let row = 0; row < gridHeight; row += 1) if (!taken.has(row)) free.push(row)
  // deterministic shuffle so snow does not twitch between renders
  return free
    .map((row) => ({ row, weight: Math.abs(Math.sin((row + 1) * 91.17 + (column + 1) * 13.7)) }))
    .sort((left, right) => left.weight - right.weight)
    .map((entry) => entry.row)
}

/**
 * builds one cloud of glyphs that reads two ways: head-on it is an ascii
 * christmas tree, and from directly above every glyph lands on a dark module of
 * the qr code. each glyph is a single point, so neither view is a cheat — the
 * tree column and the code column are the same column, and the tree's height
 * axis is the code's depth axis.
 */
export function buildScene(url: string): Scene {
  const code = QRCode.create(url, { errorCorrectionLevel: 'M' })
  const size = code.modules.size
  const modules = code.modules.data
  const gridHeight = size

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
    const taken = new Set(cells.map((cell) => cell.row))
    const freeRows = shuffledFreeRows(gridHeight, taken, column)

    // enough glyphs to draw every tree cell and cover every dark module: extra
    // glyphs stack on modules already covered, which the overhead view cannot
    // tell apart, and extra modules become snowfall around the tree
    const glyphCount = Math.max(cells.length, darkDepths.length)

    for (let index = 0; index < glyphCount; index += 1) {
      const depth = darkDepths[index % darkDepths.length]
      const cell = cells[index]
      if (cell) {
        points.push({
          column,
          row: cell.row,
          depth,
          glyph: cell.glyph,
          color: colorFor(cell.kind, column, cell.row),
          snow: false,
        })
      } else {
        const row = freeRows.length ? freeRows[(index - cells.length) % freeRows.length] : index % gridHeight
        points.push({
          column,
          row,
          depth,
          glyph: SNOW_GLYPHS[(column + row) % SNOW_GLYPHS.length],
          color: INK.snow,
          snow: true,
        })
      }
    }
  }

  return { points, size, gridHeight }
}
