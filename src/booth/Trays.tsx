import { Frame, Sticker } from '../lib/assets'
import { FILTERS, cssFilter } from '../lib/filters'

type FilterTrayProps = {
  activeId: string
  onPick: (id: string) => void
  // a captured frame used as the thumbnail so each chip previews the real look
  thumbnail: string | null
}

export function FilterTray({ activeId, onPick, thumbnail }: FilterTrayProps) {
  return (
    <div className="tray">
      {FILTERS.map((filter) => (
        <button
          key={filter.id}
          className={`tray-item${filter.id === activeId ? ' active' : ''}`}
          onClick={() => onPick(filter.id)}
        >
          <span className="swatch">
            {thumbnail ? (
              <img src={thumbnail} alt="" style={{ filter: cssFilter(filter) }} />
            ) : (
              <span className="swatch-blank" style={{ filter: cssFilter(filter) }} />
            )}
            {filter.wash && (
              <span
                className="swatch-wash"
                style={{ background: filter.wash.color, opacity: filter.wash.alpha, mixBlendMode: filter.wash.blend }}
              />
            )}
          </span>
          <span className="tray-label">{filter.name}</span>
        </button>
      ))}
    </div>
  )
}

type FrameTrayProps = {
  frames: Frame[]
  activeId: string
  onPick: (id: string) => void
}

export function FrameTray({ frames, activeId, onPick }: FrameTrayProps) {
  return (
    <div className="tray">
      {frames.map((frame) => (
        <button
          key={frame.id}
          className={`tray-item${frame.id === activeId ? ' active' : ''}`}
          onClick={() => onPick(frame.id)}
        >
          <span className="swatch frame-swatch" style={{ background: frame.background }}>
            {frame.src ? <img src={frame.src} alt="" /> : <span className="swatch-paper" style={{ borderColor: frame.ink }} />}
          </span>
          <span className="tray-label">{frame.name}</span>
        </button>
      ))}
    </div>
  )
}

type StickerTrayProps = {
  stickers: Sticker[]
  onPick: (sticker: Sticker) => void
}

export function StickerTray({ stickers, onPick }: StickerTrayProps) {
  return (
    <div className="tray sticker-tray">
      {stickers.map((sticker) => (
        <button
          key={sticker.id}
          className={`tray-item sticker-item${sticker.text ? ' word' : ''}`}
          onClick={() => onPick(sticker)}
          aria-label={`add ${sticker.name}`}
        >
          {sticker.text ? sticker.text : <img src={sticker.src} alt="" />}
        </button>
      ))}
    </div>
  )
}
