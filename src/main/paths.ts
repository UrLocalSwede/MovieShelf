// Windows path-normalization helpers that reproduce Python's os.path semantics,
// so cache keys stay byte-identical to those the legacy app wrote.

import { win32 } from 'path'

/** Python os.path.normcase on Windows: lowercase and turn '/' into '\' (no collapsing). */
export function normcase(p: string): string {
  return p.replace(/\//g, '\\').toLowerCase()
}

/** Python os.path.normcase(os.path.normpath(p)) on Windows. */
export function normcaseNormpath(p: string): string {
  return normcase(win32.normalize(p))
}

/** Python library.normalize_path: normpath, with UNC forward-slashes flipped back to '\'. */
export function normalizePath(p: string): string {
  let normalized = win32.normalize(p)
  if (normalized.startsWith('\\') || normalized.startsWith('//')) {
    normalized = normalized.replace(/\//g, '\\')
  }
  return normalized
}
