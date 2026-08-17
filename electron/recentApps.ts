import { app, nativeImage, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { searchWindowsSettings, type WindowsSettingEntry } from './windowsSettings'

export interface DesktopAppEntry {
  id: string
  name: string
  path: string
  target: string
  lastUsed?: number
  useCount?: number
  iconDataUrl?: string
  /** app = desktop software; settings = Windows Settings page */
  kind?: 'app' | 'settings'
  description?: string
  /** User-pinned on the launcher home grid */
  pinned?: boolean
}

export interface RecentPathEntry {
  id: string
  name: string
  path: string
  isDir: boolean
  lastUsed?: number
  iconDataUrl?: string
}

export interface LauncherRecentHome {
  apps: DesktopAppEntry[]
  files: RecentPathEntry[]
  folders: RecentPathEntry[]
}

interface UsageRecord {
  count: number
  lastUsed: number
}

interface UsageStore {
  [targetKey: string]: UsageRecord
}

interface RecentAppsPrefs {
  /** Normalized target keys, order = pin order (first = leftmost) */
  pinned: string[]
  /** Normalized target keys hidden from the recent grid */
  hidden: string[]
}

const SKIP_NAME_RE = /uninstall|卸载|帮助|help|readme|release notes|网站|website|manual|文档|license|许可/i
const EXEC_EXT_RE = /\.(exe|bat|cmd|com|msc)$/i
const SYSTEM_EXE_SKIP = /^(rundll32|dllhost|conhost|sihost|taskhostw|svchost|explorer|backgroundtaskhost|runtimebroker|searchhost|shellexperiencehost|applicationframehost|systemsettings|systemsettingsadminflows)\.exe$/i

let catalog: DesktopAppEntry[] = []
let catalogBuiltAt = 0
let usageStore: UsageStore = {}
let usagePath = ''
let prefsStore: RecentAppsPrefs = { pinned: [], hidden: [] }
let prefsPath = ''
let building: Promise<DesktopAppEntry[]> | null = null

function exists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\//g, '\\')
}

function makeId(filePath: string): string {
  return `app:${normalizeKey(filePath)}`
}

function isExecutableTarget(target: string): boolean {
  const t = target.trim()
  if (!t) return false
  if (/^ms-settings:/i.test(t)) return true
  return EXEC_EXT_RE.test(t)
}

function loadUsage(userDataPath: string): void {
  usagePath = path.join(userDataPath, 'launcher-app-usage.json')
  try {
    const raw = fs.readFileSync(usagePath, 'utf8')
    const parsed = JSON.parse(raw) as UsageStore
    usageStore = parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    usageStore = {}
  }
}

function saveUsage(): void {
  if (!usagePath) return
  try {
    fs.writeFileSync(usagePath, JSON.stringify(usageStore), 'utf8')
  } catch {
    // best-effort
  }
}

