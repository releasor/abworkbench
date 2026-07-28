export {}

interface TranslateProviderConfig {
  id: string
  name: string
  urlTemplate: string
  builtin?: boolean
}

interface LauncherSettingsConfig {
  hotkey: string
  mainWindowHotkey: string
  quickCaptureHotkey: string
  reclaimMainWindowWhenHidden: boolean
  esPath: string
  everythingHttpUrl: string
  defaultProviderId: string
  providers: TranslateProviderConfig[]
}

type EverythingSearchResult =
  | { ok: true; mode: 'cli' | 'http'; items: Array<{ name: string; path: string; isDir: boolean }> }
  | { ok: false; reason: 'not-installed' | 'not-running' | 'error'; message?: string }

interface EverythingStatusResult {
  installed: boolean
  running: boolean
  mode: 'cli' | 'http' | null
  detail: string
}

interface DesktopAppInfo {
  id: string
  name: string
  path: string
  target: string
  lastUsed?: number
  useCount?: number
  iconDataUrl?: string
  kind?: 'app' | 'settings'
  description?: string
  pinned?: boolean
}

interface RecentPathInfo {
  id: string
  name: string
  path: string
  isDir: boolean
  lastUsed?: number
  iconDataUrl?: string
}

interface LauncherRecentHomeInfo {
  apps: DesktopAppInfo[]
  files: RecentPathInfo[]
  folders: RecentPathInfo[]
}

declare global {
  interface Window {
    electronAPI?: {
      platform: string
      onOpenQuickCapture?: (callback: () => void) => () => void
      openMiniWindow?: () => Promise<void>
      showMainWindow?: () => Promise<boolean>
      openTarget?: (target: string) => Promise<boolean>
      readClipboard?: () => Promise<{ text: string; imageDataUrl: string }>
      captureScreen?: () => Promise<{ title: string; dataUrl: string; capturedAt: string } | null>
      notify?: (payload: { title?: string; body?: string }) => Promise<boolean>
      indexDirectory?: () => Promise<Array<{ name: string; path: string; type: string; size: number; modified: string }>>
      windowControl?: (action: 'minimize' | 'toggle-maximize' | 'close') => Promise<boolean>
      isWindowMaximized?: () => Promise<boolean>
      onWindowMaximizedChanged?: (callback: (maximized: boolean) => void) => (() => void) | undefined
      hideLauncher?: () => Promise<boolean>
      onLauncherShown?: (callback: () => void) => (() => void) | undefined
      onToggleEmbeddedLauncher?: (callback: () => void) => (() => void) | undefined
      toggleLauncher?: () => Promise<boolean>
      openMainPage?: (page: string) => Promise<boolean>
      onOpenMainPage?: (callback: (page: string) => void) => (() => void) | undefined
      everythingSearch?: (query: string) => Promise<EverythingSearchResult>
      everythingStatus?: () => Promise<EverythingStatusResult>
      revealPath?: (target: string) => Promise<boolean>
      openTranslate?: (payload: { text: string; providerId?: string }) => Promise<boolean>
      getLauncherSettings?: () => Promise<LauncherSettingsConfig>
      setLauncherSettings?: (settings: LauncherSettingsConfig) => Promise<LauncherSettingsConfig>
      listRecentApps?: () => Promise<LauncherRecentHomeInfo | DesktopAppInfo[]>
      searchApps?: (query: string) => Promise<DesktopAppInfo[]>
      openApp?: (appPath: string) => Promise<boolean>
      pinRecentApp?: (appPath: string) => Promise<DesktopAppInfo[]>
      unpinRecentApp?: (appPath: string) => Promise<DesktopAppInfo[]>
      hideRecentApp?: (appPath: string) => Promise<DesktopAppInfo[]>
    }
  }
}
