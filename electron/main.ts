import { app, BrowserWindow, Menu, Tray, dialog, globalShortcut, ipcMain, nativeImage, shell, session, screen, desktopCapturer, clipboard, Notification } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { shouldQuitForExistingInstance } from './appLifecycle'
import { getIsolatedCachePaths } from './desktopReliability'
import { buildTranslateUrl, DEFAULT_HOTKEY, DEFAULT_MAIN_WINDOW_HOTKEY, DEFAULT_QUICK_CAPTURE_HOTKEY, loadLauncherSettings, saveLauncherSettings, type LauncherSettings } from './launcherSettings'
import { everythingStatus, searchEverything } from './everythingSearch'
import { initRecentApps, listLauncherRecentHome, openDesktopApp, searchInstalledApps, pinRecentApp, unpinRecentApp, hideRecentApp } from './recentApps'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
let miniWin: BrowserWindow | null = null
let launcherWin: BrowserWindow | null = null
let translateWin: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let launcherHotkey = ''
let mainWindowHotkey = ''
let quickCaptureHotkey = ''
let launcherSettings: LauncherSettings = loadLauncherSettings(app.getPath('userData'))

function configureDiskCacheIsolation() {
  const paths = getIsolatedCachePaths(app.getPath('userData'))
  try {
    fs.mkdirSync(paths.cacheDir, { recursive: true })
    fs.mkdirSync(paths.sessionDataDir, { recursive: true })
    app.setPath('sessionData', paths.sessionDataDir)
    app.commandLine.appendSwitch('disk-cache-dir', paths.cacheDir)
    app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
  } catch {
    // Cache isolation is a reliability improvement; startup should continue if it cannot be applied.
  }
}

configureDiskCacheIsolation()

