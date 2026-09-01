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
import StealthReaderApp from './modules/stealthReader/StealthReaderApp'
import GlobalToastHost from './components/common/GlobalToastHost'
import ErrorBoundary from './components/common/ErrorBoundary'
import { useI18nStore, useTranslation } from './i18n'
import { acceleratorToKeys, eventMatchesShortcut, useShortcutStore, useSyncElectronShortcuts } from './shortcuts'
import {
  DashboardSkeleton, PomodoroSkeleton, NotesSkeleton,
  WeatherSkeleton, HabitsSkeleton, SettingsSkeleton,
  TaskFlowSkeleton, HotlistSkeleton,
} from './components/common/PageSkeletons'
import { isPomodoroTitleActive } from './utils/documentTitle'
import { useTaskStore } from './modules/taskflow/hooks/useTaskStore'
import {
  WORKSPACE_MODE_EVENT,
  applyWorkspaceModeSideEffects,
  planWorkspaceModeEffects,
  requestPomodoroStart,
  type WorkspaceModeChangeDetail,
} from './utils/workspaceModeEffects'
import { showToast } from './modules/taskflow/utils/toastEvent'
import AmbientEffects from './components/common/AmbientEffects'
import DeepWorkTransition from './components/common/DeepWorkTransition'
import GlassFilterSvg from './components/common/GlassFilterSvg'
import { smoothNavigate } from './utils/smoothNavigate'
import clsx from 'clsx'

const DashboardPage = lazy(() => import('./components/dashboard/DashboardPage'))
const PomodoroTimer = lazy(() => import('./components/pomodoro/PomodoroTimer'))
const NotesList = lazy(() => import('./components/notes/NotesList'))
const WeatherWidget = lazy(() => import('./components/weather/WeatherWidget'))
const HabitTracker = lazy(() => import('./components/habits/HabitTracker'))
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'))
const WorkbenchPage = lazy(() => import('./modules/workbench/WorkbenchPage'))
const RemindersPage = lazy(() => import('./components/reminders/RemindersPage'))
const HotlistPage = lazy(() => import('./modules/hotlist/HotlistPage'))
const MineradioPage = lazy(() => import('./components/mineradio/MineradioPage'))
const DailyBriefModal = lazy(() => import('./components/dashboard/DailyBriefModal'))

const pages: Page[] = [...APP_PAGES]

