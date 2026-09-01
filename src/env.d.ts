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
  lineHeight: number
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
  pinned?: boolean
  updatedAt: number
  missing?: boolean
}

interface ReaderLibraryInfo {
  books: ReaderBookInfo[]
  progress: { bookId: string; chapterIndex: number; offset: number; updatedAt: number } | null
  progressByBook?: Record<string, { bookId: string; chapterIndex: number; offset: number; updatedAt: number }>
}

declare global {
  interface Window {
    electronAPI?: {
      platform: string
      onOpenQuickCapture?: (callback: () => void) => () => void
      openMiniWindow?: () => Promise<void>
      openQuickCapture?: () => Promise<boolean>
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
      everythingStatus?: (overrides?: { esPath?: string; httpUrl?: string }) => Promise<EverythingStatusResult>
      revealPath?: (target: string) => Promise<boolean>
      openTranslate?: (payload: { text: string; providerId?: string }) => Promise<boolean>
      getLauncherSettings?: () => Promise<LauncherSettingsConfig>
      setLauncherSettings?: (settings: LauncherSettingsConfig) => Promise<LauncherSettingsConfig>
      workbenchLocalGet?: () => Promise<unknown | null>
      workbenchLocalSet?: (data: unknown) => Promise<boolean>
      workbenchHostStart?: (opts?: {
        displayName?: string
        userId?: string
        passphrase?: string
      }) => Promise<{ port: number; roomCode: string; lanUrls: string[] }>
      workbenchHostStop?: () => Promise<boolean>
      workbenchHostStatus?: () => Promise<{
        running: boolean
        port: number | null
        roomCode: string | null
        lanUrls: string[]
      }>
      workbenchHostShareProject?: (payload: {
        project: unknown
        mainlineSeed: unknown[]
      }) => Promise<{ ok: boolean; error?: string }>
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
      readerListChapters?: (bookId: string) => Promise<Array<{ index: number; title: string }>>
      readerPickDirectory?: () => Promise<{ library: ReaderLibraryInfo; novelDir: string }>
      readerPickTxtFile?: () => Promise<{ library: ReaderLibraryInfo }>
      readerRemoveBook?: (bookId: string) => Promise<ReaderLibraryInfo>
      readerUpsertBook?: (book: ReaderBookInfo | Record<string, unknown>) => Promise<ReaderLibraryInfo>
      readerScrapeUrl?: (url: string, bookId?: string) => Promise<
        | { ok: true; book: ReaderBookInfo; chapter: { title: string; body: string; chapterIndex: number; chapterCount: number } }
        | { ok: false; message: string }
      >
      hotlistFetchAll?: (opts?: { noCache?: boolean }) => Promise<Array<{
        id: string
        title: string
        subtitle?: string
        updateTime: string
        fromCache: boolean
        items: Array<{ rank: number; title: string; url: string; hot?: string }>
        error?: string
      }>>
      hotlistGetPlatforms?: () => Promise<Array<{ id: string; title: string; subtitle?: string }>>
      hotlistFetchBatch?: (payload: { ids: string[]; noCache?: boolean }) => Promise<Array<{
        id: string
        title: string
        subtitle?: string
        updateTime: string
        fromCache: boolean
        items: Array<{ rank: number; title: string; url: string; hot?: string }>
        error?: string
      }>>
      hotlistFetch?: (id: string, opts?: { noCache?: boolean }) => Promise<{
        id: string
        title: string
        subtitle?: string
        updateTime: string
        fromCache: boolean
        items: Array<{ rank: number; title: string; url: string; hot?: string }>
        error?: string
      }>
      readerOpenBook?: (bookId: string) => Promise<{ mode: string; bookId?: string }>
      readerWindowControl?: (action: unknown) => Promise<boolean>
      ensureMineradio?: () => Promise<{
        ok: boolean
        url?: string
        mode?: 'full' | 'static'
        root?: string
        message?: string
        installing?: boolean
        port?: number
        preloadPath?: string
        embedEngine?: 'webview-native' | 'iframe-bridge'
      }>
      mineradioStatus?: () => Promise<{
        ok: boolean
        url?: string
        mode?: 'full' | 'static'
        root?: string
        message?: string
        installing?: boolean
        port?: number
        preloadPath?: string
        embedEngine?: 'webview-native' | 'iframe-bridge'
      }>
      openMineradioNeteaseLogin?: () => Promise<{
        ok: boolean
        cookie?: string
        reused?: boolean
        cancelled?: boolean
        error?: string
        message?: string
      }>
      openMineradioQQLogin?: (options?: { forceReauth?: boolean }) => Promise<{
        ok: boolean
        cookie?: string
        reused?: boolean
        recovered?: boolean
        partial?: boolean
        cancelled?: boolean
        error?: string
        message?: string
      }>
      openMineradioKugouLogin?: () => Promise<{
        ok: boolean
        cookie?: string
        reused?: boolean
        partial?: boolean
        cancelled?: boolean
        error?: string
        message?: string
      }>
      saveMineradioAccount?: (payload: Record<string, unknown>) => Promise<{
        id: string
        provider: string
        userId?: string
        nickname?: string
        loggedIn: boolean
        updatedAt: number
      }>
      listMineradioAccounts?: () => Promise<Array<{
        id: string
        provider: string
        userId?: string
        nickname?: string
        loggedIn: boolean
        updatedAt: number
      }>>
    }
  }
}
