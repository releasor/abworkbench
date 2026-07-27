import { useState, useCallback, useMemo, useRef, useEffect, lazy, Suspense } from 'react'
import { useStore } from './store'
import Sidebar from './components/layout/Sidebar'
import type { Page } from './components/layout/Sidebar'
import { APP_PAGES, PAGE_TITLE_KEYS } from './navigation/pages'
import Header from './components/layout/Header'
import CommandPalette from './components/common/CommandPalette'
import QuickCaptureModal from './components/common/QuickCaptureModal'
import MiniWindow from './components/common/MiniWindow'
import LauncherApp from './launcher/LauncherApp'
import ErrorBoundary from './components/common/ErrorBoundary'
import { useI18nStore, useTranslation } from './i18n'
import { acceleratorToKeys, eventMatchesShortcut, useShortcutStore, useSyncElectronShortcuts } from './shortcuts'
import {
  DashboardSkeleton, PomodoroSkeleton, NotesSkeleton,
  WeatherSkeleton, HabitsSkeleton, SettingsSkeleton,
  TaskFlowSkeleton,
} from './components/common/PageSkeletons'

const DashboardPage = lazy(() => import('./components/dashboard/DashboardPage'))
const PomodoroTimer = lazy(() => import('./components/pomodoro/PomodoroTimer'))
const NotesList = lazy(() => import('./components/notes/NotesList'))
const WeatherWidget = lazy(() => import('./components/weather/WeatherWidget'))
const HabitTracker = lazy(() => import('./components/habits/HabitTracker'))
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'))
const TaskFlowPage = lazy(() => import('./modules/taskflow/TaskFlowPage'))

const pages: Page[] = [...APP_PAGES]

