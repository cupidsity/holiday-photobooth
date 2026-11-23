import { CSSProperties, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CameraStage } from '../booth/CameraStage'
import { Dial, FilterTray, FrameTray, StickerTray } from '../booth/Trays'
import { StripPreview } from '../booth/StripPreview'
import { ARRANGEMENTS, placeArrangement } from '../booth/presets'
import { useCamera } from '../booth/useCamera'
import { Frame, PAPER_FRAMES, Sticker, loadFrames, loadStickers } from '../lib/assets'
import { BOOTH_NAME, PARTY_NAME, PARTY_YEAR } from '../lib/config'
import { cssFilter, filterById, withExposure } from '../lib/filters'
import { CaptionFace, PlacedSticker, StripOptions, renderStrip } from '../lib/render'
import { CAPTURE_HEIGHT, CAPTURE_WIDTH, STRIP, bleedTop, drawCover } from '../lib/strip'
import { canShareStrip, saveStrip, shareStrip } from '../lib/download'
import '../styles/booth.css'

type Phase = 'intro' | 'shoot' | 'develop' | 'edit'
type Tab = 'look' | 'press' | 'words' | 'paper'

const COUNTDOWN_FROM = 3
const BETWEEN_SHOTS_MS = 900
const EVERY_SHOT = Array.from({ length: STRIP.photoCount }, (_item, index) => index)
const DEVELOP_MS = 5200

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

// the slice of the open tray that stays usable while the strip grows, and the
// panel's own padding and gaps around it
const TRAY_FLOOR = 104
const PANEL_CHROME = 74

