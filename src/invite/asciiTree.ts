// a character-grid renderer: the tree is a lit 3d surface rasterised into cells
// of a fixed monospace grid, where the character stands for how much light the
// surface caught. that is what makes it read as a solid object rather than a
// cloud of glyphs

export const PALETTE = {
  needleDark: '#12401f',
  needleLit: '#4ec266',
  needleHot: '#e8c33c',
  trunkDark: '#5a3a1c',
  trunkLit: '#c89059',
  star: '#fff3c4',
  snow: '#cfe3ff',
  field: '#dfe9f5',
  rule: '#1b2a1f',
  ink: '#14241a',
  night: '#06110a',
  paper: '#f6efe2',
} as const

const LIGHT_COLORS = ['#ff2f44', '#ffc21f', '#36c6ff', '#fff6e2', '#ff5fae']
const NEEDLE_TINTS = [
  '#3cb45c',
  '#2f9c4f',
  '#47c86a',
  '#1f7a3c',
  '#56d47a',
  '#2f9c4f',
  '#3cb45c',
  '#19623a',
]
const GIFT_COLORS = ['#e02a3a', '#2f7fd8', '#e8b23c', '#c43a8f']
const RIBBON_COLORS = ['#f4eee2', '#ffd45e', '#f4eee2', '#ffd45e']

// dark to bright. the ramp is what draws the shading, so it has to climb in
// ink coverage evenly rather than alphabetically
const RAMP = ` .'\`^",:;~-=+*vcoxswXVW%&#@$`

export type Sample = {
  x: number
  y: number
  z: number
  // surface normal, for the lambert term
  nx: number
  ny: number
  nz: number
  kind: 'needle' | 'trunk' | 'bauble' | 'cap' | 'star' | 'gift' | 'garland' | 'ribbon'
  color?: string
  phase: number
  // nudges this sample's character off the ramp so neighbours never agree
  jitter: number
}

export type Cell = {
  column: number
  row: number
  glyph: string
  color: string
}

function makeRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function mixHex(from: string, to: string, amount: number): [number, number, number] {
  const parse = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  const [fromRed, fromGreen, fromBlue] = parse(from)
  const [toRed, toGreen, toBlue] = parse(to)
  const level = amount < 0 ? 0 : amount > 1 ? 1 : amount
  return [
    Math.round(fromRed + (toRed - fromRed) * level),
    Math.round(fromGreen + (toGreen - fromGreen) * level),
    Math.round(fromBlue + (toBlue - fromBlue) * level),
  ]
}

export type TreeModel = {
  samples: Sample[]
  height: number
  radius: number
  lightCount: number
  // the star is a flat shape, so it is drawn as a billboard around this point
  // rather than turned with the tree, or it goes edge on twice a revolution
  starAnchorY: number
}

