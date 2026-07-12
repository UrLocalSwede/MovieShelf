import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { PlaybackStatus } from '@shared/types'
import {
  PlayIcon,
  PauseIcon,
  Skip10Back,
  Skip10Fwd,
  VolumeIcon,
  MuteIcon,
  SubtitlesIcon,
  FullscreenIcon,
  CloseIcon
} from '../icons'

const DEFAULT_STATUS: PlaybackStatus = {
  timePos: 0,
  duration: 0,
  pause: false,
  volume: 100,
  mute: false,
  subVisible: true
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const total = Math.floor(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function Controls(): React.JSX.Element {
  const [status, setStatus] = useState<PlaybackStatus>(DEFAULT_STATUS)
  const [active, setActive] = useState(true)
  const [hovering, setHovering] = useState(false)

  // Seek-bar drag state. While dragging, the fill follows `dragValue` (0..1) so incoming
  // time-pos telemetry doesn't fight the user's pointer; the seek is committed on release.
  const [dragging, setDragging] = useState(false)
  const [dragValue, setDragValue] = useState(0)
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const offStatus = window.events.onPlaybackStatus((patch) =>
      setStatus((prev) => ({ ...prev, ...patch }))
    )
    const offActive = window.events.onControlsActive((a) => setActive(a))
    return () => {
      offStatus()
      offActive()
    }
  }, [])

  const { timePos, duration, pause, volume, mute, subVisible } = status
  const shown = active || hovering || pause

  const fillFraction = dragging
    ? dragValue
    : duration > 0
      ? Math.min(timePos / duration, 1)
      : 0

  const valueFromClientX = useCallback((clientX: number): number => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return 0
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
  }, [])

  const onTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      trackRef.current?.setPointerCapture(e.pointerId)
      setDragging(true)
      setDragValue(valueFromClientX(e.clientX))
    },
    [valueFromClientX]
  )

  const onTrackPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const v = valueFromClientX(e.clientX)
      if (dragging) setDragValue(v)
      else setHoverValue(v)
    },
    [dragging, valueFromClientX]
  )

  const onTrackPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return
      const v = valueFromClientX(e.clientX)
      trackRef.current?.releasePointerCapture(e.pointerId)
      setDragging(false)
      if (duration > 0) void api.playerSeek(v * duration)
    },
    [dragging, duration, valueFromClientX]
  )

  const elapsed = dragging ? dragValue * duration : timePos

  return (
    <div className={'controls-overlay' + (shown ? ' visible' : '')}>
      <div
        className="ctl-bar"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => {
          setHovering(false)
          setHoverValue(null)
        }}
      >
        <div className="ctl-progress-row">
          <span className="ctl-time">{formatTime(elapsed)}</span>
          <div
            ref={trackRef}
            className="ctl-progress"
            onPointerDown={onTrackPointerDown}
            onPointerMove={onTrackPointerMove}
            onPointerUp={onTrackPointerUp}
          >
            <div className="ctl-progress-fill" style={{ width: `${fillFraction * 100}%` }} />
            <div className="ctl-progress-thumb" style={{ left: `${fillFraction * 100}%` }} />
            {hoverValue !== null && !dragging && (
              <div className="ctl-scrub" style={{ left: `${hoverValue * 100}%` }}>
                {formatTime(hoverValue * duration)}
              </div>
            )}
          </div>
          <span className="ctl-time">{formatTime(duration)}</span>
        </div>

        <div className="ctl-buttons">
          <div className="ctl-cluster">
            <button
              className="ctl-btn ctl-btn-primary"
              title={pause ? 'Play (Space)' : 'Pause (Space)'}
              onClick={() => void api.playerSetPause(!pause)}
            >
              {pause ? <PlayIcon /> : <PauseIcon />}
            </button>
            <button className="ctl-btn" title="Back 10s (←)" onClick={() => void api.playerSkip(-10)}>
              <Skip10Back />
            </button>
            <button className="ctl-btn" title="Forward 10s (→)" onClick={() => void api.playerSkip(10)}>
              <Skip10Fwd />
            </button>
            <div className="ctl-volume">
              <button
                className="ctl-btn"
                title={mute ? 'Unmute (m)' : 'Mute (m)'}
                onClick={() => void api.playerSetMute(!mute)}
              >
                {mute ? <MuteIcon /> : <VolumeIcon />}
              </button>
              <input
                className="ctl-volume-slider"
                type="range"
                min={0}
                max={100}
                step={1}
                value={mute ? 0 : Math.round(volume)}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (mute && v > 0) void api.playerSetMute(false)
                  void api.playerSetVolume(v)
                }}
              />
            </div>
          </div>

          <div className="ctl-cluster">
            <button
              className={'ctl-btn' + (subVisible ? ' ctl-btn-on' : '')}
              title="Subtitles"
              onClick={() => void api.playerToggleSub(!subVisible)}
            >
              <SubtitlesIcon />
            </button>
            <button className="ctl-btn" title="Fullscreen (F)" onClick={() => void api.controlsFullscreenToggle()}>
              <FullscreenIcon />
            </button>
            <button className="ctl-btn" title="Close (Esc)" onClick={() => void api.controlsExit()}>
              <CloseIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
