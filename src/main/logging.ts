// Minimal file + console logger writing to %APPDATA%\MovieShelf\logs\movieshelf.log,
// plus crash hooks. Port of logsetup.py (kept dependency-free).

import { appendFileSync, statSync, renameSync, existsSync } from 'fs'
import { join } from 'path'
import { logDir } from './config'

const MAX_BYTES = 1_000_000
let logFile = ''

function rotateIfNeeded(): void {
  try {
    if (existsSync(logFile) && statSync(logFile).size > MAX_BYTES) {
      renameSync(logFile, logFile + '.1')
    }
  } catch {
    // rotation is best-effort
  }
}

function write(level: string, args: unknown[]): void {
  const line = `${new Date().toISOString()} ${level} ${args
    .map((a) => (a instanceof Error ? (a.stack ?? a.message) : typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')}\n`
  if (level === 'ERROR' || level === 'WARN') process.stderr.write(line)
  else process.stdout.write(line)
  if (logFile) {
    rotateIfNeeded()
    try {
      appendFileSync(logFile, line)
    } catch {
      // ignore log write failures
    }
  }
}

export const log = {
  info: (...args: unknown[]): void => write('INFO', args),
  warn: (...args: unknown[]): void => write('WARN', args),
  error: (...args: unknown[]): void => write('ERROR', args),
  debug: (...args: unknown[]): void => write('DEBUG', args)
}

export function setupLogging(): string {
  logFile = join(logDir(), 'movieshelf.log')
  process.on('uncaughtException', (err) => log.error('uncaughtException', err))
  process.on('unhandledRejection', (reason) => log.error('unhandledRejection', reason))
  return logFile
}
