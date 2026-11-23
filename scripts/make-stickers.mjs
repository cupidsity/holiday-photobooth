import { writeFileSync } from 'node:fs'

const OUT = new URL('../public/stickers/', import.meta.url)

// stickers are photogram silhouettes: in a real cyanotype whatever lies on the
// paper blocks the sun and prints pale, so every shape is one flat pale field
const wrap = (art) => `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 100 100">
  <g fill="#dde7dc" stroke="#dde7dc" stroke-width="0" stroke-linecap="round" stroke-linejoin="round">
${art
  .trim()
  .split('\n')
  .map((line) => '    ' + line.trim())
  .join('\n')}
  </g>
</svg>
`

// a stem with leaves, used by several of the botanicals
const stem = (x, topY, bottomY, width = 3) =>
  `<path d="M${x} ${bottomY} C${x - 2} ${(topY + bottomY) / 2} ${x + 2} ${(topY + bottomY) / 2} ${x} ${topY}" stroke-width="${width}" fill="none" />`

const leaf = (cx, cy, rotate, length = 16, width = 7) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${width}" ry="${length}" transform="rotate(${rotate} ${cx} ${cy})" />`

const petal = (cx, cy, rotate, length = 15, width = 7) =>
  `<ellipse cx="${cx}" cy="${cy - length}" rx="${width}" ry="${length}" transform="rotate(${rotate} ${cx} ${cy})" />`

const ring = (cx, cy, radius, count, draw) =>
  Array.from({ length: count }, (unused, index) => draw(cx, cy, radius, (index * 360) / count)).join('\n')

