import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export interface EverythingItem {
  name: string
  path: string
  isDir: boolean
}

export type EverythingSearchOutcome =
  | { ok: true; mode: 'cli' | 'http'; items: EverythingItem[] }
  | { ok: false; reason: 'not-installed' | 'not-running' | 'error'; message?: string }

const ES_CANDIDATE_PATHS = [
  'C:\\Program Files\\Everything\\es.exe',
  'C:\\Program Files (x86)\\Everything\\es.exe',
]

function run(command: string, args: string[], timeoutMs = 4000): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      if (error && typeof (error as { code?: unknown }).code === 'number') {
        resolve({ code: (error as { code: number }).code, stdout: String(stdout), stderr: String(stderr) })
        return
      }
      if (error) {
        resolve({ code: null, stdout: String(stdout), stderr: String(stderr || error.message) })
        return
      }
      resolve({ code: 0, stdout: String(stdout), stderr: String(stderr) })
    })
  })
}

function exists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

/** Locate es.exe: configured path → PATH (where) → well-known install locations. */
export async function locateEsExe(configuredPath?: string): Promise<string | null> {
  if (configuredPath && exists(configuredPath)) return configuredPath

  if (process.platform === 'win32') {
    const found = await run('where', ['es.exe'], 2000)
    if (found.code === 0) {
      const first = found.stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => line.toLowerCase().endsWith('es.exe') && exists(line))
      if (first) return first
    }
  }

  for (const candidate of ES_CANDIDATE_PATHS) {
    if (exists(candidate)) return candidate
  }
  return null
}

/** Find an Everything.exe we can launch: packaged resources, project folder, then system installs. */
export function findEverythingExe(...searchRoots: Array<string | undefined | null>): string | null {
  const candidates: string[] = []
  const roots = searchRoots.filter((root): root is string => typeof root === 'string' && root.length > 0)

  for (const root of roots) {
    // Packaged layout: resources/Everything/everything.exe
    candidates.push(path.join(root, 'Everything', 'everything.exe'))
    candidates.push(path.join(root, 'Everything', 'Everything.exe'))
    try {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name.toLowerCase().startsWith('everything')) {
          candidates.push(path.join(root, entry.name, 'everything.exe'))
          candidates.push(path.join(root, entry.name, 'Everything.exe'))
        }
      }
    } catch {
      // ignore unreadable roots
    }
  }

  candidates.push('C:\\Program Files\\Everything\\Everything.exe')
  candidates.push('C:\\Program Files (x86)\\Everything\\Everything.exe')
  return candidates.find(exists) || null
}

const PORTABLE_FILES = ['everything.exe', 'Everything.ini', 'Everything.lng'] as const

/**
 * Ensure a writable portable Everything lives under userData.
 * Packaged installs copy exe/ini/lng from resources (never the machine-specific .db).
 */
export function ensurePortableEverything(resourcesPath?: string, userDataPath?: string, appDir?: string): string | null {
  if (!userDataPath) {
    return findEverythingExe(resourcesPath, appDir)
  }

  const destDir = path.join(userDataPath, 'Everything')
  const destExe = path.join(destDir, 'everything.exe')
  if (exists(destExe)) return destExe

  const sourceExe = findEverythingExe(resourcesPath, appDir)
  if (!sourceExe) return null

  const sourceDir = path.dirname(sourceExe)
  try {
    fs.mkdirSync(destDir, { recursive: true })
    for (const file of PORTABLE_FILES) {
      const src = path.join(sourceDir, file)
      const dest = path.join(destDir, file === 'everything.exe' ? 'everything.exe' : file)
      if (!exists(src)) continue
      if (!exists(dest)) fs.copyFileSync(src, dest)
    }
    // Case-insensitive fallback for Everything.exe on case-sensitive volumes.
    if (!exists(destExe) && exists(path.join(sourceDir, 'Everything.exe'))) {
      fs.copyFileSync(path.join(sourceDir, 'Everything.exe'), destExe)
    }
  } catch {
    // Fall back to launching the read-only packaged copy if seeding fails.
    return sourceExe
  }

  return exists(destExe) ? destExe : sourceExe
}

// --- HTTP server mode (works with portable Everything, no es.exe needed) ---

async function probeHttp(baseUrl: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(`${baseUrl}/?search=probe&json=1&count=1`, { signal: controller.signal })
    clearTimeout(timer)
    return response.ok
  } catch {
    return false
  }
}

