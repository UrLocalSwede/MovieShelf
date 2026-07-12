// Download a static Windows ffprobe.exe into resources/ffprobe/ for media fingerprinting.
//
//   node scripts/fetch-ffprobe.mjs
//
// Uses gyan.dev's "essentials" build (.7z) and extracts only ffprobe.exe with 7zr.exe.
// FFmpeg is licensed under LGPL/GPL; source & build info: https://www.gyan.dev/ffmpeg/builds/.

import { existsSync, mkdirSync, writeFileSync, statSync } from 'fs'
import { spawnSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEST = join(ROOT, 'resources', 'ffprobe')
const BUILD = join(ROOT, 'resources', '.build')
const ARCHIVE_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.7z'
const SEVENZR_URL = 'https://www.7-zip.org/a/7zr.exe'

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': 'MovieShelf-build' }, redirect: 'follow' })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

export async function fetchFfprobe() {
  mkdirSync(DEST, { recursive: true })
  mkdirSync(BUILD, { recursive: true })

  const archive = join(BUILD, 'ffmpeg-essentials.7z')
  console.log('Downloading ffmpeg essentials (.7z)…')
  await download(ARCHIVE_URL, archive)

  const sevenzr = join(BUILD, '7zr.exe')
  if (!existsSync(sevenzr)) {
    console.log('Downloading 7zr.exe…')
    await download(SEVENZR_URL, sevenzr)
  }

  console.log('Extracting ffprobe.exe…')
  const r = spawnSync(sevenzr, ['e', '-y', `-o${DEST}`, archive, 'ffprobe.exe', '-r'], { stdio: 'ignore' })
  if (r.status !== 0) throw new Error('7zr extraction failed')

  const exe = join(DEST, 'ffprobe.exe')
  if (!existsSync(exe)) throw new Error('Extraction failed: ffprobe.exe not found.')

  writeFileSync(
    join(DEST, 'SOURCE.txt'),
    `ffprobe.exe from ${ARCHIVE_URL}\nFFmpeg licensed under LGPL/GPL. Build info: https://www.gyan.dev/ffmpeg/builds/\n`
  )
  console.log(`Wrote ${exe} (${Math.round(statSync(exe).size / (1024 * 1024))} MB)`)
}

fetchFfprobe().catch((e) => {
  console.error(e)
  process.exit(1)
})