const stickers = {
  daisy: `
    ${ring(50, 46, 0, 8, (cx, cy, radius, angle) => petal(cx, cy, angle, 17, 7))}
    <circle cx="50" cy="46" r="9" />
    ${stem(50, 58, 94)}
    ${leaf(40, 74, 35, 11, 5)}
    ${leaf(60, 82, -35, 10, 4)}
  `,
  'cosmos-flower': `
    ${ring(50, 40, 0, 6, (cx, cy, radius, angle) => petal(cx, cy, angle + 15, 19, 11))}
    <circle cx="50" cy="40" r="7" />
    ${stem(50, 54, 96)}
    ${leaf(41, 70, 50, 13, 3)}
    ${leaf(59, 80, -50, 12, 3)}
  `,
  'queen-annes-lace': `
    ${ring(50, 34, 0, 12, (cx, cy, radius, angle) => {
      const rad = ((angle - 90) * Math.PI) / 180
      const px = cx + Math.cos(rad) * 22
      const py = cy + Math.sin(rad) * 18
      return `<path d="M${cx} ${cy + 4} L${px.toFixed(1)} ${py.toFixed(1)}" stroke-width="1.6" fill="none" /><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4.2" />`
    })}
    <circle cx="50" cy="34" r="4" />
    ${stem(50, 40, 96, 2.6)}
  `,
  lavender: `
    ${Array.from({ length: 9 }, (unused, index) => {
      const y = 16 + index * 5.4
      const spread = 3 + index * 0.9
      return `<ellipse cx="${(50 - spread).toFixed(1)}" cy="${y}" rx="3.6" ry="4.4" /><ellipse cx="${(50 + spread).toFixed(1)}" cy="${y + 2}" rx="3.6" ry="4.4" />`
    }).join('\n')}
    ${stem(50, 20, 96, 2.6)}
  `,
  fern: `
    ${stem(50, 10, 96, 3)}
    ${Array.from({ length: 9 }, (unused, index) => {
      const y = 20 + index * 8
      const length = 20 - index * 1.6
      return `${leaf(50 - length / 2, y, 62, length / 1.6, 3.4)}${leaf(50 + length / 2, y + 4, -62, length / 1.6, 3.4)}`
    }).join('\n')}
  `,
  'berry-sprig': `
    ${stem(52, 14, 96, 2.8)}
    <circle cx="40" cy="34" r="6" /><circle cx="62" cy="44" r="6.5" />
    <circle cx="38" cy="56" r="5.5" /><circle cx="60" cy="68" r="6" />
    <circle cx="44" cy="76" r="4.5" />
    ${leaf(64, 28, -40, 11, 5)}
    ${leaf(36, 46, 40, 10, 4.5)}
  `,
  clover: `
    ${ring(50, 46, 0, 4, (cx, cy, radius, angle) => {
      const rad = ((angle - 90) * Math.PI) / 180
      const px = (cx + Math.cos(rad) * 15).toFixed(1)
      const py = (cy + Math.sin(rad) * 15).toFixed(1)
      return `<ellipse cx="${px}" cy="${py}" rx="11" ry="12" transform="rotate(${angle} ${px} ${py})" />`
    })}
    ${stem(50, 60, 94, 2.6)}
  `,
  tulip: `
    <path d="M33 30 C33 54 39 66 50 70 C61 66 67 54 67 30 C60 40 55 36 50 25 C45 36 40 40 33 30 Z" />
    ${stem(50, 68, 96, 3)}
    ${leaf(38, 82, 28, 14, 5)}
    ${leaf(62, 86, -28, 12, 4.5)}
  `,
  rose: `
    <path d="M50 14 C64 14 74 25 74 38 C74 52 63 62 50 62 C38 62 29 53 29 42 C29 32 37 25 46 25 C54 25 60 31 60 39 C60 45 55 50 49 50 C44 50 40 46 40 41" fill="none" stroke-width="9" />
    ${stem(50, 62, 96, 3)}
    ${leaf(36, 74, 38, 13, 6)}
    ${leaf(64, 84, -38, 12, 5.5)}
  `,
  'wild-stem': `
    ${stem(48, 8, 96, 2.4)}
    ${Array.from({ length: 7 }, (unused, index) => {
      const y = 18 + index * 10
      const side = index % 2 === 0 ? -1 : 1
      return `<ellipse cx="${(48 + side * 10).toFixed(1)}" cy="${y}" rx="4" ry="8" transform="rotate(${side * 40} ${(48 + side * 10).toFixed(1)} ${y})" />`
    }).join('\n')}
  `,
  heart: `
    <path d="M50 88 C16 64 10 42 24 30 C36 20 48 28 50 38 C52 28 64 20 76 30 C90 42 84 64 50 88 Z" />
  `,
  'heart-outline': `
    <path d="M50 88 C16 64 10 42 24 30 C36 20 48 28 50 38 C52 28 64 20 76 30 C90 42 84 64 50 88 Z" fill="none" stroke-width="6" />
  `,
  bow: `
    <path d="M44 44 C26 26 8 32 12 50 C8 68 26 74 44 56 Z" />
    <path d="M56 44 C74 26 92 32 88 50 C92 68 74 74 56 56 Z" />
    <circle cx="50" cy="50" r="9" />
    <path d="M44 58 L34 88 L50 78 L66 88 L56 58 Z" />
  `,
  ribbon: `
    <path d="M50 8 C40 24 40 40 50 52 C60 40 60 24 50 8 Z" />
    <path d="M46 50 C30 60 18 78 16 94 C34 88 46 72 50 56 Z" />
    <path d="M54 50 C70 60 82 78 84 94 C66 88 54 72 50 56 Z" />
  `,
  butterfly: `
    <ellipse cx="50" cy="50" rx="3.4" ry="22" />
    <circle cx="50" cy="26" r="4" />
    <path d="M48 24 C42 12 32 8 28 13" stroke-width="2.6" fill="none" />
    <path d="M52 24 C58 12 68 8 72 13" stroke-width="2.6" fill="none" />
    <path d="M47 38 C32 20 10 26 15 44 C19 58 38 56 47 46 Z" />
    <path d="M53 38 C68 20 90 26 85 44 C81 58 62 56 53 46 Z" />
    <path d="M47 54 C36 48 18 54 23 68 C28 80 44 72 47 62 Z" />
    <path d="M53 54 C64 48 82 54 77 68 C72 80 56 72 53 62 Z" />
  `,
  star: `
    <path d="M50 6 L61 36 L92 38 L68 58 L76 90 L50 72 L24 90 L32 58 L8 38 L39 36 Z" />
  `,
  sparkle: `
    <path d="M38 14 Q42 34 60 38 Q42 42 38 62 Q34 42 16 38 Q34 34 38 14 Z" />
    <path d="M72 50 Q75 63 86 66 Q75 69 72 82 Q69 69 58 66 Q69 63 72 50 Z" />
    <path d="M46 72 Q48 81 56 83 Q48 85 46 94 Q44 85 36 83 Q44 81 46 72 Z" />
  `,
  swirl: `
    <path d="M86 20 C56 8 18 24 18 52 C18 72 38 84 54 78 C68 73 72 56 62 48 C53 41 40 46 40 56" fill="none" stroke-width="6" />
  `,
  moon: `
    <path d="M64 12 A40 40 0 1 0 64 88 C26 72 26 28 64 12 Z" />
  `,
  snowflake: `
    ${ring(50, 50, 0, 6, (cx, cy, radius, angle) => {
      const rad = ((angle - 90) * Math.PI) / 180
      const px = (cx + Math.cos(rad) * 40).toFixed(1)
      const py = (cy + Math.sin(rad) * 40).toFixed(1)
      const mx = (cx + Math.cos(rad) * 24).toFixed(1)
      const my = (cy + Math.sin(rad) * 24).toFixed(1)
      return `<path d="M${cx} ${cy} L${px} ${py}" stroke-width="5" fill="none" /><g transform="rotate(${angle} ${mx} ${my})"><path d="M${mx} ${my} l-9 -9 M${mx} ${my} l9 -9" stroke-width="4" fill="none" /></g>`
    })}
    <circle cx="50" cy="50" r="7" />
  `,
  holly: `
    <path d="M48 56 C28 54 16 40 18 24 C34 22 46 34 48 56 Z" />
    <path d="M52 56 C72 54 84 40 82 24 C66 22 54 34 52 56 Z" />
    <circle cx="43" cy="70" r="8" /><circle cx="59" cy="66" r="7" /><circle cx="51" cy="82" r="7" />
  `,
  'candy-cane': `
    <path d="M36 92 V42 A16 16 0 0 1 68 42 V56" fill="none" stroke-width="12" />
  `,
  bell: `
    <path d="M26 74 C26 46 33 33 50 26 C67 33 74 46 74 74 Z" />
    <rect x="20" y="74" width="60" height="7" rx="3.5" />
    <circle cx="50" cy="88" r="6" />
    <circle cx="50" cy="18" r="6" />
  `,
  bunny: `
    <ellipse cx="38" cy="30" rx="8" ry="22" transform="rotate(-12 38 30)" />
    <ellipse cx="60" cy="32" rx="8" ry="20" transform="rotate(14 60 32)" />
    <circle cx="50" cy="66" r="24" />
  `,
}


// the second family is fine-line flash: hairline florals and spiked
// cybersigilism, drawn as strokes rather than fields so they read as ink
// how heavy the fine-line family draws. the pieces are used small on a strip,
// so a hairline that looks right at full size disappears at sticker size
const FINE = 2
const flashWrap = (art, width, height) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2.4}" height="${height * 2.4}" viewBox="0 0 ${width} ${height}">
  <g fill="#dde7dc" stroke="#dde7dc" stroke-width="${1.3 * FINE}" stroke-linecap="round" stroke-linejoin="round">
${art
  .trim()
  .split('\n')
  .map((line) => '    ' + line.trim())
  .join('\n')}
  </g>
</svg>
`

