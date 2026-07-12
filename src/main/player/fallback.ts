// External-player fallback when the embedded mpv engine is unavailable. Port of the VLC /
// OS-default logic in player.py.

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { shell } from 'electron'
import { normalizePath } from '../paths'
import type { PlayerBackend } from '../../../shared/types'

const VLC_CANDIDATES = [
  'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
  'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
  'C:\\Program Files\\VLC\\vlc.exe',
  'C:\\Program Files (x86)\\VLC\\vlc.exe'
]

function findVlc(): string | null {
  return VLC_CANDIDATES.find((c) => existsSync(c)) ?? null
}

export async function playExternal(filePath: string, subtitlePath = ''): Promise<PlayerBackend> {
  const fixed = normalizePath(filePath)
  const vlc = findVlc()
  if (vlc) {
    const command = [fixed]
    if (subtitlePath) command.push('--sub-file', normalizePath(subtitlePath))
    spawn(vlc, command, { detached: true, stdio: 'ignore' }).unref()
    return 'VLC'
  }
  await shell.openPath(fixed)
  return 'default player'
}