export function buildTree(height: number, density = 1): TreeModel {
  const random = makeRandom(20261123)
  const samples: Sample[] = []
  const baseRadius = height * 0.46
  const layers = Math.round(150 * density)
  let lightCount = 0

  for (let layer = 0; layer < layers; layer += 1) {
    const down = layer / (layers - 1)
    // seven sawtooth tiers give the skirted silhouette of a real fir
    const tier = (down * 7) % 1
    const radius = baseRadius * (0.04 + down * 0.96) * (0.72 + tier * 0.28)
    const y = (down - 0.5) * height
    const steps = Math.max(24, Math.round(radius * 3.4 * density))

    for (let step = 0; step < steps; step += 1) {
      const theta = (step / steps) * Math.PI * 2 + layer * 0.21
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)
      // the cone's surface leans outward and up, so its normal does too
      const lean = 0.42
      const length = Math.hypot(cos, lean, sin)
      samples.push({
        x: cos * radius,
        y,
        z: sin * radius,
        nx: cos / length,
        ny: -lean / length,
        nz: sin / length,
        kind: 'needle',
        color: NEEDLE_TINTS[Math.floor(random() * NEEDLE_TINTS.length)],
        phase: random() * Math.PI * 2,
        jitter: Math.round(random() * 4) - 2,
      })
    }
  }

  // the baubles. each one is a small sphere of its own rather than a coloured
  // character, so it shades like a ball and keeps its shape as the tree turns
  const baubleCount = Math.round(54 * density)
  for (let ornament = 0; ornament < baubleCount; ornament += 1) {
    // nothing hangs near the tip: up there the cone is narrower than the ball
    // and the ornaments end up floating off the sides of the tree
    const down = 0.3 + random() * 0.66
    const tier = (down * 7) % 1
    const sitting = baseRadius * (0.04 + down * 0.96) * (0.72 + tier * 0.28)
    const baubleRadius = Math.min(height * 0.019, sitting * 0.3)
    const theta = random() * Math.PI * 2
    const hangX = Math.cos(theta) * (sitting + baubleRadius * 0.6)
    const hangZ = Math.sin(theta) * (sitting + baubleRadius * 0.6)
    const hangY = (down - 0.5) * height
    const color = LIGHT_COLORS[Math.floor(random() * LIGHT_COLORS.length)]
    const phase = random() * Math.PI * 2
    lightCount += 1

    for (let band = 0; band <= 6; band += 1) {
      const polar = (band / 6) * Math.PI
      const ringSteps = Math.max(1, Math.round(Math.sin(polar) * 11))
      for (let around = 0; around < ringSteps; around += 1) {
        const azimuth = (around / ringSteps) * Math.PI * 2
        const nx = Math.sin(polar) * Math.cos(azimuth)
        const ny = -Math.cos(polar)
        const nz = Math.sin(polar) * Math.sin(azimuth)
        samples.push({
          x: hangX + nx * baubleRadius,
          y: hangY + ny * baubleRadius,
          z: hangZ + nz * baubleRadius,
          nx,
          ny,
          nz,
          kind: 'bauble',
          color,
          phase,
          jitter: 0,
        })
      }
    }

    // the little cap and hook it hangs from
    for (let step = 0; step < 4; step += 1) {
      samples.push({
        x: hangX,
        y: hangY - baubleRadius - step * baubleRadius * 0.28,
        z: hangZ,
        nx: 0,
        ny: 0,
        nz: 1,
        kind: 'cap',
        color: '#e8c33c',
        phase,
        jitter: 0,
      })
    }
  }

  // a ribbon wound five times round the cone, sitting just proud of the
  // needles so it stays in front of them as the tree turns
  const garlandSteps = Math.round(2200 * density)
  for (let step = 0; step < garlandSteps; step += 1) {
    const down = 0.14 + (step / garlandSteps) * 0.84
    const tier = (down * 7) % 1
    const radius = baseRadius * (0.04 + down * 0.96) * (0.72 + tier * 0.28) * 1.07
    const theta = down * Math.PI * 10
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    samples.push({
      x: cos * radius,
      y: (down - 0.5) * height,
      z: sin * radius,
      nx: cos,
      ny: 0,
      nz: sin,
      kind: 'garland',
      phase: step * 0.4,
      color: step % 9 < 5 ? '#ffc21f' : '#fff0c0',
      jitter: 0,
    })
  }

  const trunkRadius = baseRadius * 0.09
  const trunkTop = height * 0.46
  for (let ring = 0; ring < 16; ring += 1) {
    const y = trunkTop + (ring / 15) * height * 0.08
    for (let step = 0; step < 16; step += 1) {
      const theta = (step / 16) * Math.PI * 2
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)
      samples.push({
        x: cos * trunkRadius,
        y,
        z: sin * trunkRadius,
        nx: cos,
        ny: 0,
        nz: sin,
        kind: 'trunk',
        phase: 0,
        jitter: Math.round(random() * 2) - 1,
      })
    }
  }

  // parcels round the foot of the tree. each one is a whole box with five
  // faces and its own ribbon, so it still reads as a present from any angle
  // instead of collapsing to a streak when it turns edge on
  for (let box = 0; box < 8; box += 1) {
    const angle = (box / 8) * Math.PI * 2 + 0.6
    const away = baseRadius * (0.66 + random() * 0.5)
    const wide = height * (0.075 + random() * 0.05)
    const tall = wide * (0.62 + random() * 0.4)
    const deep = wide * (0.72 + random() * 0.35)
    const yaw = random() * Math.PI
    const yawCos = Math.cos(yaw)
    const yawSin = Math.sin(yaw)
    const standX = Math.cos(angle) * away
    const standZ = Math.sin(angle) * away
    const floor = height * 0.54
    const paper = GIFT_COLORS[box % GIFT_COLORS.length]
    const ribbon = RIBBON_COLORS[box % RIBBON_COLORS.length]
    const step = Math.max(3, Math.round(wide / 7))

    const put = (
      localX: number,
      localY: number,
      localZ: number,
      normalX: number,
      normalZ: number,
      normalY: number,
      onRibbon: boolean,
    ) => {
      samples.push({
        x: standX + localX * yawCos - localZ * yawSin,
        y: floor - tall + localY,
        z: standZ + localX * yawSin + localZ * yawCos,
        nx: normalX * yawCos - normalZ * yawSin,
        ny: normalY,
        nz: normalX * yawSin + normalZ * yawCos,
        kind: onRibbon ? 'ribbon' : 'gift',
        color: onRibbon ? ribbon : paper,
        phase: 0,
        jitter: 0,
      })
    }

    const ribbonWidth = wide * 0.11
    for (let across = -wide / 2; across <= wide / 2; across += step) {
      for (let through = -deep / 2; through <= deep / 2; through += step) {
        // the lid, with the ribbon crossing it both ways
        put(across, 0, through, 0, 0, -1, Math.abs(across) < ribbonWidth || Math.abs(through) < ribbonWidth)
      }
      for (let up = 0; up <= tall; up += step) {
        put(across, up, -deep / 2, 0, -1, 0, Math.abs(across) < ribbonWidth)
        put(across, up, deep / 2, 0, 1, 0, Math.abs(across) < ribbonWidth)
      }
    }
    for (let through = -deep / 2; through <= deep / 2; through += step) {
      for (let up = 0; up <= tall; up += step) {
        put(-wide / 2, up, through, -1, 0, 0, Math.abs(through) < ribbonWidth)
        put(wide / 2, up, through, 1, 0, 0, Math.abs(through) < ribbonWidth)
      }
    }
  }

  // a real five pointed star on the top, filled in so it reads as a shape and
  // not as a bright speck
  const starRadius = height * 0.125
  const starPoints: [number, number][] = []
  for (let corner = 0; corner < 10; corner += 1) {
    const reach = corner % 2 === 0 ? starRadius : starRadius * 0.42
    const angle = (-90 + corner * 36) * (Math.PI / 180)
    starPoints.push([Math.cos(angle) * reach, Math.sin(angle) * reach])
  }
  const inStar = (px: number, py: number) => {
    let inside = false
    for (let edge = 0, last = starPoints.length - 1; edge < starPoints.length; last = edge, edge += 1) {
      const [ax, ay] = starPoints[edge]
      const [bx, by] = starPoints[last]
      if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inside = !inside
    }
    return inside
  }
  const starStep = starRadius / 14
  const starTop = -height * 0.5 - starRadius * 0.55
  for (let across = -starRadius; across <= starRadius; across += starStep) {
    for (let down = -starRadius; down <= starRadius; down += starStep) {
      if (!inStar(across, down)) continue
      samples.push({
        x: across,
        y: starTop + down,
        z: 0,
        nx: 0,
        ny: 0,
        nz: 1,
        kind: 'star',
        phase: 0,
        jitter: 0,
      })
    }
  }

  return { samples, height, radius: baseRadius, lightCount, starAnchorY: starTop }
}

