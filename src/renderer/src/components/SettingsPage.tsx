import { useEffect, useState } from 'react'
import { api, isError } from '../api'
import { BackIcon } from '../icons'
import type { AppSettings } from '@shared/types'

interface Props {
  onClose: () => void
  onCacheCleared: () => void
}

const DEFAULT_SETTINGS: AppSettings = {
  autoDownloadUpdates: true,
  defaultVolume: 100,
  skipSeconds: 10
}

export function SettingsPage({ onClose, onCacheCleared }: Props): React.JSX.Element {
  const [tmdb, setTmdb] = useState('')
  const [omdb, setOmdb] = useState('')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  const [saveMsg, setSaveMsg] = useState('')
  const [updateMsg, setUpdateMsg] = useState('')
  const [cacheMsg, setCacheMsg] = useState('')

  useEffect(() => {
    let alive = true
    void (async () => {
      const [keys, s] = await Promise.all([api.getApiKeys(), api.getSettings()])
      if (!alive) return
      if (!isError(keys)) {
        setTmdb(keys.tmdb || '')
        setOmdb(keys.omdb || '')
      }
      if (!isError(s)) setSettings(s)
      setLoaded(true)
    })()
    return () => {
      alive = false
    }
  }, [])

  const save = async (): Promise<void> => {
    setSaveMsg('Saving…')
    const [k, s] = await Promise.all([api.saveApiKeys({ tmdb: tmdb.trim(), omdb: omdb.trim() }), api.saveSettings(settings)])
    setSaveMsg(isError(k) || isError(s) ? `Error: ${isError(k) ? k.error : isError(s) ? s.error : ''}` : 'Saved ✓')
  }

  const checkUpdates = async (): Promise<void> => {
    setUpdateMsg('Checking…')
    const r = await api.checkForUpdates()
    setUpdateMsg(isError(r) ? r.error : 'Checking for updates… you’ll be notified if one is found.')
  }

  const clearCache = async (): Promise<void> => {
    setCacheMsg('Clearing…')
    const r = await api.clearCache()
    if (isError(r)) {
      setCacheMsg(`Error: ${r.error}`)
      return
    }
    setCacheMsg('Cache cleared ✓')
    onCacheCleared()
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="settings-back" title="Back (Esc)" onClick={onClose}>
          <BackIcon />
        </button>
        <h2>Settings</h2>
      </div>

      <div className="settings-body">
        <section className="settings-section">
          <div className="card-label">API keys</div>
          <p className="settings-hint">
            Used to match movies and fetch posters/ratings. TMDb powers matching; OMDb adds extra
            ratings. Changes apply on the next lookup — no restart needed.
          </p>
          <label className="settings-field">
            <span>TMDb API key</span>
            <input
              type="text"
              className="settings-input"
              placeholder="Your TMDb API key"
              value={tmdb}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setTmdb(e.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>OMDb API key</span>
            <input
              type="text"
              className="settings-input"
              placeholder="Optional — leave blank for the built-in sample key"
              value={omdb}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setOmdb(e.target.value)}
            />
          </label>
        </section>

        <section className="settings-section">
          <div className="card-label">Playback</div>
          <label className="settings-field">
            <span>Default volume ({settings.defaultVolume}%)</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.defaultVolume}
              onChange={(e) => setSettings((s) => ({ ...s, defaultVolume: Number(e.target.value) }))}
            />
          </label>
          <label className="settings-field">
            <span>Skip button amount</span>
            <select
              className="select"
              value={settings.skipSeconds}
              onChange={(e) => setSettings((s) => ({ ...s, skipSeconds: Number(e.target.value) }))}
            >
              {[5, 10, 15, 30, 60].map((n) => (
                <option key={n} value={n}>
                  {n} seconds
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="settings-section">
          <div className="card-label">Updates</div>
          <label className="settings-field settings-toggle">
            <input
              type="checkbox"
              checked={settings.autoDownloadUpdates}
              onChange={(e) => setSettings((s) => ({ ...s, autoDownloadUpdates: e.target.checked }))}
            />
            <span>Automatically download updates in the background</span>
          </label>
          <div className="settings-actions">
            <button className="btn" onClick={() => void checkUpdates()}>
              Check for updates now
            </button>
            {updateMsg && <span className="settings-msg">{updateMsg}</span>}
          </div>
        </section>

        <section className="settings-section">
          <div className="card-label">Cache</div>
          <p className="settings-hint">
            Removes cached metadata and downloaded posters/backdrops. They’ll be re-fetched the next
            time you open a movie.
          </p>
          <div className="settings-actions">
            <button className="btn" onClick={() => void clearCache()}>
              Clear cache
            </button>
            {cacheMsg && <span className="settings-msg">{cacheMsg}</span>}
          </div>
        </section>

        <div className="settings-save">
          <button className="btn-play" disabled={!loaded} onClick={() => void save()}>
            Save changes
          </button>
          {saveMsg && <span className="settings-msg">{saveMsg}</span>}
        </div>
      </div>
    </div>
  )
}
