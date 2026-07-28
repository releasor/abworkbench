import fs from 'node:fs'
import path from 'node:path'

export interface TranslateProvider {
  id: string
  name: string
  /** URL template; `{q}` is replaced by the encoded query. Without `{q}`, text is injected into the page after load. */
  urlTemplate: string
  builtin?: boolean
}

export interface LauncherSettings {
  /** Electron accelerator for launcher, e.g. "Alt+Space" */
  hotkey: string
  /** Electron accelerator for main window, e.g. "Ctrl+Alt+Space" */
  mainWindowHotkey: string
  /** Electron accelerator for quick capture, e.g. "Ctrl+Shift+Space" */
  quickCaptureHotkey: string
  /**
   * When true, destroy the main BrowserWindow as soon as it is hidden/closed,
   * reclaiming renderer memory while the tray + launcher stay alive.
   */
  reclaimMainWindowWhenHidden: boolean
  /** Absolute path to Everything's es.exe; empty string means auto-detect */
  esPath: string
  /** Everything HTTP server base URL used when es.exe is unavailable */
  everythingHttpUrl: string
  defaultProviderId: string
  providers: TranslateProvider[]
}

export const DEFAULT_HOTKEY = 'Alt+Space'
export const DEFAULT_MAIN_WINDOW_HOTKEY = 'Ctrl+Alt+Space'
/** Previous mistaken factory default when launcher was briefly set to Ctrl+Alt+Space */
export const MISASSIGNED_LAUNCHER_HOTKEY = 'Ctrl+Alt+Space'
export const DEFAULT_QUICK_CAPTURE_HOTKEY = 'Ctrl+Shift+Space'
export const DEFAULT_EVERYTHING_HTTP_URL = 'http://127.0.0.1:23581'
export const DEFAULT_RECLAIM_MAIN_WINDOW = true

export const DEFAULT_PROVIDERS: TranslateProvider[] = [
  { id: 'sogou', name: '搜狗翻译', urlTemplate: 'https://translate.sogou.com/text', builtin: true },
  { id: 'google', name: 'Google 翻译', urlTemplate: 'https://translate.google.com/?sl=auto&tl=zh-CN&text={q}', builtin: true },
  { id: 'bing', name: '必应翻译', urlTemplate: 'https://www.bing.com/translator/?from=auto&to=zh-Hans&text={q}', builtin: true },
  { id: 'youdao', name: '有道翻译', urlTemplate: 'https://www.youdao.com/result?word={q}&lang=zh-CHS', builtin: true },
  { id: 'deepl', name: 'DeepL', urlTemplate: 'https://www.deepl.com/translator#auto/zh-hans/{q}', builtin: true },
]

export function defaultLauncherSettings(): LauncherSettings {
  return {
    hotkey: DEFAULT_HOTKEY,
    mainWindowHotkey: DEFAULT_MAIN_WINDOW_HOTKEY,
    quickCaptureHotkey: DEFAULT_QUICK_CAPTURE_HOTKEY,
    reclaimMainWindowWhenHidden: DEFAULT_RECLAIM_MAIN_WINDOW,
    esPath: '',
    everythingHttpUrl: DEFAULT_EVERYTHING_HTTP_URL,
    defaultProviderId: 'sogou',
    providers: DEFAULT_PROVIDERS.map((p) => ({ ...p })),
  }
}

function isValidProvider(value: unknown): value is TranslateProvider {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return typeof p.id === 'string' && p.id.length > 0 && typeof p.name === 'string' && typeof p.urlTemplate === 'string' && /^https?:\/\//i.test(p.urlTemplate)
}

function normalizeAcceleratorLabel(value: string): string {
  return value.trim().replace(/^CommandOrControl/i, 'Ctrl')
}