const LIGHT_DIR = (() => {
  // over the viewer's left shoulder: the lit side of the cone faces us, the
  // right side falls away into the dark characters of the ramp
  const vector = [-0.5, -0.45, 0.74]
  const length = Math.hypot(...vector)
  return vector.map((part) => part / length) as [number, number, number]
})()

export type RasterOptions = {
  columns: number
  rows: number
  cellWidth: number
  cellHeight: number
  angle: number
  // 0 looks at the tree head on, 1 looks straight down on it
  pitch: number
  // how much of the tree has grown in, from the foot upward
  reveal: number
  scale: number
  centerX: number
  centerY: number
  focal: number
  time: number
}

/**
 * walks every sample, lights it, projects it and keeps whichever one is nearest
 * in each cell of the character grid. one pass, one z-buffer, no allocation per
 * frame beyond the two typed arrays this is handed.
 */
export function rasterise(
  model: TreeModel,
  options: RasterOptions,
  depthBuffer: Float32Array,
  glyphBuffer: Int16Array,
  colorBuffer: Int32Array,
): number {
  const { columns, rows, cellWidth, cellHeight, angle, pitch, reveal, scale, centerX, centerY, focal, time } = options
  depthBuffer.fill(-Infinity)
  glyphBuffer.fill(0)

  const angleCos = Math.cos(angle)
  const angleSin = Math.sin(angle)
  const pitchCos = Math.cos(pitch)
  const pitchSin = Math.sin(pitch)
  let filled = 0

  const front = 1 - reveal
  // where the star hangs, carried through the same rotation as everything else
  const anchorY = model.starAnchorY * pitchCos
  const anchorZ = -model.starAnchorY * pitchSin

  for (const sample of model.samples) {
    // the tree grows up out of the ground, so anything above the front has not
    // been printed yet
    const down = Math.max(0, sample.y / model.height + 0.5)
    if (down < front) continue
    const onFront = down - front < 0.035 && reveal < 1

    const flat = sample.kind === 'star'
    let spunX: number
    let spunY: number
    let spunZ: number
    if (flat) {
      // the star keeps its face to the viewer: only its anchor travels
      spunX = sample.x
      spunY = anchorY + (sample.y - model.starAnchorY)
      spunZ = anchorZ
    } else {
      spunX = sample.x * angleCos - sample.z * angleSin
      const turnedZ = sample.x * angleSin + sample.z * angleCos
      // tipping the camera up swaps height for depth, so looking straight down
      // flattens the cone into rings
      spunY = sample.y * pitchCos + turnedZ * pitchSin
      spunZ = turnedZ * pitchCos - sample.y * pitchSin
    }
    const perspective = focal / (focal - spunZ * scale)
    const screenX = centerX + spunX * scale * perspective
    const screenY = centerY + spunY * scale * perspective
    const column = Math.round(screenX / cellWidth)
    const row = Math.round(screenY / cellHeight)
    if (column < 0 || column >= columns || row < 0 || row >= rows) continue

    const index = row * columns + column
    // nearer samples win the cell, which is the whole depth test
    if (spunZ <= depthBuffer[index]) continue

    const normalX = sample.nx * angleCos - sample.nz * angleSin
    const turnedNormalZ = sample.nx * angleSin + sample.nz * angleCos
    const normalY = sample.ny * pitchCos + turnedNormalZ * pitchSin
    const normalZ = turnedNormalZ * pitchCos - sample.ny * pitchSin
    const lambert = flat ? 1 : normalX * LIGHT_DIR[0] + normalY * LIGHT_DIR[1] + normalZ * LIGHT_DIR[2]
    const facing = lambert > 0 ? lambert : 0
    const depthLift = 0.72 + 0.28 * ((spunZ / model.radius + 1) / 2)
    let level = (0.2 + 0.8 * facing) * depthLift

    let red: number
    let green: number
    let blue: number
    let glyph = ''

    if (sample.kind === 'bauble') {
      const twinkle = 0.84 + 0.16 * Math.sin(time * 0.004 + sample.phase)
      // the ball's own shading: a bright highlight where the light lands, a
      // solid body, and a dark rim on the side turned away
      const shaped = 0.2 + 0.8 * facing
      level = Math.min(1, shaped * twinkle + 0.18)
      glyph = level > 0.82 ? '@' : level > 0.58 ? '0' : level > 0.36 ? 'o' : ':'
      ;[red, green, blue] = mixHex('#140a0c', sample.color ?? '#ffc21f', 0.22 + level * 0.95)
    } else if (sample.kind === 'cap') {
      level = 0.9
      glyph = 'I'
      ;[red, green, blue] = mixHex('#2a2008', sample.color ?? '#e8c33c', 0.9)
    } else if (sample.kind === 'star') {
      level = 1
      glyph = '*'
      ;[red, green, blue] = mixHex(PALETTE.needleHot, PALETTE.star, 0.5)
    } else if (sample.kind === 'trunk') {
      ;[red, green, blue] = mixHex(PALETTE.trunkDark, PALETTE.trunkLit, level)
    } else if (sample.kind === 'garland') {
      const shimmer = 0.76 + 0.24 * Math.sin(time * 0.0025 + sample.phase)
      level = 0.95
      glyph = sample.color === '#ffc21f' ? 'o' : '*'
      ;[red, green, blue] = mixHex('#6b4a08', sample.color ?? '#ffc21f', shimmer)
    } else if (sample.kind === 'gift' || sample.kind === 'ribbon') {
      // wrapping paper is flat colour, so the glyph carries the shading rather
      // than the hue: that is what keeps a box looking like a box
      glyph = sample.kind === 'ribbon' ? '=' : level > 0.62 ? '#' : level > 0.38 ? '%' : '+'
      ;[red, green, blue] = mixHex('#1a0d12', sample.color ?? '#d8323f', 0.3 + level * 0.8)
    } else {
      // each needle keeps its own colour and the light only decides how much of
      // it shows, which is what gives the weave its mixed reds and golds
      const tint = sample.color ?? '#2f9c4f'
      ;[red, green, blue] = mixHex('#07130b', tint, 0.22 + level * 0.9)
    }

    if (onFront) {
      // a bright line rides the top of whatever has grown in so far
      level = 1
      glyph = '='
      ;[red, green, blue] = [255, 246, 214]
    }

    const ramp = Math.min(
      RAMP.length - 1,
      Math.max(1, Math.round(level * (RAMP.length - 1)) + sample.jitter),
    )
    const packed = (red << 16) | (green << 8) | blue
    depthBuffer[index] = spunZ
    glyphBuffer[index] = (glyph || RAMP[ramp]).charCodeAt(0)
    colorBuffer[index] = packed
    filled += 1

    if (sample.kind === 'garland') {
      const spread = [
        [-1, 0],
        [1, 0],
      ]
      for (const [acrossOffset, downOffset] of spread) {
        const nearColumn = column + acrossOffset
        const nearRow = row + downOffset
        if (nearColumn < 0 || nearColumn >= columns || nearRow < 0 || nearRow >= rows) continue
        const nearIndex = nearRow * columns + nearColumn
        if (spunZ <= depthBuffer[nearIndex]) continue
        depthBuffer[nearIndex] = spunZ
        glyphBuffer[nearIndex] = 111
        colorBuffer[nearIndex] = packed
      }
    }
  }

  return filled
}

