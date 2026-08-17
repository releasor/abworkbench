import fs from 'node:fs'
import path from 'node:path'
import type { ReaderSettings } from './reader/types'

export const DEFAULT_BOSS_KEY = 'Ctrl+Shift+Q'

export function defaultReaderSettings(): ReaderSettings {
  return {
    opacity: 0.85,
    fontSize: 16,
    lineHeight: 1.7,
    fontColor: '#e8e8e8',
    bossKey: DEFAULT_BOSS_KEY,
    disguiseEnabled: false,
    novelDir: '',
    windowBounds: null,
  }
}

export function readerSettingsPath(userData: string): string {
  return path.join(userData, 'reader-settings.json')
}

export function normalizeReaderSettings(input: unknown): ReaderSettings {
  const base = defaultReaderSettings()
  if (!input || typeof input !== 'object') return base
  const raw = input as Record<string, unknown>
  if (typeof raw.opacity === 'number' && raw.opacity >= 0.2 && raw.opacity <= 1) base.opacity = raw.opacity
  if (typeof raw.fontSize === 'number' && raw.fontSize >= 12 && raw.fontSize <= 36) base.fontSize = raw.fontSize
  if (typeof raw.lineHeight === 'number' && raw.lineHeight >= 1.2 && raw.lineHeight <= 2.4) base.lineHeight = raw.lineHeight
  if (typeof raw.fontColor === 'string' && raw.fontColor.trim()) base.fontColor = raw.fontColor.trim()
  if (typeof raw.bossKey === 'string' && raw.bossKey.trim()) base.bossKey = raw.bossKey.trim().replace(/^CommandOrControl/i, 'Ctrl')
  if (typeof raw.disguiseEnabled === 'boolean') base.disguiseEnabled = raw.disguiseEnabled
  if (typeof raw.novelDir === 'string') base.novelDir = raw.novelDir
  if (raw.windowBounds && typeof raw.windowBounds === 'object') {
    const b = raw.windowBounds as Record<string, unknown>
    if ([b.x, b.y, b.width, b.height].every((n) => typeof n === 'number')) {
      base.windowBounds = {
        x: b.x as number,
        y: b.y as number,
        width: b.width as number,
        height: b.height as number,
      }
    }
  }
  return base
}

export function loadReaderSettings(userData: string): ReaderSettings {
  const file = readerSettingsPath(userData)
  try {
    if (!fs.existsSync(file)) return defaultReaderSettings()
    return normalizeReaderSettings(JSON.parse(fs.readFileSync(file, 'utf8')))
  } catch {
    return defaultReaderSettings()
  }
}

export function saveReaderSettings(userData: string, input: unknown): ReaderSettings {
  const next = normalizeReaderSettings(input)
  try {
    fs.mkdirSync(userData, { recursive: true })
    fs.writeFileSync(readerSettingsPath(userData), JSON.stringify(next, null, 2), 'utf8')
  } catch {
    // best-effort
  }
  return next
}