const line = (d, width = 1.3) => `<path d="${d}" fill="none" stroke-width="${(width * FINE).toFixed(2)}" />`
const dot = (x, y, radius = 1.2) => `<circle cx="${x}" cy="${y}" r="${(radius * 1.6).toFixed(2)}" />`

// a five petal blossom seen face on, the size of a fingernail
const blossom = (cx, cy, radius, rotate = 0) =>
  `<g transform="rotate(${rotate} ${cx} ${cy})">` +
  Array.from({ length: 5 }, (unused, index) => {
    const angle = (index * 72 * Math.PI) / 180
    const px = cx + Math.cos(angle - Math.PI / 2) * radius
    const py = cy + Math.sin(angle - Math.PI / 2) * radius
    return `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(radius * 0.52).toFixed(1)}" ry="${(radius * 0.78).toFixed(1)}" transform="rotate(${(index * 72).toFixed(0)} ${px.toFixed(1)} ${py.toFixed(1)})" fill="none" stroke-width="${(1.1 * FINE).toFixed(2)}" />`
  }).join('') +
  dot(cx, cy, radius * 0.22) +
  '</g>'

// a pointed leaf drawn as two arcs meeting at the tip, with its midrib
const leafLine = (x, y, angle, length, spread) => {
  const rad = (angle * Math.PI) / 180
  const tipX = x + Math.cos(rad) * length
  const tipY = y + Math.sin(rad) * length
  const offX = Math.cos(rad + Math.PI / 2) * spread
  const offY = Math.sin(rad + Math.PI / 2) * spread
  return (
    line(
      `M${x.toFixed(1)} ${y.toFixed(1)} Q${(x + Math.cos(rad) * length * 0.5 + offX).toFixed(1)} ${(y + Math.sin(rad) * length * 0.5 + offY).toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q${(x + Math.cos(rad) * length * 0.5 - offX).toFixed(1)} ${(y + Math.sin(rad) * length * 0.5 - offY).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`,
      1.1,
    ) + line(`M${x.toFixed(1)} ${y.toFixed(1)} L${tipX.toFixed(1)} ${tipY.toFixed(1)}`, 0.7)
  )
}

const spike = (x, y, angle, length, width) => {
  const rad = (angle * Math.PI) / 180
  const tipX = x + Math.cos(rad) * length
  const tipY = y + Math.sin(rad) * length
  const baseX = Math.cos(rad + Math.PI / 2) * width
  const baseY = Math.sin(rad + Math.PI / 2) * width
  return `<path d="M${(x + baseX).toFixed(1)} ${(y + baseY).toFixed(1)} Q${(x + Math.cos(rad) * length * 0.55).toFixed(1)} ${(y + Math.sin(rad) * length * 0.55).toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q${(x - baseX + Math.cos(rad) * length * 0.2).toFixed(1)} ${(y - baseY + Math.sin(rad) * length * 0.2).toFixed(1)} ${(x - baseX).toFixed(1)} ${(y - baseY).toFixed(1)} Z" stroke-width="0" />`
}

const fourStar = (cx, cy, radius, thin = 0.3) =>
  `<path d="M${cx} ${cy - radius} Q${cx + radius * thin} ${cy - radius * thin} ${cx + radius} ${cy} Q${cx + radius * thin} ${cy + radius * thin} ${cx} ${cy + radius} Q${cx - radius * thin} ${cy + radius * thin} ${cx - radius} ${cy} Q${cx - radius * thin} ${cy - radius * thin} ${cx} ${cy - radius} Z" />`


// cybersigilism is built from strands: a wide root that narrows over a long
// sweeping curve to a needle point. the look comes from how long and thin they
// are and from how they mirror, never from how spiky they are
const strand = (x, y, angle, length, width, bendNear, bendFar) => {
  const rad = (angle * Math.PI) / 180
  const dirX = Math.cos(rad)
  const dirY = Math.sin(rad)
  const perpX = Math.cos(rad + Math.PI / 2)
  const perpY = Math.sin(rad + Math.PI / 2)
  const at = (along, across) => [
    x + dirX * length * along + perpX * length * across,
    y + dirY * length * along + perpY * length * across,
  ]
  const [tipX, tipY] = at(1, bendFar)
  const [nearX, nearY] = at(0.33, bendNear)
  const [farX, farY] = at(0.72, (bendNear + bendFar) * 0.5)
  const fix = (value) => value.toFixed(1)
  const side = (px, py, amount) => `${fix(px + perpX * width * amount)} ${fix(py + perpY * width * amount)}`
  return (
    `<path d="M${side(x, y, 1)} C${side(nearX, nearY, 0.55)} ${side(farX, farY, 0.18)} ${fix(tipX)} ${fix(tipY)} ` +
    `C${side(farX, farY, -0.18)} ${side(nearX, nearY, -0.55)} ${side(x, y, -1)} Z" stroke-width="0" />`
  )
}

// the same strand on both sides of a vertical axis
const pair = (axis, x, y, angle, length, width, bendNear, bendFar) =>
  strand(x, y, angle, length, width, bendNear, bendFar) +
  strand(2 * axis - x, y, 180 - angle, length, width, -bendNear, -bendFar)