function loadPrefs(userDataPath: string): void {
  prefsPath = path.join(userDataPath, 'launcher-recent-prefs.json')
  try {
    const raw = fs.readFileSync(prefsPath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<RecentAppsPrefs>
    prefsStore = {
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned.filter((v) => typeof v === 'string') : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((v) => typeof v === 'string') : [],
    }
  } catch {
    prefsStore = { pinned: [], hidden: [] }
  }
}

function savePrefs(): void {
  if (!prefsPath) return
  try {
    fs.writeFileSync(prefsPath, JSON.stringify(prefsStore, null, 2), 'utf8')
  } catch {
    // best-effort
  }
}

function ensurePrefs(userDataPath: string): void {
  if (!prefsPath) loadPrefs(userDataPath)
}

function resolveAppKey(appPathOrTarget: string): string {
  const value = String(appPathOrTarget || '').trim()
  if (!value) return ''
  if (/^ms-settings:/i.test(value)) return normalizeKey(value)
  if (value.toLowerCase().endsWith('.lnk')) {
    const resolved = resolveShortcut(value)
    if (resolved?.target) return normalizeKey(resolved.target)
  }
  return normalizeKey(value)
}

function findEntryByKey(key: string): DesktopAppEntry | undefined {
  if (!key) return undefined
  return catalog.find(
    (entry) => normalizeKey(entry.target) === key || normalizeKey(entry.path) === key,
  )
}

function resolveShortcut(linkPath: string): { name: string; target: string; path: string } | null {
  try {
    const shortcut = shell.readShortcutLink(linkPath)
    const target = String(shortcut.target || '').trim()
    if (!isExecutableTarget(target)) return null
    const name = path.basename(linkPath, path.extname(linkPath))
    if (SKIP_NAME_RE.test(name) || SKIP_NAME_RE.test(path.basename(target))) return null
    const exeName = path.basename(target)
    if (SYSTEM_EXE_SKIP.test(exeName)) return null
    return { name, target, path: linkPath }
  } catch {
    return null
  }
}

function walkShortcuts(dir: string, out: Map<string, DesktopAppEntry>, depth = 0): void {
  if (depth > 6 || !exists(dir)) return
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkShortcuts(full, out, depth + 1)
      continue
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.lnk')) continue
    const resolved = resolveShortcut(full)
    if (!resolved) continue
    const key = normalizeKey(resolved.target)
    const usage = usageStore[key]
    const item: DesktopAppEntry = {
      id: makeId(resolved.path),
      name: resolved.name,
      path: resolved.path,
      target: resolved.target,
      kind: 'app',
      useCount: usage?.count || 0,
      lastUsed: usage?.lastUsed,
    }
    const prev = out.get(key)
    if (!prev || (item.useCount || 0) > (prev.useCount || 0)) {
      out.set(key, item)
    }
  }
}

