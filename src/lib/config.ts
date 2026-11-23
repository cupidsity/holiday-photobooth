// the url the invite qr code points at. set VITE_BOOTH_URL in vercel so the
// tree encodes the real deployment, or pass ?url= when testing locally.
const FALLBACK_BOOTH_URL = 'https://holiday-photobooth.vercel.app'

export function boothUrl(): string {
  const fromQuery = new URLSearchParams(window.location.search).get('url')
  if (fromQuery) return fromQuery
  const fromEnv = import.meta.env.VITE_BOOTH_URL as string | undefined
  return fromEnv || FALLBACK_BOOTH_URL
}

// printed on the strip footer and the invite screen
export const PARTY_NAME = 'holiday party'
export const PARTY_YEAR = new Date().getFullYear()