export function glyphAt(code: number): string {
  return String.fromCharCode(code)
}

export type Flake = { x: number; y: number; fall: number; size: number; drift: number }

export function buildSnow(count: number): Flake[] {
  const random = makeRandom(77001)
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    fall: 0.012 + random() * 0.03,
    size: 0.6 + random() * 1.5,
    drift: 0.2 + random() * 0.6,
  }))
}

export type ShootingStar = {
  // all positions are fractions of the canvas, so a resize does not strand one
  x: number
  y: number
  dirX: number
  dirY: number
  // seconds since this one set off, or a negative number while it waits
  age: number
  span: number
  speed: number
  tail: number
}

const SHOOTING_TAIL = ['*', '=', '-', '-', '·', '·', '.', '.']

export function buildShootingStars(count: number): ShootingStar[] {
  return Array.from({ length: count }, (_item, index) => ({
    x: 0,
    y: 0,
    dirX: 1,
    dirY: 1,
    age: -(2 + index * 3.5),
    span: 1.6,
    speed: 0.55,
    tail: 8,
  }))
}

export function resetShootingStar(star: ShootingStar, random: () => number) {
  const fromLeft = random() < 0.5
  star.x = fromLeft ? -0.1 : 1.1
  star.y = random() * 0.45
  const slope = 0.25 + random() * 0.4
  star.dirX = fromLeft ? 1 : -1
  star.dirY = slope
  star.age = 0
  star.span = 1.1 + random() * 0.8
  star.speed = 0.5 + random() * 0.45
  star.tail = 7 + Math.floor(random() * 7)
}

export function shootingTailGlyph(step: number): string {
  return SHOOTING_TAIL[Math.min(SHOOTING_TAIL.length - 1, step)]
}

export type FieldMark = { x: number; y: number; glyph: string; dim: number }

// the sparse punctuation that fills the night behind the tree
export function buildField(count: number): FieldMark[] {
  const random = makeRandom(31337)
  const glyphs = ['.', '+', '*', '·', "'", '-']
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    glyph: glyphs[Math.floor(random() * glyphs.length)],
    dim: 0.12 + random() * 0.4,
  }))
}
