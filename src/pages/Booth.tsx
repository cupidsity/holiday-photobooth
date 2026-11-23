import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CameraStage } from '../booth/CameraStage'
import { Dial, FilterTray, FrameTray, StickerTray } from '../booth/Trays'
import { StripPreview } from '../booth/StripPreview'
import { useCamera } from '../booth/useCamera'
import { Frame, PAPER_FRAMES, Sticker, loadFrames, loadStickers } from '../lib/assets'
import { PARTY_NAME, PARTY_YEAR } from '../lib/config'
import { cssFilter, filterById, withExposure } from '../lib/filters'
import { CaptionFace, PlacedSticker, StripOptions, renderStrip } from '../lib/render'
import { PHOTO_HEIGHT, PHOTO_WIDTH, drawCover } from '../lib/strip'
import { canShareStrip, saveStrip, shareStrip } from '../lib/download'
import '../styles/booth.css'

type Phase = 'intro' | 'shoot' | 'develop' | 'edit'
type Tab = 'look' | 'press' | 'words' | 'paper'

const COUNTDOWN_FROM = 3
const BETWEEN_SHOTS_MS = 900
const DEVELOP_MS = 5200

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

export function Booth() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const camera = useCamera(videoRef)
  const sequenceRef = useRef(0)

  const [phase, setPhase] = useState<Phase>('intro')
  const [tab, setTab] = useState<Tab>('look')
  const [shots, setShots] = useState<(HTMLCanvasElement | null)[]>([null, null, null])
  const [thumbnails, setThumbnails] = useState<(string | null)[]>([null, null, null])
  const [frames, setFrames] = useState<Frame[]>(PAPER_FRAMES)
  const [stickerKinds, setStickerKinds] = useState<Sticker[]>([])
  const [frameId, setFrameId] = useState('sunprint')
  const [filterId, setFilterId] = useState('cyanotype')
  const [exposure, setExposure] = useState(0.52)
  const [paper, setPaper] = useState(0.42)
  const [captionFace, setCaptionFace] = useState<CaptionFace>('script')
  const [caption, setCaption] = useState(PARTY_NAME)
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
      setFrameId((current) => (loaded.some((frame) => frame.id === current) ? current : loaded[0]?.id ?? 'sunprint'))
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
        <div className="intro-card">
          <p className="intro-mark">sunprint booth</p>
          <h1 className="intro-title">Three photographs, one blue strip.</h1>
          <p className="intro-copy">
            The booth counts you in three times, then the strip drops out of the slot and develops.
            Press flowers and sigils into it, set the exposure, keep it.
          </p>
          <button className="button" onClick={openBooth}>
            Start the booth
          </button>
          <p className="intro-foot">Your camera never leaves this device. Nothing is uploaded.</p>
        </div>
      </div>
    )
  }

  if (phase === 'shoot') {
    const pending = shots.filter((shot) => !shot).length
    return (
      <div className="booth shoot">
        <header className="bar">
          <span className="mark">sunprint booth</span>
          <span className="bar-note">{filledShots.length} of 3 exposed</span>
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
              {pending === 3 ? 'Take three' : `Take ${pending} more`}
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
        <div className="slot-housing">
          <div className="slot-mouth" aria-hidden="true" />
          <div className="dropping">
            <StripPreview options={stripOptions} selectedKey={null} onSelect={() => {}} onChange={() => {}} />
          </div>
        </div>
        <p className="develop-note">developing…</p>
      </div>
    )
  }

  return (
    <div className="booth edit">
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
            {(['look', 'press', 'words', 'paper'] as Tab[]).map((name) => (
              <button key={name} className={`tab${tab === name ? ' active' : ''}`} onClick={() => setTab(name)}>
                {name}
              </button>
            ))}
          </div>

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
              <StickerTray stickers={stickerKinds} onPick={addSticker} />
              <p className="hint">
                Drag to move it. Tap one, then pull the ⤡ corner to resize and turn, or × to lift it off.
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
              {[0, 1, 2].map((index) => (
                <button key={index} className="button quiet small" onClick={() => retake([index])}>
                  Redo {index + 1}
                </button>
              ))}
            </div>
            <button className="button quiet small" onClick={startOver}>
              Start over
            </button>
          </div>
          <p className="panel-foot">{PARTY_NAME} · {PARTY_YEAR}</p>
        </div>
      </div>
    </div>
  )
}
