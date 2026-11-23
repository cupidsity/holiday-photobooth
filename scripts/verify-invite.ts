import QRCode from 'qrcode'
import { buildScene } from '../src/invite/scene'
import { buildTree } from '../src/invite/tree'

// the invite only works if the overhead projection is the qr code exactly: one
// missing dark module or one glyph sitting on a light module and phones stop
// decoding it. this checks both directions for a handful of url lengths.
const urls = [
  'https://holiday-photobooth.vercel.app',
  'https://holiday-photobooth.vercel.app/?from=tv',
  'https://a-rather-longer-party-name-photobooth.vercel.app/booth',
  'https://x.co/p',
]

let failures = 0

for (const url of urls) {
  const scene = buildScene(url)
  const code = QRCode.create(url, { errorCorrectionLevel: 'M' })
  const size = code.modules.size
  const modules = code.modules.data

  const covered = new Set<string>()
  for (const point of scene.points) covered.add(`${point.column},${point.depth}`)

  let missingDark = 0
  let strayLight = 0
  for (let depth = 0; depth < size; depth += 1) {
    for (let column = 0; column < size; column += 1) {
      const dark = !!modules[depth * size + column]
      const drawn = covered.has(`${column},${depth}`)
      if (dark && !drawn) missingDark += 1
      if (!dark && drawn) strayLight += 1
    }
  }

  const frontView = new Set<string>()
  for (const point of scene.points) frontView.add(`${point.column},${point.row}`)
  const missingTreeCells = buildTree(size, scene.gridHeight).filter(
    (cell) => !frontView.has(`${cell.column},${cell.row}`),
  )

  const ok = missingDark === 0 && strayLight === 0 && missingTreeCells.length === 0
  if (!ok) failures += 1
  console.log(
    `${ok ? 'pass' : 'FAIL'}  ${size}x${size} modules  ${String(scene.points.length).padStart(4)} glyphs ` +
      `(${scene.points.filter((point) => point.snow).length} snow)  ` +
      `missing-dark=${missingDark} stray-light=${strayLight} missing-tree=${missingTreeCells.length}  ${url}`,
  )
}

if (failures) {
  console.error(`${failures} url(s) would not scan from above`)
  process.exit(1)
}
