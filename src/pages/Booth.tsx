import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CameraStage } from '../booth/CameraStage'
import { FilterTray, FrameTray, StickerTray } from '../booth/Trays'
import { StripPreview } from '../booth/StripPreview'
import { useCamera } from '../booth/useCamera'
import { Frame, PAPER_FRAMES, Sticker, loadFrames, loadStickers } from '../lib/assets'
import { PARTY_NAME, PARTY_YEAR } from '../lib/config'
import { cssFilter, filterById } from '../lib/filters'
import { PlacedSticker, StripOptions, renderStrip } from '../lib/render'
import { PHOTO_HEIGHT, PHOTO_WIDTH, drawCover } from '../lib/strip'
import { canShareStrip, saveStrip, shareStrip } from '../lib/download'
import '../styles/booth.css'

type Phase = 'intro' | 'shoot' | 'edit'
type Tab = 'frame' | 'filter' | 'stickers' | 'caption'

const COUNTDOWN_FROM = 3
const BETWEEN_SHOTS_MS = 900

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

export function Booth() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const camera = useCamera(videoRef)
  const sequenceRef = useRef(0)

  const [phase, setPhase] = useState<Phase>('intro')
  const [tab, setTab] = useState<Tab>('frame')
  const [shots, setShots] = useState<(HTMLCanvasElement | null)[]>([null, null, null])
  const [thumbnails, setThumbnails] = useState<(string | null)[]>([null, null, null])
  const [frames, setFrames] = useState<Frame[]>(PAPER_FRAMES)
  const [stickerKinds, setStickerKinds] = useState<Sticker[]>([])
  const [frameId, setFrameId] = useState('garland')
  const [filterId, setFilterId] = useState('noel')
  const [caption, setCaption] = useState(`${PARTY_NAME} ${PARTY_YEAR}`)
  const [subcaption, setSubcaption] = useState(todayLabel())
  const [placed, setPlaced] = useState<PlacedSticker[]>([])
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null)
  const [mirrored, setMirrored] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [flashing, setFlashing] = useState(false)
  const [shooting, setShooting] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    loadFrames().then((loaded) => {
      setFrames(loaded)
      setFrameId((current) => (loaded.some((frame) => frame.id === current) ? current : loaded[0]?.id ?? 'cream'))
    })
    loadStickers().then(setStickerKinds)
  }, [])

  const frame = useMemo(() => frames.find((item) => item.id === frameId) ?? frames[0], [frames, frameId])
  const filter = useMemo(() => filterById(filterId), [filterId])
  const filledShots = shots.filter((shot): shot is HTMLCanvasElement => !!shot)

  const stripOptions: StripOptions = useMemo(
    () => ({
      shots: shots.map((shot) => shot ?? (undefined as unknown as HTMLCanvasElement)),
      frame,
      filter,
      caption,
      subcaption,
      stickers: placed,
    }),
    [shots, frame, filter, caption, subcaption, placed],
  )

  const grabFrame = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = PHOTO_WIDTH
    canvas.height = PHOTO_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    if (mirrored) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    // photos are stored unfiltered so the filter stays changeable after the
    // shoot, and the strip renderer is the only thing that bakes it in
    drawCover(ctx, video, video.videoWidth, video.videoHeight, 0, 0, canvas.width, canvas.height)
    return canvas
  }, [mirrored])

  const runSequence = useCallback(
    async (targets: number[]) => {
      const runId = sequenceRef.current + 1
      sequenceRef.current = runId
      setShooting(true)
      setNote(null)

      for (const index of targets) {
        for (let tick = COUNTDOWN_FROM; tick > 0; tick -= 1) {
          if (sequenceRef.current !== runId) return
          setCountdown(tick)
          await sleep(1000)
        }
        if (sequenceRef.current !== runId) return
        setCountdown(0)
        setFlashing(true)
        const shot = grabFrame()
        await sleep(160)
        setFlashing(false)
        setCountdown(null)
        if (!shot) {
          setNote('that frame did not come through, try again')
          continue
        }
        setShots((current) => current.map((existing, slot) => (slot === index ? shot : existing)))
        setThumbnails((current) =>
          current.map((existing, slot) => (slot === index ? shot.toDataURL('image/jpeg', 0.6) : existing)),
        )
        if (index !== targets[targets.length - 1]) await sleep(BETWEEN_SHOTS_MS)
      }

      if (sequenceRef.current !== runId) return
      setShooting(false)
      setPhase('edit')
      camera.stop()
    },
    [camera, grabFrame],
  )

  async function openBooth() {
    await camera.start()
    setPhase('shoot')
  }

  function cancelSequence() {
    sequenceRef.current += 1
    setShooting(false)
    setCountdown(null)
    setFlashing(false)
  }

  async function retake(targets: number[]) {
    setShots((current) => current.map((shot, index) => (targets.includes(index) ? null : shot)))
    setThumbnails((current) => current.map((thumb, index) => (targets.includes(index) ? null : thumb)))
    setPhase('shoot')
    await camera.start()
    runSequence(targets)
  }

  function startOver() {
    cancelSequence()
    setShots([null, null, null])
    setThumbnails([null, null, null])
    setPlaced([])
    setSelectedSticker(null)
    setPhase('intro')
    camera.stop()
  }

  function addSticker(sticker: Sticker) {
    const key = `${sticker.id}-${Date.now().toString(36)}`
    setPlaced((current) => [
      ...current,
      {
        key,
        stickerId: sticker.id,
        glyph: sticker.glyph,
        src: sticker.src,
        // new stickers land slightly off centre and nudge down the strip so a
        // handful dropped in a row do not stack perfectly on top of each other
        x: 0.5 + (current.length % 3 - 1) * 0.16,
        y: 0.22 + (current.length % 4) * 0.18,
        size: 0.22,
        rotation: ((current.length % 5) - 2) * 0.12,
      },
    ])
    setSelectedSticker(key)
  }

  async function handleSave() {
    setBusy('saving')
    try {
      const canvas = await renderStrip(stripOptions)
      await saveStrip(canvas)
      setNote('strip saved to your downloads')
    } catch {
      setNote('saving fell over, try again')
    } finally {
      setBusy(null)
    }
  }

  async function handleShare() {
    setBusy('sharing')
    try {
      const canvas = await renderStrip(stripOptions)
      const shared = await shareStrip(canvas, `${caption} 📸`)
      if (!shared) await saveStrip(canvas)
    } catch {
      setNote('sharing fell over, try saving instead')
    } finally {
      setBusy(null)
    }
  }

  if (phase === 'intro') {
    return (
      <div className="app booth intro">
        <div className="intro-card">
          <h1 className="wordmark">
            holiday <span>photobooth</span>
          </h1>
          <p className="intro-copy">
            three photos, one strip. pick a frame, add stickers, save it to your phone.
          </p>
          <button className="button" onClick={openBooth}>
            start the booth
          </button>
          <p className="subtle">your camera stays on your device — nothing is uploaded</p>
        </div>
      </div>
    )
  }

  if (phase === 'shoot') {
    const pending = shots.filter((shot) => !shot).length
    return (
      <div className="app booth">
        <h1 className="wordmark small">
          holiday <span>photobooth</span>
        </h1>

        <CameraStage
          videoRef={videoRef}
          camera={camera.state}
          mirrored={mirrored}
          filterCss={cssFilter(filter)}
          countdown={countdown}
          flashing={flashing}
          shotCount={filledShots.length}
          hasMultipleCameras={camera.hasMultipleCameras}
          onFlip={camera.flip}
          onToggleMirror={() => setMirrored((current) => !current)}
          onRetry={() => camera.start()}
        />

        <div className="shot-rail">
          {thumbnails.map((thumb, index) => (
            <div key={index} className={`shot-slot${thumb ? ' filled' : ''}`}>
              {thumb ? <img src={thumb} alt={`shot ${index + 1}`} /> : <span>{index + 1}</span>}
            </div>
          ))}
        </div>

        {note && <p className="note">{note}</p>}

        <div className="actions">
          {shooting ? (
            <button className="button ghost" onClick={cancelSequence}>
              stop
            </button>
          ) : (
            <button
              className="button"
              disabled={camera.state.status !== 'live'}
              onClick={() => runSequence(shots.map((shot, index) => (shot ? -1 : index)).filter((index) => index >= 0))}
            >
              {pending === 3 ? 'take 3 photos' : `take ${pending} more`}
            </button>
          )}
          {filledShots.length === 3 && !shooting && (
            <button className="button gold" onClick={() => setPhase('edit')}>
              to the strip
            </button>
          )}
        </div>

        <details className="look-ahead">
          <summary>pick a look first</summary>
          <FilterTray activeId={filterId} onPick={setFilterId} thumbnail={thumbnails.find(Boolean) ?? null} />
        </details>
      </div>
    )
  }

  return (
    <div className="app booth edit">
      <div className="edit-layout">
        <div className="strip-column">
          <StripPreview
            options={stripOptions}
            selectedKey={selectedSticker}
            onSelect={setSelectedSticker}
            onChange={setPlaced}
          />
        </div>

        <div className="panel">
          <div className="tabs">
            {(['frame', 'filter', 'stickers', 'caption'] as Tab[]).map((name) => (
              <button
                key={name}
                className={`tab${tab === name ? ' active' : ''}`}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </div>

          {tab === 'frame' && <FrameTray frames={frames} activeId={frameId} onPick={setFrameId} />}
          {tab === 'filter' && (
            <FilterTray activeId={filterId} onPick={setFilterId} thumbnail={thumbnails.find(Boolean) ?? null} />
          )}
          {tab === 'stickers' && (
            <>
              <StickerTray stickers={stickerKinds} onPick={addSticker} />
              <p className="hint">
                drag to move. tap a sticker, then pull the ⤡ corner to resize and spin it, or × to bin it.
              </p>
              {placed.length > 0 && (
                <button className="button ghost small" onClick={() => setPlaced([])}>
                  clear stickers
                </button>
              )}
            </>
          )}
          {tab === 'caption' && (
            <div className="caption-fields">
              <label>
                big line
                <input value={caption} maxLength={28} onChange={(event) => setCaption(event.target.value)} />
              </label>
              <label>
                small line
                <input value={subcaption} maxLength={34} onChange={(event) => setSubcaption(event.target.value)} />
              </label>
            </div>
          )}

          {note && <p className="note">{note}</p>}

          <div className="actions stacked">
            <button className="button" disabled={!!busy} onClick={handleSave}>
              {busy === 'saving' ? 'saving…' : 'save strip'}
            </button>
            {canShareStrip() && (
              <button className="button gold" disabled={!!busy} onClick={handleShare}>
                {busy === 'sharing' ? 'sharing…' : 'share'}
              </button>
            )}
            <button className="button ghost" onClick={() => retake([0, 1, 2])}>
              retake all
            </button>
            <div className="retake-row">
              {[0, 1, 2].map((index) => (
                <button key={index} className="button ghost small" onClick={() => retake([index])}>
                  redo {index + 1}
                </button>
              ))}
            </div>
            <button className="button ghost small" onClick={startOver}>
              start over
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
