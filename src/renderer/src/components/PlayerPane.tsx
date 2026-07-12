import { forwardRef } from 'react'

interface Props {
  visible: boolean
  title: string
  fullscreen: boolean
  onFullscreenToggle: () => void
  onClose: () => void
}

// The mpv video surface is overlaid on #video-region by the main process; only its geometry
// matters here. The ref exposes that element so App can report its rect via setPlayerRegion.
export const PlayerPane = forwardRef<HTMLDivElement, Props>(function PlayerPane(
  { visible, title, fullscreen, onFullscreenToggle, onClose },
  videoRegionRef
): React.JSX.Element {
  return (
    <section className={'player-pane' + (visible ? '' : ' hidden')}>
      <div className="np-bar">
        <div className="np-title">{title}</div>
        <div className="np-actions">
          <button className="np-btn" title="Fullscreen (F)" onClick={onFullscreenToggle}>
            {fullscreen ? '🗗 Exit fullscreen' : '⛶ Fullscreen'}
          </button>
          <button className="np-btn" title="Close (Esc)" onClick={onClose}>
            ✕ Close
          </button>
        </div>
      </div>
      <div className="video-region" ref={videoRegionRef} />
    </section>
  )
})
