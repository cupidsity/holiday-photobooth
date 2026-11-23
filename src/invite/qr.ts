import QRCode from 'qrcode'

export type CodeGrid = {
  size: number
  // one entry per dark module, in reading order
  cells: { column: number; row: number }[]
}

export function codeGrid(url: string): CodeGrid {
  const code = QRCode.create(url, { errorCorrectionLevel: 'M' })
  const size = code.modules.size
  const data = code.modules.data
  const cells: { column: number; row: number }[] = []
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (data[row * size + column]) cells.push({ column, row })
    }
  }
  return { size, cells }
}