function showMainWindow() {
  if (!win) {
    createWindow()
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

/** Ctrl+Alt+Space: show main window, or hide to tray when already visible. */
function toggleMainWindow() {
  if (!win || win.isDestroyed()) {
    createWindow()
    return
  }
  if (win.isVisible() && !win.isMinimized()) {
    win.hide()
    return
  }
  showMainWindow()
}

function openQuickCapture() {
  showMainWindow()
  win?.webContents.send('open-quick-capture')
}

function createMiniWindow() {
  if (miniWin && !miniWin.isDestroyed()) {
    miniWin.show()
    miniWin.focus()
    return
  }

  miniWin = new BrowserWindow({
    width: 380,
    height: 560,
    minWidth: 320,
    minHeight: 420,
    title: 'Abworkbench Mini',
    icon: path.join(process.env.VITE_PUBLIC!, 'favicon.ico'),
    backgroundColor: '#050505',
    alwaysOnTop: true,
    autoHideMenuBar: true,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  miniWin.on('closed', () => { miniWin = null })
  miniWin.loadFile(path.join(process.env.DIST!, 'index.html'), { query: { mini: '1' } })
}

// --- uTools-style launcher window ---
const LAUNCHER_WIDTH = 680
const LAUNCHER_HEIGHT = 460

function positionLauncher() {
  if (!launcherWin) return
  const display = screen.getPrimaryDisplay()
  const { x, y, width } = display.workArea
  launcherWin.setBounds({
    x: Math.round(x + (width - LAUNCHER_WIDTH) / 2),
    y: Math.round(y + Math.max(80, display.workArea.height * 0.14)),
    width: LAUNCHER_WIDTH,
    height: LAUNCHER_HEIGHT,
  })
}

function createLauncherWindow() {
  launcherWin = new BrowserWindow({
    width: LAUNCHER_WIDTH,
    height: LAUNCHER_HEIGHT,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  launcherWin.on('blur', () => {
    // uTools behaviour: hide when the user clicks away.
    if (launcherWin && launcherWin.isVisible() && !launcherWin.webContents.isDevToolsOpened()) {
      launcherWin.hide()
    }
  })
  launcherWin.on('closed', () => { launcherWin = null })
  launcherWin.loadFile(path.join(process.env.DIST!, 'index.html'), { query: { launcher: '1' } })
}

function toggleLauncher() {
  // When the main window is focused, open the embedded launcher inside it.
  const mainFocused = Boolean(win && !win.isDestroyed() && win.isVisible() && win.isFocused())
  if (mainFocused) {
    if (launcherWin && !launcherWin.isDestroyed() && launcherWin.isVisible()) {
      launcherWin.hide()
    }
    win?.webContents.send('toggle-embedded-launcher')
    return
  }

  if (!launcherWin || launcherWin.isDestroyed()) {
    createLauncherWindow()
    launcherWin?.once('ready-to-show', () => {
      positionLauncher()
      launcherWin?.show()
      launcherWin?.focus()
      launcherWin?.webContents.send('launcher:shown')
    })
    return
  }
  if (launcherWin.isVisible()) {
    launcherWin.hide()
    return
  }
  positionLauncher()
  launcherWin.show()
  launcherWin.focus()
  launcherWin.webContents.send('launcher:shown')
}

function registerLauncherHotkey(accelerator: string) {
  if (launcherHotkey) {
    try { globalShortcut.unregister(launcherHotkey) } catch { /* ignore */ }
  }
  if (!accelerator) {
    launcherHotkey = ''
    return false
  }
  const ok = globalShortcut.register(accelerator, toggleLauncher)
  launcherHotkey = ok ? accelerator : ''
  if (!ok && accelerator !== DEFAULT_HOTKEY) {
    // Fall back to the default hotkey when the custom one is taken by another app.
    return registerLauncherHotkey(DEFAULT_HOTKEY)
  }
  return ok
}

function registerMainWindowHotkey(accelerator: string) {
  if (mainWindowHotkey) {
    try { globalShortcut.unregister(mainWindowHotkey) } catch { /* ignore */ }
  }
  if (!accelerator) {
    mainWindowHotkey = ''
    return false
  }
  const ok = globalShortcut.register(accelerator, toggleMainWindow)
  mainWindowHotkey = ok ? accelerator : ''
  if (!ok && accelerator !== DEFAULT_MAIN_WINDOW_HOTKEY) {
    return registerMainWindowHotkey(DEFAULT_MAIN_WINDOW_HOTKEY)
  }
  return ok
}

function registerQuickCaptureHotkey(accelerator: string) {
  if (quickCaptureHotkey) {
    try { globalShortcut.unregister(quickCaptureHotkey) } catch { /* ignore */ }
  }
  if (!accelerator) {
    quickCaptureHotkey = ''
    return false
  }
  const ok = globalShortcut.register(accelerator, openQuickCapture)
  quickCaptureHotkey = ok ? accelerator : ''
  if (!ok && accelerator !== DEFAULT_QUICK_CAPTURE_HOTKEY) {
    return registerQuickCaptureHotkey(DEFAULT_QUICK_CAPTURE_HOTKEY)
  }
  return ok
}

// --- Translate window (external provider page, isolated session so our CSP does not break it) ---
function openTranslateWindow(text: string, providerId?: string) {
  const query = text.trim()
  if (!query) return false
  const settings = launcherSettings
  const provider = settings.providers.find((p) => p.id === (providerId || settings.defaultProviderId)) || settings.providers[0]
  if (!provider) return false

  // Always put the text on the clipboard as a fallback for manual pasting.
  clipboard.writeText(query)

  const { url, needsInjection } = buildTranslateUrl(provider, query)

  if (translateWin && !translateWin.isDestroyed()) {
    translateWin.setTitle(`${provider.name} - Abworkbench`)
    translateWin.show()
    translateWin.focus()
    translateWin.loadURL(url)
  } else {
    translateWin = new BrowserWindow({
      width: 1080,
      height: 760,
      title: `${provider.name} - Abworkbench`,
      icon: path.join(process.env.VITE_PUBLIC!, 'favicon.ico'),
      autoHideMenuBar: true,
      backgroundColor: '#ffffff',
      webPreferences: {
        partition: 'persist:translate',
        nodeIntegration: false,
        contextIsolation: true,
      },
    })
    translateWin.on('closed', () => { translateWin = null })
    // uTools-style: Esc closes the translate window.
    translateWin.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown' && input.key === 'Escape') {
        translateWin?.close()
      }
    })
    // uTools-style: clicking away (losing focus) closes the translate window.
    translateWin.on('blur', () => {
      if (translateWin && !translateWin.isDestroyed() && !translateWin.webContents.isDevToolsOpened()) {
        translateWin.close()
      }
    })
    translateWin.loadURL(url)
  }

  if (needsInjection) {
    const inject = () => {
      translateWin?.webContents.executeJavaScript(`(() => {
        const text = ${JSON.stringify(query)};
        let attempts = 0;
        const timer = setInterval(() => {
          attempts += 1;
          const ta = document.querySelector('textarea');
          if (ta) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
            setter.call(ta, text);
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new Event('change', { bubbles: true }));
            ta.focus();
            clearInterval(timer);
          } else if (attempts > 25) {
            clearInterval(timer);
          }
        }, 300);
      })()`).catch(() => { /* page blocked injection; clipboard fallback already set */ })
    }
    translateWin.webContents.once('did-finish-load', inject)
  }
  return true
}

function scanDirectory(root: string) {
  const results: Array<{ name: string; path: string; type: string; size: number; modified: string }> = []
  const maxFiles = 1000
  const allowed = new Set(['.txt', '.md', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html'])

  function walk(dir: string, depth: number) {
    if (results.length >= maxFiles || depth > 4) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (results.length >= maxFiles) return
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') walk(fullPath, depth + 1)
        continue
      }
      const ext = path.extname(entry.name).toLowerCase()
      if (!allowed.has(ext)) continue
      try {
        const stat = fs.statSync(fullPath)
        results.push({ name: entry.name, path: fullPath, type: ext.slice(1) || 'file', size: stat.size, modified: stat.mtime.toISOString() })
      } catch {
        // Ignore unreadable files.
      }
    }
  }

  walk(root, 0)
  return results
}

function refreshTrayMenu() {
  if (!tray) return
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 Abworkbench', accelerator: mainWindowHotkey || DEFAULT_MAIN_WINDOW_HOTKEY, click: showMainWindow },
    { label: '启动器', accelerator: launcherHotkey || DEFAULT_HOTKEY, click: toggleLauncher },
    { label: '快速捕获', accelerator: quickCaptureHotkey || DEFAULT_QUICK_CAPTURE_HOTKEY, click: openQuickCapture },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ]))
}

