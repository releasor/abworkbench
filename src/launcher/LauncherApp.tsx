import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  PinOff,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import { useShortcutStore } from '../shortcuts'
import { buildLauncherItems, detectUrl, LAUNCHER_COMMANDS, type LauncherItem } from './intents'

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
  | { status: 'unavailable'; reason: 'not-installed' | 'not-running' | 'error' }

const COMMAND_ICONS: Record<string, typeof LayoutDashboard> = {
  'open-main': AppWindow,
  'nav-dashboard': LayoutDashboard,
  'nav-taskflow': CheckSquare,
  'nav-pomodoro': Timer,
  'nav-habits': Target,
  'nav-notes': StickyNote,
  'nav-weather': Cloud,
  'nav-settings': Settings,
  'translate-clipboard': Languages,
}

const PAGE_BY_COMMAND: Record<string, string> = {
  'nav-dashboard': 'dashboard',
  'nav-taskflow': 'taskflow',
  'nav-pomodoro': 'pomodoro',
  'nav-habits': 'habits',
  'nav-notes': 'notes',
  'nav-weather': 'weather',
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

export interface LauncherAppProps {
  /** window = standalone Electron launcher; embedded = modal inside main app */
  variant?: 'window' | 'embedded'
  isOpen?: boolean
  onClose?: () => void
  onNavigate?: (page: string) => void
}

function rowClass(isSelected: boolean) {
  return clsx(
    'w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all',
    isSelected
      ? 'bg-primary/15 text-text border border-primary/25 shadow-lg shadow-primary/5'
      : 'text-text-muted border border-transparent hover:bg-surface-lighter/80 hover:text-text'
  )
}

export default function LauncherApp({
  variant = 'window',
  isOpen = true,
  onClose,
  onNavigate,
}: LauncherAppProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
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
  const launcherHotkey = useShortcutStore((s) => s.getAccelerator('launcher'))
  const inputRef = useRef<HTMLInputElement>(null)
  const searchSeq = useRef(0)
  const appSearchSeq = useRef(0)

  const items = useMemo(() => buildLauncherItems(query), [query])
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
          setEverything({ status: 'unavailable', reason: result?.reason || 'error' })
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
    setSelectedIndex(0)
    setCopied(false)
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
    resetLauncher()
    return window.electronAPI?.onLauncherShown?.(resetLauncher)
  }, [variant, resetLauncher])

  // Embedded mode: reset each time the overlay opens.
  useEffect(() => {
    if (variant !== 'embedded' || !isOpen) return
    resetLauncher()
  }, [variant, isOpen, resetLauncher])

  useEffect(() => {
    queueMicrotask(() => setSelectedIndex(0))
  }, [query, matchedApps, everything])

  const hideLauncher = useCallback(() => {
    if (variant === 'embedded') {
      onClose?.()
      return
    }
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
    void window.electronAPI?.openApp?.(appEntry.path).then((ok) => {
      if (!ok) void window.electronAPI?.openTarget?.(appEntry.target)
      refreshRecentApps()
    })
    hideLauncher()
  }, [hideLauncher, refreshRecentApps])

  const applyRecentAppsUpdate = useCallback((apps: DesktopAppInfo[] | undefined) => {
    if (Array.isArray(apps)) setRecentApps(apps)
    else refreshRecentApps()
  }, [refreshRecentApps])

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
    if (item.kind === 'path') {
      void window.electronAPI?.openTarget?.(item.path)
      hideLauncher()
      return
    }
    if (item.kind === 'everything' && everything.status === 'ok' && everything.items[0]) {
      void window.electronAPI?.openTarget?.(everything.items[0].path)
      hideLauncher()
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

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const cols = 6
    const homeAppOffset = !query.trim() && clipboardUrl ? 1 : 0
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((prev) => {
        if (!query.trim() && prev >= homeAppOffset && prev < homeAppOffset + recentApps.length) {
          return Math.min(prev + cols, selectable.length - 1)
        }
        return Math.min(prev + 1, Math.max(0, selectable.length - 1))
      })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((prev) => {
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
      <div
        key={appEntry.id}
        className="group relative"
        onMouseEnter={() => setSelectedIndex(index)}
      >
        <button
          type="button"
          onClick={() => openApp(appEntry)}
          title={appEntry.target || appEntry.name}
          className={clsx(
            'flex w-full flex-col items-center gap-1.5 px-1.5 py-2.5 rounded-2xl text-center transition-all border',
            isSelected
              ? 'bg-primary/15 border-primary/30 shadow-lg shadow-primary/5'
              : 'border-transparent hover:bg-surface-lighter/80 hover:border-border/70'
          )}
        >
          <div className="relative">
            {appEntry.iconDataUrl ? (
              <img src={appEntry.iconDataUrl} alt="" className="h-9 w-9 rounded-xl object-contain bg-surface/60 p-1" />
            ) : (
              <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                <AppWindow size={18} />
              </div>
            )}
            {appEntry.pinned && (
              <span className="absolute -left-1 -top-1 rounded-full bg-primary p-0.5 text-white shadow-sm">
                <Pin size={9} fill="currentColor" />
              </span>
            )}
          </div>
          <span className="text-[11px] text-text leading-tight line-clamp-2 w-full px-0.5">{appEntry.name}</span>
        </button>
        <div className={clsx(
          'absolute right-0.5 top-0.5 flex gap-0.5 transition-opacity',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}>
          <button
            type="button"
            title={appEntry.pinned ? '取消固定' : '固定'}
            onClick={(event) => {
              event.stopPropagation()
              if (appEntry.pinned) unpinApp(appEntry, event)
              else pinApp(appEntry, event)
            }}
            className="rounded-md border border-border bg-surface/95 p-0.5 text-text-muted hover:text-primary hover:border-primary/40"
          >
            {appEntry.pinned ? <PinOff size={11} /> : <Pin size={11} />}
          </button>
          <button
            type="button"
            title="从最近软件中移除"
            onClick={(event) => {
              event.stopPropagation()
              hideApp(appEntry, event)
            }}
            className="rounded-md border border-border bg-surface/95 p-0.5 text-text-muted hover:text-danger hover:border-danger/40"
          >
            <X size={11} />
          </button>
        </div>
      </div>
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
        onMouseEnter={() => setSelectedIndex(index)}
        className={rowClass(isSelected)}
      >
        {appEntry.iconDataUrl ? (
          <img src={appEntry.iconDataUrl} alt="" className="h-8 w-8 rounded-xl object-contain bg-surface/60 p-1 flex-shrink-0" />
        ) : (
          <div className={clsx(
            'h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0',
            isSettings ? 'bg-cyan-500/15 text-cyan-400' : 'bg-primary/15 text-primary'
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
        onMouseEnter={() => setSelectedIndex(index)}
        title="回车打开，Ctrl+回车定位到文件夹"
        className={rowClass(isSelected)}
      >
        {entry.iconDataUrl ? (
          <img src={entry.iconDataUrl} alt="" className="h-8 w-8 rounded-xl object-contain bg-surface/60 p-1 flex-shrink-0" />
        ) : (
          <div className={clsx(
            'h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0',
            isSelected ? 'bg-primary/20 text-primary' : 'bg-surface/70 text-text-muted'
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
        className={rowClass(isSelected)}
      >
        <div className={clsx(
          'h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0',
          isSelected ? 'bg-primary/20 text-primary' : 'bg-surface/70 text-text-muted'
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
        onMouseEnter={() => setSelectedIndex(index)}
        title="回车打开，Ctrl+回车定位到文件夹"
        className={rowClass(isSelected)}
      >
        <div className={clsx(
          'h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0',
          isSelected ? 'bg-primary/20 text-primary' : 'bg-surface/70 text-text-muted'
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
          'glass-card overflow-hidden animate-fade-in flex flex-col shadow-2xl shadow-black/25',
          variant === 'embedded' ? 'relative w-full max-w-2xl max-h-[min(560px,78vh)]' : 'h-full w-full'
        )}
        onClick={variant === 'embedded' ? (event) => event.stopPropagation() : undefined}
        role={variant === 'embedded' ? 'dialog' : undefined}
        aria-modal={variant === 'embedded' ? true : undefined}
        aria-label="启动器"
      >
        {/* Brand + search — aligned with main command palette */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-surface/40">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
            <Zap size={16} className="text-white" />
          </div>
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <Search size={18} className="text-text-muted flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜索网页 / 输入网址 / 软件 / 设置 / 翻译 / 找文件"
              autoFocus
              className="flex-1 bg-transparent text-text text-[15px] outline-none placeholder:text-text-muted/70"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <kbd className="px-1.5 py-0.5 text-[10px] text-text-muted bg-surface rounded-lg border border-border">{launcherHotkey}</kbd>
            <kbd className="px-2 py-0.5 text-xs text-text-muted bg-surface rounded-lg border border-border">ESC</kbd>
          </div>
        </div>

        {showHome && clipboardUrl && (
          <button
            onClick={openClipboardUrl}
            onMouseEnter={() => setSelectedIndex(0)}
            className={clsx(
              'mx-3 mt-3 flex items-center gap-2 px-3 py-2.5 rounded-2xl border text-left transition-all',
              selectedIndex === 0
                ? 'border-cyan-500/40 bg-cyan-500/20 shadow-lg shadow-cyan-500/5'
                : 'border-cyan-500/25 bg-cyan-500/10 hover:bg-cyan-500/15'
            )}
          >
            <Globe size={15} className="text-cyan-400 flex-shrink-0" />
            <span className="text-xs text-text truncate flex-1">访问剪贴板网址：{clipboardUrl}</span>
            <kbd className="px-1.5 py-0.5 text-[10px] text-text-muted bg-surface rounded border border-border flex-shrink-0">↵</kbd>
          </button>
        )}

        {showHome && clipboardText && !clipboardUrl && (
          <button
            onClick={() => runCommand('translate-clipboard')}
            className="mx-3 mt-3 flex items-center gap-2 px-3 py-2.5 rounded-2xl border border-primary/20 bg-primary/10 hover:bg-primary/15 text-left transition-all"
          >
            <ClipboardPaste size={15} className="text-primary flex-shrink-0" />
            <span className="text-xs text-text truncate flex-1">翻译剪贴板：{clipboardText}</span>
            <Languages size={14} className="text-text-muted flex-shrink-0" />
          </button>
        )}

        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {showHome ? (
            <>
              <div className="px-3 py-1.5 text-xs text-text-muted font-medium flex items-center justify-between gap-2">
                <span>最近软件</span>
                <span className="text-[10px] text-text-muted/70 font-normal">悬停可固定 / 删除</span>
              </div>
              {recentApps.length > 0 ? (
                <div className="grid grid-cols-6 gap-1 px-1 pb-2">
                  {recentApps.map(renderAppTile)}
                </div>
              ) : (
                <div className="px-3 py-3 text-xs text-text-muted/80">
                  暂无最近软件。从启动器打开应用后会出现在这里。
                </div>
              )}

              <div className="px-3 py-1.5 text-xs text-text-muted font-medium">最近文件</div>
              {recentFiles.length > 0 ? (
                <div className="space-y-1 pb-2">
                  {recentFiles.map(renderRecentPathRow)}
                </div>
              ) : (
                <div className="px-3 py-2 text-xs text-text-muted/80">暂无最近文件</div>
              )}

              <div className="px-3 py-1.5 text-xs text-text-muted font-medium">最近目录</div>
              {recentFolders.length > 0 ? (
                <div className="space-y-1 pb-2">
                  {recentFolders.map(renderRecentPathRow)}
                </div>
              ) : (
                <div className="px-3 py-2 text-xs text-text-muted/80">暂无最近目录</div>
              )}

              {recentCommands.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-xs text-text-muted font-medium">最近功能</div>
                  <div className="grid grid-cols-4 gap-1.5 px-1 pb-2">
                    {recentCommands.map((command) => {
                      const Icon = COMMAND_ICONS[command.id] || AppWindow
                      return (
                        <button
                          key={command.id}
                          onClick={() => runCommand(command.id)}
                          className="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-2xl border border-transparent hover:border-border/70 hover:bg-surface-lighter/80 transition-all"
                        >
                          <div className="h-8 w-8 rounded-xl bg-surface/70 flex items-center justify-center">
                            <Icon size={16} className="text-text" />
                          </div>
                          <span className="text-[11px] text-text-muted truncate w-full text-center">{command.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <div className="px-3 py-1.5 text-xs text-text-muted font-medium">工作台</div>
              <div className="grid grid-cols-4 gap-2 px-1 pb-1">
                {LAUNCHER_COMMANDS.filter((command) => command.id !== 'translate-clipboard').map((command) => {
                  const Icon = COMMAND_ICONS[command.id] || AppWindow
                  return (
                    <button
                      key={command.id}
                      onClick={() => runCommand(command.id)}
                      title={command.description}
                      className="flex flex-col items-center gap-2 px-2 py-3 rounded-2xl border border-border/70 bg-surface/50 hover:border-primary/30 hover:bg-primary/10 transition-all"
                    >
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <Icon size={18} className="text-primary" />
                      </div>
                      <span className="text-[11px] text-text-muted truncate w-full text-center">{command.label}</span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              {(matchedApps.length > 0 || appsLoading) && (
                <>
                  <div className="px-3 py-1.5 text-xs text-text-muted font-medium">应用与系统设置</div>
                  {appsLoading && matchedApps.length === 0 && (
                    <div className="px-3 py-2 text-xs text-text-muted">正在搜索…</div>
                  )}
                  {matchedApps.map(renderAppRow)}
                </>
              )}

              {items.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-xs text-text-muted font-medium">功能</div>
                  {items.map(renderItemRow)}
                </>
              )}

              {everything.status === 'ok' && everything.items.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-xs text-text-muted font-medium">文件</div>
                  {everything.items.map(renderFileRow)}
                </>
              )}
              {everything.status === 'loading' && (
                <div className="px-3 py-2 text-xs text-text-muted">正在搜索文件…</div>
              )}
              {everything.status === 'unavailable' && (
                <div className="px-3 py-2 text-xs text-text-muted/80">
                  {everything.reason === 'not-installed'
                    ? '未检测到 Everything（es.exe），安装后可在启动器中全局搜索文件；可在 设置 → 启动器 中配置路径。'
                    : everything.reason === 'not-running'
                      ? 'Everything 未运行，请先启动 Everything。'
                      : 'Everything 搜索出错。'}
                </div>
              )}

              {items.length === 0 && matchedApps.length === 0 && !appsLoading && everything.status !== 'ok' && (
                <div className="px-3 py-8 text-center text-sm text-text-muted">没有匹配的应用或功能</div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-surface/30 text-[11px] text-text-muted/80">
          <div className="flex items-center gap-3">
            <span>↑↓ 选择</span>
            <span>↵ 打开</span>
            <span>Ctrl+↵ 定位文件</span>
          </div>
          {copied ? <span className="text-success">结果已复制</span> : <span>{launcherHotkey} 快速启动 · ESC 关闭</span>}
        </div>
      </div>
  )

  if (variant === 'embedded') {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4"
        onClick={hideLauncher}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative w-full max-w-2xl">{panel}</div>
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
