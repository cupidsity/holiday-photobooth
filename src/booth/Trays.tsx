import { Frame, Sticker } from '../lib/assets'
import { FILTERS, cssFilter, withExposure } from '../lib/filters'

type FilterTrayProps = {
  activeId: string
  exposure: number
  onPick: (id: string) => void
  // a captured frame used as the thumbnail so each chip previews the real look
  thumbnail: string | null
}

export function FilterTray({ activeId, exposure, onPick, thumbnail }: FilterTrayProps) {
  return (
    <div className="tray">
      {FILTERS.map((filter) => {
        const developed = withExposure(filter, exposure)
        return (
          <button
            key={filter.id}
            className={`tray-item${filter.id === activeId ? ' active' : ''}`}
            onClick={() => onPick(filter.id)}
          >
            <span className="swatch">
              {thumbnail ? (
                <img src={thumbnail} alt="" style={{ filter: cssFilter(developed) }} />
              ) : (
                <span className="swatch-blank" style={{ filter: cssFilter(developed) }} />
              )}
              {developed.wash && (
                <span
                  className="swatch-wash"
                  style={{
                    background: developed.wash.color,
                    opacity: developed.wash.alpha,
                    mixBlendMode: developed.wash.blend,
                  }}
                />
              )}
            </span>
            <span className="tray-label">{filter.name}</span>
          </button>
        )
      })}
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
            {frame.src ? (
              <img src={frame.src} alt="" />
            ) : (
              <span className="swatch-paper" style={{ borderColor: frame.ink }} />
            )}
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

const GROUP_ORDER = ['filigree', 'fine line', 'pressed', 'words']

export function StickerTray({ stickers, onPick }: StickerTrayProps) {
  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: stickers.filter((sticker) => sticker.group === group),
  })).filter((entry) => entry.items.length > 0)

  return (
    <div className="sticker-groups">
      {groups.map(({ group, items }) => (
        <section key={group}>
          <h3 className="group-name">{group}</h3>
          <div className="sticker-tray">
            {items.map((sticker) => (
              <button
                key={sticker.id}
                className={`sticker-item${sticker.text ? ' word' : ''}`}
                onClick={() => onPick(sticker)}
                aria-label={`press on ${sticker.name}`}
              >
                {sticker.text ? sticker.text : <img src={sticker.src} alt="" />}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

type DialProps = {
  label: string
  note: string
  value: number
  onChange: (value: number) => void
}

export function Dial({ label, note, value, onChange }: DialProps) {
  return (
    <label className="dial">
      <span className="dial-head">
        <span className="dial-label">{label}</span>
        <span className="dial-note">{note}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
    </label>
  )
}
