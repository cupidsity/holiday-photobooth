export type Frame = {
  id: string
  name: string
  // strip art covers the whole 600x1800 strip, photo art is stamped over each
  // of the three photo cells, and paper means no art at all
  kind: 'strip' | 'photo' | 'paper'
  src?: string
  background: string
  ink: string
}

export type Sticker = {
  id: string
  name: string
  // emoji stickers need no art files, image stickers come from public/stickers
  glyph?: string
  src?: string
}

export const PAPER_FRAMES: Frame[] = [
  { id: 'cream', name: 'cream paper', kind: 'paper', background: '#f6efe2', ink: '#1d3b2a' },
  { id: 'forest', name: 'forest', kind: 'paper', background: '#13301f', ink: '#f6efe2' },
  { id: 'cranberry', name: 'cranberry', kind: 'paper', background: '#7d1326', ink: '#ffe9d6' },
]

const EMOJI_STICKERS: Sticker[] = [
  { id: 'tree', name: 'tree', glyph: '🎄' },
  { id: 'santa', name: 'santa', glyph: '🎅' },
  { id: 'snowflake', name: 'snowflake', glyph: '❄️' },
  { id: 'gift', name: 'gift', glyph: '🎁' },
  { id: 'star', name: 'star', glyph: '⭐' },
  { id: 'candycane', name: 'candy cane', glyph: '🍬' },
  { id: 'cocoa', name: 'cocoa', glyph: '☕' },
  { id: 'bells', name: 'bells', glyph: '🔔' },
  { id: 'wreath', name: 'wreath', glyph: '🎀' },
  { id: 'snowman', name: 'snowman', glyph: '⛄' },
  { id: 'sparkles', name: 'sparkles', glyph: '✨' },
  { id: 'reindeer', name: 'reindeer', glyph: '🦌' },
  { id: 'mistletoe', name: 'mistletoe', glyph: '🌿' },
  { id: 'heart', name: 'heart', glyph: '❤️' },
]

type Manifest<T> = { items?: T[] } | T[]

async function loadManifest<T>(url: string): Promise<T[]> {
  try {
    const response = await fetch(url, { cache: 'no-cache' })
    if (!response.ok) return []
    const parsed = (await response.json()) as Manifest<T>
    const items = Array.isArray(parsed) ? parsed : parsed.items
    return Array.isArray(items) ? items : []
  } catch {
    // a missing manifest is the normal case before any art is dropped in
    return []
  }
}

export async function loadFrames(): Promise<Frame[]> {
  const drawn = await loadManifest<Partial<Frame>>('/frames/manifest.json')
  const normalised = drawn
    .filter((frame): frame is Partial<Frame> & { id: string; src: string } => !!frame.id && !!frame.src)
    .map((frame) => ({
      id: frame.id,
      name: frame.name ?? frame.id,
      kind: frame.kind === 'photo' ? ('photo' as const) : ('strip' as const),
      src: frame.src,
      background: frame.background ?? '#f6efe2',
      ink: frame.ink ?? '#1d3b2a',
    }))
  return [...normalised, ...PAPER_FRAMES]
}

export async function loadStickers(): Promise<Sticker[]> {
  const drawn = await loadManifest<Partial<Sticker>>('/stickers/manifest.json')
  const normalised = drawn
    .filter((sticker): sticker is Partial<Sticker> & { id: string; src: string } => !!sticker.id && !!sticker.src)
    .map((sticker) => ({ id: sticker.id, name: sticker.name ?? sticker.id, src: sticker.src }))
  return [...normalised, ...EMOJI_STICKERS]
}

const imageCache = new Map<string, Promise<HTMLImageElement>>()

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src)
  if (cached) return cached
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`could not load ${src}`))
    image.src = src
  })
  imageCache.set(src, pending)
  return pending
}