/** Merge a partial/persisted value over defaults, dropping invalid entries. */
export function normalizeLauncherSettings(input: unknown): LauncherSettings {
  const base = defaultLauncherSettings()
  if (!input || typeof input !== 'object') return base
  const raw = input as Record<string, unknown>

  if (typeof raw.hotkey === 'string' && raw.hotkey.trim()) {
    const hotkey = normalizeAcceleratorLabel(raw.hotkey)
    // Undo the brief period when launcher default was wrongly set to Ctrl+Alt+Space
    // (only when main-window hotkey has never been persisted yet).
    if (hotkey === MISASSIGNED_LAUNCHER_HOTKEY && typeof raw.mainWindowHotkey !== 'string') {
      base.hotkey = DEFAULT_HOTKEY
      base.mainWindowHotkey = DEFAULT_MAIN_WINDOW_HOTKEY
    } else {
      base.hotkey = hotkey
    }
  }
  if (typeof raw.mainWindowHotkey === 'string' && raw.mainWindowHotkey.trim()) {
    base.mainWindowHotkey = normalizeAcceleratorLabel(raw.mainWindowHotkey)
  }
  if (typeof raw.quickCaptureHotkey === 'string' && raw.quickCaptureHotkey.trim()) {
    base.quickCaptureHotkey = normalizeAcceleratorLabel(raw.quickCaptureHotkey)
  }
  if (typeof raw.reclaimMainWindowWhenHidden === 'boolean') {
    base.reclaimMainWindowWhenHidden = raw.reclaimMainWindowWhenHidden
  }
  if (typeof raw.esPath === 'string') base.esPath = raw.esPath.trim()
  if (typeof raw.everythingHttpUrl === 'string' && /^https?:\/\//i.test(raw.everythingHttpUrl.trim())) {
    base.everythingHttpUrl = raw.everythingHttpUrl.trim().replace(/\/+$/, '')
  }

  if (Array.isArray(raw.providers)) {
    const custom = raw.providers.filter(isValidProvider)
    if (custom.length > 0) {
      // Keep persisted providers; append any new builtin the user has never seen.
      const known = new Set(custom.map((p) => p.id))
      base.providers = [...custom, ...DEFAULT_PROVIDERS.filter((p) => !known.has(p.id)).map((p) => ({ ...p }))]
    }
  }

  if (typeof raw.defaultProviderId === 'string' && base.providers.some((p) => p.id === raw.defaultProviderId)) {
    base.defaultProviderId = raw.defaultProviderId
  }
  return base
}

export function loadLauncherSettings(userDataDir: string): LauncherSettings {
  const file = path.join(userDataDir, 'launcher-settings.json')
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>
      const normalized = normalizeLauncherSettings(raw)
      const rawHotkey = typeof raw.hotkey === 'string' ? normalizeAcceleratorLabel(raw.hotkey) : ''
      const needsPersist =
        rawHotkey === MISASSIGNED_LAUNCHER_HOTKEY
        || typeof raw.quickCaptureHotkey !== 'string'
        || typeof raw.mainWindowHotkey !== 'string'
      if (needsPersist) {
        return saveLauncherSettings(userDataDir, normalized)
      }
      return normalized
    }
  } catch {
    // Corrupt file: fall back to defaults.
  }
  return defaultLauncherSettings()
}

export function saveLauncherSettings(userDataDir: string, settings: LauncherSettings): LauncherSettings {
  const normalized = normalizeLauncherSettings(settings)
  const file = path.join(userDataDir, 'launcher-settings.json')
  try {
    fs.mkdirSync(userDataDir, { recursive: true })
    fs.writeFileSync(file, JSON.stringify(normalized, null, 2))
  } catch {
    // Persisting settings is best-effort; runtime state still applies.
  }
  return normalized
}

export function buildTranslateUrl(provider: TranslateProvider, text: string): { url: string; needsInjection: boolean } {
  if (provider.urlTemplate.includes('{q}')) {
    return { url: provider.urlTemplate.replace('{q}', encodeURIComponent(text)), needsInjection: false }
  }
  return { url: provider.urlTemplate, needsInjection: true }
}