function createTray() {
  if (tray) {
    refreshTrayMenu()
    return
  }
  const iconPath = path.join(process.env.VITE_PUBLIC!, 'favicon.ico')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Abworkbench')
  refreshTrayMenu()
  tray.on('double-click', showMainWindow)
}
function configureContentSecurityPolicy() {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' https://nominatim.openstreetmap.org",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    })
  })
}

// --- Window state persistence ---
interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

const stateFile = path.join(app.getPath('userData'), 'window-state.json')

function loadWindowState(): WindowState {
  try {
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
    }
  } catch { /* ignore corrupt file */ }
  return { width: 1280, height: 800, isMaximized: false }
}

function saveWindowState() {
  if (!win) return
  const bounds = win.getBounds()
  const state: WindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: win.isMaximized(),
  }
  try { fs.writeFileSync(stateFile, JSON.stringify(state)) } catch { /* ignore */ }
}

function createWindow() {
  const state = loadWindowState()

  win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 900,
    minHeight: 600,
    title: 'Abworkbench',
    icon: path.join(process.env.VITE_PUBLIC!, 'favicon.ico'),
    backgroundColor: '#1e1e2e',
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (state.isMaximized || (!state.x && !state.y)) win.maximize()

  win.on('resize', saveWindowState)
  win.on('move', saveWindowState)
  win.on('maximize', () => win?.webContents.send('window-maximized-changed', true))
  win.on('unmaximize', () => win?.webContents.send('window-maximized-changed', false))
  win.on('close', (event) => {
    saveWindowState()
    if (!isQuitting) {
      event.preventDefault()
      win?.hide()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  win.loadFile(path.join(process.env.DIST!, 'index.html'))
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (shouldQuitForExistingInstance(hasSingleInstanceLock)) {
  app.quit()
} else {
  app.on('second-instance', showMainWindow)
}

app.on('window-all-closed', () => {
  win = null
  if (process.platform === 'darwin') return
})

app.whenReady().then(() => {
  if (shouldQuitForExistingInstance(hasSingleInstanceLock)) return
  configureContentSecurityPolicy()
  ipcMain.handle('desktop:open-mini-window', () => createMiniWindow())
  ipcMain.handle('desktop:show-main-window', () => {
    showMainWindow()
    return true
  })
  ipcMain.handle('desktop:open-target', async (_event, target: string) => {
    if (/^https?:\/\//i.test(target)) {
      await shell.openExternal(target)
      return true
    }
    const result = await shell.openPath(target)
    return result === ''
  })
  ipcMain.handle('desktop:read-clipboard', () => {
    const text = clipboard.readText()
    const image = clipboard.readImage()
    return {
      text,
      imageDataUrl: image.isEmpty() ? '' : image.toDataURL(),
    }
  })
  ipcMain.handle('desktop:capture-screen', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
      fetchWindowIcons: false,
    })
    const source = sources[0]
    if (!source) return null
    return {
      title: source.name,
      dataUrl: source.thumbnail.toDataURL(),
      capturedAt: new Date().toISOString(),
    }
  })
  ipcMain.handle('desktop:notify', (_event, payload: { title?: string; body?: string }) => {
    if (!Notification.isSupported()) return false
    new Notification({
      title: payload.title || 'Abworkbench',
      body: payload.body || '提醒时间到了',
    }).show()
    return true
  })
  ipcMain.handle('desktop:index-directory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths[0]) return []
    return scanDirectory(result.filePaths[0])
  })

  // --- Custom window controls (frameless main window) ---
  ipcMain.handle('desktop:window-control', (_event, action: string) => {
    if (!win) return false
    if (action === 'minimize') {
      win.minimize()
    } else if (action === 'toggle-maximize') {
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
    } else if (action === 'close') {
      // Goes through the existing close handler: hides to tray unless quitting.
      win.close()
    } else {
      return false
    }
    return true
  })
  ipcMain.handle('desktop:window-is-maximized', () => win?.isMaximized() ?? false)

  // --- Launcher IPC ---
  ipcMain.handle('desktop:toggle-launcher', () => {
    toggleLauncher()
    return true
  })
  ipcMain.handle('desktop:hide-launcher', () => {
    if (launcherWin && !launcherWin.isDestroyed()) launcherWin.hide()
    return true
  })
  ipcMain.handle('desktop:open-main-page', (_event, page: string) => {
    showMainWindow()
    win?.webContents.send('open-main-page', page)
    if (launcherWin && !launcherWin.isDestroyed()) launcherWin.hide()
    return true
  })
  ipcMain.handle('desktop:everything-search', async (_event, query: string) => {
    return searchEverything(String(query || ''), {
      esPath: launcherSettings.esPath || undefined,
      httpUrl: launcherSettings.everythingHttpUrl || undefined,
      appDir: app.isPackaged ? undefined : process.cwd(),
      resourcesPath: process.resourcesPath,
      userDataPath: app.getPath('userData'),
    })
  })
  ipcMain.handle('desktop:everything-status', async () => {
    return everythingStatus({
      esPath: launcherSettings.esPath || undefined,
      httpUrl: launcherSettings.everythingHttpUrl || undefined,
      appDir: app.isPackaged ? undefined : process.cwd(),
      resourcesPath: process.resourcesPath,
      userDataPath: app.getPath('userData'),
    })
  })
  ipcMain.handle('desktop:reveal-path', (_event, target: string) => {
    if (typeof target !== 'string' || !target) return false
    shell.showItemInFolder(target)
    return true
  })
  ipcMain.handle('desktop:open-translate', (_event, payload: { text?: string; providerId?: string }) => {
    return openTranslateWindow(String(payload?.text || ''), payload?.providerId)
  })
  ipcMain.handle('desktop:get-launcher-settings', () => launcherSettings)
  ipcMain.handle('desktop:set-launcher-settings', (_event, next: LauncherSettings) => {
    const previousHotkey = launcherSettings.hotkey
    const previousMainWindow = launcherSettings.mainWindowHotkey
    const previousQuickCapture = launcherSettings.quickCaptureHotkey
    launcherSettings = saveLauncherSettings(app.getPath('userData'), next)
    if (launcherSettings.hotkey !== previousHotkey) {
      registerLauncherHotkey(launcherSettings.hotkey)
    }
    if (launcherSettings.mainWindowHotkey !== previousMainWindow) {
      registerMainWindowHotkey(launcherSettings.mainWindowHotkey)
    }
    if (launcherSettings.quickCaptureHotkey !== previousQuickCapture) {
      registerQuickCaptureHotkey(launcherSettings.quickCaptureHotkey)
    }
    refreshTrayMenu()
    return launcherSettings
  })
  ipcMain.handle('desktop:list-recent-apps', async () => {
    return listLauncherRecentHome(app.getPath('userData'))
  })
  ipcMain.handle('desktop:search-apps', async (_event, query: string) => {
    return searchInstalledApps(app.getPath('userData'), String(query || ''), 10)
  })
  ipcMain.handle('desktop:open-app', async (_event, appPath: string) => {
    const ok = await openDesktopApp(app.getPath('userData'), String(appPath || ''))
    if (ok && launcherWin && !launcherWin.isDestroyed()) launcherWin.hide()
    return ok
  })
  ipcMain.handle('desktop:pin-recent-app', async (_event, appPath: string) => {
    return pinRecentApp(app.getPath('userData'), String(appPath || ''))
  })
  ipcMain.handle('desktop:unpin-recent-app', async (_event, appPath: string) => {
    return unpinRecentApp(app.getPath('userData'), String(appPath || ''))
  })
  ipcMain.handle('desktop:hide-recent-app', async (_event, appPath: string) => {
    return hideRecentApp(app.getPath('userData'), String(appPath || ''))
  })

  initRecentApps(app.getPath('userData'))
  createWindow()
  createTray()
  registerQuickCaptureHotkey(launcherSettings.quickCaptureHotkey)
  registerMainWindowHotkey(launcherSettings.mainWindowHotkey)
  registerLauncherHotkey(launcherSettings.hotkey)
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
