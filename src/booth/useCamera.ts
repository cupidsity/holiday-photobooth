import { useCallback, useEffect, useRef, useState } from 'react'

export type Facing = 'user' | 'environment'

export type CameraState = {
  status: 'idle' | 'starting' | 'live' | 'error'
  message: string
}

function describeError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'camera access was blocked. allow the camera for this site, then tap retry.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'no camera turned up on this device.'
  }
  if (name === 'NotReadableError') {
    return 'another app is already using the camera. close it and tap retry.'
  }
  if (!window.isSecureContext) {
    return 'browsers only hand over the camera over https. open the vercel link instead of a plain http address.'
  }
  return 'the camera would not start. tap retry.'
}

export function useCamera(videoRef: React.RefObject<HTMLVideoElement>) {
  const [facing, setFacing] = useState<Facing>('user')
  const [state, setState] = useState<CameraState>({ status: 'idle', message: '' })
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [videoRef])

  const start = useCallback(
    async (nextFacing: Facing = facing) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState({ status: 'error', message: 'this browser has no camera support. try chrome or safari.' })
        return
      }
      setState({ status: 'starting', message: '' })
      stop()
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        streamRef.current = stream
        setFacing(nextFacing)
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          video.playsInline = true
          video.muted = true
          await video.play().catch(() => undefined)
        }
        setState({ status: 'live', message: '' })

        // the device list only carries labels once permission is granted, which
        // is why the flip button only appears after the first successful start
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
        setHasMultipleCameras(devices.filter((device) => device.kind === 'videoinput').length > 1)
      } catch (error) {
        setState({ status: 'error', message: describeError(error) })
      }
    },
    [facing, stop, videoRef],
  )

  const flip = useCallback(() => {
    start(facing === 'user' ? 'environment' : 'user')
  }, [facing, start])

  useEffect(() => stop, [stop])

  return { state, facing, start, stop, flip, hasMultipleCameras }
}