async function searchViaHttp(query: string, baseUrl: string, limit: number): Promise<EverythingItem[]> {
  const params = new URLSearchParams({
    search: query,
    json: '1',
    count: String(limit),
    path_column: '1',
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(`${baseUrl}/?${params.toString()}`, { signal: controller.signal })
    if (!response.ok) return []
    const data = (await response.json()) as { results?: Array<{ type?: string; name?: string; path?: string }> }
    const results = Array.isArray(data.results) ? data.results : []
    return results
      .filter((entry) => typeof entry.name === 'string' && entry.name)
      .map((entry) => {
        const dir = typeof entry.path === 'string' ? entry.path : ''
        const fullPath = dir ? (dir.endsWith('\\') ? `${dir}${entry.name}` : `${dir}\\${entry.name}`) : entry.name!
        return { name: entry.name!, path: fullPath, isDir: entry.type === 'folder' }
      })
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

function launchEverything(exePath: string): void {
  try {
    const child = spawn(exePath, ['-minimized'], { detached: true, stdio: 'ignore', windowsHide: true })
    child.unref()
  } catch {
    // best-effort launch
  }
}

async function waitForHttp(baseUrl: string, attempts = 10): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await probeHttp(baseUrl)) return true
    await new Promise((resolve) => setTimeout(resolve, 600))
  }
  return false
}

// --- CLI mode ---

function toItem(fullPath: string): EverythingItem {
  const normalized = fullPath.replace(/\//g, '\\')
  const name = normalized.split('\\').filter(Boolean).pop() || normalized
  let isDir: boolean
  try {
    isDir = fs.statSync(normalized).isDirectory()
  } catch {
    isDir = !/\.[a-z0-9]{1,8}$/i.test(name)
  }
  return { name, path: normalized, isDir }
}

export interface EverythingSearchOptions {
  esPath?: string
  httpUrl?: string
  /** Dev project root / app path (may contain Everything-* folder). */
  appDir?: string
  /** Packaged Electron resources path (contains bundled Everything/). */
  resourcesPath?: string
  /** Writable userData path; portable Everything is seeded here. */
  userDataPath?: string
  limit?: number
}

/**
 * Query Everything. Strategy:
 * 1. es.exe CLI when available;
 * 2. otherwise the Everything HTTP server (portable-friendly); if it is not reachable,
 *    try to launch a discovered Everything.exe once and retry.
 */
export async function searchEverything(query: string, options: EverythingSearchOptions = {}): Promise<EverythingSearchOutcome> {
  const trimmed = query.trim()
  if (!trimmed) return { ok: true, mode: 'http', items: [] }

  const limit = Math.max(1, Math.min(options.limit ?? 12, 50))
  const esPath = await locateEsExe(options.esPath)

  if (esPath) {
    const result = await run(esPath, ['-n', String(limit), trimmed])
    if (result.code !== 0) {
      const message = (result.stderr || result.stdout || '').trim()
      // es.exe exits non-zero (error 8) when the Everything service/IPC is unavailable.
      return { ok: false, reason: 'not-running', message: message || 'es.exe exited with an error' }
    }
    const items = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, limit)
      .map(toItem)
    return { ok: true, mode: 'cli', items }
  }

  // HTTP mode (portable Everything with its built-in HTTP server).
  const baseUrl = (options.httpUrl || '').replace(/\/+$/, '')
  if (baseUrl) {
    if (await probeHttp(baseUrl)) {
      return { ok: true, mode: 'http', items: await searchViaHttp(trimmed, baseUrl, limit) }
    }
    const exe = ensurePortableEverything(options.resourcesPath, options.userDataPath, options.appDir)
    if (exe) {
      launchEverything(exe)
      if (await waitForHttp(baseUrl)) {
        return { ok: true, mode: 'http', items: await searchViaHttp(trimmed, baseUrl, limit) }
      }
      return { ok: false, reason: 'not-running', message: '已尝试启动 Everything，但 HTTP 服务未就绪' }
    }
    return { ok: false, reason: 'not-installed', message: `未找到 es.exe，也未能连接 ${baseUrl}` }
  }

  return { ok: false, reason: 'not-installed' }
}

/** Health check for the settings page. */
export async function everythingStatus(options: EverythingSearchOptions = {}): Promise<{
  installed: boolean
  running: boolean
  mode: 'cli' | 'http' | null
  detail: string
}> {
  const esPath = await locateEsExe(options.esPath)
  if (esPath) {
    const probe = await run(esPath, ['-n', '1', 'abworkbench-everything-probe'], 3000)
    return {
      installed: true,
      running: probe.code === 0,
      mode: 'cli',
      detail: probe.code === 0 ? `es.exe：${esPath}` : `已找到 ${esPath}，但 Everything 未在运行`,
    }
  }

  const baseUrl = (options.httpUrl || '').replace(/\/+$/, '')
  if (baseUrl) {
    if (await probeHttp(baseUrl)) {
      return { installed: true, running: true, mode: 'http', detail: `HTTP 模式：${baseUrl}` }
    }
    const exe = ensurePortableEverything(options.resourcesPath, options.userDataPath, options.appDir)
    if (exe) {
      return { installed: true, running: false, mode: null, detail: `找到 ${exe}，但未在运行（搜索时会自动拉起）` }
    }
    return { installed: false, running: false, mode: null, detail: `未找到 Everything，且 ${baseUrl} 不可达` }
  }

  return { installed: false, running: false, mode: null, detail: '未找到 Everything' }
}
