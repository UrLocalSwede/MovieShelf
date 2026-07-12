// Persistence of saved library folders. Port of settings.py.
// Stored as a newline-delimited list in %APPDATA%\MovieShelf\settings.txt.

import { existsSync, readFileSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'
import { DEFAULT_FOLDERS, MOVIES_DIR, userConfigDir } from './config'

function settingsPath(): string {
  return join(userConfigDir(), 'settings.txt')
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

function existingDefaults(): string[] {
  const present = DEFAULT_FOLDERS.filter(isDir)
  return present.length ? present : DEFAULT_FOLDERS
}

export function saveFolders(folders: string[], currentFolder = ''): void {
  // Keep folders even when unreachable (e.g. an offline share) so they are never silently lost;
  // users prune stale entries via the sidebar remove control.
  const unique: string[] = []
  for (const folder of folders) {
    if (folder && !unique.includes(folder)) unique.push(folder)
  }
  if (currentFolder && !unique.includes(currentFolder)) unique.unshift(currentFolder)
  writeFileSync(settingsPath(), unique.join('\n'), 'utf-8')
}

export function loadSavedFolders(): string[] {
  const path = settingsPath()
  if (!existsSync(path)) return existingDefaults()
  const folders = readFileSync(path, 'utf-8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  return folders.length ? folders : existingDefaults()
}

export function loadFolder(): string {
  const folders = loadSavedFolders()
  return folders.length ? folders[0] : MOVIES_DIR
}