function App() {
  const { t } = useTranslation()
  const setLanguage = useI18nStore((s) => s.setLanguage)
  const [activePage, setActivePage] = useState<Page>('dashboard')
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showLauncher, setShowLauncher] = useState(false)
  const [showQuickCapture, setShowQuickCapture] = useState(false)
  const [showDailyBrief, setShowDailyBrief] = useState(false)
  const [dailyBriefMode, setDailyBriefMode] = useState<'morning' | 'evening'>('morning')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const accentColor = useStore((s) => s.accentColor)
  const setAccentColor = useStore((s) => s.setAccentColor)
  const themeMode = useStore((s) => s.themeMode)
  const workspaceMode = useStore((s) => s.workspaceMode)
  const visualNoise = useStore((s) => s.visualNoise)
  const visualParticles = useStore((s) => s.visualParticles)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed)
  const isMiniMode = useMemo(() => new URLSearchParams(window.location.search).get('mini') === '1', [])
  const isLauncherMode = useMemo(() => new URLSearchParams(window.location.search).get('launcher') === '1', [])
  const isReaderMode = useMemo(() => new URLSearchParams(window.location.search).get('reader') === '1', [])

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
    const syncTitle = () => {
      if (isPomodoroTitleActive()) return
      document.title = activePage === 'dashboard' ? 'Abworkbench' : `${pageTitles[activePage]} | Abworkbench`
    }
    syncTitle()
    window.addEventListener('abwb:restore-title', syncTitle)
    return () => window.removeEventListener('abwb:restore-title', syncTitle)
  }, [activePage, pageTitles])

  // Apply accent color as CSS custom properties
  useEffect(() => {
    const legacyPurpleAccents = new Set(['#6366f1', '#818cf8', '#4f46e5', '#8b5cf6', '#7c3aed'])
    const legacyBlueAccents = new Set(['#3b82f6', '#2563eb', '#60a5fa', '#1d4ed8'])
    const legacyCyanAccents = new Set(['#00f5d4', '#5ffbec', '#00c4aa', '#14b8a6', '#00a894'])
    const silverGlass = '#e8eef2'
    const lightPrimary = '#2563eb'
    let hex = accentColor.toLowerCase()
    if (legacyPurpleAccents.has(hex)) hex = silverGlass
    if (legacyBlueAccents.has(hex)) hex = silverGlass
    // Dark glass skin: map neon accents to silver
    if (themeMode === 'dark' && legacyCyanAccents.has(hex)) hex = silverGlass
    // Light theme: never paint near-white primary (selected states become invisible)
    if (themeMode === 'light') {
      const r0 = parseInt(hex.slice(1, 3), 16)
      const g0 = parseInt(hex.slice(3, 5), 16)
      const b0 = parseInt(hex.slice(5, 7), 16)
      const luminance = (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0) / 255
      if (luminance > 0.72 || hex === silverGlass) hex = lightPrimary
    } else if (hex !== accentColor.toLowerCase()) {
      setAccentColor(hex)
    }
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const root = document.documentElement
    root.style.setProperty('--color-primary', hex)
    root.style.setProperty('--color-primary-light', `color-mix(in srgb, ${hex} 80%, white)`)
    root.style.setProperty('--color-primary-dark', `color-mix(in srgb, ${hex} 80%, black)`)
    root.style.setProperty('--home-accent', hex)
    root.style.setProperty('--tw-ring-color', `rgb(${r} ${g} ${b} / 0.15)`)
  }, [accentColor, setAccentColor, themeMode])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = themeMode
    root.classList.toggle('dark', themeMode === 'dark')
    // Force readable ink tokens (inline beats any leftover dark glass defaults)
    if (themeMode === 'light') {
      root.style.setProperty('--color-text', '#0f172a')
      root.style.setProperty('--color-text-muted', '#475569')
      root.style.setProperty('--color-text-secondary', '#334155')
      root.style.setProperty('--color-border', '#94a3b8')
    } else {
      root.style.removeProperty('--color-text')
      root.style.removeProperty('--color-text-muted')
      root.style.removeProperty('--color-text-secondary')
      root.style.removeProperty('--color-border')
    }
  }, [themeMode])

  useEffect(() => {
    document.documentElement.dataset.workspaceMode = workspaceMode
  }, [workspaceMode])

  useEffect(() => {
    document.documentElement.dataset.fxNoise = visualNoise ? '1' : '0'
    document.documentElement.dataset.fxParticles = visualParticles ? '1' : '0'
  }, [visualNoise, visualParticles])

  useEffect(() => {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined
    if (!api?.isWindowMaximized) return
    const apply = (maximized: boolean) => {
      document.documentElement.dataset.windowMaximized = maximized ? '1' : '0'
    }
    void api.isWindowMaximized().then(apply)
    return api.onWindowMaximizedChanged?.(apply)
  }, [])

  useEffect(() => {
    // Enable SVG backdrop-filter path when browser supports filter URLs.
    const ok = typeof CSS !== 'undefined' && CSS.supports?.('backdrop-filter', 'url(#abwb-control-glass-filter)')
    document.documentElement.classList.toggle('control-glass-svg-ok', !!ok)
  }, [])

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
  const openDailyBrief = useCallback((mode: 'morning' | 'evening' = 'morning') => {
    setDailyBriefMode(mode)
    setShowDailyBrief(true)
  }, [])
  const closeDailyBrief = useCallback(() => setShowDailyBrief(false), [])
  const goToPage = useCallback((page: Page) => {
    smoothNavigate(() => {
      setActivePage(page)
      setVisitedPages((prev) => {
        if (prev.has(page)) return prev
        const next = new Set(prev)
        next.add(page)
        return next
      })
    })
  }, [])
  const navigateFromPalette = useCallback((page: Page) => {
    smoothNavigate(() => {
      setActivePage(page)
      setVisitedPages((prev) => {
        if (prev.has(page)) return prev
        const next = new Set(prev)
        next.add(page)
        return next
      })
      setShowCommandPalette(false)
    })
  }, [])
  const navigateFromLauncher = useCallback((page: string) => {
    smoothNavigate(() => {
      if ((APP_PAGES as readonly string[]).includes(page)) {
        const nextPage = page as Page
        setActivePage(nextPage)
        setVisitedPages((prev) => {
          if (prev.has(nextPage)) return prev
          const next = new Set(prev)
          next.add(nextPage)
          return next
        })
      }
      setShowLauncher(false)
    })
  }, [])

  useSyncElectronShortcuts()

  const shortcutOverrides = useShortcutStore((s) => s.overrides)
  const launcherHint = useShortcutStore((s) => s.getAccelerator('launcher'))
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
      if (eventMatchesShortcut('pageDashboard', event)) { event.preventDefault(); goToPage('dashboard'); return }
      if (eventMatchesShortcut('pageTaskflow', event)) { event.preventDefault(); goToPage('taskflow'); return }
      if (eventMatchesShortcut('pagePomodoro', event)) { event.preventDefault(); goToPage('pomodoro'); return }
      if (eventMatchesShortcut('pageHabits', event)) { event.preventDefault(); goToPage('habits'); return }
      if (eventMatchesShortcut('pageNotes', event)) { event.preventDefault(); goToPage('notes'); return }
      if (eventMatchesShortcut('pageReminders', event)) { event.preventDefault(); goToPage('reminders'); return }
      if (eventMatchesShortcut('pageWeather', event)) { event.preventDefault(); goToPage('weather'); return }
      if (eventMatchesShortcut('pageHotlist', event)) { event.preventDefault(); goToPage('hotlist'); return }
      if (eventMatchesShortcut('pageMineradio', event)) { event.preventDefault(); goToPage('mineradio'); return }
      if (eventMatchesShortcut('pageSettings', event)) { event.preventDefault(); goToPage('settings'); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goToPage, openQuickCapture, shortcutOverrides, showLauncher, toggleCommandPalette, toggleSidebar])

  useEffect(() => {
    return window.electronAPI?.onOpenQuickCapture?.(openQuickCapture)
  }, [openQuickCapture])

  useEffect(() => {
    const handler = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: 'morning' | 'evening' }>).detail?.mode || 'morning'
      openDailyBrief(mode)
    }
    window.addEventListener('abworkbench:daily-brief', handler)
    return () => window.removeEventListener('abworkbench:daily-brief', handler)
  }, [openDailyBrief])

  // Auto-open Daily Brief once per Beijing calendar day.
  useEffect(() => {
    if (isMiniMode || isLauncherMode || isReaderMode) return
    import('./modules/taskflow/dateUtils').then(({ todayStr }) => {
      const key = 'abworkbench-daily-brief-shown'
      const today = todayStr()
      if (localStorage.getItem(key) === today) return
      const hour = new Date().getHours()
      const mode = hour >= 18 ? 'evening' : 'morning'
      localStorage.setItem(key, today)
      openDailyBrief(mode)
    }).catch(() => { /* ignore */ })
  }, [isMiniMode, isLauncherMode, isReaderMode, openDailyBrief])

  // Global Alt+Space: when main window is focused, Electron routes here for the embedded launcher.
  useEffect(() => {
    return window.electronAPI?.onToggleEmbeddedLauncher?.(toggleLauncher)
  }, [toggleLauncher])

  // Navigate when the floating launcher asks the main window to open a specific page.
  useEffect(() => {
    return window.electronAPI?.onOpenMainPage?.((page) => {
      if ((APP_PAGES as readonly string[]).includes(page)) {
        goToPage(page as Page)
      }
    })
  }, [goToPage])

  // Browser notification polling for overdue/due-today tasks and custom reminders
  useEffect(() => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }

    let cancelled = false
    const run = async () => {
      const { checkNotifications, loadReadNotificationIds, saveReadNotificationIds, sendBrowserNotifications } = await import('./utils/notificationManager')
      if (cancelled) return
      const tasks = useTaskStore.getState().tasks
      const habits = useStore.getState().habits
      const items = checkNotifications(tasks, habits)
      const readIds = loadReadNotificationIds()
      sendBrowserNotifications(items, readIds)
      for (const item of items) readIds.add(item.id)
      saveReadNotificationIds(readIds)
    }

    void run()
    const id = window.setInterval(() => { void run() }, 5 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceModeChangeDetail>).detail
      if (!detail) return
      const plan = planWorkspaceModeEffects(detail.prev, detail.next)
      applyWorkspaceModeSideEffects(plan)
      if (plan.navigatePomodoro) {
        goToPage('pomodoro')
        setShowCommandPalette(false)
        setShowLauncher(false)
      }
      if (plan.startPomodoro) requestPomodoroStart()
      if (plan.enableDnd) showToast('深度工作已开启：免打扰 + 番茄计时', 'success')
      else if (plan.disableDnd) showToast('已退出深度工作，免打扰已关闭', 'info')
    }
    window.addEventListener(WORKSPACE_MODE_EVENT, handler)
    return () => window.removeEventListener(WORKSPACE_MODE_EVENT, handler)
  }, [goToPage])

  // Track which pages have been visited to lazily mount them (but never unmount)
  const [visitedPages, setVisitedPages] = useState<Set<Page>>(new Set(['dashboard']))

  if (isReaderMode) {
    return <StealthReaderApp />
  }

  if (isLauncherMode) {
    return (
      <>
        <GlassFilterSvg />
        <LauncherApp />
      </>
    )
  }

  if (isMiniMode) {
    return (
      <>
        <MiniWindow onOpenQuickCapture={openQuickCapture} />
        <QuickCaptureModal isOpen={showQuickCapture} onClose={closeQuickCapture} />
        <GlobalToastHost />
      </>
    )
  }

  return (
    <div className="app-frame">
      <GlassFilterSvg />
      <div className={clsx('app-shell app-shell--float', sidebarCollapsed && 'app-shell--sidebar-collapsed')}>
        <Sidebar
          activePage={activePage}
          onPageChange={goToPage}
          onOpenLauncher={openLauncher}
          isMobileOpen={mobileSidebarOpen}
          onMobileClose={closeMobileSidebar}
        />
        <div className={clsx('app-content-column', activePage === 'mineradio' && 'app-content-column--embed')}>
          <Header
            title={pageTitles[activePage]}
            onOpenCommandPalette={toggleCommandPalette}
            onOpenMobileSidebar={openMobileSidebar}
            onNavigate={goToPage}
          />
          <main
            ref={mainRef}
            className={clsx(
              'app-main-stage page-stack',
              activePage === 'mineradio' ? 'app-main-stage--embed p-0 overflow-hidden' : 'p-4 md:p-6 overflow-auto',
            )}
          >
            <ErrorBoundary>
              {visitedPages.has('dashboard') && (
                <div className={clsx('page-layer', activePage === 'dashboard' && 'is-active')}>
                  <Suspense fallback={<DashboardSkeleton />}>
                    <DashboardPage onNavigate={goToPage} onOpenDailyBrief={openDailyBrief} onOpenQuickCapture={openQuickCapture} />
                  </Suspense>
                </div>
              )}
              {visitedPages.has('taskflow') && (
                <div className={clsx('page-layer', activePage === 'taskflow' && 'is-active')}>
                  <Suspense fallback={<TaskFlowSkeleton />}>
                    <WorkbenchPage />
                  </Suspense>
                </div>
              )}
              {visitedPages.has('pomodoro') && (
                <div className={clsx('page-layer', activePage === 'pomodoro' && 'is-active')}>
                  <Suspense fallback={<PomodoroSkeleton />}>
                    <PomodoroTimer />
                  </Suspense>
                </div>
              )}
              {visitedPages.has('habits') && (
                <div className={clsx('page-layer', activePage === 'habits' && 'is-active')}>
                  <Suspense fallback={<HabitsSkeleton />}>
                    <HabitTracker />
                  </Suspense>
                </div>
              )}
              {visitedPages.has('notes') && (
                <div className={clsx('page-layer', activePage === 'notes' && 'is-active')}>
                  <Suspense fallback={<NotesSkeleton />}>
                    <NotesList />
                  </Suspense>
                </div>
              )}
              {visitedPages.has('reminders') && (
                <div className={clsx('page-layer', activePage === 'reminders' && 'is-active')}>
                  <Suspense fallback={<NotesSkeleton />}>
                    <RemindersPage />
                  </Suspense>
                </div>
              )}
              {visitedPages.has('weather') && (
                <div className={clsx('page-layer', activePage === 'weather' && 'is-active')}>
                  <Suspense fallback={<WeatherSkeleton />}>
                    <WeatherWidget />
                  </Suspense>
                </div>
              )}
              {visitedPages.has('hotlist') && (
                <div className={clsx('page-layer', activePage === 'hotlist' && 'is-active')}>
                  <Suspense fallback={<HotlistSkeleton />}>
                    <HotlistPage />
                  </Suspense>
                </div>
              )}
              {visitedPages.has('mineradio') && (
                <div className={clsx('page-layer page-layer--embed', activePage === 'mineradio' && 'is-active')}>
                  <Suspense fallback={<DashboardSkeleton />}>
                    <MineradioPage />
                  </Suspense>
                </div>
              )}
              {visitedPages.has('settings') && (
                <div className={clsx('page-layer', activePage === 'settings' && 'is-active')}>
                  <Suspense fallback={<SettingsSkeleton />}>
                    <SettingsPage />
                  </Suspense>
                </div>
              )}
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {/* Overlays must stay outside the flex shell or they steal horizontal space */}
      <div className="app-overlay-root">
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={closeCommandPalette}
          pages={pages}
          pageTitles={pageTitles}
          onNavigate={navigateFromPalette}
          onOpenQuickCapture={openQuickCapture}
        />
        <LauncherApp
          variant="embedded"
          isOpen={showLauncher}
          onClose={closeLauncher}
          onNavigate={navigateFromLauncher}
          onOpenQuickCapture={openQuickCapture}
        />
        <QuickCaptureModal isOpen={showQuickCapture} onClose={closeQuickCapture} />
        {showDailyBrief && (
          <Suspense fallback={null}>
            <DailyBriefModal
              isOpen={showDailyBrief}
              mode={dailyBriefMode}
              onClose={closeDailyBrief}
              onNavigate={(page) => { goToPage(page); closeDailyBrief() }}
              onOpenQuickCapture={openQuickCapture}
            />
          </Suspense>
        )}
        <GlobalToastHost />
        <AmbientEffects />
        <DeepWorkTransition />
        <div className="shortcut-dock hidden md:flex" data-overlay-interactive="true" title="快捷键">
          <kbd>{acceleratorToKeys(launcherHint).join('+')}</kbd>
          <span>启动器</span>
          <span className="opacity-40">·</span>
          <kbd>{acceleratorToKeys(commandPaletteHint).join('+')}</kbd>
          <span>命令</span>
          <span className="opacity-40">·</span>
          <kbd>{acceleratorToKeys(quickCaptureHint).join('+')}</kbd>
          <span>捕获</span>
        </div>
      </div>
    </div>
  )
}

export default App
