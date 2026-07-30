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

interface ReaderSettingsConfig {
  opacity: number
  fontSize: number
  fontColor: string
  bossKey: string
  disguiseEnabled: boolean
  novelDir: string
  windowBounds: { x: number; y: number; width: number; height: number } | null
  bossKeyError?: string
}

interface ReaderBookInfo {
  id: string
  title: string
  source: 'local' | 'web'
  path?: string
  catalogUrl?: string
  chapterUrl?: string
  updatedAt: number
}

interface ReaderLibraryInfo {
  books: ReaderBookInfo[]
  progress: { bookId: string; chapterIndex: number; offset: number; updatedAt: number } | null
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
      openReader?: (req?: { mode?: 'auto' | 'library' | 'reading'; bookId?: string }) => Promise<{ mode: string; bookId?: string; bossKeyError?: string }>
      hideReader?: () => Promise<boolean>
      onReaderShown?: (callback: (payload: { mode: string; bookId?: string }) => void) => (() => void) | undefined
      onReaderToggleDisguise?: (callback: () => void) => (() => void) | undefined
      getReaderSettings?: () => Promise<ReaderSettingsConfig>
      setReaderSettings?: (settings: ReaderSettingsConfig | Record<string, unknown>) => Promise<ReaderSettingsConfig>
      readerListBooks?: () => Promise<ReaderLibraryInfo>
      readerSetProgress?: (progress: unknown) => Promise<ReaderLibraryInfo>
      readerGetChapter?: (bookId: string, chapterIndex: number) => Promise<
        | { ok: true; book: ReaderBookInfo; chapter: { title: string; body: string; chapterIndex: number; chapterCount: number } }
        | { ok: false; message: string }
      >
      readerPickDirectory?: () => Promise<ReaderLibraryInfo>
      readerScrapeUrl?: (url: string) => Promise<
        | { ok: true; book: ReaderBookInfo; chapter: { title: string; body: string; chapterIndex: number; chapterCount: number } }
        | { ok: false; message: string }
      >
      readerOpenBook?: (bookId: string) => Promise<{ mode: string; bookId?: string }>
      readerWindowControl?: (action: unknown) => Promise<boolean>
    }
  }
}