function sourceDirs(): string[] {
  const dirs: string[] = []
  const appData = process.env.APPDATA || ''
  const programData = process.env.ProgramData || 'C:\\ProgramData'
  const userProfile = process.env.USERPROFILE || ''
  if (appData) dirs.push(path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'))
  dirs.push(path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'))
  if (userProfile) {
    dirs.push(path.join(userProfile, 'Desktop'))
    dirs.push(path.join(userProfile, 'OneDrive', 'Desktop'))
  }
  dirs.push('C:\\Users\\Public\\Desktop')
  return dirs.filter(exists)
}

function recentDir(): string | null {
  const appData = process.env.APPDATA
  if (!appData) return null
  const dir = path.join(appData, 'Microsoft', 'Windows', 'Recent')
  return exists(dir) ? dir : null
}

/** Recently executed programs from Windows Prefetch (exe only). */
function listPrefetchRecent(limit = 40): Array<{ exeName: string; mtime: number }> {
  const dir = 'C:\\Windows\\Prefetch'
  if (!exists(dir)) return []
  let files: string[]
  try {
    files = fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith('.pf'))
  } catch {
    return []
  }

  const byExe = new Map<string, number>()
  for (const name of files) {
    // CHROME.EXE-A1B2C3D4.pf
    const match = name.match(/^(.+\.(?:EXE|BAT|CMD|COM))-[0-9A-F]+\.pf$/i)
    if (!match) continue
    const exeName = match[1]
    if (SYSTEM_EXE_SKIP.test(exeName)) continue
    if (SKIP_NAME_RE.test(exeName)) continue
    const full = path.join(dir, name)
    let mtime: number
    try {
      mtime = fs.statSync(full).mtimeMs
    } catch {
      continue
    }
    const key = exeName.toLowerCase()
    const prev = byExe.get(key) || 0
    if (mtime > prev) byExe.set(key, mtime)
  }

  return Array.from(byExe.entries())
    .map(([exeName, mtime]) => ({ exeName, mtime }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
}

function findCatalogByExeName(exeName: string): DesktopAppEntry | undefined {
  const needle = exeName.toLowerCase()
  return catalog.find((entry) => path.basename(entry.target).toLowerCase() === needle)
}

async function withIcon(entry: DesktopAppEntry): Promise<DesktopAppEntry> {
  if (entry.kind === 'settings') return entry
  const iconSource = exists(entry.target) ? entry.target : entry.path
  try {
    const icon = await app.getFileIcon(iconSource, { size: 'normal' })
    if (!icon.isEmpty()) {
      return { ...entry, iconDataUrl: icon.toDataURL() }
    }
  } catch {
    // ignore icon failures
  }
  try {
    const empty = nativeImage.createEmpty()
    if (!empty.isEmpty()) {
      return { ...entry, iconDataUrl: empty.toDataURL() }
    }
  } catch {
    // ignore
  }
  return entry
}

async function attachIcons(entries: DesktopAppEntry[]): Promise<DesktopAppEntry[]> {
  return Promise.all(entries.map((entry) => withIcon(entry)))
}

function settingToEntry(setting: WindowsSettingEntry): DesktopAppEntry {
  return {
    id: setting.id,
    name: setting.name,
    path: setting.uri,
    target: setting.uri,
    kind: 'settings',
    description: `${setting.category} · ${setting.description}`,
  }
}

export async function ensureAppCatalog(userDataPath: string, force = false): Promise<DesktopAppEntry[]> {
  if (process.platform !== 'win32') {
    catalog = []
    catalogBuiltAt = Date.now()
    return catalog
  }
  if (!usagePath) loadUsage(userDataPath)
  const fresh = Date.now() - catalogBuiltAt < 5 * 60 * 1000
  if (!force && catalog.length > 0 && fresh) return catalog
  if (building) return building

  building = (async () => {
    const map = new Map<string, DesktopAppEntry>()
    for (const dir of sourceDirs()) walkShortcuts(dir, map)
    catalog = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    catalogBuiltAt = Date.now()
    building = null
    return catalog
  })()

  return building
}

function fuzzyScore(name: string, query: string): number {
  const n = name.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return 0
  if (n === q) return 1000
  if (n.startsWith(q)) return 800
  if (n.includes(q)) return 600

  let qi = 0
  for (let i = 0; i < n.length && qi < q.length; i++) {
    if (n[i] === q[qi]) qi++
  }
  if (qi === q.length) return 300 + Math.max(0, 80 - (n.length - q.length))

  const tokens = n.split(/[\s\-_.()（）]+/).filter(Boolean)
  if (tokens.some((token) => token.startsWith(q))) return 500
  return 0
}

function resolveAnyShortcut(linkPath: string): { name: string; target: string; path: string } | null {
  try {
    const shortcut = shell.readShortcutLink(linkPath)
    const target = String(shortcut.target || '').trim()
    if (!target) return null
    const name = path.basename(linkPath, path.extname(linkPath))
    return { name, target, path: linkPath }
  } catch {
    return null
  }
}

function listRecentLinkPaths(limit = 80): string[] {
  const recent = recentDir()
  if (!recent) return []
  try {
    return fs.readdirSync(recent)
      .filter((name) => name.toLowerCase().endsWith('.lnk'))
      .map((name) => path.join(recent, name))
      .filter(exists)
      .sort((a, b) => {
        try {
          return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs
        } catch {
          return 0
        }
      })
      .slice(0, limit)
  } catch {
    return []
  }
}

async function withPathIcon(entry: RecentPathEntry): Promise<RecentPathEntry> {
  try {
    const icon = await app.getFileIcon(entry.path, { size: 'normal' })
    if (!icon.isEmpty()) return { ...entry, iconDataUrl: icon.toDataURL() }
  } catch {
    // ignore
  }
  return entry
}

export async function listRecentFilesAndFolders(fileLimit = 8, folderLimit = 6): Promise<{
  files: RecentPathEntry[]
  folders: RecentPathEntry[]
}> {
  if (process.platform !== 'win32') return { files: [], folders: [] }

  const files: RecentPathEntry[] = []
  const folders: RecentPathEntry[] = []
  const seen = new Set<string>()

  for (const linkPath of listRecentLinkPaths(100)) {
    if (files.length >= fileLimit && folders.length >= folderLimit) break
    const resolved = resolveAnyShortcut(linkPath)
    if (!resolved) continue
    const target = resolved.target
    if (isExecutableTarget(target)) continue
    if (/^https?:\/\//i.test(target) || /^ms-/i.test(target)) continue
    if (!exists(target)) continue

    const key = normalizeKey(target)
    if (seen.has(key)) continue
    seen.add(key)

    let isDir: boolean
    let mtime: number
    try {
      const st = fs.statSync(target)
      isDir = st.isDirectory()
      mtime = fs.statSync(linkPath).mtimeMs
    } catch {
      continue
    }

    const entry: RecentPathEntry = {
      id: `path:${key}`,
      name: path.basename(target) || resolved.name,
      path: target,
      isDir,
      lastUsed: mtime,
    }

    if (isDir) {
      if (folders.length < folderLimit) folders.push(entry)
    } else if (files.length < fileLimit) {
      files.push(entry)
    }
  }

  const [filesWithIcons, foldersWithIcons] = await Promise.all([
    Promise.all(files.map(withPathIcon)),
    Promise.all(folders.map(withPathIcon)),
  ])
  return { files: filesWithIcons, folders: foldersWithIcons }
}

export async function listLauncherRecentHome(userDataPath: string): Promise<LauncherRecentHome> {
  const [apps, paths] = await Promise.all([
    listRecentApps(userDataPath, 12),
    listRecentFilesAndFolders(8, 6),
  ])
  return { apps, files: paths.files, folders: paths.folders }
}

export async function listRecentApps(userDataPath: string, limit = 12): Promise<DesktopAppEntry[]> {
  await ensureAppCatalog(userDataPath)
  ensurePrefs(userDataPath)
  const byTarget = new Map(catalog.map((appEntry) => [normalizeKey(appEntry.target), appEntry]))
  const merged = new Map<string, DesktopAppEntry>()
  const hidden = new Set(prefsStore.hidden.map(normalizeKey))
  const pinnedKeys = prefsStore.pinned.map(normalizeKey).filter(Boolean)

  const put = (entry: DesktopAppEntry, lastUsed?: number) => {
    if (entry.kind === 'settings') return
    if (!isExecutableTarget(entry.target)) return
    const key = normalizeKey(entry.target)
    if (hidden.has(key)) return
    if (merged.has(key)) {
      const prev = merged.get(key)!
      if ((lastUsed || entry.lastUsed || 0) > (prev.lastUsed || 0)) {
        merged.set(key, { ...entry, lastUsed: lastUsed || entry.lastUsed, kind: 'app' })
      }
      return
    }
    merged.set(key, {
      ...entry,
      kind: 'app',
      lastUsed: lastUsed ?? entry.lastUsed,
    })
  }

  // 1) Apps opened via this launcher (real software usage)
  const usageRecent = Object.entries(usageStore)
    .sort((a, b) => b[1].lastUsed - a[1].lastUsed)
    .slice(0, limit * 2)
  for (const [key, usage] of usageRecent) {
    const found = byTarget.get(key)
    if (found) put({ ...found, useCount: usage.count, lastUsed: usage.lastUsed }, usage.lastUsed)
  }

  // 2) Prefetch = recently executed software on this PC
  for (const row of listPrefetchRecent(limit * 3)) {
    const found = findCatalogByExeName(row.exeName)
    if (found) {
      put(found, row.mtime)
      continue
    }
  }

  // 3) Windows Recent: only shortcuts whose target is an executable (ignore docs/folders)
  for (const linkPath of listRecentLinkPaths(60)) {
    const resolved = resolveShortcut(linkPath)
    if (!resolved) continue
    const fromCatalog = byTarget.get(normalizeKey(resolved.target)) || findCatalogByExeName(path.basename(resolved.target))
    let mtime: number
    try {
      mtime = fs.statSync(linkPath).mtimeMs
    } catch {
      mtime = Date.now()
    }
    if (fromCatalog) {
      put(fromCatalog, mtime)
    } else {
      put({
        id: makeId(linkPath),
        name: resolved.name,
        path: linkPath,
        target: resolved.target,
        kind: 'app',
        useCount: usageStore[normalizeKey(resolved.target)]?.count || 0,
      }, mtime)
    }
    if (merged.size >= limit * 2) break
  }

  // 4) Fallback: popular Start Menu apps so the list is never empty of software
  if (merged.size < Math.min(8, limit)) {
    const fallback = [...catalog]
      .sort((a, b) => (b.useCount || 0) - (a.useCount || 0) || a.name.localeCompare(b.name, 'zh'))
      .slice(0, limit)
    for (const item of fallback) put(item)
  }

  const pinnedEntries: DesktopAppEntry[] = []
  const pinnedSet = new Set<string>()
  for (const key of pinnedKeys) {
    if (hidden.has(key) || pinnedSet.has(key)) continue
    const found = byTarget.get(key) || findEntryByKey(key) || merged.get(key)
    if (!found || found.kind === 'settings' || !isExecutableTarget(found.target)) continue
    pinnedSet.add(key)
    pinnedEntries.push({
      ...found,
      kind: 'app',
      pinned: true,
      useCount: usageStore[key]?.count ?? found.useCount,
      lastUsed: usageStore[key]?.lastUsed ?? found.lastUsed,
    })
  }

  const recentEntries = Array.from(merged.values())
    .filter((entry) => entry.kind !== 'settings' && isExecutableTarget(entry.target))
    .filter((entry) => !pinnedSet.has(normalizeKey(entry.target)))
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0) || (b.useCount || 0) - (a.useCount || 0))

  const remaining = Math.max(0, limit - pinnedEntries.length)
  const list = [
    ...pinnedEntries,
    ...recentEntries.slice(0, remaining).map((entry) => ({ ...entry, pinned: false })),
  ].slice(0, limit)

  return attachIcons(list)
}

/** Pin an app to the front of the recent software grid. */
export async function pinRecentApp(userDataPath: string, appPathOrTarget: string): Promise<DesktopAppEntry[]> {
  await ensureAppCatalog(userDataPath)
  ensurePrefs(userDataPath)
  const key = resolveAppKey(appPathOrTarget)
  if (!key) return listRecentApps(userDataPath)
  prefsStore.hidden = prefsStore.hidden.filter((item) => normalizeKey(item) !== key)
  prefsStore.pinned = [key, ...prefsStore.pinned.filter((item) => normalizeKey(item) !== key)]
  savePrefs()
  return listRecentApps(userDataPath)
}

/** Unpin an app (it may still appear in recent order). */
export async function unpinRecentApp(userDataPath: string, appPathOrTarget: string): Promise<DesktopAppEntry[]> {
  ensurePrefs(userDataPath)
  const key = resolveAppKey(appPathOrTarget)
  if (!key) return listRecentApps(userDataPath)
  prefsStore.pinned = prefsStore.pinned.filter((item) => normalizeKey(item) !== key)
  savePrefs()
  return listRecentApps(userDataPath)
}

/**
 * Remove an app from the recent software grid.
 * Later items fill the gap; Prefetch/Recent will not bring it back until opened again from the launcher.
 */
export async function hideRecentApp(userDataPath: string, appPathOrTarget: string): Promise<DesktopAppEntry[]> {
  ensurePrefs(userDataPath)
  const key = resolveAppKey(appPathOrTarget)
  if (!key) return listRecentApps(userDataPath)
  prefsStore.pinned = prefsStore.pinned.filter((item) => normalizeKey(item) !== key)
  if (!prefsStore.hidden.some((item) => normalizeKey(item) === key)) {
    prefsStore.hidden = [...prefsStore.hidden, key]
  }
  // Drop local usage so launcher-ranked recent does not keep resurfacing it.
  if (usageStore[key]) {
    delete usageStore[key]
    saveUsage()
  }
  savePrefs()
  return listRecentApps(userDataPath)
}

export async function searchInstalledApps(userDataPath: string, query: string, limit = 10): Promise<DesktopAppEntry[]> {
  const q = query.trim()
  if (q.length < 1) return []
  await ensureAppCatalog(userDataPath)

  const settingsHits = searchWindowsSettings(q, Math.min(14, Math.max(8, limit))).map(settingToEntry)

  const scored = catalog
    .map((entry) => {
      const nameScore = fuzzyScore(entry.name, q)
      const fileScore = Math.floor(fuzzyScore(path.basename(entry.target, path.extname(entry.target)), q) * 0.85)
      const score = Math.max(nameScore, fileScore) + Math.min(120, (entry.useCount || 0) * 8)
      return { entry, score }
    })
    .filter((row) => row.score >= 300)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, 'zh'))
    .slice(0, limit)
    .map((row) => row.entry)

  // Prefer settings when query is settings-oriented; otherwise apps first, then settings.
  const settingsFirst = /设置|settings|ms-settings|系统设置|wlan|蓝牙|wifi|更新|电源|显示|声音|隐私|通知|任务栏|壁纸|麦克风|相机|打印机|语言|输入法|默认应用|启动项|飞行模式|热点|vpn|代理|剪贴板|深色|浅色|夜间|放大镜|讲述人|安全中心|defender/i.test(q)
  const apps = await attachIcons(scored)
  const merged = settingsFirst
    ? [...settingsHits, ...apps]
    : [...apps, ...settingsHits]

  // Dedupe by id, keep order
  const seen = new Set<string>()
  const unique: DesktopAppEntry[] = []
  for (const item of merged) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    unique.push(item)
    if (unique.length >= limit + 8) break
  }
  return unique.slice(0, settingsFirst ? Math.max(limit + 4, settingsHits.length) : Math.max(limit, Math.min(settingsHits.length + apps.length, limit + 4)))
}

