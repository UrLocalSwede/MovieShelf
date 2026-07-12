// Media fingerprinting via bundled ffprobe (duration, resolution). Port of fingerprint.py,
// which used pymediainfo. ffprobe reports duration in SECONDS (pymediainfo used milliseconds).

import { spawnSync } from 'child_process'
import { existsSync, statSync } from 'fs'
import { ffprobeExe } from './config'
import { log } from './logging'
import type { Fingerprint } from '../../shared/types'

let ffprobeAvailable: boolean | null = null

export function hasFfprobe(): boolean {
  if (ffprobeAvailable === null) ffprobeAvailable = existsSync(ffprobeExe())
  return ffprobeAvailable
}

function resolutionLabel(height: number | null): string {
  if (!height) return ''
  if (height >= 2000) return '2160p'
  if (height >= 1400) return '1440p'
  if (height >= 1000) return '1080p'
  if (height >= 700) return '720p'
  if (height >= 540) return '576p'
  return `${height}p`
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

/** Best-effort media fingerprint. Returns {} if ffprobe is unavailable or fails. */
export function probe(path: string): Fingerprint {
  if (!hasFfprobe() || !isFile(path)) return {}
  try {
    const res = spawnSync(
      ffprobeExe(),
      ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', path],
      { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024, windowsHide: true }
    )
    if (res.status !== 0 || !res.stdout) return {}
    const info = JSON.parse(res.stdout)
    const format = info.format ?? {}
    const streams: any[] = info.streams ?? []
    const video = streams.find((s) => s.codec_type === 'video')

    let durationMin: number | null = null
    const durSec = parseFloat(format.duration)
    if (!Number.isNaN(durSec)) durationMin = Math.round((durSec / 60.0) * 10) / 10

    const width = video && video.width ? Number(video.width) : null
    const height = video && video.height ? Number(video.height) : null

    return {
      duration_min: durationMin,
      width: width || null,
      height: height || null,
      resolution: resolutionLabel(height),
      container: format.format_name || '',
      embedded_title: (format.tags && format.tags.title) || ''
    }
  } catch (exc) {
    log.debug(`ffprobe failed for ${path}:`, String(exc))
    return {}
  }
}
