import {
  LayoutDashboard,
  Timer,
  StickyNote,
  Cloud,
  ChevronLeft,
  Zap,
  Target,
  Settings,
  X,
  ClipboardList,
  Rocket,
  Bell,
  Radio,
  Flame,
} from 'lucide-react'
import { useMemo, memo, useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { useToday } from '../../hooks/useToday'
import { useTranslation } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { useShortcutStore } from '../../shortcuts'
import { useSyncedLocalCollection } from '../../hooks/useSyncedLocalCollection'
import { REMINDERS_KEY, type WorkspaceReminder } from '../../utils/reminders'
import { beijingYMD } from '../../utils/beijingTime'
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
  { id: 'reminders' as Page, labelKey: 'page.reminders' as TranslationKey, icon: Bell, shortcut: '6' },
  { id: 'weather' as Page, labelKey: 'page.weather' as TranslationKey, icon: Cloud, shortcut: '7' },
  { id: 'hotlist' as Page, labelKey: 'page.hotlist' as TranslationKey, icon: Flame, shortcut: '0' },
  { id: 'mineradio' as Page, labelKey: 'page.mineradio' as TranslationKey, icon: Radio, shortcut: '8' },
  { id: 'settings' as Page, labelKey: 'page.settings' as TranslationKey, icon: Settings, shortcut: '9' },
]

const SIDEBAR_MOTION_MS = 300

