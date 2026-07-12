// Download a Windows mpv.exe into resources/mpv/ for bundling. Node port of tools/fetch_libmpv.py,
// but fetches the standalone player (mpv.exe drives the --wid embedding), not libmpv-2.dll.
//
//   node scripts/fetch-mpv.mjs
//
// Pulls the latest generic x86_64 build from zhongfly/mpv-winbuild and extracts mpv.exe with the
// standalone 7zr.exe (these archives use filters the pure-JS readers don't support).
// mpv is licensed under GPLv2+/LGPLv2.1+; source: https://mpv.io/.

import { existsSync, mkdirSync, writeFileSync, statSync } from 'fs'
import { spawnSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEST = join(ROOT, 'resources', 'mpv')
const BUILD = join(ROOT, 'resources', '.build')
const RELEASES_API = 'https://api.github.com/repos/zhongfly/mpv-winbuild/releases/latest'
const SEVENZR_URL = 'https://www.7-zip.org/a/7zr.exe'
// Generic x86_64 player build (avoid -dev = libmpv, and -v3 = AVX2-only).
const ASSET_RE = /^mpv-x86_64-\d.*\.7z$/

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': 'MovieShelf-build' }, redirect: 'follow' })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'MovieShelf-build' } })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  return res.json()
}

export async function fetchMpv() {
  mkdirSync(DEST, { recursive: true })
  mkdirSync(BUILD, { recursive: true })

  console.log('Querying latest mpv release…')
  const release = await getJson(RELEASES_API)
  const asset = (release.assets || []).find((a) => ASSET_RE.test(a.name))
  if (!asset) {
    throw new Error(`No matching mpv asset. Available: ${(release.assets || []).map((a) => a.name).join(', ')}`)
  }

  const archive = join(BUILD, asset.name)
  console.log(`Downloading ${asset.name} (${Math.round(asset.size / (1024 * 1024))} MB)…`)
  await download(asset.browser_download_url, archive)

  const sevenzr = join(BUILD, '7zr.exe')
  if (!existsSync(sevenzr)) {
    console.log('Downloading 7zr.exe…')
    await download(SEVENZR_URL, sevenzr)
  }

  console.log('Extracting mpv.exe…')
  const r = spawnSync(sevenzr, ['e', '-y', `-o${DEST}`, archive, 'mpv.exe', '-r'], { stdio: 'ignore' })
  if (r.status !== 0) throw new Error('7zr extraction failed')

  const exe = join(DEST, 'mpv.exe')
  if (!existsSync(exe)) throw new Error('Extraction failed: mpv.exe not found.')

  writeFileSync(
    join(DEST, 'SOURCE.txt'),
    `mpv.exe from ${asset.name}\nSource: ${asset.browser_download_url}\n` +
      'mpv is licensed under GPLv2+/LGPLv2.1+. Source: https://mpv.io/\n'
  )
  console.log(`Wrote ${exe} (${Math.round(statSync(exe).size / (1024 * 1024))} MB)`)
}

fetchMpv().catch((e) => {
  console.error(e)
  process.exit(1)
})
