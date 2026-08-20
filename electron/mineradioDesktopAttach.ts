import { app, type BrowserWindow, type WebContents } from 'electron'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { resolveMineradioRoot } from './mineradioHost'

const require = createRequire(import.meta.url)

type MineradioDesktopRuntime = {
  setHostWindow: (win: BrowserWindow | null) => void
  setEmbedWebContents: (wc: WebContents | null) => void
  setMainServerPort: (port: number) => void
  getStableUserDataPath: () => string
}

type MineradioDesktopModule = {
  attachMineradioDesktopRuntime: (options?: {
    hostWindow?: BrowserWindow | null
    embedWebContents?: WebContents | null
    port?: number
  }) => MineradioDesktopRuntime
  installMineradioDesktopProtocols: () => Promise<void>
}

let runtimeModule: MineradioDesktopModule | null = null
let runtime: MineradioDesktopRuntime | null = null
let loaded = false

function resolveRuntimePath(): string | null {
  const root = resolveMineradioRoot()
  if (!root) return null
  const candidate = path.join(root, 'desktop', 'abwb-host-runtime.js')
  return fs.existsSync(candidate) ? candidate : null
}

export function resolveMineradioPreloadPath(): string | null {
  const root = resolveMineradioRoot()
  if (!root) return null
  for (const name of ['abwb-preload.js', 'preload.js']) {
    const candidate = path.join(root, 'desktop', name)
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

export function writeMineradioLoginEasterEggUnlocked(): void {
  const dataDir = process.env.MINERADIO_ABWB_USER_DATA || path.join(app.getPath('userData'), 'mineradio')
  try {
    fs.mkdirSync(dataDir, { recursive: true })
    const file = path.join(dataDir, 'login-easter-egg.json')
    const now = Date.now()
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          schema: 1,
          gateVersion: 'world-peace-v1',
          cookieResetVersion: 'world-peace-v1',
          resetComplete: true,
          unlocked: true,
          resetAt: now,
          unlockedAt: now,
          resetError: '',
        },
        null,
        2,
      ),
      'utf8',
    )
  } catch {
    // ignore
  }
}

export function prepareMineradioDesktopEnv(): void {
  process.env.MINERADIO_ABWB_HOST = '1'
  process.env.MINERADIO_ABWB_USER_DATA = path.join(app.getPath('userData'), 'mineradio')
  process.env.MINERADIO_DISABLE_LOGIN_EASTER_EGG = '1'
  delete process.env.MINERADIO_LOGIN_EASTER_EGG_GATE_FILE
  try {
    fs.mkdirSync(process.env.MINERADIO_ABWB_USER_DATA, { recursive: true })
  } catch {
    // ignore
  }
  writeMineradioLoginEasterEggUnlocked()
}

export function loadMineradioDesktopRuntime(): boolean {
  if (loaded) return !!runtime
  prepareMineradioDesktopEnv()
  const runtimePath = resolveRuntimePath()
  if (!runtimePath) {
    console.warn('[Mineradio] abwb-host-runtime.js not found — desktop API attach skipped')
    loaded = true
    return false
  }
  try {
    runtimeModule = require(runtimePath) as MineradioDesktopModule
    runtime = runtimeModule.attachMineradioDesktopRuntime({})
    loaded = true
    console.log('[Mineradio] desktop runtime attached from', runtimePath)
    return true
  } catch (error) {
    console.error('[Mineradio] failed to load desktop runtime:', error)
    loaded = true
    return false
  }
}

export async function installMineradioDesktopProtocols(): Promise<void> {
  if (!loadMineradioDesktopRuntime() || !runtimeModule) return
  await runtimeModule.installMineradioDesktopProtocols()
}

export function bindMineradioDesktopHost(win: BrowserWindow | null, port?: number): void {
  if (!loadMineradioDesktopRuntime() || !runtime) return
  runtime.setHostWindow(win)
  if (port && port > 0) runtime.setMainServerPort(port)
}

export function bindMineradioEmbedWebContents(wc: WebContents | null): void {
  if (!loadMineradioDesktopRuntime() || !runtime) return
  runtime.setEmbedWebContents(wc)
}

export function setMineradioDesktopPort(port: number): void {
  if (!loadMineradioDesktopRuntime() || !runtime) return
  runtime.setMainServerPort(port)
}
