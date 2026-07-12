import { useEffect, useState } from 'react'
import { api } from '../api'

type Phase = 'idle' | 'downloading' | 'ready' | 'error'

// Small non-intrusive banner (bottom-right) driven by main-process update events.
// Auto-download runs in the background; when ready, the user clicks Restart to apply.
export function UpdateBanner(): React.JSX.Element | null {
  const [phase, setPhase] = useState<Phase>('idle')
  const [percent, setPercent] = useState(0)
  const [version, setVersion] = useState('')
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const offs = [
      window.events.onUpdateAvailable((p) => {
        setVersion(p.version)
        setPercent(0)
        setDismissed(false)
        setPhase('downloading')
      }),
      window.events.onUpdateProgress((p) => {
        setPhase((cur) => (cur === 'ready' ? cur : 'downloading'))
        setPercent(p.percent)
      }),
      window.events.onUpdateDownloaded((p) => {
        setVersion(p.version)
        setDismissed(false)
        setPhase('ready')
      }),
      // Only surface an error if a download was already underway (a real interruption).
      // Routine check failures (e.g. no releases published yet, offline) stay silent — main logs them.
      window.events.onUpdateError(() => setPhase((cur) => (cur === 'downloading' ? 'error' : cur)))
    ]
    return () => offs.forEach((off) => off())
  }, [])

  if (phase === 'idle' || dismissed) return null

  return (
    <div className="update-banner" role="status">
      {phase === 'downloading' && (
        <>
          <span className="spin-inline" />
          <span className="update-text">Downloading update{version ? ` ${version}` : ''}… {percent}%</span>
        </>
      )}
      {phase === 'ready' && (
        <>
          <span className="update-text">Update{version ? ` ${version}` : ''} ready</span>
          <button className="update-btn" onClick={() => void api.quitAndInstall()}>
            Restart
          </button>
          <button className="update-dismiss" title="Later" onClick={() => setDismissed(true)}>
            ×
          </button>
        </>
      )}
      {phase === 'error' && (
        <>
          <span className="update-text">Update check failed</span>
          <button className="update-dismiss" title="Dismiss" onClick={() => setDismissed(true)}>
            ×
          </button>
        </>
      )}
    </div>
  )
}
