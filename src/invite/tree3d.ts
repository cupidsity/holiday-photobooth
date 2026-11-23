export type GlyphKind = 'leaf' | 'light' | 'garland' | 'trunk' | 'star'

export type TreePoint = {
  x: number
  y: number
  z: number
  glyph: string
  color: string
  kind: GlyphKind
  // size as a multiple of the base glyph size
  weight: number
  // so every light twinkles on its own clock
  phase: number
}

export const PALETTE = {
  leaf: ['#2f9c57', '#3bbd6c', '#237c45', '#46cf7c'],
  light: ['#ff5668', '#ffd166', '#6fd8ff', '#fff2dd'],
  garland: '#ffd166',
  trunk: '#8a5a2b',
  star: '#ffe08a',
  snow: '#dff0ff',
  // what everything turns into once the glyphs settle into the code
  ink: '#14241a',
  night: '#06110a',
  paper: '#f6efe2',
} as const

const LEAF_GLYPHS = ['*', '^', '+', '~', '"', '.', 'o']
const LIGHT_GLYPHS = ['o', 'O', '@', '*']

// a small deterministic generator, so the tree is the same tree on every load
function makeRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

export type TreeShape = {
  points: TreePoint[]
  height: number
  radius: number
}

/**
 * the tree is a stack of horizontal rings of characters rather than a surface:
 * wide at the bottom, stepped into tiers, with every ring turned a little
 * against the one below it. that is what gives it a body to rotate rather than
 * a silhouette to look at.
 */
export function buildTree3D(height: number, density = 1): TreeShape {
  const random = makeRandom(20261123)
  const points: TreePoint[] = []
  const layers = Math.round(68 * density)
  const baseRadius = height * 0.34

  for (let layer = 0; layer < layers; layer += 1) {
    const down = layer / (layers - 1)
    // seven sawtooth tiers, so the cone steps the way a fir does
    const tier = (down * 7) % 1
    const radius = baseRadius * (0.06 + down * 0.94) * (0.78 + tier * 0.22)
    const y = (down - 0.5) * height
    const count = Math.max(8, Math.floor(radius / (3.1 / density)))

    for (let index = 0; index < count; index += 1) {
      if (random() < 0.04) continue
      const theta = (index / count) * Math.PI * 2 + layer * 0.29
      const reach = radius * (0.82 + random() * 0.2)
      const lit = down > 0.1 && random() < 0.08
      points.push({
        x: Math.cos(theta) * reach,
        y,
        z: Math.sin(theta) * reach,
        glyph: lit
          ? LIGHT_GLYPHS[Math.floor(random() * LIGHT_GLYPHS.length)]
          : LEAF_GLYPHS[Math.floor(random() * LEAF_GLYPHS.length)],
        color: lit
          ? PALETTE.light[Math.floor(random() * PALETTE.light.length)]
          : PALETTE.leaf[Math.floor(random() * PALETTE.leaf.length)],
        kind: lit ? 'light' : 'leaf',
        weight: lit ? 1.45 : 1,
        phase: random() * Math.PI * 2,
      })
    }
  }

  // a garland wound twice round the tree, which reads as depth as it turns
  const garlandSteps = Math.round(150 * density)
  for (let turn = 0; turn < 2; turn += 1) {
    for (let step = 0; step < garlandSteps; step += 1) {
      const down = 0.18 + (step / garlandSteps) * 0.78
      const tier = (down * 7) % 1
      const radius = baseRadius * (0.06 + down * 0.94) * (0.78 + tier * 0.22) * 1.04
      const theta = down * Math.PI * 6 + turn * Math.PI * 0.67
      points.push({
        x: Math.cos(theta) * radius,
        y: (down - 0.5) * height,
        z: Math.sin(theta) * radius,
        glyph: step % 3 === 0 ? '@' : '·',
        color: PALETTE.garland,
        kind: 'garland',
        weight: step % 3 === 0 ? 1.1 : 0.9,
        phase: random() * Math.PI * 2,
      })
    }
  }

  const trunkRadius = baseRadius * 0.11
  for (let ring = 0; ring < 8; ring += 1) {
    for (let index = 0; index < 9; index += 1) {
      const theta = (index / 9) * Math.PI * 2 + ring * 0.4
      points.push({
        x: Math.cos(theta) * trunkRadius,
        y: height * 0.5 + ring * (height * 0.018),
        z: Math.sin(theta) * trunkRadius,
        glyph: '#',
        color: PALETTE.trunk,
        kind: 'trunk',
        weight: 1,
        phase: 0,
      })
    }
  }

  // the star is a drawn character in the ascii art, not an icon in the interface
  points.push({
    x: 0,
    y: -height * 0.54,
    z: 0,
    glyph: '✦', // taste-skill-ignore
    color: PALETTE.star,
    kind: 'star',
    weight: 4.2,
    phase: 0,
  })

  return { points, height, radius: baseRadius }
}

export type Flake = {
  x: number
  y: number
  drift: number
  fall: number
  size: number
}

export function buildSnow(count: number): Flake[] {
  const random = makeRandom(77001)
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    drift: 0.2 + random() * 0.5,
    fall: 0.012 + random() * 0.03,
    size: 0.6 + random() * 1.6,
  }))
}
