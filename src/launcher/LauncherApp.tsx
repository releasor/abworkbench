import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Search,
  Languages,
  Calculator,
  Globe,
  FileSearch,
  File,
  Folder,
  LayoutDashboard,
  CheckSquare,
  Timer,
  Target,
  StickyNote,
  Cloud,
  Settings,
  AppWindow,
  ClipboardPaste,
  CornerDownLeft,
  Zap,
  Pin,
  BookOpen,
  PictureInPicture2,
  Bell,
  Radio,
  Flame,
} from 'lucide-react'
import clsx from 'clsx'
import { buildLauncherItems, detectUrl, LAUNCHER_COMMANDS, type LauncherItem } from './intents'
import {
  filterCommandsForWorkspaceMode,
  readPersistedWorkspaceMode,
} from '../utils/workspaceModeEffects'
import {
  buildAppContextMenuItems,
  buildPathContextMenuItems,
  buildReaderContextMenuItems,
  type LauncherMenuActionId,
  type LauncherMenuItem,
} from './launcherContextMenu'

interface EverythingItem {
  name: string
  path: string
  isDir: boolean
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

type EverythingState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; items: EverythingItem[] }
  | { status: 'unavailable'; reason: 'not-installed' | 'not-running' | 'error'; message?: string }

const COMMAND_ICONS: Record<string, typeof LayoutDashboard> = {
  'open-main': AppWindow,
  'nav-dashboard': LayoutDashboard,
  'nav-taskflow': CheckSquare,
  'nav-pomodoro': Timer,
  'nav-habits': Target,
  'nav-notes': StickyNote,
  'nav-reminders': Bell,
  'nav-weather': Cloud,
  'nav-hotlist': Flame,
  'nav-mineradio': Radio,
  'nav-settings': Settings,
  'translate-clipboard': Languages,
  'stealth-reader': BookOpen,
  'stealth-reader-library': BookOpen,
  'open-mini': PictureInPicture2,
  'daily-brief': Zap,
}

const PAGE_BY_COMMAND: Record<string, string> = {
  'nav-dashboard': 'dashboard',
  'nav-taskflow': 'taskflow',
  'nav-pomodoro': 'pomodoro',
  'nav-habits': 'habits',
  'nav-notes': 'notes',
  'nav-reminders': 'reminders',
  'nav-weather': 'weather',
  'nav-hotlist': 'hotlist',
  'nav-mineradio': 'mineradio',
  'nav-settings': 'settings',
}

const RECENT_KEY = 'abworkbench-launcher-recent'

function readRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function recordRecent(commandId: string) {
  const next = [commandId, ...readRecentIds().filter((id) => id !== commandId)].slice(0, 8)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // best-effort
  }
}

type SelectableEntry =
  | { type: 'item'; item: LauncherItem }
  | { type: 'file'; file: EverythingItem }
  | { type: 'app'; app: DesktopAppInfo }
  | { type: 'recent-path'; entry: RecentPathInfo }
  | { type: 'clipboard-url'; url: string }

type LauncherContextMenu =
  | {
      kind: 'app'
      x: number
      y: number
      app: DesktopAppInfo
      items: LauncherMenuItem[]
    }
  | {
      kind: 'path'
      x: number
      y: number
      path: string
      isDir: boolean
      canRemove: boolean
      items: LauncherMenuItem[]
    }
  | {
      kind: 'reader'
      x: number
      y: number
      items: LauncherMenuItem[]
    }

export interface LauncherAppProps {
  /** window = standalone Electron launcher; embedded = modal inside main app */
  variant?: 'window' | 'embedded'
  isOpen?: boolean
  onClose?: () => void
  onNavigate?: (page: string) => void
}

function rowClass(isSelected: boolean) {
  return clsx('launcher-row', isSelected && 'is-selected')
}

