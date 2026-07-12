// Spawns a single, persistent mpv.exe embedded into a host window via --wid, and controls it
// over mpv's JSON IPC named pipe. Replaces python-mpv (in-process libmpv) from player.py.

import { spawn, type ChildProcess } from 'child_process'
import net from 'net'
import { mpvConfigDir, mpvExe } from '../config'
import { log } from '../logging'
import type { PlaybackStatus } from '../../../shared/types'

// mpv observe_property ids → PlaybackStatus fields.
const OBSERVED: Array<[number, string, keyof PlaybackStatus]> = [
  [1, 'time-pos', 'timePos'],
  [2, 'duration', 'duration'],
  [3, 'pause', 'pause'],
  [4, 'volume', 'volume'],
  [5, 'mute', 'mute'],
  [6, 'sub-visibility', 'subVisible']
]

export class Mpv {
  private proc: ChildProcess | null = null
  private sock: net.Socket | null = null
  private readonly pipeName = `\\\\.\\pipe\\movieshelf-mpv-${process.pid}`
  private buffer = ''
  private pendingSub = ''
  private lastTimeEmit = 0 // ms of the last forwarded time-pos, for throttling
  onEndFile?: () => void
  onStatus?: (patch: Partial<PlaybackStatus>) => void

  isRunning(): boolean {
    return this.proc !== null && this.sock !== null
  }

  async start(hwnd: string): Promise<void> {
    const args = [
      `--wid=${hwnd}`,
      `--config-dir=${mpvConfigDir()}`,
      `--input-ipc-server=${this.pipeName}`,
      '--no-osc', // uosc (from config-dir) replaces the default OSC
      '--no-input-vo-keyboard', // never grab keyboard/foreground; keys forwarded from the UI
      '--no-ytdl',
      '--hwdec=auto-safe',
      '--keep-open=yes',
      '--idle=yes',
      '--force-window=yes'
    ]
    this.proc = spawn(mpvExe(), args, { windowsHide: true })
    this.proc.on('exit', (code) => {
      log.info(`mpv exited (${code})`)
      this.proc = null
      this.sock = null
    })
    this.proc.on('error', (err) => log.error('mpv spawn error', err))
    await this.connect()
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let tries = 0
      const attempt = (): void => {
        const s = net.connect(this.pipeName)
        s.on('connect', () => {
          this.sock = s
          this.setup(s)
          for (const [id, prop] of OBSERVED) this.command(['observe_property', id, prop])
          log.info('mpv IPC connected')
          resolve()
        })
        s.on('error', () => {
          s.destroy()
          if (++tries > 100) {
            reject(new Error('mpv IPC connect timeout'))
            return
          }
          setTimeout(attempt, 50)
        })
      }
      attempt()
    })
  }

  private setup(s: net.Socket): void {
    s.setEncoding('utf-8')
    s.on('data', (chunk: string) => {
      this.buffer += chunk
      let idx: number
      while ((idx = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, idx).trim()
        this.buffer = this.buffer.slice(idx + 1)
        if (line) this.handle(line)
      }
    })
    s.on('close', () => {
      this.sock = null
    })
    s.on('error', (e) => log.debug('mpv IPC socket error', String(e)))
  }

  private handle(line: string): void {
    let msg: any
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }
    if (msg.event === 'file-loaded' && this.pendingSub) {
      const sub = this.pendingSub
      this.pendingSub = ''
      this.command(['sub-add', sub, 'select'])
    } else if (msg.event === 'end-file') {
      this.onEndFile?.()
    } else if (msg.event === 'property-change') {
      this.onProperty(msg.name, msg.data)
    }
  }

  private onProperty(name: string, data: unknown): void {
    if (!this.onStatus) return
    const field = OBSERVED.find(([, prop]) => prop === name)?.[2]
    if (!field) return
    // Throttle the high-frequency time-pos stream so IPC isn't flooded.
    if (field === 'timePos') {
      const now = Date.now()
      if (now - this.lastTimeEmit < 250) return
      this.lastTimeEmit = now
    }
    // mpv reports null for time-pos/duration until a file is loaded; coerce to numbers/booleans.
    switch (field) {
      case 'timePos':
      case 'duration':
      case 'volume':
        this.onStatus({ [field]: typeof data === 'number' ? data : 0 } as Partial<PlaybackStatus>)
        break
      default:
        this.onStatus({ [field]: Boolean(data) } as Partial<PlaybackStatus>)
    }
  }

  command(cmd: unknown[]): void {
    if (!this.sock) return
    try {
      this.sock.write(JSON.stringify({ command: cmd }) + '\n')
    } catch (e) {
      log.debug('mpv command failed', String(e))
    }
  }

  load(path: string, subtitle = ''): void {
    this.pendingSub = subtitle || ''
    this.command(['loadfile', path, 'replace'])
  }

  keypress(name: string): void {
    if (name) this.command(['keypress', name])
  }

  // Re-arm the property observers so mpv re-fires their current values. Used when the controls
  // renderer (re)loads after mpv is already running, so its UI shows the true state immediately.
  refreshStatus(): void {
    this.lastTimeEmit = 0
    for (const [id, prop] of OBSERVED) {
      this.command(['unobserve_property', id])
      this.command(['observe_property', id, prop])
    }
  }

  seek(seconds: number, mode: 'absolute' | 'relative'): void {
    this.command(['seek', seconds, mode])
  }

  setPause(paused: boolean): void {
    this.command(['set_property', 'pause', paused])
  }

  setVolume(volume: number): void {
    this.command(['set_property', 'volume', volume])
  }

  setMute(muted: boolean): void {
    this.command(['set_property', 'mute', muted])
  }

  setSubVisibility(visible: boolean): void {
    this.command(['set_property', 'sub-visibility', visible])
  }

  stop(): void {
    this.pendingSub = ''
    this.command(['stop'])
  }

  terminate(): void {
    this.command(['quit'])
    const proc = this.proc
    this.proc = null
    this.sock = null
    if (proc) setTimeout(() => proc.kill(), 500)
  }
}