// the narrow lens that runs up the middle of most pieces
const spine = (axis, topY, bottomY, width) =>
  `<path d="M${axis} ${topY} C${axis + width} ${(topY * 2 + bottomY) / 3} ${axis + width} ${(topY + bottomY * 2) / 3} ${axis} ${bottomY} C${axis - width} ${(topY + bottomY * 2) / 3} ${axis - width} ${(topY * 2 + bottomY) / 3} ${axis} ${topY} Z" stroke-width="0" />`

// a five pointed star, the accent that sits in the gaps of a sigil
const star5 = (cx, cy, radius) => {
  const points = Array.from({ length: 10 }, (unused, index) => {
    const reach = index % 2 === 0 ? radius : radius * 0.4
    const angle = ((-90 + index * 36) * Math.PI) / 180
    return `${(cx + Math.cos(angle) * reach).toFixed(1)} ${(cy + Math.sin(angle) * reach).toFixed(1)}`
  })
  return `<path d="M${points.join(' L')} Z" stroke-width="0" />`
}

const stipple = (cx, cy, radius, count, seed = 1) =>
  Array.from({ length: count }, (unused, index) => {
    const first = Math.abs(Math.sin((index + seed) * 12.9898) * 43758.5453) % 1
    const second = Math.abs(Math.sin((index + seed) * 78.233) * 43758.5453) % 1
    const angle = first * Math.PI * 2
    const distance = Math.sqrt(second) * radius
    return `<circle cx="${(cx + Math.cos(angle) * distance).toFixed(1)}" cy="${(cy + Math.sin(angle) * distance).toFixed(1)}" r="${(0.5 + first * 1.3).toFixed(1)}" />`
  }).join('')

// a cubic, and its tangent, so a branch can be drawn as a filled shape that
// tapers along the curve rather than as a stroke of constant width
const along = (t, a, b, c, d) => {
  const back = 1 - t
  return back * back * back * a + 3 * back * back * t * b + 3 * back * t * t * c + t * t * t * d
}
const slope = (t, a, b, c, d) => {
  const back = 1 - t
  return 3 * back * back * (b - a) + 6 * back * t * (c - b) + 3 * t * t * (d - c)
}

// the branch: wide where it leaves the branch, a point where it ends
const branch = (p0, p1, p2, p3, rootWidth, tipWidth = 0, steps = 30) => {
  const left = []
  const right = []
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps
    const x = along(t, p0[0], p1[0], p2[0], p3[0])
    const y = along(t, p0[1], p1[1], p2[1], p3[1])
    const dx = slope(t, p0[0], p1[0], p2[0], p3[0])
    const dy = slope(t, p0[1], p1[1], p2[1], p3[1])
    const length = Math.hypot(dx, dy) || 1
    const outX = -dy / length
    const outY = dx / length
    const half = (rootWidth + (tipWidth - rootWidth) * t) / 2
    left.push(`${(x + outX * half).toFixed(1)} ${(y + outY * half).toFixed(1)}`)
    right.push(`${(x - outX * half).toFixed(1)} ${(y - outY * half).toFixed(1)}`)
  }
  // a dot on the root rounds off what would otherwise be a chisel end
  return (
    `<path d="M${left.join(' L')} L${right.reverse().join(' L')} Z" stroke-width="0" />` +
    `<circle cx="${p0[0]}" cy="${p0[1]}" r="${(rootWidth / 2).toFixed(1)}" />`
  )
}

// where a stem is at a given point along itself, and which way it is heading
// there. everything that hangs off a stem is attached with these, so nothing
// is placed by eye and nothing comes adrift
const at = (curve, t) => [
  along(t, curve[0][0], curve[1][0], curve[2][0], curve[3][0]),
  along(t, curve[0][1], curve[1][1], curve[2][1], curve[3][1]),
]
const heading = (curve, t) =>
  (Math.atan2(
    slope(t, curve[0][1], curve[1][1], curve[2][1], curve[3][1]),
    slope(t, curve[0][0], curve[1][0], curve[2][0], curve[3][0]),
  ) *
    180) /
  Math.PI

// a shoot that curls in on itself. it is given the point it grows from and the
// way the stem was heading there, so it carries straight on out of the stem
const coil = (x, y, going, radius, turns, rootWidth, steps = 46) => {
  const from = going - 90
  const centerX = x - Math.cos((from * Math.PI) / 180) * radius
  const centerY = y - Math.sin((from * Math.PI) / 180) * radius
  const left = []
  const right = []
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps
    const angle = ((from + turns * 360 * t) * Math.PI) / 180
    const reach = radius * (1 - t * 0.82)
    const spotX = centerX + Math.cos(angle) * reach
    const spotY = centerY + Math.sin(angle) * reach
    const outX = Math.cos(angle)
    const outY = Math.sin(angle)
    const half = (rootWidth * (1 - t)) / 2
    left.push(`${(spotX + outX * half).toFixed(1)} ${(spotY + outY * half).toFixed(1)}`)
    right.push(`${(spotX - outX * half).toFixed(1)} ${(spotY - outY * half).toFixed(1)}`)
  }
  return `<path d="M${left.join(' L')} L${right.reverse().join(' L')} Z" stroke-width="0" />`
}