export function Booth() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const camera = useCamera(videoRef)
  const sequenceRef = useRef(0)

  const [phase, setPhase] = useState<Phase>('intro')
  const [tab, setTab] = useState<Tab>('look')
  const [shots, setShots] = useState<(HTMLCanvasElement | null)[]>(() => EVERY_SHOT.map(() => null))
  const [thumbnails, setThumbnails] = useState<(string | null)[]>(() => EVERY_SHOT.map(() => null))
  const [frames, setFrames] = useState<Frame[]>(PAPER_FRAMES)
  const [stickerKinds, setStickerKinds] = useState<Sticker[]>([])
  const [frameId, setFrameId] = useState('candy-cane')
  const [filterId, setFilterId] = useState('noel')
  const [exposure, setExposure] = useState(0.52)
  const [paper, setPaper] = useState(0.42)
  const [captionFace, setCaptionFace] = useState<CaptionFace>('script')
  const [caption, setCaption] = useState(PARTY_NAME)
  const [subcaption, setSubcaption] = useState(todayLabel())
  const [placed, setPlaced] = useState<PlacedSticker[]>([])
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null)
  // on a phone the strip and the panel share one screen, so the guest can drag
  // the bar between them to get a bigger strip while placing stickers
  const [stripShare, setStripShare] = useState(1)
  const stripColumnRef = useRef<HTMLDivElement | null>(null)
  const layoutRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const resizeRef = useRef<{
    pointerId: number
    startY: number
    startHeight: number
    startShare: number
    room: number
  } | null>(null)

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const column = stripColumnRef.current
    const layout = layoutRef.current
    const panel = panelRef.current
    if (!column || !layout || !panel) return
    // the panel's own parts say how much it needs: its tabs, a usable slice of
    // whichever tray is open, and the buttons, none of which may be pushed off
    // the bottom of the screen
    const heightOf = (selector: string) => panel.querySelector(selector)?.getBoundingClientRect().height ?? 0
    const needs = heightOf('.tabs') + heightOf('.actions') + TRAY_FLOOR + PANEL_CHROME
    resizeRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: column.getBoundingClientRect().height,
      startShare: stripShare,
      room: layout.getBoundingClientRect().height - needs,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId || resize.startHeight <= 0) return
    const wanted = Math.min(resize.room, resize.startHeight + (event.clientY - resize.startY))
    setStripShare(Math.max(0.6, (resize.startShare * wanted) / resize.startHeight))
  }

  const endResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null
  }
  const [mirrored, setMirrored] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [flashing, setFlashing] = useState(false)
  const [shooting, setShooting] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    loadFrames().then((loaded) => {
      setFrames(loaded)
      setFrameId((current) => (loaded.some((frame) => frame.id === current) ? current : loaded[0]?.id ?? 'forest'))
    })
    loadStickers().then(setStickerKinds)
  }, [])

  const frame = useMemo(() => frames.find((item) => item.id === frameId) ?? frames[0], [frames, frameId])
  const filter = useMemo(() => filterById(filterId), [filterId])
  const filledShots = shots.filter((shot): shot is HTMLCanvasElement => !!shot)

  const stripOptions: StripOptions = useMemo(
    () => ({ shots, frame, filter, exposure, paper, caption, subcaption, captionFace, stickers: placed }),
    [shots, frame, filter, exposure, paper, caption, subcaption, captionFace, placed],
  )

  // the blank strip on the first screen: real paper, real botanicals, no
  // pretend photographs in the three windows
  const sampleStrip: StripOptions = useMemo(() => {
    const bordered = frames.find((item) => item.windows) ?? frames.find((item) => item.src) ?? frame
    return {
      shots: EVERY_SHOT.map(() => null),
      frame: bordered,
      filter,
      exposure,
      paper,
      caption: PARTY_NAME,
      subcaption: String(PARTY_YEAR),
      captionFace: 'script',
      stickers: [
        { key: 'sample-1', stickerId: 'sigil-spine', src: '/stickers/sigil-spine.svg', x: 0.33, y: 0.15, size: 0.19, rotation: -0.2 },
        { key: 'sample-2', stickerId: 'daisy', src: '/stickers/daisy.svg', x: 0.66, y: 0.42, size: 0.2, rotation: 0.25 },
        { key: 'sample-3', stickerId: 'lily', src: '/stickers/lily.svg', x: 0.38, y: 0.68, size: 0.24, rotation: 0.1 },
      ],
    }
  }, [frames, frame, filter, exposure, paper])

  const grabFrame = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = CAPTURE_WIDTH
    canvas.height = CAPTURE_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    if (mirrored) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    // photos are stored undeveloped so the look stays changeable after the
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
      setPhase('develop')
      camera.stop()
    },
    [camera, grabFrame],
  )

  // the strip slides out of the slot and the blue comes up in it, the way a
  // sunprint darkens once it is out of the sun
  useEffect(() => {
    if (phase !== 'develop') return
    const timer = setTimeout(() => setPhase('edit'), DEVELOP_MS)
    return () => clearTimeout(timer)
  }, [phase])

  function openBooth() {
    // safari only hands over the camera when getUserMedia is reached straight
    // from the tap, so nothing may be awaited before it
    setPhase('shoot')
    camera.start()
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
    setShots(EVERY_SHOT.map(() => null))
    setThumbnails(EVERY_SHOT.map(() => null))
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
        src: sticker.src,
        text: sticker.text,
        // each new piece lands a little off the last one so a handful pressed
        // in a row do not stack perfectly on top of each other
        x: 0.5 + ((current.length % 3) - 1) * 0.17,
        y: 0.2 + (current.length % 4) * 0.19,
        size: sticker.text ? 0.14 : 0.26,
        rotation: ((current.length % 5) - 2) * 0.14,
      },
    ])
    setSelectedSticker(key)
  }

  async function handleSave() {
    setBusy('saving')
    try {
      const canvas = await renderStrip(stripOptions)
      await saveStrip(canvas)
      setNote('saved to your downloads')
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
      const shared = await shareStrip(canvas, caption)
      if (!shared) await saveStrip(canvas)
    } catch {
      setNote('sharing fell over, try saving instead')
    } finally {
      setBusy(null)
    }
  }

  if (phase === 'intro') {
    return (
      <div className="booth intro">
        <header className="bar">
          <span className="mark">{BOOTH_NAME}</span>
          <span className="bar-note">
            {PARTY_NAME} · {PARTY_YEAR}
          </span>
        </header>

        <div className="intro-layout">
          <div className="intro-card">
            <h1 className="intro-title">Four photographs, one strip.</h1>
            <p className="intro-copy">
              The booth counts you in four times, then the strip drops out of the slot and develops.
              Press flowers and sigils into it, set the look, keep it.
            </p>
            <button className="button" onClick={openBooth}>
              Start the booth
            </button>
            <p className="intro-foot">Your camera never leaves this device. Nothing is uploaded.</p>
          </div>

          <div className="intro-strip" aria-hidden="true">
            <StripPreview options={sampleStrip} selectedKey={null} onSelect={() => {}} onChange={() => {}} />
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'shoot') {
    const pending = shots.filter((shot) => !shot).length
    return (
      <div className="booth shoot">
        <header className="bar">
          <span className="mark">{BOOTH_NAME}</span>
          <span className="bar-note">{filledShots.length} of {STRIP.photoCount} exposed</span>
        </header>

        <CameraStage
          videoRef={videoRef}
          camera={camera.state}
          mirrored={mirrored}
          filterCss={cssFilter(withExposure(filter, exposure))}
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
              {thumb ? (
                <img src={thumb} alt={`exposure ${index + 1}`} style={{ filter: cssFilter(withExposure(filter, exposure)) }} />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
          ))}
        </div>

        {note && <p className="note">{note}</p>}

        <div className="actions">
          {shooting ? (
            <button className="button quiet" onClick={cancelSequence}>
              Stop
            </button>
          ) : (
            <button
              className="button"
              disabled={camera.state.status !== 'live'}
              onClick={() => runSequence(shots.map((shot, index) => (shot ? -1 : index)).filter((index) => index >= 0))}
            >
              {pending === STRIP.photoCount ? 'Take four' : `Take ${pending} more`}
            </button>
          )}
          {filledShots.length === 3 && !shooting && (
            <button className="button quiet" onClick={() => setPhase('develop')}>
              To the strip
            </button>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'develop') {
    return (
      <div className="booth develop" onClick={() => setPhase('edit')}>
        <header className="bar">
          <span className="mark">{BOOTH_NAME}</span>
        </header>

        <div className="slot-housing">
          <div className="slot-mouth" aria-hidden="true" />
          <div
            className="dropping"
            // room for whatever the frame hangs above the strip, so the bow is
            // not shaved off by the slot as the print comes out
            style={{ paddingTop: `${(bleedTop(frame.art) / STRIP.width) * 100}%` }}
          >
            <StripPreview options={stripOptions} selectedKey={null} onSelect={() => {}} onChange={() => {}} />
          </div>
        </div>
        <p className="develop-note">developing…</p>
      </div>
    )
  }

  return (
    <div className="booth edit">
      <header className="bar">
        <span className="mark">{BOOTH_NAME}</span>
        <span className="bar-note">{STRIP.photoCount} exposures · ready</span>
      </header>

      <div className="edit-layout" ref={layoutRef} style={{ '--strip-share': stripShare } as CSSProperties}>
        <div className="strip-column" ref={stripColumnRef}>
          <StripPreview
            options={stripOptions}
            selectedKey={selectedSticker}
            onSelect={setSelectedSticker}
            onChange={setPlaced}
          />
        </div>

        <div
          className="split-handle"
          role="separator"
          aria-label="drag to resize the strip"
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onDoubleClick={() => setStripShare(1)}
        />

        <div className="panel" ref={panelRef}>
          <div className="tabs">
            {(['look', 'press', 'words', 'paper'] as Tab[]).map((name) => (
              <button key={name} className={`tab${tab === name ? ' active' : ''}`} onClick={() => setTab(name)}>
                {name}
              </button>
            ))}
          </div>

          <div className="panel-body">
          {tab === 'look' && (
            <>
              <FilterTray
                activeId={filterId}
                exposure={exposure}
                onPick={setFilterId}
                thumbnail={thumbnails.find(Boolean) ?? null}
              />
              <Dial
                label="Exposure"
                note={exposure < 0.4 ? 'under' : exposure > 0.65 ? 'deep' : 'even'}
                value={exposure}
                onChange={setExposure}
              />
              <Dial
                label="Paper"
                note={paper < 0.25 ? 'smooth' : paper > 0.6 ? 'rough rag' : 'cold press'}
                value={paper}
                onChange={setPaper}
              />
            </>
          )}

          {tab === 'press' && (
            <>
              <div className="arrangements">
                <h3 className="group-name">arrangements</h3>
                <div className="arrangement-row">
                  {ARRANGEMENTS.map((arrangement) => (
                    <button
                      key={arrangement.id}
                      className="button quiet small"
                      onClick={() => {
                        setPlaced(placeArrangement(arrangement))
                        setSelectedSticker(null)
                      }}
                    >
                      {arrangement.name}
                    </button>
                  ))}
                </div>
              </div>

              <StickerTray stickers={stickerKinds} onPick={addSticker} />
              <p className="hint">
                Drag to move it. Tap one, then pull the corner handle to resize and turn, or the cross
                to lift it off.
              </p>
              {placed.length > 0 && (
                <button className="button quiet small" onClick={() => setPlaced([])}>
                  Clear the strip
                </button>
              )}
            </>
          )}

          {tab === 'words' && (
            <div className="caption-fields">
              <div className="face-switch">
                {(['script', 'serif'] as CaptionFace[]).map((face) => (
                  <button
                    key={face}
                    className={`face${captionFace === face ? ' active' : ''} ${face}`}
                    onClick={() => setCaptionFace(face)}
                  >
                    {face}
                  </button>
                ))}
              </div>
              <label>
                Name
                <input value={caption} maxLength={28} onChange={(event) => setCaption(event.target.value)} />
              </label>
              <label>
                Date
                <input value={subcaption} maxLength={34} onChange={(event) => setSubcaption(event.target.value)} />
              </label>
            </div>
          )}

          {tab === 'paper' && <FrameTray frames={frames} activeId={frameId} onPick={setFrameId} />}

          {note && <p className="note">{note}</p>}
          </div>

          <div className="actions stacked">
            <button className="button" disabled={!!busy} onClick={handleSave}>
              {busy === 'saving' ? 'Saving…' : 'Save the strip'}
            </button>
            {canShareStrip() && (
              <button className="button quiet" disabled={!!busy} onClick={handleShare}>
                {busy === 'sharing' ? 'Sharing…' : 'Share'}
              </button>
            )}
            <div className="retake-row">
              {EVERY_SHOT.map((index) => (
                <button key={index} className="button quiet small" onClick={() => retake([index])}>
                  Redo {index + 1}
                </button>
              ))}
            </div>
            <button className="button quiet small" onClick={startOver}>
              Start over
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