function App() {
  const { t } = useTranslation()
  const setLanguage = useI18nStore((s) => s.setLanguage)
  const [activePage, setActivePage] = useState<Page>('dashboard')
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showLauncher, setShowLauncher] = useState(false)
  const [showQuickCapture, setShowQuickCapture] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const accentColor = useStore((s) => s.accentColor)
  const setAccentColor = useStore((s) => s.setAccentColor)
  const themeMode = useStore((s) => s.themeMode)
  const workspaceMode = useStore((s) => s.workspaceMode)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const isMiniMode = useMemo(() => new URLSearchParams(window.location.search).get('mini') === '1', [])
  const isLauncherMode = useMemo(() => new URLSearchParams(window.location.search).get('launcher') === '1', [])

  const pageTitles = useMemo(
    () => Object.fromEntries(pages.map((page) => [page, t(PAGE_TITLE_KEYS[page])])) as Record<Page, string>,
    [t]
  )

  useEffect(() => {
    setLanguage('zh')
    document.documentElement.lang = 'zh-CN'
  }, [setLanguage])

  // Update document title based on active page
  useEffect(() => {
    document.title = activePage === 'dashboard' ? 'Abworkbench' : `${pageTitles[activePage]} | Abworkbench`
  }, [activePage, pageTitles])

  // Apply accent color as CSS custom properties
  useEffect(() => {
    const legacyPurpleAccents = new Set(['#6366f1', '#818cf8', '#4f46e5', '#8b5cf6', '#7c3aed'])
    const hex = legacyPurpleAccents.has(accentColor.toLowerCase()) ? '#3b82f6' : accentColor
    if (hex !== accentColor) setAccentColor(hex)
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const root = document.documentElement
    root.style.setProperty('--color-primary', hex)
    root.style.setProperty('--color-primary-light', `color-mix(in srgb, ${hex} 80%, white)`)
    root.style.setProperty('--color-primary-dark', `color-mix(in srgb, ${hex} 80%, black)`)
    root.style.setProperty('--tw-ring-color', `rgb(${r} ${g} ${b} / 0.15)`)
  }, [accentColor, setAccentColor])

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    document.documentElement.classList.toggle('dark', themeMode === 'dark')
  }, [themeMode])

  useEffect(() => {
    document.documentElement.dataset.workspaceMode = workspaceMode
  }, [workspaceMode])

  useEffect(() => {
    if (!isLauncherMode) return
    const html = document.documentElement
    const body = document.body
    const root = document.getElementById('root')
    const prevHtmlBg = html.style.background
    const prevBodyBg = body.style.background
    const prevRootBg = root?.style.background ?? ''
    html.style.background = 'transparent'
    body.style.background = 'transparent'
    if (root) root.style.background = 'transparent'
    return () => {
      html.style.background = prevHtmlBg
      body.style.background = prevBodyBg
      if (root) root.style.background = prevRootBg
    }
  }, [isLauncherMode])

  const toggleCommandPalette = useCallback(() => {
    setShowLauncher(false)
    setShowCommandPalette((prev) => !prev)
  }, [])
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), [])
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), [])
  const closeCommandPalette = useCallback(() => setShowCommandPalette(false), [])
  const openLauncher = useCallback(() => {
    setShowCommandPalette(false)
    setShowLauncher(true)
  }, [])
  const closeLauncher = useCallback(() => setShowLauncher(false), [])
  const toggleLauncher = useCallback(() => {
    setShowCommandPalette(false)
    setShowLauncher((prev) => !prev)
  }, [])
  const openQuickCapture = useCallback(() => setShowQuickCapture(true), [])
  const closeQuickCapture = useCallback(() => setShowQuickCapture(false), [])
  const navigateFromPalette = useCallback((page: Page) => {
    setActivePage(page)
    setShowCommandPalette(false)
  }, [])
  const navigateFromLauncher = useCallback((page: string) => {
    if ((APP_PAGES as readonly string[]).includes(page)) {
      setActivePage(page as Page)
    }
    setShowLauncher(false)
  }, [])

  useSyncElectronShortcuts()

  const shortcutOverrides = useShortcutStore((s) => s.overrides)
  const launcherHint = useShortcutStore((s) => s.getAccelerator('launcher'))
  const mainWindowHint = useShortcutStore((s) => s.getAccelerator('mainWindow'))
  const commandPaletteHint = useShortcutStore((s) => s.getAccelerator('commandPalette'))
  const quickCaptureHint = useShortcutStore((s) => s.getAccelerator('quickCapture'))

  useEffect(() => {
    void shortcutOverrides
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const inField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (eventMatchesShortcut('escapeClose', event)) {
        if (showLauncher) return
        event.preventDefault()
        setShowCommandPalette(false)
        setMobileSidebarOpen(false)
        return
      }

      if (inField) return

      if (eventMatchesShortcut('commandPalette', event)) {
        event.preventDefault()
        toggleCommandPalette()
        return
      }
      if (eventMatchesShortcut('quickCapture', event)) {
        // Global Electron hotkey also fires; allow in-window binding too.
        event.preventDefault()
        openQuickCapture()
        return
      }
      if (eventMatchesShortcut('toggleSidebar', event)) {
        event.preventDefault()
        toggleSidebar()
        return
      }
      if (eventMatchesShortcut('pageDashboard', event)) { event.preventDefault(); setActivePage('dashboard'); return }
      if (eventMatchesShortcut('pageTaskflow', event)) { event.preventDefault(); setActivePage('taskflow'); return }
      if (eventMatchesShortcut('pagePomodoro', event)) { event.preventDefault(); setActivePage('pomodoro'); return }
      if (eventMatchesShortcut('pageHabits', event)) { event.preventDefault(); setActivePage('habits'); return }
      if (eventMatchesShortcut('pageNotes', event)) { event.preventDefault(); setActivePage('notes'); return }
      if (eventMatchesShortcut('pageWeather', event)) { event.preventDefault(); setActivePage('weather'); return }
      if (eventMatchesShortcut('pageSettings', event)) { event.preventDefault(); setActivePage('settings'); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openQuickCapture, shortcutOverrides, showLauncher, toggleCommandPalette, toggleSidebar])

  useEffect(() => {
    return window.electronAPI?.onOpenQuickCapture?.(openQuickCapture)
  }, [openQuickCapture])

  // Global Alt+Space: when main window is focused, Electron routes here for the embedded launcher.
  useEffect(() => {
    return window.electronAPI?.onToggleEmbeddedLauncher?.(toggleLauncher)
  }, [toggleLauncher])

  // Navigate when the floating launcher asks the main window to open a specific page.
  useEffect(() => {
    return window.electronAPI?.onOpenMainPage?.((page) => {
      if ((APP_PAGES as readonly string[]).includes(page)) {
        setActivePage(page as Page)
      }
    })
  }, [])

  // Browser notification polling for overdue/due-today tasks
  useEffect(() => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Track which pages have been visited to lazily mount them (but never unmount)
  const [visitedPages, setVisitedPages] = useState<Set<Page>>(new Set(['dashboard']))
  useEffect(() => {
    queueMicrotask(() => {
      setVisitedPages(prev => {
        if (prev.has(activePage)) return prev
        const next = new Set(prev)
        next.add(activePage)
        return next
      })
    })
  }, [activePage])

  if (isLauncherMode) {
    return <LauncherApp />
  }

  if (isMiniMode) {
    return (
      <>
        <MiniWindow onOpenQuickCapture={openQuickCapture} />
        <QuickCaptureModal isOpen={showQuickCapture} onClose={closeQuickCapture} />
      </>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--color-surface)' }}>
      <Sidebar
        activePage={activePage}
        onPageChange={setActivePage}
        onOpenLauncher={openLauncher}
        isMobileOpen={mobileSidebarOpen}
        onMobileClose={closeMobileSidebar}
      />
      <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header
          title={pageTitles[activePage]}
          onOpenCommandPalette={toggleCommandPalette}
          onOpenMobileSidebar={openMobileSidebar}
        />
        <main ref={mainRef} className="p-4 md:p-6 overflow-auto bg-gradient-to-b from-surface to-surface-light/30" style={{ flex: '1 1 0%', minHeight: 0, width: '100%' }}>
          <ErrorBoundary>
            {visitedPages.has('dashboard')   && <div style={{ display: activePage === 'dashboard'   ? undefined : 'none' }}><Suspense fallback={<DashboardSkeleton />}><DashboardPage onNavigate={setActivePage} /></Suspense></div>}
            {visitedPages.has('taskflow')    && <div style={{ display: activePage === 'taskflow'    ? undefined : 'none' }}><Suspense fallback={<TaskFlowSkeleton />}><TaskFlowPage /></Suspense></div>}
            {visitedPages.has('pomodoro')    && <div style={{ display: activePage === 'pomodoro'    ? undefined : 'none' }}><Suspense fallback={<PomodoroSkeleton />}><PomodoroTimer /></Suspense></div>}
            {visitedPages.has('habits')      && <div style={{ display: activePage === 'habits'      ? undefined : 'none' }}><Suspense fallback={<HabitsSkeleton />}><HabitTracker /></Suspense></div>}
            {visitedPages.has('notes')       && <div style={{ display: activePage === 'notes'       ? undefined : 'none' }}><Suspense fallback={<NotesSkeleton />}><NotesList /></Suspense></div>}
            {visitedPages.has('weather')     && <div style={{ display: activePage === 'weather'     ? undefined : 'none' }}><Suspense fallback={<WeatherSkeleton />}><WeatherWidget /></Suspense></div>}
            {visitedPages.has('settings')    && <div style={{ display: activePage === 'settings'    ? undefined : 'none' }}><Suspense fallback={<SettingsSkeleton />}><SettingsPage /></Suspense></div>}
          </ErrorBoundary>
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={closeCommandPalette}
        pages={pages}
        pageTitles={pageTitles}
        onNavigate={navigateFromPalette}
      />

      {/* Embedded launcher (same UI as Alt+Space floating window) */}
      <LauncherApp
        variant="embedded"
        isOpen={showLauncher}
        onClose={closeLauncher}
        onNavigate={navigateFromLauncher}
      />

      <QuickCaptureModal isOpen={showQuickCapture} onClose={closeQuickCapture} />

      {/* Keyboard Shortcuts Hint - desktop only */}
      <div className="fixed bottom-4 right-4 text-xs text-text-muted/50 hidden md:flex items-center gap-3">
        <span className="inline-flex items-center gap-1">
          {acceleratorToKeys(launcherHint).map((key) => (
            <kbd key={key} className="px-1.5 py-0.5 bg-surface-light rounded border border-border text-[10px]">{key}</kbd>
          ))}
          {' '}启动器
        </span>
        <span className="inline-flex items-center gap-1">
          {acceleratorToKeys(mainWindowHint).map((key) => (
            <kbd key={`main-${key}`} className="px-1.5 py-0.5 bg-surface-light rounded border border-border text-[10px]">{key}</kbd>
          ))}
          {' '}主窗口
        </span>
        <span className="inline-flex items-center gap-1">
          {acceleratorToKeys(commandPaletteHint).map((key) => (
            <kbd key={key} className="px-1.5 py-0.5 bg-surface-light rounded border border-border text-[10px]">{key}</kbd>
          ))}
          {' '}{t('shortcuts.commandPalette')}
        </span>
        <span className="inline-flex items-center gap-1">
          {acceleratorToKeys(quickCaptureHint).map((key) => (
            <kbd key={key} className="px-1.5 py-0.5 bg-surface-light rounded border border-border text-[10px]">{key}</kbd>
          ))}
          {' '}快速捕获
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-surface-light rounded border border-border text-[10px]">ESC</kbd>
          {' '}关闭
        </span>
      </div>
    </div>
  )
}

export default App