// a solid almond frond, base to tip
const frond = (x, y, angle, length, width) => {
  const rad = angle * (Math.PI / 180)
  const dirX = Math.cos(rad)
  const dirY = Math.sin(rad)
  const outX = -dirY
  const outY = dirX
  const fix = (value) => value.toFixed(1)
  const tipX = x + dirX * length
  const tipY = y + dirY * length
  const midX = x + dirX * length * 0.42
  const midY = y + dirY * length * 0.42
  return `<path d="M${fix(x)} ${fix(y)} Q${fix(midX + outX * width)} ${fix(midY + outY * width)} ${fix(tipX)} ${fix(tipY)} Q${fix(midX - outX * width)} ${fix(midY - outY * width)} ${fix(x)} ${fix(y)} Z" stroke-width="0" />`
}

// five petals with the middle punched out, so the flower keeps an eye
const floret = (cx, cy, radius, rotate = 0) => {
  const petals = Array.from({ length: 5 }, (unused, index) => {
    const angle = rotate + index * 72 - 90
    const rad = angle * (Math.PI / 180)
    const dirX = Math.cos(rad)
    const dirY = Math.sin(rad)
    const outX = -dirY
    const outY = dirX
    const fix = (value) => value.toFixed(1)
    const tipX = cx + dirX * radius
    const tipY = cy + dirY * radius
    const midX = cx + dirX * radius * 0.45
    const midY = cy + dirY * radius * 0.45
    const wide = radius * 0.42
    return `M${fix(cx)} ${fix(cy)} Q${fix(midX + outX * wide)} ${fix(midY + outY * wide)} ${fix(tipX)} ${fix(tipY)} Q${fix(midX - outX * wide)} ${fix(midY - outY * wide)} ${fix(cx)} ${fix(cy)} Z`
  }).join(' ')
  const eye = radius * 0.2
  const hole = `M${(cx - eye).toFixed(1)} ${cy.toFixed(1)} a ${eye.toFixed(1)} ${eye.toFixed(1)} 0 1 0 ${(eye * 2).toFixed(1)} 0 a ${eye.toFixed(1)} ${eye.toFixed(1)} 0 1 0 ${(-eye * 2).toFixed(1)} 0 Z`
  return `<path fill-rule="evenodd" d="${petals} ${hole}" stroke-width="0" />`
}

const glint = (cx, cy, radius) => {
  const fix = (value) => value.toFixed(1)
  const thin = radius * 0.17
  return `<path d="M${fix(cx)} ${fix(cy - radius)} Q${fix(cx + thin)} ${fix(cy - thin)} ${fix(cx + radius)} ${fix(cy)} Q${fix(cx + thin)} ${fix(cy + thin)} ${fix(cx)} ${fix(cy + radius)} Q${fix(cx - thin)} ${fix(cy + thin)} ${fix(cx - radius)} ${fix(cy)} Q${fix(cx - thin)} ${fix(cy - thin)} ${fix(cx)} ${fix(cy - radius)} Z" stroke-width="0" />`
}

