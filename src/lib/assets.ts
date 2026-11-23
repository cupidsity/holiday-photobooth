export type Frame = {
  id: string
  name: string
  // strip art covers the whole strip, photo art is stamped over each window,
  // and paper means no art at all
  kind: 'strip' | 'photo' | 'paper'
  src?: string
  background: string
  ink: string
  // where the art sits in its own file: drawn frames are exported with padding
  // round them, so the strip crops to the art
  art?: ArtBox
  // the frame's own photo windows, in strip coordinates
  windows?: Window[]
  // the height the caption is centred on, or null for a frame whose art runs
  // to the foot and leaves it nowhere to go
  caption?: number | null
  // how much room the frame leaves for it: a frame whose art runs to the foot
  // gets a smaller caption so it sits in the band rather than on the drawing
  captionScale?: number
}

// a sticker is either a piece of line art or a word set in the caption hand
import { ArtBox, Window, artScale } from './strip'

export type Sticker = {
  id: string
  name: string
  // which tray the sticker belongs to: sigil, fine line, pressed or words
  group: string
  src?: string
  text?: string
}

// the paper the print is made on. sunprint is the house stock: everything else
// is there for a guest who wants the strip warmer or darker
// every stock is dark, because a photogram only reads when the paper is darker
// than the thing laid on it
export const PAPER_FRAMES: Frame[] = [
  { id: 'forest', name: 'forest', kind: 'paper', background: '#16412a', ink: '#eef3e9' },
  { id: 'cranberry', name: 'cranberry', kind: 'paper', background: '#6d1123', ink: '#fbe8e2' },
  { id: 'sunprint', name: 'sunprint', kind: 'paper', background: '#123a6e', ink: '#eaf3fc' },
  { id: 'midnight', name: 'midnight', kind: 'paper', background: '#0a1c38', ink: '#dbe9f8' },
]

function scaleWindow(window: Window, art?: ArtBox): Window {
  const scale = artScale(art)
  return {
    x: (window.x - (art?.left ?? 0)) * scale,
    y: (window.y - (art?.top ?? 0)) * scale,
    width: window.width * scale,
    height: window.height * scale,
  }
}

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
      art: frame.art,
      // the manifest measures everything in the artwork's own file, so it is
      // all moved by the crop and scaled by however much the art is resized
      windows: frame.windows?.map((window) => scaleWindow(window, frame.art)),
      caption:
        frame.caption === null || frame.caption === undefined
          ? frame.caption
          : (frame.caption - (frame.art?.top ?? 0)) * artScale(frame.art),
      captionScale: (frame.captionScale ?? 1) * artScale(frame.art),
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
      group: sticker.group ?? 'pressed',
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
