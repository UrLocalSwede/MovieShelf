// Download the uosc mpv control UI into resources/mpv_config/. Node port of tools/fetch_uosc.py.
//
//   node scripts/fetch-uosc.mjs
//
// uosc (https://github.com/tomasklaen/uosc) ships uosc.zip laid out as an mpv config dir
// (fonts/, scripts/uosc/, script-opts/). MovieShelf's own mpv.conf and themed
// script-opts/uosc.conf are kept (never clobbered).

import { existsSync, mkdirSync, writeFileSync, cpSync, rmSync, readdirSync, statSync } from 'fs'
import { spawnSync } from 'child_process'
import { dirname, join, relative } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEST = join(ROOT, 'resources', 'mpv_config')
const BUILD = join(ROOT, 'resources', '.build')
const RELEASES_API = 'https://api.github.com/repos/tomasklaen/uosc/releases/latest'
const KEEP = new Set(['mpv.conf', 'script-opts/uosc.conf']) // our files — never clobber

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

function walk(dir, base, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, base, out)
    else out.push(relative(base, full))
  }
}

export async function fetchUosc() {
  mkdirSync(DEST, { recursive: true })
  mkdirSync(BUILD, { recursive: true })

  const release = await getJson(RELEASES_API)
  const asset = (release.assets || []).find((a) => a.name === 'uosc.zip')
  if (!asset) throw new Error(`uosc.zip not in release assets: ${(release.assets || []).map((a) => a.name).join(', ')}`)

  console.log(`Downloading uosc ${release.tag_name || ''}…`)
  const zip = join(BUILD, 'uosc.zip')
  await download(asset.browser_download_url, zip)

  const extractDir = join(BUILD, 'uosc')
  rmSync(extractDir, { recursive: true, force: true })
  // Node has no built-in unzip; use PowerShell's Expand-Archive (Windows-only build tooling).
  const r = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', `Expand-Archive -Path '${zip}' -DestinationPath '${extractDir}' -Force`],
    { stdio: 'ignore' }
  )
  if (r.status !== 0) throw new Error('Expand-Archive failed')

  const files = []
  walk(extractDir, extractDir, files)
  for (const rel of files) {
    const relPosix = rel.replace(/\\/g, '/')
    const target = join(DEST, rel)
    if (KEEP.has(relPosix) && existsSync(target)) continue
    mkdirSync(dirname(target), { recursive: true })
    cpSync(join(extractDir, rel), target)
  }
  console.log(`Extracted uosc into ${DEST} (${files.length} files, ${statSync(zip).size} bytes zip)`)
}

fetchUosc().catch((e) => {
  console.error(e)
  process.exit(1)
})