// every piece is one main stem with things hung off it at known points along
// its own curve, so a leaf always meets the stem and a coil always carries on
// out of the tip it grows from
const sigil = (() => {
  const piece = (main, rootWidth, tipWidth, parts) => {
    const body = [branch(main[0], main[1], main[2], main[3], rootWidth, tipWidth)]
    for (const part of parts) body.push(part)
    return body.join('\n      ')
  }

  const scrollStem = [
    [96, 412],
    [40, 330],
    [150, 270],
    [96, 196],
  ]
  const scrollTop = [
    [96, 196],
    [52, 136],
    [140, 104],
    [104, 28],
  ]
  const scrollSideA = [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]

  const vineScroll = (() => {
    const lowerLeaf = at(scrollStem, 0.28)
    const midLeaf = at(scrollStem, 0.62)
    const upperLeaf = at(scrollTop, 0.3)
    const crownLeaf = at(scrollTop, 0.66)
    const sideRoot = at(scrollStem, 0.42)
    const side = [sideRoot, [sideRoot[0] - 40, sideRoot[1] - 26], [36, 254], [46, 220]]
    const sideTip = at(side, 1)
    const spurRoot = at(scrollTop, 0.18)
    const spur = [spurRoot, [spurRoot[0] + 44, spurRoot[1] - 14], [150, 200], [134, 176]]
    const spurTip = at(spur, 1)
    return piece(scrollStem, 15, 5, [
      branch(scrollTop[0], scrollTop[1], scrollTop[2], scrollTop[3], 5, 1.5),
      coil(at(scrollTop, 1)[0], at(scrollTop, 1)[1], heading(scrollTop, 1), 24, 0.8, 1.5),
      branch(side[0], side[1], side[2], side[3], 6, 1.5),
      coil(sideTip[0], sideTip[1], heading(side, 1), 17, 0.7, 1.5),
      branch(spur[0], spur[1], spur[2], spur[3], 5.5, 1.5),
      coil(spurTip[0], spurTip[1], heading(spur, 1), 15, 0.65, 1.5),
      frond(lowerLeaf[0], lowerLeaf[1], heading(scrollStem, 0.28) - 118, 46, 13),
      frond(midLeaf[0], midLeaf[1], heading(scrollStem, 0.62) + 118, 40, 11),
      frond(upperLeaf[0], upperLeaf[1], heading(scrollTop, 0.3) - 118, 36, 10),
      frond(crownLeaf[0], crownLeaf[1], heading(scrollTop, 0.66) + 118, 30, 9),
      floret(118, 44, 28, 12),
      floret(44, 214, 18, 40),
      floret(136, 172, 15, 20),
      glint(60, 112, 9),
      glint(150, 150, 7),
      glint(38, 170, 6),
      glint(58, 392, 7),
      glint(156, 372, 5),
    ])
  })()

  const branchStem = [
    [84, 292],
    [34, 232],
    [132, 186],
    [80, 118],
  ]
  const branchTop = [
    [80, 118],
    [48, 82],
    [112, 60],
    [92, 20],
  ]
  const vineBranch = (() => {
    const sideRoot = at(branchStem, 0.55)
    const side = [sideRoot, [sideRoot[0] + 42, sideRoot[1] - 18], [138, 178], [120, 150]]
    const sideTip = at(side, 1)
    const lowLeaf = at(branchStem, 0.22)
    const midLeaf = at(branchStem, 0.74)
    const topLeaf = at(branchTop, 0.45)
    return piece(branchStem, 13, 4, [
      branch(branchTop[0], branchTop[1], branchTop[2], branchTop[3], 4, 1.4),
      coil(at(branchTop, 1)[0], at(branchTop, 1)[1], heading(branchTop, 1), 19, 0.75, 1.4),
      branch(side[0], side[1], side[2], side[3], 5, 1.5),
      coil(sideTip[0], sideTip[1], heading(side, 1), 15, 0.65, 1.5),
      frond(lowLeaf[0], lowLeaf[1], heading(branchStem, 0.22) - 118, 42, 12),
      frond(midLeaf[0], midLeaf[1], heading(branchStem, 0.74) + 118, 34, 10),
      frond(topLeaf[0], topLeaf[1], heading(branchTop, 0.45) - 118, 28, 8),
      floret(42, 192, 21, 25),
      floret(126, 88, 16, 50),
      glint(132, 240, 7),
      glint(38, 118, 6),
      glint(142, 34, 5),
    ])
  })()

  const coilStem = [
    [16, 160],
    [66, 152],
    [96, 124],
    [106, 76],
  ]
  const vineCoil = (() => {
    const sideRoot = at(coilStem, 0.4)
    const side = [sideRoot, [sideRoot[0] + 24, sideRoot[1] - 22], [58, 102], [38, 90]]
    const sideTip = at(side, 1)
    const leafAt = at(coilStem, 0.62)
    return piece(coilStem, 7, 2, [
      coil(at(coilStem, 1)[0], at(coilStem, 1)[1], heading(coilStem, 1), 27, 0.85, 2),
      branch(side[0], side[1], side[2], side[3], 4.2, 1.2),
      coil(sideTip[0], sideTip[1], heading(side, 1), 13, 0.6, 1.2),
      frond(leafAt[0], leafAt[1], heading(coilStem, 0.62) + 118, 34, 10),
      floret(30, 42, 21, 15),
      glint(124, 136, 7),
      glint(152, 104, 5),
    ])
  })()

  const floretStem = [
    [74, 164],
    [94, 136],
    [58, 112],
    [76, 84],
  ]
  const vineFloret = (() => {
    const lowLeaf = at(floretStem, 0.3)
    const highLeaf = at(floretStem, 0.68)
    return piece(floretStem, 6, 2.5, [
      // turned so a petal points back down the stem, or the flower reads as
      // floating just above it
      floret(76, 58, 34, 36),
      frond(lowLeaf[0], lowLeaf[1], heading(floretStem, 0.3) + 118, 34, 10),
      frond(highLeaf[0], highLeaf[1], heading(floretStem, 0.68) - 118, 28, 9),
      floret(122, 112, 15, 40),
      glint(22, 100, 8),
      glint(128, 28, 6),
    ])
  })()

  const cornerStem = [
    [12, 192],
    [84, 190],
    [146, 156],
    [184, 78],
  ]
  const vineCorner = (() => {
    const sideRoot = at(cornerStem, 0.42)
    const side = [sideRoot, [sideRoot[0] + 28, sideRoot[1] - 34], [102, 118], [78, 106]]
    const sideTip = at(side, 1)
    const lowLeaf = at(cornerStem, 0.22)
    const midLeaf = at(cornerStem, 0.66)
    const highLeaf = at(cornerStem, 0.86)
    return piece(cornerStem, 8, 2.4, [
      coil(at(cornerStem, 1)[0], at(cornerStem, 1)[1], heading(cornerStem, 1), 21, 0.8, 2.4),
      branch(side[0], side[1], side[2], side[3], 4.6, 1.3),
      coil(sideTip[0], sideTip[1], heading(side, 1), 14, 0.6, 1.3),
      frond(lowLeaf[0], lowLeaf[1], heading(cornerStem, 0.22) - 118, 40, 12),
      frond(midLeaf[0], midLeaf[1], heading(cornerStem, 0.66) + 118, 32, 10),
      frond(highLeaf[0], highLeaf[1], heading(cornerStem, 0.86) - 118, 26, 8),
      floret(38, 118, 22, 20),
      floret(152, 38, 16, 45),
      glint(108, 58, 8),
      glint(204, 140, 6),
      glint(16, 56, 5),
    ])
  })()

  const sprigStem = [
    [58, 232],
    [34, 180],
    [84, 140],
    [62, 86],
  ]
  const sprigTop = [
    [62, 86],
    [44, 58],
    [80, 44],
    [66, 16],
  ]
  const vineSprig = (() => {
    const lowLeaf = at(sprigStem, 0.26)
    const midLeaf = at(sprigStem, 0.58)
    const highLeaf = at(sprigStem, 0.85)
    return piece(sprigStem, 9, 3, [
      branch(sprigTop[0], sprigTop[1], sprigTop[2], sprigTop[3], 3, 1.2),
      coil(at(sprigTop, 1)[0], at(sprigTop, 1)[1], heading(sprigTop, 1), 13, 0.65, 1.2),
      frond(lowLeaf[0], lowLeaf[1], heading(sprigStem, 0.26) - 118, 34, 10),
      frond(midLeaf[0], midLeaf[1], heading(sprigStem, 0.58) + 118, 30, 9),
      frond(highLeaf[0], highLeaf[1], heading(sprigStem, 0.85) - 118, 24, 7),
      floret(90, 166, 16, 30),
      glint(24, 138, 6),
      glint(98, 90, 5),
    ])
  })()

  void scrollSideA
  return {
    'vine-scroll': { width: 180, height: 420, art: vineScroll },
    'vine-branch': { width: 170, height: 300, art: vineBranch },
    'vine-curl': { width: 170, height: 170, art: vineCoil },
    'vine-bloom': { width: 150, height: 170, art: vineFloret },
    'vine-corner': { width: 220, height: 200, art: vineCorner },
    'vine-sprig': { width: 120, height: 240, art: vineSprig },
  }
})()

