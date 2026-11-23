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

// a sticker is either a piece of line art or a word set in the caption hand
export type Sticker = {
  id: string
  name: string
  src?: string
  text?: string
}

export const PAPER_FRAMES: Frame[] = [
  { id: 'cream', name: 'cream paper', kind: 'paper', background: '#f6efe2', ink: '#1d3b2a' },
  { id: 'forest', name: 'forest', kind: 'paper', background: '#13301f', ink: '#f6efe2' },
  { id: 'cranberry', name: 'cranberry', kind: 'paper', background: '#7d1326', ink: '#ffe9d6' },
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

// the whole set lives in public/stickers so swapping in hand-drawn art is a
// matter of dropping files in and editing the manifest
export async function loadStickers(): Promise<Sticker[]> {
  const drawn = await loadManifest<Partial<Sticker>>('/stickers/manifest.json')
  return drawn
    .filter((sticker) => !!sticker.id && (!!sticker.src || !!sticker.text))
    .map((sticker) => ({
      id: sticker.id as string,
      name: sticker.name ?? (sticker.id as string),
      src: sticker.src,
      text: sticker.text,
    }))
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
