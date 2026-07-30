import { BrowserWindow, globalShortcut, screen } from 'electron'
import path from 'node:path'
import type { ReaderSettings } from './reader/types'

const DEFAULT_WIDTH = 520
const DEFAULT_HEIGHT = 640

let registeredBossKey = ''

export function createReaderWindow(opts: {
  dist: string
  preload: string
  bounds?: ReaderSettings['windowBounds']
}): BrowserWindow {
  const display = screen.getPrimaryDisplay().workArea
  const width = opts.bounds?.width ?? DEFAULT_WIDTH
  const height = opts.bounds?.height ?? DEFAULT_HEIGHT
  const x = opts.bounds?.x ?? Math.round(display.x + display.width - width - 24)
  const y = opts.bounds?.y ?? Math.round(display.y + 48)

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    minWidth: 320,
    minHeight: 360,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: opts.preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.loadFile(path.join(opts.dist, 'index.html'), { query: { reader: '1' } })
  return win
}

export function showReader(
  win: BrowserWindow,
  payload: { mode: string; bookId?: string },
): void {
  if (win.isDestroyed()) return
  if (!win.isVisible()) win.show()
  win.setAlwaysOnTop(true, 'screen-saver')
  win.focus()
  win.webContents.send('reader:shown', payload)
}

export function hideReader(win: BrowserWindow | null): void {
  if (win && !win.isDestroyed() && win.isVisible()) win.hide()
}

export function unregisterBossKey(): void {
  if (registeredBossKey) {
    try { globalShortcut.unregister(registeredBossKey) } catch { /* ignore */ }
    registeredBossKey = ''
  }
}

export function registerBossKey(
  accelerator: string,
  onTrigger: () => void,
): { ok: boolean; error?: string } {
  unregisterBossKey()
  const accel = String(accelerator || '').trim()
  if (!accel) return { ok: false, error: '老板键不能为空' }
  const electronAccel = accel.replace(/^Ctrl\+/i, 'CommandOrControl+')
  try {
    const ok = globalShortcut.register(electronAccel, onTrigger)
    if (!ok) return { ok: false, error: `无法注册老板键：${accel}（可能被占用）` }
    registeredBossKey = electronAccel
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function applyReaderOpacity(win: BrowserWindow | null, opacity: number): void {
  if (!win || win.isDestroyed()) return
  const clamped = Math.min(1, Math.max(0.2, opacity))
  // Window opacity multiplies content; keep slightly above content opacity so text stays readable.
  win.setOpacity(Math.min(1, Math.max(0.35, clamped)))
}

export function setReaderBounds(
  win: BrowserWindow | null,
  bounds: { x: number; y: number; width: number; height: number },
): void {
  if (!win || win.isDestroyed()) return
  win.setBounds(bounds)
}