const flash = {
  'vine-trail': {
    width: 60,
    height: 190,
    art: `
      ${line('M30 186 C14 160 44 144 28 118 C12 92 44 76 30 50 C22 34 26 18 32 4', 1.4)}
      ${leafLine(27, 156, -30, 16, 4)}
      ${leafLine(31, 142, 150, 15, 4)}
      ${leafLine(26, 104, -25, 14, 3.6)}
      ${leafLine(32, 92, 155, 13, 3.4)}
      ${leafLine(28, 60, -35, 12, 3)}
      ${blossom(20, 128, 8)}
      ${blossom(40, 82, 9, 20)}
      ${blossom(24, 36, 7, 40)}
      ${line('M30 170 C42 166 46 156 38 152 C33 149 30 154 34 157', 0.9)}
      ${line('M29 70 C17 66 13 56 21 52 C26 49 29 54 25 57', 0.9)}
      ${dot(38, 118)} ${dot(18, 96, 1)} ${dot(40, 52, 1)} ${dot(22, 16, 1)}
    `,
  },
  lily: {
    width: 100,
    height: 150,
    art: `
      ${Array.from({ length: 6 }, (unused, index) =>
        `<g transform="rotate(${index * 60} 50 62)">${line('M50 62 C40 40 40 18 50 2 C60 18 60 40 50 62', 1.2)}${line('M50 62 L50 10', 0.6)}</g>`,
      ).join('\n')}
      ${Array.from({ length: 5 }, (unused, index) => {
        const angle = -140 + index * 20
        const rad = (angle * Math.PI) / 180
        const tipX = 50 + Math.cos(rad) * 26
        const tipY = 62 + Math.sin(rad) * 26
        return line(`M50 62 Q${(50 + Math.cos(rad) * 14).toFixed(1)} ${(62 + Math.sin(rad) * 20).toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}`, 0.8) + dot(tipX, tipY, 1.8)
      }).join('\n')}
      ${line('M50 62 C52 92 46 116 50 148', 1.3)}
      ${leafLine(50, 104, 160, 26, 6)}
      ${leafLine(50, 124, 20, 22, 5)}
    `,
  },
  'thorn-trail': {
    width: 70,
    height: 190,
    art: `
      ${line('M35 188 C20 158 50 140 34 112 C18 84 50 66 35 38 C28 24 32 14 36 2', 1.5)}
      ${Array.from({ length: 7 }, (unused, index) => {
        const y = 24 + index * 24
        const side = index % 2 === 0 ? 1 : -1
        const x = 35 + Math.sin(index * 1.2) * 6
        return spike(x, y, side > 0 ? -34 : 214, 22 - index, 3.2)
      }).join('\n')}
      ${fourStar(52, 40, 7)}
      ${fourStar(18, 100, 6)}
      ${fourStar(50, 158, 5)}
      ${dot(24, 64, 1.2)} ${dot(46, 124, 1.2)}
    `,
  },
  tendril: {
    width: 110,
    height: 110,
    art: `
      ${line('M4 100 C34 100 58 86 70 64 C80 46 74 28 58 26 C44 24 36 38 46 46 C54 52 64 46 62 38', 1.3)}
      ${line('M34 94 C40 84 38 74 30 72', 0.9)}
      ${line('M66 76 C76 74 82 66 80 58', 0.9)}
      ${blossom(92, 36, 10)}
      ${leafLine(52, 90, -40, 18, 4.5)}
      ${dot(22, 86, 1.2)} ${dot(86, 60, 1.2)}
    `,
  },
  'rose-line': {
    width: 100,
    height: 150,
    art: `
      ${line('M50 36 C44 30 36 34 36 42 C36 52 46 58 56 54 C68 49 70 34 60 26 C48 16 30 22 26 38 C22 56 38 70 56 68', 1.1)}
      ${line('M26 44 C18 56 22 72 36 78', 1)}
      ${line('M74 40 C80 54 74 70 60 76', 1)}
      ${line('M50 74 C52 100 48 124 50 148', 1.3)}
      ${leafLine(50, 100, 165, 24, 6)}
      ${leafLine(50, 120, 15, 20, 5)}
      ${line('M50 92 L42 86', 0.8)}
      ${line('M50 112 L58 106', 0.8)}
    `,
  },
  'star-spark': {
    width: 110,
    height: 110,
    art: `
      ${fourStar(46, 44, 38, 0.17)}
      ${fourStar(88, 78, 16, 0.2)}
      ${fourStar(22, 88, 11, 0.2)}
    `,
  },
  'butterfly-line': {
    width: 120,
    height: 100,
    art: `
      ${line('M60 32 C58 50 58 64 60 76', 1.2)}
      ${dot(60, 28, 3)}
      ${line('M58 26 C50 12 38 6 30 10', 0.8)}
      ${line('M62 26 C70 12 82 6 90 10', 0.8)}
      ${line('M57 38 C40 16 8 20 12 44 C15 62 44 60 57 48', 1.1)}
      ${line('M63 38 C80 16 112 20 108 44 C105 62 76 60 63 48', 1.1)}
      ${line('M57 54 C44 46 18 54 24 72 C30 86 50 76 57 64', 1.1)}
      ${line('M63 54 C76 46 102 54 96 72 C90 86 70 76 63 64', 1.1)}
      ${line('M50 36 C40 34 30 38 26 44', 0.7)}
      ${line('M70 36 C80 34 90 38 94 44', 0.7)}
      ${dot(32, 40, 1.4)} ${dot(88, 40, 1.4)}
    `,
  },
  'baby-breath': {
    width: 90,
    height: 160,
    art: `
      ${line('M45 158 C42 126 46 100 44 72', 1.2)}
      ${Array.from({ length: 9 }, (unused, index) => {
        const angle = -120 + index * 15
        const rad = (angle * Math.PI) / 180
        const length = 34 - Math.abs(index - 4) * 3
        const tipX = 44 + Math.cos(rad) * length
        const tipY = 72 + Math.sin(rad) * length
        return line(`M44 72 Q${(44 + Math.cos(rad) * length * 0.6).toFixed(1)} ${(72 + Math.sin(rad) * length * 0.75).toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}`, 0.7) + dot(tipX, tipY, 2.6)
      }).join('\n')}
      ${leafLine(44, 118, 150, 18, 3)}
      ${leafLine(45, 134, 30, 16, 3)}
    `,
  },
}

