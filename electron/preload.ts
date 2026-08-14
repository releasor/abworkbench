import { contextBridge, ipcRenderer } from 'electron'

// Expose a minimal API to the renderer process.
// TaskFlow uses the desktop local adapter directly; no localhost HTTP service is started.
// This file exists for future extensibility (e.g., file system access, native dialogs).

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  onOpenQuickCapture: (callback: () => void) => {
    ipcRenderer.on('open-quick-capture', callback)
    return () => ipcRenderer.removeListener('open-quick-capture', callback)
  },
  openMiniWindow: () => ipcRenderer.invoke('desktop:open-mini-window'),
  showMainWindow: () => ipcRenderer.invoke('desktop:show-main-window'),
  openTarget: (target: string) => ipcRenderer.invoke('desktop:open-target', target),
  readClipboard: () => ipcRenderer.invoke('desktop:read-clipboard'),
  captureScreen: () => ipcRenderer.invoke('desktop:capture-screen'),
  notify: (payload: { title?: string; body?: string }) => ipcRenderer.invoke('desktop:notify', payload),
  indexDirectory: () => ipcRenderer.invoke('desktop:index-directory'),

  // Custom window controls (frameless main window)
  windowControl: (action: 'minimize' | 'toggle-maximize' | 'close') => ipcRenderer.invoke('desktop:window-control', action),
  isWindowMaximized: () => ipcRenderer.invoke('desktop:window-is-maximized'),
  onWindowMaximizedChanged: (callback: (maximized: boolean) => void) => {
    const listener = (_event: unknown, maximized: boolean) => callback(maximized)
    ipcRenderer.on('window-maximized-changed', listener)
    return () => ipcRenderer.removeListener('window-maximized-changed', listener)
  },

  // uTools-style launcher
  hideLauncher: () => ipcRenderer.invoke('desktop:hide-launcher'),
  onLauncherShown: (callback: () => void) => {
    ipcRenderer.on('launcher:shown', callback)
    return () => ipcRenderer.removeListener('launcher:shown', callback)
  },
  onToggleEmbeddedLauncher: (callback: () => void) => {
    ipcRenderer.on('toggle-embedded-launcher', callback)
    return () => ipcRenderer.removeListener('toggle-embedded-launcher', callback)
  },
  toggleLauncher: () => ipcRenderer.invoke('desktop:toggle-launcher'),
  openMainPage: (page: string) => ipcRenderer.invoke('desktop:open-main-page', page),
  onOpenMainPage: (callback: (page: string) => void) => {
    const listener = (_event: unknown, page: string) => callback(page)
    ipcRenderer.on('open-main-page', listener)
    return () => ipcRenderer.removeListener('open-main-page', listener)
  },
  everythingSearch: (query: string) => ipcRenderer.invoke('desktop:everything-search', query),
  everythingStatus: () => ipcRenderer.invoke('desktop:everything-status'),
  revealPath: (target: string) => ipcRenderer.invoke('desktop:reveal-path', target),
  openTranslate: (payload: { text: string; providerId?: string }) => ipcRenderer.invoke('desktop:open-translate', payload),
  getLauncherSettings: () => ipcRenderer.invoke('desktop:get-launcher-settings'),
  setLauncherSettings: (settings: unknown) => ipcRenderer.invoke('desktop:set-launcher-settings', settings),
  listRecentApps: () => ipcRenderer.invoke('desktop:list-recent-apps'),
  searchApps: (query: string) => ipcRenderer.invoke('desktop:search-apps', query),
  openApp: (appPath: string) => ipcRenderer.invoke('desktop:open-app', appPath),
  pinRecentApp: (appPath: string) => ipcRenderer.invoke('desktop:pin-recent-app', appPath),
  unpinRecentApp: (appPath: string) => ipcRenderer.invoke('desktop:unpin-recent-app', appPath),
  hideRecentApp: (appPath: string) => ipcRenderer.invoke('desktop:hide-recent-app', appPath),

  // Stealth reader
  openReader: (req?: { mode?: 'auto' | 'library' | 'reading'; bookId?: string }) =>
    ipcRenderer.invoke('desktop:open-reader', req),
  hideReader: () => ipcRenderer.invoke('desktop:hide-reader'),
  onReaderShown: (callback: (payload: { mode: string; bookId?: string }) => void) => {
    const listener = (_event: unknown, payload: { mode: string; bookId?: string }) => callback(payload)
    ipcRenderer.on('reader:shown', listener)
    return () => ipcRenderer.removeListener('reader:shown', listener)
  },
  onReaderToggleDisguise: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('reader:toggle-disguise', listener)
    return () => ipcRenderer.removeListener('reader:toggle-disguise', listener)
  },
  getReaderSettings: () => ipcRenderer.invoke('desktop:get-reader-settings'),
  setReaderSettings: (settings: unknown) => ipcRenderer.invoke('desktop:set-reader-settings', settings),
  readerListBooks: () => ipcRenderer.invoke('desktop:reader-list-books'),
  readerSetProgress: (progress: unknown) => ipcRenderer.invoke('desktop:reader-set-progress', progress),
  readerGetChapter: (bookId: string, chapterIndex: number) =>
    ipcRenderer.invoke('desktop:reader-get-chapter', { bookId, chapterIndex }),
  readerPickDirectory: () => ipcRenderer.invoke('desktop:reader-pick-directory'),
  readerRemoveBook: (bookId: string) => ipcRenderer.invoke('desktop:reader-remove-book', bookId),
  readerScrapeUrl: (url: string) => ipcRenderer.invoke('desktop:reader-scrape-url', url),
  readerOpenBook: (bookId: string) => ipcRenderer.invoke('desktop:reader-open-book', bookId),
  readerWindowControl: (action: unknown) => ipcRenderer.invoke('desktop:reader-window-control', action),
})
