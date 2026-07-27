import {
  LayoutDashboard,
  Timer,
  StickyNote,
  Cloud,
  ChevronLeft,
  ChevronRight,
  Zap,
  Target,
  Settings,
  X,
  ClipboardList,
  Rocket,
} from 'lucide-react'
import { useMemo, memo } from 'react'
import { useStore } from '../../store'
import { useToday } from '../../hooks/useToday'
import { useTranslation } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { useShortcutStore } from '../../shortcuts'
import clsx from 'clsx'
import type { Page } from '../../navigation/pages'

export type { Page } from '../../navigation/pages'

interface SidebarProps {
  activePage: Page
  onPageChange: (page: Page) => void
  onOpenLauncher?: () => void
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

const menuItems = [
  { id: 'dashboard' as Page, labelKey: 'page.dashboard' as TranslationKey, icon: LayoutDashboard, shortcut: '1' },
  { id: 'taskflow' as Page, labelKey: 'page.taskflow' as TranslationKey, icon: ClipboardList, shortcut: '2' },
  { id: 'pomodoro' as Page, labelKey: 'page.pomodoro' as TranslationKey, icon: Timer, shortcut: '3' },
  { id: 'habits' as Page, labelKey: 'page.habits' as TranslationKey, icon: Target, shortcut: '4' },
  { id: 'notes' as Page, labelKey: 'page.notes' as TranslationKey, icon: StickyNote, shortcut: '5' },
  { id: 'weather' as Page, labelKey: 'page.weather' as TranslationKey, icon: Cloud, shortcut: '6' },
  { id: 'settings' as Page, labelKey: 'page.settings' as TranslationKey, icon: Settings, shortcut: '7' },
]

export default memo(function Sidebar({ activePage, onPageChange, onOpenLauncher, isMobileOpen, onMobileClose }: SidebarProps) {
  const { t } = useTranslation()
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const pomodoroSessions = useStore((s) => s.pomodoroSessions)
  const habits = useStore((s) => s.habits)
  const dailyPomodoroGoal = useStore((s) => s.dailyPomodoroGoal)
  const notes = useStore((s) => s.notes)
  const { todayStr, todayMidnightMs, tomorrowMidnightMs } = useToday()
  const launcherHotkey = useShortcutStore((s) => s.getAccelerator('launcher'))
  const toggleSidebarHotkey = useShortcutStore((s) => s.getAccelerator('toggleSidebar'))
  const pageDashboardHotkey = useShortcutStore((s) => s.getAccelerator('pageDashboard'))
  const pageTaskflowHotkey = useShortcutStore((s) => s.getAccelerator('pageTaskflow'))
  const pagePomodoroHotkey = useShortcutStore((s) => s.getAccelerator('pagePomodoro'))
  const pageHabitsHotkey = useShortcutStore((s) => s.getAccelerator('pageHabits'))
  const pageNotesHotkey = useShortcutStore((s) => s.getAccelerator('pageNotes'))
  const pageWeatherHotkey = useShortcutStore((s) => s.getAccelerator('pageWeather'))
  const pageSettingsHotkey = useShortcutStore((s) => s.getAccelerator('pageSettings'))
  const pageHotkeys: Record<string, string> = {
    dashboard: pageDashboardHotkey,
    taskflow: pageTaskflowHotkey,
    pomodoro: pagePomodoroHotkey,
    habits: pageHabitsHotkey,
    notes: pageNotesHotkey,
    weather: pageWeatherHotkey,
    settings: pageSettingsHotkey,
  }

  const badges = useMemo(() => {

    let todayWork = 0
    for (const s of pomodoroSessions) {
      if (s.type === 'work' && s.completed && s.startedAt >= todayMidnightMs && s.startedAt < tomorrowMidnightMs) todayWork++
    }

    let completedHabits = 0
    for (const h of habits) { if (h.completedDates.includes(todayStr)) completedHabits++ }

    let pinnedNotes = 0
    for (const n of notes) { if (n.pinned) pinnedNotes++ }

    const pomodoroBadge = todayWork > 0 ? `${todayWork}/${dailyPomodoroGoal}` : null
    const habitsBadge = habits.length > 0 ? `${completedHabits}/${habits.length}` : null
    const notesBadge = pinnedNotes > 0 ? `${pinnedNotes} ${t('dashboard.pinned')}` : null

    return {
      pomodoro: pomodoroBadge,
      pomodoroGoalMet: todayWork >= dailyPomodoroGoal,
      habits: habitsBadge,
      habitsAllDone: habits.length > 0 && completedHabits >= habits.length,
      notes: notesBadge,
      badgeMap: { pomodoro: pomodoroBadge, habits: habitsBadge, notes: notesBadge } as Record<string, string | null>,
    }
  }, [pomodoroSessions, habits, dailyPomodoroGoal, notes, todayStr, todayMidnightMs, tomorrowMidnightMs, t])

  const handleNavClick = (page: Page) => {
    onPageChange(page)
    onMobileClose?.()
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0">
          <Zap size={18} className="text-white" />
        </div>
        {!sidebarCollapsed && (
          <span className="font-semibold text-lg text-text animate-fade-in">
            Abworkbench
          </span>
        )}
        {/* Mobile close button */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            aria-label={t('sidebar.closeMenu')}
            className="ml-auto p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-lighter lg:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto" role="navigation" aria-label={t('sidebar.mainNavigation')}>
        {/* Launcher entry in left nav */}
        <button
          onClick={() => {
            onOpenLauncher?.()
            onMobileClose?.()
          }}
          aria-label="打开启动器"
          title={sidebarCollapsed ? `启动器 · ${launcherHotkey} 快速启动` : undefined}
          className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-text-muted hover:text-text hover:bg-primary/10 border border-transparent hover:border-primary/25 mb-2"
        >
          <div className="relative flex-shrink-0 h-5 w-5 flex items-center justify-center">
            <span className="absolute inset-[-4px] rounded-lg bg-gradient-to-br from-primary/25 to-primary/5 opacity-80 group-hover:opacity-100" />
            <Rocket
              size={20}
              className="relative text-primary transition-transform duration-200 group-hover:scale-105"
            />
          </div>
          {!sidebarCollapsed && (
            <span className="text-sm font-medium animate-fade-in text-text">启动器</span>
          )}
          {!sidebarCollapsed && (
            <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-surface-lighter text-text-muted opacity-80 font-mono hidden lg:inline">
              {launcherHotkey}
            </kbd>
          )}
        </button>

        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activePage === item.id
          const label = t(item.labelKey)
          const pageHotkey = pageHotkeys[item.id]
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              aria-current={isActive ? 'page' : undefined}
              title={sidebarCollapsed
                ? `${label}${badges.badgeMap[item.id] ? ` (${badges.badgeMap[item.id]})` : ''}${pageHotkey ? ` · ${pageHotkey}` : ''}`
                : undefined
              }
              className={clsx(
                'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-text-muted hover:text-text hover:bg-surface-lighter'
              )}
            >
              <div className="relative flex-shrink-0">
                <Icon
                  size={20}
                  className={clsx(
                    'transition-transform duration-200',
                    isActive && 'scale-110',
                    !isActive && 'group-hover:scale-105'
                  )}
                />
                {sidebarCollapsed && badges.badgeMap[item.id] && (
                  <span className={clsx(
                    'absolute -top-1 -right-1 w-2 h-2 rounded-full',
                    item.id === 'pomodoro' && badges.pomodoroGoalMet ? 'bg-green-500' :
                    item.id === 'habits' && badges.habitsAllDone ? 'bg-green-500' :
                    'bg-primary'
                  )} />
                )}
              </div>
              {!sidebarCollapsed && (
                <span className="text-sm font-medium animate-fade-in">
                  {label}
                </span>
              )}
              {!sidebarCollapsed && badges.badgeMap[item.id] && (
                <span className={clsx(
                  'ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium hidden lg:inline',
                  item.id === 'pomodoro' && badges.pomodoroGoalMet
                    ? 'bg-green-500/15 text-green-500'
                    : item.id === 'habits' && badges.habitsAllDone
                    ? 'bg-green-500/15 text-green-500'
                    : 'bg-primary/15 text-primary'
                )}>
                  {badges.badgeMap[item.id]}
                </span>
              )}
              {!sidebarCollapsed && !badges.badgeMap[item.id] && pageHotkey && (
                <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-surface-lighter text-text-muted opacity-60 font-mono hidden lg:inline">
                  {pageHotkey}
                </kbd>
              )}
              {isActive && (
                <div className="absolute left-0 w-[3px] h-6 bg-primary rounded-r-full" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Collapse Toggle - desktop only */}
      {!onMobileClose && (
        <div className="p-3 border-t border-border">
          <button
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapseSidebar')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-text-muted hover:text-text hover:bg-surface-lighter transition-all duration-200"
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!sidebarCollapsed && (
              <>
                <span className="text-sm">{t('sidebar.collapseSidebar')}</span>
                <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-surface-lighter text-text-muted opacity-60 font-mono hidden lg:inline">
                  {toggleSidebarHotkey}
                </kbd>
              </>
            )}
          </button>
        </div>
      )}
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          'h-screen sticky top-0 flex-col border-r border-border bg-surface-light transition-all duration-300 hidden lg:flex',
          sidebarCollapsed ? 'w-[72px]' : 'w-[240px]'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={onMobileClose}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />
          <aside
            className="absolute left-0 top-0 h-full w-[280px] bg-surface-light border-r border-border flex flex-col animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
})