export default memo(function Sidebar({ activePage, onPageChange, onOpenLauncher, isMobileOpen, onMobileClose }: SidebarProps) {
  const { t } = useTranslation()
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const [sidebarAnimating, setSidebarAnimating] = useState(false)
  const prevCollapsedRef = useRef(sidebarCollapsed)

  // Drop backdrop blur while width is tweening — blur+layout is the main jank source.
  useEffect(() => {
    if (prevCollapsedRef.current === sidebarCollapsed) return
    prevCollapsedRef.current = sidebarCollapsed
    setSidebarAnimating(true)
    const id = window.setTimeout(() => setSidebarAnimating(false), SIDEBAR_MOTION_MS + 40)
    return () => {
      window.clearTimeout(id)
      setSidebarAnimating(false)
    }
  }, [sidebarCollapsed])
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
  const pageRemindersHotkey = useShortcutStore((s) => s.getAccelerator('pageReminders'))
  const pageWeatherHotkey = useShortcutStore((s) => s.getAccelerator('pageWeather'))
  const pageHotlistHotkey = useShortcutStore((s) => s.getAccelerator('pageHotlist'))
  const pageMineradioHotkey = useShortcutStore((s) => s.getAccelerator('pageMineradio'))
  const pageSettingsHotkey = useShortcutStore((s) => s.getAccelerator('pageSettings'))
  const { items: reminders } = useSyncedLocalCollection<WorkspaceReminder>(REMINDERS_KEY, [])
  const pageHotkeys: Record<string, string> = {
    dashboard: pageDashboardHotkey,
    taskflow: pageTaskflowHotkey,
    pomodoro: pagePomodoroHotkey,
    habits: pageHabitsHotkey,
    notes: pageNotesHotkey,
    reminders: pageRemindersHotkey,
    weather: pageWeatherHotkey,
    hotlist: pageHotlistHotkey,
    mineradio: pageMineradioHotkey,
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

    let overdueReminders = 0
    let todayReminders = 0
    const now = Date.now()
    for (const r of reminders) {
      if (r.done) continue
      const dueMs = Date.parse(r.dueAt)
      if (!Number.isFinite(dueMs)) continue
      if (dueMs < now) overdueReminders++
      else if (beijingYMD(new Date(dueMs)) === todayStr) todayReminders++
    }

    const pomodoroBadge = todayWork > 0 ? `${todayWork}/${dailyPomodoroGoal}` : null
    const habitsBadge = habits.length > 0 ? `${completedHabits}/${habits.length}` : null
    const notesBadge = pinnedNotes > 0 ? `${pinnedNotes} ${t('dashboard.pinned')}` : null
    const remindersBadge = overdueReminders > 0
      ? `逾期 ${overdueReminders}`
      : todayReminders > 0
        ? `今日 ${todayReminders}`
        : null

    return {
      pomodoro: pomodoroBadge,
      pomodoroGoalMet: todayWork >= dailyPomodoroGoal,
      habits: habitsBadge,
      habitsAllDone: habits.length > 0 && completedHabits >= habits.length,
      notes: notesBadge,
      reminders: remindersBadge,
      remindersOverdue: overdueReminders > 0,
      badgeMap: {
        pomodoro: pomodoroBadge,
        habits: habitsBadge,
        notes: notesBadge,
        reminders: remindersBadge,
      } as Record<string, string | null>,
    }
  }, [pomodoroSessions, habits, dailyPomodoroGoal, notes, reminders, todayStr, todayMidnightMs, tomorrowMidnightMs, t])

  const handleNavClick = (page: Page) => {
    onPageChange(page)
    onMobileClose?.()
  }

  const renderSidebarBody = (mode: 'desktop' | 'mobile') => (
    <>
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-border pr-3 md:h-16">
        {mode === 'mobile' ? (
          <>
            <button
              type="button"
              onClick={() => onMobileClose?.()}
              aria-label={t('sidebar.closeMenu')}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-lighter"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-dark">
                <Zap size={18} className="text-white" />
              </div>
              <span className="truncate font-semibold text-lg text-text">Abworkbench</span>
            </button>
            <button
              type="button"
              onClick={() => onMobileClose?.()}
              aria-label={t('sidebar.closeMenu')}
              className="ml-auto p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-lighter"
            >
              <X size={18} />
            </button>
          </>
        ) : (
          <>
            <div className="sidebar-brand-spacer" aria-hidden />
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={t('sidebar.collapseSidebar')}
              title={`${t('sidebar.collapseSidebar')} · ${toggleSidebarHotkey}`}
              className="flex min-w-0 flex-1 items-center rounded-xl py-2 pr-2 text-left transition-colors hover:bg-surface-lighter"
            >
              <span className="truncate font-semibold text-lg text-text">Abworkbench</span>
            </button>
          </>
        )}
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto" role="navigation" aria-label={t('sidebar.mainNavigation')}>
        <button
          onClick={() => {
            onOpenLauncher?.()
            onMobileClose?.()
          }}
          aria-label="打开启动器"
          title={sidebarCollapsed ? `启动器 · ${launcherHotkey} 快速启动` : undefined}
          className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-text-muted hover:text-text hover:bg-primary/10 border border-transparent hover:border-primary/25 mb-2 active:scale-[0.98]"
        >
          <div className="relative flex-shrink-0 h-5 w-5 flex items-center justify-center">
            <span className="absolute inset-[-4px] rounded-lg bg-gradient-to-br from-primary/25 to-primary/5 opacity-80 group-hover:opacity-100" />
            <Rocket
              size={20}
              className="relative text-primary transition-transform duration-200 group-hover:scale-105"
            />
          </div>
          <span className="text-sm font-medium text-text">启动器</span>
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-surface-lighter text-text-muted opacity-80 font-mono hidden lg:inline">
            {launcherHotkey}
          </kbd>
        </button>

        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activePage === item.id
          const label = t(item.labelKey)
          const pageHotkey = pageHotkeys[item.id]
          return (
            <button
              key={item.id}
              data-nav-page={item.id}
              onClick={() => handleNavClick(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={clsx(
                'nav-item-spring interactive-press relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl group',
                isActive
                  ? 'nav-item-spring--active'
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
              </div>
              <span className="text-sm font-medium">{label}</span>
              {badges.badgeMap[item.id] ? (
                <span className={clsx(
                  'ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium hidden lg:inline',
                  item.id === 'pomodoro' && badges.pomodoroGoalMet
                    ? 'bg-success/15 text-success'
                    : item.id === 'habits' && badges.habitsAllDone
                    ? 'bg-success/15 text-success'
                    : item.id === 'reminders' && badges.remindersOverdue
                    ? 'bg-danger/15 text-danger'
                    : 'bg-primary/15 text-primary'
                )}>
                  {badges.badgeMap[item.id]}
                </span>
              ) : pageHotkey ? (
                <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-surface-lighter text-text-muted opacity-60 font-mono hidden lg:inline">
                  {pageHotkey}
                </kbd>
              ) : null}
            </button>
          )
        })}
      </nav>

      {mode === 'desktop' && (
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={t('sidebar.collapseSidebar')}
            title={`${t('sidebar.collapseSidebar')} · ${toggleSidebarHotkey}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-text-muted transition-all duration-200 hover:bg-surface-lighter hover:text-text"
          >
            <ChevronLeft size={18} />
            <span className="text-sm">{t('sidebar.collapseSidebar')}</span>
            <kbd className="ml-auto hidden rounded bg-surface-lighter px-1.5 py-0.5 font-mono text-[10px] text-text-muted opacity-60 lg:inline">
              {toggleSidebarHotkey}
            </kbd>
          </button>
        </div>
      )}
    </>
  )

  return (
    <>
      {/* Desktop: fixed brand pin + panel that collapses to the right */}
      <div
        className={clsx(
          'sidebar-stack hidden lg:flex',
          sidebarCollapsed && 'sidebar-stack--collapsed',
          sidebarAnimating && 'sidebar-stack--animating',
        )}
      >
        <button
          type="button"
          className="sidebar-brand-pin"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapseSidebar')}
          title={`${sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapseSidebar')} · ${toggleSidebarHotkey}`}
        >
          <span className="sidebar-brand-pin__glyph">
            <Zap size={18} className="text-white" />
          </span>
        </button>
        <div className="sidebar-rail-clip">
          <aside
            className={clsx(
              'sidebar-glass sidebar-float sidebar-rail',
              sidebarCollapsed && 'sidebar-rail--collapsed',
            )}
            aria-hidden={sidebarCollapsed}
          >
            <div className="sidebar-rail-inner">
              {renderSidebarBody('desktop')}
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={onMobileClose}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />
          <aside
            className="sidebar-glass absolute left-3 top-3 bottom-3 w-[280px] flex flex-col animate-slide-in overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarBody('mobile')}
          </aside>
        </div>
      )}
    </>
  )
})
