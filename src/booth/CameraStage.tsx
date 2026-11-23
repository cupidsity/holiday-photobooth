import { RefObject } from 'react'
import { CameraState } from './useCamera'
import { PHOTO_ASPECT } from '../lib/strip'

type Props = {
  videoRef: RefObject<HTMLVideoElement>
  camera: CameraState
  mirrored: boolean
  filterCss: string
  countdown: number | null
  flashing: boolean
  shotCount: number
  hasMultipleCameras: boolean
  onFlip: () => void
  onToggleMirror: () => void
  onRetry: () => void
}

export function CameraStage({
  videoRef,
  camera,
  mirrored,
  filterCss,
  countdown,
  flashing,
  shotCount,
  hasMultipleCameras,
  onFlip,
  onToggleMirror,
  onRetry,
}: Props) {
  return (
    <div className="stage" style={{ aspectRatio: String(PHOTO_ASPECT) }}>
      <video
        ref={videoRef}
        className="stage-video"
        playsInline
        muted
        autoPlay
        style={{
          filter: filterCss,
          transform: mirrored ? 'scaleX(-1)' : 'none',
          opacity: camera.status === 'live' ? 1 : 0,
        }}
      />

      <div className="stage-guides" aria-hidden="true" />

      {camera.status !== 'live' && (
        <div className="stage-overlay">
          {camera.status === 'starting' && <p>waking the camera…</p>}
          {camera.status === 'error' && (
            <>
              <p className="stage-error">{camera.message}</p>
              <button className="button ghost" onClick={onRetry}>
                retry
              </button>
            </>
          )}
        </div>
      )}

      {countdown !== null && (
        <div className="countdown" key={countdown}>
          {countdown === 0 ? 'smile' : countdown}
        </div>
      )}

      {flashing && <div className="flash" />}

      <div className="stage-chips">
        <span className="chip-static">{shotCount}/3</span>
        {hasMultipleCameras && (
          <button className="chip-static tappable" onClick={onFlip}>
            flip
          </button>
        )}
        <button className="chip-static tappable" onClick={onToggleMirror}>
          {mirrored ? 'mirrored' : 'as-seen'}
        </button>
      </div>
    </div>
  )
}