for (const [name, art] of Object.entries(stickers)) {
  writeFileSync(new URL(`${name}.svg`, OUT), wrap(art))
}

for (const [name, piece] of Object.entries({ ...sigil, ...flash })) {
  writeFileSync(new URL(`${name}.svg`, OUT), flashWrap(piece.art, piece.width, piece.height))
}

const manifest = {
  items: [
    ...Object.keys(sigil).map((name) => ({
      id: name,
      name: name.replace(/^vine-/, '').replace(/-/g, ' '),
      group: 'filigree',
      src: `/stickers/${name}.svg`,
    })),
    ...Object.keys(flash).map((name) => ({
      id: name,
      name: name.replace(/-/g, ' '),
      group: 'fine line',
      src: `/stickers/${name}.svg`,
    })),
    ...Object.keys(stickers).map((name) => ({
      id: name,
      name: name.replace(/-/g, ' '),
      group: 'pressed',
      src: `/stickers/${name}.svg`,
    })),
  ],
}
writeFileSync(new URL('manifest.json', OUT), JSON.stringify(manifest, null, 2) + '\n')
console.log(
  'wrote',
  Object.keys(stickers).length,
  'silhouettes,',
  Object.keys(sigil).length,
  'sigils,',
  Object.keys(flash).length,
  'fine-line pieces',
)


// a botanical border for the strip, composed from the same silhouettes: this is
// what a sunprint looks like when the flowers are laid around the photographs
// rather than on them
const FRAME_WIDTH = 600
const FRAME_HEIGHT = 1800

const placements = [
  ['fern', 52, 120, 2.3, -14],
  ['queen-annes-lace', 548, 150, 2.1, 16],
  ['lavender', 38, 420, 1.9, 8],
  ['vine-trail', 556, 470, 2.2, -6],
  ['cosmos-flower', 60, 700, 1.7, 22],
  ['baby-breath', 545, 760, 1.9, -12],
  ['daisy', 44, 980, 1.6, -18],
  ['berry-sprig', 556, 1010, 1.8, 10],
  ['wild-stem', 54, 1250, 1.9, 14],
  ['tendril', 548, 1290, 1.6, -20],
  ['sprig-dummy', 0, 0, 0, 0],
  ['clover', 70, 1530, 1.2, -24],
  ['butterfly-line', 520, 1536, 1.3, 12],
  ['star-spark', 300, 30, 0.8, 0],
  ['sparkle', 52, 1744, 1.0, 0],
  ['queen-annes-lace', 548, 1752, 1.2, -10],
]

const frameArt = placements
  .filter(([name]) => stickers[name] || flash[name] || sigil[name])
  .map(([name, x, y, scale, rotate]) => {
    const piece = stickers[name] ?? flash[name] ?? sigil[name]
    const body = typeof piece === 'string' ? piece : piece.art
    const width = typeof piece === 'string' ? 100 : piece.width
    const height = typeof piece === 'string' ? 100 : piece.height
    const strokeWidth = typeof piece === 'string' ? 0 : 1.3 * FINE
    return `  <g transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale}) translate(${-width / 2} ${-height / 2})" stroke-width="${strokeWidth}">
${body
      .trim()
      .split('\n')
      .map((entry) => '    ' + entry.trim())
      .join('\n')}
  </g>`
  })
  .join('\n')

writeFileSync(
  new URL('../frames/pressed-border.svg', OUT),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" viewBox="0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}">
  <g fill="#dde7dc" stroke="#dde7dc" stroke-width="0" stroke-linecap="round" stroke-linejoin="round" opacity="0.92">
${frameArt}
  </g>
</svg>
`,
)

writeFileSync(
  new URL('../frames/manifest.json', OUT),
  JSON.stringify(
    {
      items: [
        {
          id: 'pressed-border',
          name: 'pressed border',
          kind: 'strip',
          src: '/frames/pressed-border.svg',
          background: '#16412a',
          ink: '#eef3e9',
        },
      ],
    },
    null,
    2,
  ) + '\n',
)
console.log('wrote the pressed border frame')