export default function LauncherApp({
  variant = 'window',
  isOpen = true,
  onClose,
  onNavigate,
}: LauncherAppProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [everything, setEverything] = useState<EverythingState>({ status: 'idle' })
  const [clipboardText, setClipboardText] = useState('')
  const clipboardUrl = useMemo(() => (clipboardText ? detectUrl(clipboardText) : null), [clipboardText])
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [recentApps, setRecentApps] = useState<DesktopAppInfo[]>([])
  const [recentFiles, setRecentFiles] = useState<RecentPathInfo[]>([])
  const [recentFolders, setRecentFolders] = useState<RecentPathInfo[]>([])
  const [matchedApps, setMatchedApps] = useState<DesktopAppInfo[]>([])
  const [appsLoading, setAppsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [contextMenu, setContextMenu] = useState<LauncherContextMenu | null>(null)
  const [launchError, setLaunchError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const searchSeq = useRef(0)
  const appSearchSeq = useRef(0)

  useEffect(() => {
    if (!launchError) return
    const timer = window.setTimeout(() => setLaunchError(''), 4000)
    return () => window.clearTimeout(timer)
  }, [launchError])

  const items = useMemo(() => {
    const mode = readPersistedWorkspaceMode()
    const commands = filterCommandsForWorkspaceMode(LAUNCHER_COMMANDS, mode)
    return buildLauncherItems(query, commands)
  }, [query])
  const everythingQuery = useMemo(() => {
    const entry = items.find((item) => item.kind === 'everything')
    return entry && entry.kind === 'everything' ? entry.query : ''
  }, [items])

  // Debounced Everything search.
  useEffect(() => {
    const seq = ++searchSeq.current
    if (!everythingQuery || everythingQuery.trim().length < 2) {
      queueMicrotask(() => setEverything({ status: 'idle' }))
      return
    }
    queueMicrotask(() => setEverything({ status: 'loading' }))
    const timer = window.setTimeout(() => {
      void window.electronAPI?.everythingSearch?.(everythingQuery).then((result) => {
        if (searchSeq.current !== seq) return
        if (result?.ok) {
          setEverything({ status: 'ok', items: result.items })
        } else {
          setEverything({
            status: 'unavailable',
            reason: result?.reason || 'error',
            message: result?.message,
          })
        }
      }).catch(() => {
        if (searchSeq.current !== seq) return
        setEverything({ status: 'unavailable', reason: 'error' })
      })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [everythingQuery])

  // Debounced installed-app fuzzy search.
  useEffect(() => {
    const seq = ++appSearchSeq.current
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 1) {
      queueMicrotask(() => {
        setMatchedApps([])
        setAppsLoading(false)
      })
      return
    }
    // Skip app search for pure math / URL so results stay clean.
    if (items.length === 1 && (items[0].kind === 'calc' || items[0].kind === 'url' || items[0].kind === 'path')) {
      queueMicrotask(() => {
        setMatchedApps([])
        setAppsLoading(false)
      })
      return
    }
    queueMicrotask(() => setAppsLoading(true))
    const timer = window.setTimeout(() => {
      void window.electronAPI?.searchApps?.(trimmed).then((apps) => {
        if (appSearchSeq.current !== seq) return
        setMatchedApps(Array.isArray(apps) ? apps : [])
        setAppsLoading(false)
      }).catch(() => {
        if (appSearchSeq.current !== seq) return
        setMatchedApps([])
        setAppsLoading(false)
      })
    }, 160)
    return () => window.clearTimeout(timer)
  }, [query, items])

  const refreshRecentApps = useCallback(() => {
    void window.electronAPI?.listRecentApps?.().then((payload) => {
      if (Array.isArray(payload)) {
        setRecentApps(payload)
        setRecentFiles([])
        setRecentFolders([])
        return
      }
      setRecentApps(Array.isArray(payload?.apps) ? payload.apps : [])
      setRecentFiles(Array.isArray(payload?.files) ? payload.files : [])
      setRecentFolders(Array.isArray(payload?.folders) ? payload.folders : [])
    }).catch(() => {
      setRecentApps([])
      setRecentFiles([])
      setRecentFolders([])
    })
  }, [])

  const resetLauncher = useCallback(() => {
    setQuery('')
    setSelectedIndex(-1)
    setCopied(false)
    setLaunchError('')
    setContextMenu(null)
    setMatchedApps([])
    setRecentIds(readRecentIds())
    refreshRecentApps()
    queueMicrotask(() => inputRef.current?.focus())
    void window.electronAPI?.readClipboard?.().then(({ text }) => {
      setClipboardText((text || '').trim().slice(0, 500))
    }).catch(() => setClipboardText(''))
  }, [refreshRecentApps])

  // Window mode: reset whenever the floating launcher is summoned.
  useEffect(() => {
    if (variant !== 'window') return
    queueMicrotask(() => resetLauncher())
    return window.electronAPI?.onLauncherShown?.(resetLauncher)
  }, [variant, resetLauncher])

  // Embedded mode: reset each time the overlay opens.
  useEffect(() => {
    if (variant !== 'embedded' || !isOpen) return
    queueMicrotask(() => resetLauncher())
  }, [variant, isOpen, resetLauncher])

  useEffect(() => {
    queueMicrotask(() => setSelectedIndex(-1))
  }, [query])

  const hideLauncher = useCallback(() => {
    if (variant === 'embedded') {
      onClose?.()
      return
    }
    setContextMenu(null)
    void window.electronAPI?.hideLauncher?.()
  }, [variant, onClose])

  const openClipboardUrl = useCallback(() => {
    if (!clipboardUrl) return
    void window.electronAPI?.openTarget?.(clipboardUrl)
    hideLauncher()
  }, [clipboardUrl, hideLauncher])

  const runCommand = useCallback((commandId: string) => {
    recordRecent(commandId)
    if (commandId === 'translate-clipboard') {
      const text = clipboardText
      if (text) void window.electronAPI?.openTranslate?.({ text })
      hideLauncher()
      return
    }
    if (commandId === 'stealth-reader') {
      void window.electronAPI?.openReader?.({ mode: 'auto' }).then((result) => {
        if (result?.bossKeyError) {
          // Surface in reader window via settings; also keep launcher brief
        }
      })
      hideLauncher()
      return
    }
    if (commandId === 'stealth-reader-library') {
      void window.electronAPI?.openReader?.({ mode: 'library' })
      hideLauncher()
      return
    }
    if (commandId === 'open-mini') {
      void window.electronAPI?.openMiniWindow?.()
      hideLauncher()
      return
    }
    if (commandId === 'daily-brief') {
      if (onNavigate) onNavigate('dashboard')
      else void window.electronAPI?.openMainPage?.('dashboard')
      hideLauncher()
      return
    }
    const page = PAGE_BY_COMMAND[commandId]
    if (page) {
      if (onNavigate) {
        onNavigate(page)
        hideLauncher()
        return
      }
      void window.electronAPI?.openMainPage?.(page)
      return
    }
    if (variant === 'embedded') {
      hideLauncher()
      return
    }
    void window.electronAPI?.showMainWindow?.()
    hideLauncher()
  }, [clipboardText, hideLauncher, onNavigate, variant])

  const openApp = useCallback((appEntry: DesktopAppInfo) => {
    setLaunchError('')
    void (async () => {
      try {
        const ok = await window.electronAPI?.openApp?.(appEntry.path)
        if (ok) {
          refreshRecentApps()
          hideLauncher()
          return
        }
        const fallback = await window.electronAPI?.openTarget?.(appEntry.target)
        if (fallback) {
          refreshRecentApps()
          hideLauncher()
          return
        }
        setLaunchError(`无法打开：${appEntry.name}`)
      } catch {
        setLaunchError(`无法打开：${appEntry.name}`)
      }
    })()
  }, [hideLauncher, refreshRecentApps])

  const applyRecentHomeUpdate = useCallback((payload: unknown) => {
    if (Array.isArray(payload)) {
      setRecentApps(payload as DesktopAppInfo[])
      return
    }
    if (payload && typeof payload === 'object') {
      const home = payload as { apps?: DesktopAppInfo[]; files?: RecentPathInfo[]; folders?: RecentPathInfo[] }
      if (Array.isArray(home.apps)) setRecentApps(home.apps)
      if (Array.isArray(home.files)) setRecentFiles(home.files)
      if (Array.isArray(home.folders)) setRecentFolders(home.folders)
      return
    }
    refreshRecentApps()
  }, [refreshRecentApps])

  const applyRecentAppsUpdate = useCallback((apps: DesktopAppInfo[] | undefined) => {
    applyRecentHomeUpdate(apps)
  }, [applyRecentHomeUpdate])

  const pinApp = useCallback((appEntry: DesktopAppInfo, event?: { stopPropagation: () => void }) => {
    event?.stopPropagation()
    const key = appEntry.target || appEntry.path
    void window.electronAPI?.pinRecentApp?.(key).then(applyRecentAppsUpdate)
  }, [applyRecentAppsUpdate])

  const unpinApp = useCallback((appEntry: DesktopAppInfo, event?: { stopPropagation: () => void }) => {
    event?.stopPropagation()
    const key = appEntry.target || appEntry.path
    void window.electronAPI?.unpinRecentApp?.(key).then(applyRecentAppsUpdate)
  }, [applyRecentAppsUpdate])

  const hideApp = useCallback((appEntry: DesktopAppInfo, event?: { stopPropagation: () => void }) => {
    event?.stopPropagation()
    const key = appEntry.target || appEntry.path
    void window.electronAPI?.hideRecentApp?.(key).then((apps) => {
      applyRecentAppsUpdate(apps)
      setSelectedIndex((prev) => Math.max(0, Math.min(prev, Math.max(0, (apps?.length || 1) - 1))))
    })
  }, [applyRecentAppsUpdate])

  const hideRecentPathEntry = useCallback((targetPath: string) => {
    void window.electronAPI?.hideRecentPath?.(targetPath).then((home) => {
      applyRecentHomeUpdate(home)
    })
  }, [applyRecentHomeUpdate])

  const copyPathToClipboard = useCallback((targetPath: string) => {
    void navigator.clipboard?.writeText(targetPath).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    }).catch(() => { /* ignore */ })
  }, [])

  const openAppContextMenu = useCallback((event: React.MouseEvent, appEntry: DesktopAppInfo) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      kind: 'app',
      x: event.clientX,
      y: event.clientY,
      app: appEntry,
      items: buildAppContextMenuItems({
        pinned: Boolean(appEntry.pinned),
        canReveal: Boolean(appEntry.target || appEntry.path),
      }),
    })
  }, [])

  const openPathContextMenu = useCallback((
    event: React.MouseEvent,
    target: { path: string; isDir: boolean; canRemove?: boolean },
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      kind: 'path',
      x: event.clientX,
      y: event.clientY,
      path: target.path,
      isDir: target.isDir,
      canRemove: Boolean(target.canRemove),
      items: buildPathContextMenuItems({
        isDir: target.isDir,
        canRemove: Boolean(target.canRemove),
      }),
    })
  }, [])

  const openReaderContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      kind: 'reader',
      x: event.clientX,
      y: event.clientY,
      items: buildReaderContextMenuItems(),
    })
  }, [])

  const runContextMenuAction = useCallback((action: LauncherMenuActionId) => {
    const menu = contextMenu
    setContextMenu(null)
    if (!menu) return

    if (menu.kind === 'reader') {
      if (action === 'reader-library') {
        void window.electronAPI?.openReader?.({ mode: 'library' })
        hideLauncher()
      }
      return
    }

    if (menu.kind === 'app') {
      const appEntry = menu.app
      if (action === 'open') openApp(appEntry)
      else if (action === 'reveal') {
        const target = appEntry.target || appEntry.path
        if (target) void window.electronAPI?.revealPath?.(target)
        hideLauncher()
      } else if (action === 'pin') pinApp(appEntry)
      else if (action === 'unpin') unpinApp(appEntry)
      else if (action === 'remove') hideApp(appEntry)
      return
    }

    if (action === 'open') {
      void window.electronAPI?.openTarget?.(menu.path)
      hideLauncher()
    } else if (action === 'reveal') {
      void window.electronAPI?.revealPath?.(menu.path)
      hideLauncher()
    } else if (action === 'copy-path') {
      copyPathToClipboard(menu.path)
    } else if (action === 'remove' && menu.canRemove) {
      hideRecentPathEntry(menu.path)
    }
  }, [contextMenu, copyPathToClipboard, hideApp, hideLauncher, hideRecentPathEntry, openApp, pinApp, unpinApp])

  const executeItem = useCallback((item: LauncherItem) => {
    if (item.kind === 'command') {
      runCommand(item.commandId)
      return
    }
    if (item.kind === 'translate') {
      void window.electronAPI?.openTranslate?.({ text: item.text })
      hideLauncher()
      return
    }
    if (item.kind === 'calc') {
      void navigator.clipboard?.writeText(item.result).then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }).catch(() => { /* ignore */ })
      return
    }
    if (item.kind === 'url' || item.kind === 'websearch') {
      void window.electronAPI?.openTarget?.(item.url)
      hideLauncher()
      return
    }
    if (item.kind === 'reader-url') {
      setLaunchError('')
      void (async () => {
        try {
          const result = await window.electronAPI?.readerScrapeUrl?.(item.url)
          if (!result) {
            setLaunchError('桌面能力不可用')
            return
          }
          if (result.ok === false) {
            setLaunchError(result.message)
            return
          }
          await window.electronAPI?.openReader?.({ mode: 'reading', bookId: result.book.id })
          hideLauncher()
        } catch {
          setLaunchError('抓取失败')
        }
      })()
      return
    }
    if (item.kind === 'path') {
      void window.electronAPI?.openTarget?.(item.path)
      hideLauncher()
      return
    }
    if (item.kind === 'everything') {
      if (everything.status === 'ok' && everything.items[0]) {
        void window.electronAPI?.openTarget?.(everything.items[0].path)
        hideLauncher()
        return
      }
      if (everything.status === 'loading') {
        setLaunchError('正在搜索文件…')
        return
      }
      if (everything.status === 'unavailable') {
        setLaunchError(
          everything.message
            || (everything.reason === 'not-installed'
              ? '未检测到 Everything'
              : everything.reason === 'not-running'
                ? 'Everything 未运行'
                : 'Everything 搜索出错'),
        )
        return
      }
      setLaunchError('未找到匹配文件')
    }
  }, [everything, hideLauncher, runCommand])

  const executeFile = useCallback((file: EverythingItem, reveal: boolean) => {
    if (reveal) {
      void window.electronAPI?.revealPath?.(file.path)
    } else {
      void window.electronAPI?.openTarget?.(file.path)
    }
    hideLauncher()
  }, [hideLauncher])

  const openRecentPath = useCallback((entry: RecentPathInfo, reveal: boolean) => {
    if (reveal) {
      void window.electronAPI?.revealPath?.(entry.path)
    } else {
      void window.electronAPI?.openTarget?.(entry.path)
    }
    hideLauncher()
  }, [hideLauncher])

  // Flattened selectable list for keyboard navigation.
  const selectable = useMemo<SelectableEntry[]>(() => {
    if (!query.trim()) {
      return [
        ...(clipboardUrl ? [{ type: 'clipboard-url' as const, url: clipboardUrl }] : []),
        ...recentApps.map((appEntry) => ({ type: 'app' as const, app: appEntry })),
        ...recentFiles.map((entry) => ({ type: 'recent-path' as const, entry })),
        ...recentFolders.map((entry) => ({ type: 'recent-path' as const, entry })),
      ]
    }
    const entries: SelectableEntry[] = [
      ...matchedApps.map((appEntry) => ({ type: 'app' as const, app: appEntry })),
      ...items.map((item) => ({ type: 'item' as const, item })),
    ]
    if (everything.status === 'ok') {
      for (const file of everything.items) entries.push({ type: 'file', file })
    }
    return entries
  }, [query, clipboardUrl, recentApps, recentFiles, recentFolders, matchedApps, items, everything])

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedIndex((prev) => {
        if (prev < 0) return -1
        if (selectable.length === 0) return -1
        return Math.min(prev, selectable.length - 1)
      })
    })
  }, [selectable.length])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const cols = 6
    const homeAppOffset = !query.trim() && clipboardUrl ? 1 : 0
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((prev) => {
        if (selectable.length === 0) return -1
        if (prev < 0) return 0
        if (!query.trim() && prev >= homeAppOffset && prev < homeAppOffset + recentApps.length) {
          return Math.min(prev + cols, selectable.length - 1)
        }
        return Math.min(prev + 1, selectable.length - 1)
      })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((prev) => {
        if (selectable.length === 0) return -1
        if (prev < 0) return selectable.length - 1
        if (!query.trim() && prev >= homeAppOffset && prev < homeAppOffset + recentApps.length) {
          return Math.max(prev - cols, 0)
        }
        return Math.max(prev - 1, 0)
      })
    } else if (event.key === 'ArrowRight' && !query.trim() && selectedIndex >= homeAppOffset && selectedIndex < homeAppOffset + recentApps.length) {
      event.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, selectable.length - 1)))
    } else if (event.key === 'ArrowLeft' && !query.trim() && selectedIndex >= homeAppOffset && selectedIndex < homeAppOffset + recentApps.length) {
      event.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, homeAppOffset))
    } else if (event.key === 'Delete' && !query.trim()) {
      const entry = selectable[selectedIndex]
      if (entry?.type === 'app') {
        event.preventDefault()
        hideApp(entry.app)
      }
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const entry = selectable[selectedIndex]
      if (!entry) {
        if (!query && clipboardUrl) {
          openClipboardUrl()
          return
        }
        if (!query && clipboardText) runCommand('translate-clipboard')
        return
      }
      if (entry.type === 'clipboard-url') openClipboardUrl()
      else if (entry.type === 'item') executeItem(entry.item)
      else if (entry.type === 'app') openApp(entry.app)
      else if (entry.type === 'recent-path') openRecentPath(entry.entry, event.ctrlKey || event.metaKey)
      else executeFile(entry.file, event.ctrlKey || event.metaKey)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (contextMenu) {
        setContextMenu(null)
        return
      }
      if (query) setQuery('')
      else hideLauncher()
    }
  }

  const recentCommands = useMemo(
    () => recentIds
      .map((id) => LAUNCHER_COMMANDS.find((command) => command.id === id))
      .filter((command): command is NonNullable<typeof command> => Boolean(command)),
    [recentIds]
  )

  let flatIndex = (!query.trim() && clipboardUrl) ? 1 : 0

  const renderAppTile = (appEntry: DesktopAppInfo) => {
    const index = flatIndex++
    const isSelected = index === selectedIndex
    return (
      <button
        key={appEntry.id}
        type="button"
        onClick={() => openApp(appEntry)}
        onContextMenu={(event) => openAppContextMenu(event, appEntry)}
        onMouseEnter={() => setSelectedIndex(index)}
        onMouseLeave={() => setSelectedIndex((prev) => (prev === index ? -1 : prev))}
        title={`${appEntry.target || appEntry.name}（右键更多操作）`}
        className={clsx('launcher-tile', isSelected && 'is-selected')}
      >
        <div className="launcher-tile-icon relative">
          {appEntry.iconDataUrl ? (
            <img src={appEntry.iconDataUrl} alt="" className="launcher-app-icon" />
          ) : (
            <div className="launcher-icon-well text-primary">
              <AppWindow size={18} />
            </div>
          )}
          {appEntry.pinned && (
            <span className="launcher-pin-badge">
              <Pin size={9} fill="currentColor" />
            </span>
          )}
        </div>
        <span className="launcher-tile-label text-[11px] text-text leading-tight line-clamp-2 w-full px-0.5">{appEntry.name}</span>
      </button>
    )
  }

  const renderAppRow = (appEntry: DesktopAppInfo) => {
    const index = flatIndex++
    const isSelected = index === selectedIndex
    const isSettings = appEntry.kind === 'settings'
    return (
      <button
        key={appEntry.id}
        onClick={() => openApp(appEntry)}
        onContextMenu={(event) => openAppContextMenu(event, appEntry)}
        onMouseEnter={() => setSelectedIndex(index)}
        onMouseLeave={() => setSelectedIndex((prev) => (prev === index ? -1 : prev))}
        className={rowClass(isSelected)}
      >
        {appEntry.iconDataUrl ? (
          <img src={appEntry.iconDataUrl} alt="" className="launcher-app-icon launcher-app-icon--row" />
        ) : (
          <div className={clsx(
            'launcher-icon-well launcher-icon-well--sm',
            isSettings ? 'text-sky-300' : 'text-primary'
          )}>
            {isSettings ? <Settings size={16} /> : <AppWindow size={16} />}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate text-text">{appEntry.name}</div>
          <div className="text-xs text-text-muted truncate">
            {isSettings
              ? (appEntry.description || 'Windows 设置')
              : (appEntry.target || appEntry.path)}
          </div>
        </div>
        {isSelected && <CornerDownLeft size={14} className="text-text-muted/60 flex-shrink-0" />}
      </button>
    )
  }

  const renderRecentPathRow = (entry: RecentPathInfo) => {
    const index = flatIndex++
    const isSelected = index === selectedIndex
    const Icon = entry.isDir ? Folder : File
    return (
      <button
        key={entry.id}
        onClick={(event) => openRecentPath(entry, event.ctrlKey || event.metaKey)}
        onContextMenu={(event) => openPathContextMenu(event, {
          path: entry.path,
          isDir: entry.isDir,
          canRemove: true,
        })}
        onMouseEnter={() => setSelectedIndex(index)}
        onMouseLeave={() => setSelectedIndex((prev) => (prev === index ? -1 : prev))}
        title="左键打开 · 右键更多操作"
        className={rowClass(isSelected)}
      >
        {entry.iconDataUrl ? (
          <img src={entry.iconDataUrl} alt="" className="launcher-app-icon launcher-app-icon--row" />
        ) : (
          <div className={clsx(
            'launcher-icon-well launcher-icon-well--sm',
            isSelected ? 'text-primary' : 'text-text-muted'
          )}>
            <Icon size={15} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate text-text">{entry.name}</div>
          <div className="text-[11px] text-text-muted/70 truncate">{entry.path}</div>
        </div>
        {isSelected && <CornerDownLeft size={14} className="text-text-muted/60 flex-shrink-0" />}
      </button>
    )
  }

  const renderItemRow = (item: LauncherItem) => {
    const index = flatIndex++
    const isSelected = index === selectedIndex
    const Icon = item.kind === 'command'
      ? COMMAND_ICONS[item.commandId] || AppWindow
      : item.kind === 'translate'
        ? Languages
        : item.kind === 'calc'
          ? Calculator
          : item.kind === 'reader-url'
            ? BookOpen
            : item.kind === 'url' || item.kind === 'websearch'
              ? Globe
              : item.kind === 'path'
                ? (item.pathKind === 'file' ? File : Folder)
                : FileSearch
    return (
      <button
        key={item.id}
        onClick={() => executeItem(item)}
        onMouseEnter={() => setSelectedIndex(index)}
        onMouseLeave={() => setSelectedIndex((prev) => (prev === index ? -1 : prev))}
        onContextMenu={(event) => {
          if (item.kind === 'path') {
            openPathContextMenu(event, {
              path: item.path,
              isDir: item.pathKind === 'dir',
              canRemove: false,
            })
            return
          }
          if (item.kind !== 'command' || item.commandId !== 'stealth-reader') return
          openReaderContextMenu(event)
        }}
        className={rowClass(isSelected)}
      >
        <div className={clsx(
          'launcher-icon-well launcher-icon-well--sm',
          isSelected ? 'text-primary' : 'text-text-muted'
        )}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate text-text">{item.label}</div>
          <div className="text-xs text-text-muted truncate">{item.description}</div>
        </div>
        {isSelected && <CornerDownLeft size={14} className="text-text-muted/60 flex-shrink-0" />}
      </button>
    )
  }

  const renderFileRow = (file: EverythingItem) => {
    const index = flatIndex++
    const isSelected = index === selectedIndex
    const Icon = file.isDir ? Folder : File
    return (
      <button
        key={file.path}
        onClick={(event) => executeFile(file, event.ctrlKey || event.metaKey)}
        onContextMenu={(event) => openPathContextMenu(event, {
          path: file.path,
          isDir: file.isDir,
          canRemove: false,
        })}
        onMouseEnter={() => setSelectedIndex(index)}
        onMouseLeave={() => setSelectedIndex((prev) => (prev === index ? -1 : prev))}
        title="左键打开 · 右键更多操作"
        className={rowClass(isSelected)}
      >
        <div className={clsx(
          'launcher-icon-well launcher-icon-well--sm',
          isSelected ? 'text-primary' : 'text-text-muted'
        )}>
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate text-text">{file.name}</div>
          <div className="text-[11px] text-text-muted/70 truncate">{file.path}</div>
        </div>
      </button>
    )
  }

  const showHome = query.trim() === ''

  if (variant === 'embedded' && !isOpen) return null

  const panel = (
      <div
        className={clsx(
          'launcher-shell',
          variant === 'embedded' ? 'relative w-full max-w-2xl' : 'h-full w-full'
        )}
      >
      <div
        className={clsx(
          'launcher-panel flex flex-col',
          variant === 'embedded' ? 'relative w-full max-h-[min(560px,78vh)]' : 'h-full w-full'
        )}
        onMouseLeave={() => setSelectedIndex(-1)}
        onClick={variant === 'embedded' ? (event) => event.stopPropagation() : undefined}
        role={variant === 'embedded' ? 'dialog' : undefined}
        aria-modal={variant === 'embedded' ? true : undefined}
        aria-label="启动器"
      >
        {/* Brand + search — Mineradio glass chrome */}
        <div className="launcher-search flex items-center gap-3 px-4 py-3.5">
          <div className="launcher-brand-mark">
            <Zap size={16} className="text-sky-600" />
          </div>
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <Search size={18} className="text-text-muted flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => {
                setLaunchError('')
                setQuery(event.target.value)
              }}
              onKeyDown={handleKeyDown}
              placeholder="搜索网页 / 软件 / 阅读 / 翻译 / 找文件"
              autoFocus
              className="flex-1 bg-transparent text-text text-[15px] outline-none placeholder:text-text-muted/70"
            />
          </div>
        </div>

        {showHome && clipboardUrl && (
          <button
            onClick={openClipboardUrl}
            onMouseEnter={() => setSelectedIndex(0)}
            onMouseLeave={() => setSelectedIndex((prev) => (prev === 0 ? -1 : prev))}
            className={clsx(
              'launcher-chip mx-3 mt-3',
              selectedIndex === 0 && 'is-selected'
            )}
          >
            <Globe size={15} className="text-primary flex-shrink-0" />
            <span className="text-xs text-text truncate flex-1">访问剪贴板网址：{clipboardUrl}</span>
            <kbd className="launcher-kbd launcher-kbd--sm">↵</kbd>
          </button>
        )}

        {showHome && clipboardText && !clipboardUrl && (
          <button
            onClick={() => runCommand('translate-clipboard')}
            className="launcher-chip mx-3 mt-3"
          >
            <ClipboardPaste size={15} className="text-primary flex-shrink-0" />
            <span className="text-xs text-text truncate flex-1">翻译剪贴板：{clipboardText}</span>
            <Languages size={14} className="text-text-muted flex-shrink-0" />
          </button>
        )}

        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {showHome ? (
            <>
              <div className="launcher-section-label">最近软件</div>
              {recentApps.length > 0 ? (
                <div className="grid grid-cols-6 gap-1 px-1 pb-2">
                  {recentApps.map(renderAppTile)}
                </div>
              ) : (
                <div className="px-3 py-3 text-xs text-text-muted/80">
                  暂无最近软件。从启动器打开应用后会出现在这里。
                </div>
              )}

              <div className="launcher-section-label">阅读</div>
              <button
                type="button"
                onClick={() => runCommand('stealth-reader')}
                onContextMenu={openReaderContextMenu}
                onMouseEnter={() => setSelectedIndex(-1)}
                title="左键继续阅读 / 右键进入书架"
                className="launcher-feature-card mx-1 mb-2"
              >
                <div className="launcher-icon-well text-amber-300">
                  <BookOpen size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text">阅读</div>
                  <div className="truncate text-[11px] text-text-muted">左键续读 · 右键进书架</div>
                </div>
              </button>

              <div className="launcher-section-label">最近文件</div>
              {recentFiles.length > 0 ? (
                <div className="space-y-1 pb-2">
                  {recentFiles.map(renderRecentPathRow)}
                </div>
              ) : (
                <div className="px-3 py-2 text-xs text-text-muted/80">暂无最近文件</div>
              )}

              <div className="launcher-section-label">最近目录</div>
              {recentFolders.length > 0 ? (
                <div className="space-y-1 pb-2">
                  {recentFolders.map(renderRecentPathRow)}
                </div>
              ) : (
                <div className="px-3 py-2 text-xs text-text-muted/80">暂无最近目录</div>
              )}

              {recentCommands.length > 0 && (
                <>
                  <div className="launcher-section-label">最近功能</div>
                  <div className="grid grid-cols-4 gap-1.5 px-1 pb-2">
                    {recentCommands.map((command) => {
                      const Icon = COMMAND_ICONS[command.id] || AppWindow
                      return (
                        <button
                          key={command.id}
                          onClick={() => runCommand(command.id)}
                          onMouseEnter={() => setSelectedIndex(-1)}
                          className="launcher-tile launcher-tile--compact"
                        >
                          <div className="launcher-tile-icon">
                            <div className="launcher-icon-well launcher-icon-well--sm text-text">
                              <Icon size={16} />
                            </div>
                          </div>
                          <span className="launcher-tile-label text-[11px] text-text-muted truncate w-full">{command.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <div className="launcher-section-label">工作台</div>
              <div className="grid grid-cols-4 gap-2 px-1 pb-1">
                {LAUNCHER_COMMANDS.filter((command) => command.id !== 'translate-clipboard').map((command) => {
                  const Icon = COMMAND_ICONS[command.id] || AppWindow
                  return (
                    <button
                      key={command.id}
                      onClick={() => runCommand(command.id)}
                      onContextMenu={(event) => {
                        if (command.id !== 'stealth-reader') return
                        openReaderContextMenu(event)
                      }}
                      title={command.description}
                      onMouseEnter={() => setSelectedIndex(-1)}
                      className="launcher-tile launcher-tile--command"
                    >
                      <div className="launcher-tile-icon">
                        <div className="launcher-icon-well text-primary">
                          <Icon size={18} />
                        </div>
                      </div>
                      <span className="launcher-tile-label text-[11px] text-text-muted truncate w-full">{command.label}</span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              {(matchedApps.length > 0 || appsLoading) && (
                <>
                  <div className="launcher-section-label">应用与系统设置</div>
                  {appsLoading && matchedApps.length === 0 && (
                    <div className="px-3 py-2 text-xs text-text-muted">正在搜索…</div>
                  )}
                  {matchedApps.map(renderAppRow)}
                </>
              )}

              {items.length > 0 && (
                <>
                  <div className="launcher-section-label">功能</div>
                  {items.map(renderItemRow)}
                </>
              )}

              {everything.status === 'ok' && everything.items.length > 0 && (
                <>
                  <div className="launcher-section-label">文件</div>
                  {everything.items.map(renderFileRow)}
                </>
              )}
              {everything.status === 'ok' && everything.items.length === 0 && everythingQuery.trim().length >= 2 && (
                <div className="px-3 py-2 text-xs text-text-muted">未找到匹配文件</div>
              )}
              {everything.status === 'loading' && (
                <div className="px-3 py-2 text-xs text-text-muted">正在搜索文件…</div>
              )}
              {everything.status === 'unavailable' && (
                <div className="px-3 py-2 text-xs text-text-muted/80">
                  {everything.message
                    || (everything.reason === 'not-installed'
                      ? '未检测到 Everything（es.exe），安装后可在启动器中全局搜索文件；可在 设置 → 启动器 中配置路径。'
                      : everything.reason === 'not-running'
                        ? 'Everything 未运行，请先启动 Everything。'
                        : 'Everything 搜索出错。')}
                </div>
              )}

              {items.length === 0 && matchedApps.length === 0 && !appsLoading
                && everything.status !== 'ok' && everything.status !== 'loading' && (
                <div className="px-3 py-8 text-center text-sm text-text-muted">没有匹配的应用或功能</div>
              )}
            </>
          )}
        </div>

        {(copied || launchError) && (
          <div className="launcher-footer flex items-center justify-end px-4 py-2 text-[11px] text-text-muted/80">
            {copied ? <span className="text-success">已复制</span> : <span className="text-red-400">{launchError}</span>}
          </div>
        )}

        {contextMenu && createPortal(
          <div
            className="fixed inset-0 z-[9999]"
            onClick={() => setContextMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault()
              setContextMenu(null)
            }}
          >
            <div
              className="launcher-menu absolute min-w-[148px] py-1"
              style={{
                left: Math.min(contextMenu.x, Math.max(8, window.innerWidth - 168)),
                top: Math.min(contextMenu.y, Math.max(8, window.innerHeight - 220)),
              }}
              onClick={(event) => event.stopPropagation()}
            >
              {contextMenu.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={clsx('launcher-menu-item', item.danger && 'is-danger')}
                  onClick={() => runContextMenuAction(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
      </div>
      </div>
  )

  if (variant === 'embedded') {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4"
        onClick={hideLauncher}
      >
        <div className="absolute inset-0 modal-veil" />
        {panel}
      </div>
    )
  }

  return (
    <div
      className="h-screen w-screen overflow-hidden p-1 select-none bg-transparent"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {panel}
    </div>
  )
}
