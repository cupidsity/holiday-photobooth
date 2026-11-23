import { writeFileSync } from 'node:fs'

const OUT = '/Users/cupidity/Documents/Projects/holiday-photobooth/public/stickers'

// every sticker is the same two-pass drawing: a dark halo underneath so the
// line art stays readable on a bright photo, then the cream line on top
const wrap = (art) => `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100">
  <defs>
    <g id="art" fill="none" stroke-linecap="round" stroke-linejoin="round">
${art
  .trim()
  .split('\n')
  .map((line) => '      ' + line.trim())
  .join('\n')}
    </g>
  </defs>
  <use href="#art" stroke="#0b1711" stroke-opacity="0.4" stroke-width="9" />
  <use href="#art" stroke="#f8f2e6" stroke-width="4" />
</svg>
`

const stickers = {
  tree: `
    <path d="M50 10 L34 35 H66 Z" />
    <path d="M50 28 L26 57 H74 Z" />
    <path d="M50 48 L17 82 H83 Z" />
    <path d="M43 82 V92 H57 V82" />
    <path d="M50 4 V13 M45 8 H55" />
  `,
  star: `
    <path d="M50 9 L61 37 L91 39 L68 58 L75 88 L50 71 L25 88 L32 58 L9 39 L39 37 Z" />
  `,
  snowflake: `
    <path d="M50 8 V92" />
    <path d="M14 29 L86 71" />
    <path d="M86 29 L14 71" />
    <path d="M50 24 L40 15 M50 24 L60 15" />
    <path d="M50 76 L40 85 M50 76 L60 85" />
    <path d="M28 41 L16 42 M28 41 L27 29" />
    <path d="M72 59 L84 58 M72 59 L73 71" />
    <path d="M72 41 L73 29 M72 41 L84 42" />
    <path d="M28 59 L27 71 M28 59 L16 58" />
  `,
  gift: `
    <path d="M20 44 H80 V88 H20 Z" />
    <path d="M14 30 H86 V44 H14 Z" />
    <path d="M50 30 V88" />
    <path d="M50 30 C42 16 26 17 29 26 C31 32 44 31 50 30 Z" />
    <path d="M50 30 C58 16 74 17 71 26 C69 32 56 31 50 30 Z" />
  `,
  'candy-cane': `
    <path d="M38 90 V42 A15 15 0 0 1 68 42 V54" />
    <path d="M39 76 L53 70" />
    <path d="M39 62 L53 56" />
    <path d="M40 48 L54 43" />
    <path d="M50 32 L59 24" />
  `,
  bauble: `
    <circle cx="50" cy="58" r="29" />
    <path d="M42 24 H58 V32 H42 Z" />
    <path d="M44 24 A6 6 0 0 1 56 24" />
    <path d="M32 50 A20 20 0 0 1 48 36" />
    <path d="M23 64 H77" />
  `,
  holly: `
    <path d="M48 58 C30 56 18 44 20 30 C34 28 46 38 48 58 Z" />
    <path d="M52 58 C70 56 82 44 80 30 C66 28 54 38 52 58 Z" />
    <path d="M20 30 L48 58 M80 30 L52 58" />
    <circle cx="44" cy="70" r="7" />
    <circle cx="58" cy="66" r="6" />
    <circle cx="52" cy="80" r="6" />
  `,
  mug: `
    <path d="M24 42 H68 V70 A12 12 0 0 1 56 82 H36 A12 12 0 0 1 24 70 Z" />
    <path d="M68 50 A11 11 0 0 1 68 70" />
    <path d="M24 52 H68" />
    <path d="M38 32 C34 26 42 22 38 15" />
    <path d="M54 32 C50 26 58 22 54 15" />
  `,
  bell: `
    <path d="M28 72 C28 46 34 34 50 28 C66 34 72 46 72 72" />
    <path d="M22 72 H78" />
    <circle cx="50" cy="82" r="6" />
    <path d="M50 28 V21" />
    <circle cx="50" cy="16" r="5" />
  `,
  bow: `
    <circle cx="50" cy="50" r="7" />
    <path d="M44 46 C28 30 12 36 16 50 C12 64 28 70 44 54" />
    <path d="M56 46 C72 30 88 36 84 50 C88 64 72 70 56 54" />
    <path d="M46 56 L36 86 L50 78 L64 86 L54 56" />
  `,
  snowman: `
    <circle cx="50" cy="32" r="15" />
    <circle cx="50" cy="66" r="21" />
    <path d="M32 18 H68" />
    <path d="M38 18 V8 H62 V18" />
    <circle cx="45" cy="30" r="1.6" />
    <circle cx="55" cy="30" r="1.6" />
    <path d="M46 38 Q50 41 54 38" />
    <path d="M29 60 L10 50 M29 60 L14 62" />
    <path d="M71 60 L90 50 M71 60 L86 62" />
  `,
  sparkles: `
    <path d="M38 22 Q41 36 55 39 Q41 42 38 56 Q35 42 21 39 Q35 36 38 22 Z" />
    <path d="M70 48 Q72 58 82 60 Q72 62 70 72 Q68 62 58 60 Q68 58 70 48 Z" />
    <path d="M46 70 Q47 77 54 78 Q47 79 46 86 Q45 79 38 78 Q45 77 46 70 Z" />
  `,
  heart: `
    <path d="M50 85 C18 64 12 43 25 32 C36 23 48 30 50 39 C52 30 64 23 75 32 C88 43 82 64 50 85 Z" />
  `,
  daisy: `
    <circle cx="50" cy="42" r="9" />
    <path d="M50 33 C44 20 56 20 50 33 Z" />
    <path d="M59 38 C72 30 73 42 59 38 Z" />
    <path d="M57 50 C68 60 57 65 57 50 Z" />
    <path d="M43 50 C43 65 32 60 43 50 Z" />
    <path d="M41 38 C27 42 28 30 41 38 Z" />
    <path d="M50 51 C52 66 50 78 46 90" />
    <path d="M49 68 C40 66 34 60 33 52 C42 52 48 58 49 68 Z" />
  `,
  rose: `
    <circle cx="50" cy="38" r="20" />
    <path d="M50 28 A10 10 0 1 1 42 44" />
    <path d="M52 34 A5 5 0 1 1 47 39" />
    <path d="M50 58 V88" />
    <path d="M50 70 C40 70 33 64 32 55 C42 55 49 61 50 70 Z" />
    <path d="M50 78 C60 78 67 72 68 63 C58 63 51 69 50 78 Z" />
  `,
  tulip: `
    <path d="M32 30 C32 52 38 62 50 66 C62 62 68 52 68 30 C62 38 56 34 50 26 C44 34 38 38 32 30 Z" />
    <path d="M50 66 V90" />
    <path d="M50 76 C38 76 30 68 29 56 C41 56 49 64 50 76 Z" />
  `,
  sprig: `
    <path d="M50 92 C50 60 54 36 66 14" />
    <path d="M52 76 C40 74 34 66 34 56 C44 57 51 65 52 76 Z" />
    <path d="M55 60 C66 56 70 47 68 38 C59 42 54 50 55 60 Z" />
    <path d="M55 44 C44 42 39 34 39 25 C48 27 55 34 55 44 Z" />
  `,
  butterfly: `
    <path d="M50 30 V74" />
    <circle cx="50" cy="26" r="4" />
    <path d="M47 24 C42 14 34 10 30 14" />
    <path d="M53 24 C58 14 66 10 70 14" />
    <path d="M48 36 C34 20 12 26 16 44 C19 57 38 56 48 46 Z" />
    <path d="M52 36 C66 20 88 26 84 44 C81 57 62 56 52 46 Z" />
    <path d="M48 52 C38 46 20 52 24 66 C28 78 44 72 48 62 Z" />
    <path d="M52 52 C62 46 80 52 76 66 C72 78 56 72 52 62 Z" />
  `,
  moon: `
    <path d="M62 14 A38 38 0 1 0 62 86 A30 30 0 1 1 62 14 Z" />
    <path d="M76 24 L79 32 L87 35 L79 38 L76 46 L73 38 L65 35 L73 32 Z" />
    <path d="M84 56 L86 61 L91 63 L86 65 L84 70 L82 65 L77 63 L82 61 Z" />
  `,
  wreath: `
    <circle cx="50" cy="52" r="30" />
    <path d="M50 22 L50 12 M68 28 L75 21 M80 44 L89 40 M80 62 L89 66 M68 77 L75 84 M50 82 L50 92 M32 77 L25 84 M20 62 L11 66 M20 44 L11 40 M32 28 L25 21" />
    <path d="M42 86 C34 92 30 84 38 82 M58 86 C66 92 70 84 62 82" />
    <circle cx="50" cy="86" r="4" />
  `,
}

for (const [name, art] of Object.entries(stickers)) {
  writeFileSync(`${OUT}/${name}.svg`, wrap(art))
}

// word stickers are drawn as live text in the caption font rather than art
// files, so they stay crisp at any size
const words = [
  'merry',
  'xoxo',
  'ho ho ho',
  'so cozy',
  'let it snow',
  'cheers!',
  'be mine',
  'brrr',
  'darling',
  '<3',
]

const manifest = {
  items: [
    ...Object.keys(stickers).map((name) => ({
      id: name,
      name: name.replace(/-/g, ' '),
      src: `/stickers/${name}.svg`,
    })),
    ...words.map((word) => ({
      id: `word-${word.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'heart'}`,
      name: word,
      text: word,
    })),
  ],
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n')
console.log('wrote', Object.keys(stickers).length, 'stickers')