export async function openDesktopApp(userDataPath: string, appPath: string): Promise<boolean> {
  await ensureAppCatalog(userDataPath)
  if (!appPath) return false

  // Windows Settings URI
  if (/^ms-settings:/i.test(appPath)) {
    await shell.openExternal(appPath)
    const key = normalizeKey(appPath)
    const prev = usageStore[key] || { count: 0, lastUsed: 0 }
    usageStore[key] = { count: prev.count + 1, lastUsed: Date.now() }
    ensurePrefs(userDataPath)
    prefsStore.hidden = prefsStore.hidden.filter((item) => normalizeKey(item) !== key)
    savePrefs()
    saveUsage()
    return true
  }

  if (!exists(appPath)) return false

  const result = await shell.openPath(appPath)
  if (result !== '') return false

  let target = appPath
  if (appPath.toLowerCase().endsWith('.lnk')) {
    const resolved = resolveShortcut(appPath)
    if (resolved?.target) target = resolved.target
  }
  if (!isExecutableTarget(target) && !appPath.toLowerCase().endsWith('.lnk')) {
    // opened something unexpected — still ok, but don't record as app usage
    return true
  }

  const key = normalizeKey(target)
  const prev = usageStore[key] || { count: 0, lastUsed: 0 }
  usageStore[key] = { count: prev.count + 1, lastUsed: Date.now() }
  // Opening via launcher brings a previously removed app back into recent.
  ensurePrefs(userDataPath)
  prefsStore.hidden = prefsStore.hidden.filter((item) => normalizeKey(item) !== key)
  savePrefs()
  saveUsage()

  const found = catalog.find((entry) => normalizeKey(entry.target) === key || normalizeKey(entry.path) === normalizeKey(appPath))
  if (found) {
    found.useCount = usageStore[key].count
    found.lastUsed = usageStore[key].lastUsed
  }
  return true
}

export function initRecentApps(userDataPath: string): void {
  loadUsage(userDataPath)
  loadPrefs(userDataPath)
  void ensureAppCatalog(userDataPath).catch(() => {
    // background warmup
  })
}
