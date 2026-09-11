import { Bell, Menu, X, Timer, Pause, Play, Settings, RefreshCw } from 'lucide-react'
import { useState, useEffect, useMemo, useRef, useCallback, memo, useSyncExternalStore, type CSSProperties } from 'react'
import clsx from 'clsx'
import { useStore } from '../../store'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { useTranslation } from '../../i18n'
import {
  getHotlistHeaderChrome,
  subscribeHotlistHeaderChrome,
} from '../../modules/hotlist/hotlistHeaderChrome'
import { useToday } from '../../hooks/useToday'
import { nextDateStr } from '../../modules/taskflow/dateUtils'
import { useTick } from '../../hooks/useTick'
import { durationMinutes, fmtMin, fmtHHmm } from '../../utils/format'
import type { Page } from '../../navigation/pages'
import WindowControls from './WindowControls'
import { useSyncedLocalCollection } from '../../hooks/useSyncedLocalCollection'
import {
  REMINDERS_KEY,
  type WorkspaceReminder,
  completeReminder,
  snoozeReminderDueAt,
} from '../../utils/reminders'
import { showToast } from '../../modules/taskflow/utils/toastEvent'
import {
  ACTIVE_POMODORO_EVENT,
  getActiveRemainingSec,
  pauseActivePomodoro,
  readActivePomodoro,
  resumeActivePomodoro,
  type ActivePomodoroState,
} from '../../utils/activePomodoro'
import { shouldMuteReminder } from '../../utils/focusDnd'
import { FOCUS_DND_KEY } from '../../utils/workspaceModeEffects'
import { LOCAL_DATA_CHANGE_EVENT, readLocalValue } from '../../utils/localData'
import { HEADER_QUICK_NAV_ITEMS } from '../../navigation/headerQuickNav'
import Dock, { type DockItemData } from '../common/Dock'
import { buildHeaderDockSlots } from './headerDockModel'
import { GlassCard } from '../common/GlassSurface'

const dragRegion = { WebkitAppRegion: 'drag' } as CSSProperties
const noDragRegion = { WebkitAppRegion: 'no-drag' } as CSSProperties


interface HeaderProps {
  title: string
  activePage: Page
  onOpenMobileSidebar?: () => void
  onNavigate?: (page: Page) => void
}

type NotifKind = 'summary' | 'reminder'

interface NotifItem {
  id: string
  kind: NotifKind
  text: string
  time: string
  color: string
  reminderId?: string
}

export default memo(function Header({ title, activePage, onOpenMobileSidebar, onNavigate }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [seenCount, setSeenCount] = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)
  const { t, tWith } = useTranslation()
  const pomodoroSessions = useStore((s) => s.pomodoroSessions)
  const taskFlowTasks = useTaskStore((s) => s.tasks)
  const habits = useStore((s) => s.habits)
  const notes = useStore((s) => s.notes)
  const dailyPomodoroGoal = useStore((s) => s.dailyPomodoroGoal)
  const { todayStr, todayMidnightMs, tomorrowMidnightMs } = useToday()
  const tomorrowStr = useMemo(() => nextDateStr(todayStr), [todayStr])
  const { items: reminders, update: updateReminder } = useSyncedLocalCollection<WorkspaceReminder>(REMINDERS_KEY, [])
  const nowMs = useTick(1000).getTime()
  const [activePomo, setActivePomo] = useState<ActivePomodoroState | null>(() => readActivePomodoro())
  const [dndEnabled, setDndEnabled] = useState(() => readLocalValue(FOCUS_DND_KEY) === 'true')
  const hotlistChrome = useSyncExternalStore(
    subscribeHotlistHeaderChrome,
    getHotlistHeaderChrome,
    getHotlistHeaderChrome,
  )

  useEffect(() => {
    if (!showNotifications) return
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showNotifications])

  useEffect(() => {
    const sync = (event?: Event) => {
      const detail = (event as CustomEvent<ActivePomodoroState | null> | undefined)?.detail
      setActivePomo(detail === undefined ? readActivePomodoro() : detail)
    }
    window.addEventListener(ACTIVE_POMODORO_EVENT, sync as EventListener)
    return () => window.removeEventListener(ACTIVE_POMODORO_EVENT, sync as EventListener)
  }, [])

  useEffect(() => {
    const syncDnd = () => setDndEnabled(readLocalValue(FOCUS_DND_KEY) === 'true')
    const onLocal = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key
      if (key === FOCUS_DND_KEY) syncDnd()
    }
    window.addEventListener(LOCAL_DATA_CHANGE_EVENT, onLocal as EventListener)
    return () => window.removeEventListener(LOCAL_DATA_CHANGE_EVENT, onLocal as EventListener)
  }, [])

  const dueReminders = useMemo(
    () =>
      reminders.filter((r) => {
        if (r.done || !Number.isFinite(Date.parse(r.dueAt)) || Date.parse(r.dueAt) > nowMs) return false
        return !shouldMuteReminder({
          enabled: dndEnabled,
          reminder: { title: r.title, dueAt: r.dueAt },
          now: nowMs,
        })
      }),
    [reminders, nowMs, dndEnabled],
  )

  const { items: notifications, todayWorkCount } = useMemo(() => {
    const items: NotifItem[] = []

    let overdueCount = 0
    let todayDueCount = 0
    let tomorrowDueCount = 0
    let todayCompletedCount = 0
    let lastCompletedAt = 0
    for (const task of taskFlowTasks) {
      if (task.archived) continue
      if (task.status !== 'done') {
        if (task.dueDate) {
          const due = task.dueDate.slice(0, 10)
          if (due < todayStr) overdueCount++
          else if (due === todayStr) todayDueCount++
          else if (due === tomorrowStr) tomorrowDueCount++
        }
      } else if (task.completedAt) {
        const completedAt = Date.parse(task.completedAt)
        if (completedAt < todayMidnightMs || completedAt >= tomorrowMidnightMs) continue
        todayCompletedCount++
        if (completedAt > lastCompletedAt) lastCompletedAt = completedAt
      }
    }
    if (overdueCount > 0) {
      items.push({ id: 'overdue', kind: 'summary', text: tWith('notification.overdueTasks', overdueCount), time: '', color: 'bg-danger' })
    }
    if (todayDueCount > 0) {
      items.push({ id: 'due-today', kind: 'summary', text: tWith('notification.dueToday', todayDueCount), time: '', color: 'bg-warning' })
    }
    if (tomorrowDueCount > 0) {
      items.push({ id: 'due-tomorrow', kind: 'summary', text: tWith('notification.dueTomorrow', tomorrowDueCount), time: '', color: 'bg-primary' })
    }
    if (todayCompletedCount > 0) {
      items.push({ id: 'todos', kind: 'summary', text: tWith('notification.todayCompleted', todayCompletedCount), time: fmtHHmm(lastCompletedAt), color: 'bg-success' })
    }

    let todayWorkCount = 0
    let totalWorkMin = 0
    let lastWorkEndedAt = 0
    for (const s of pomodoroSessions) {
      if (s.type === 'work' && s.completed && s.startedAt >= todayMidnightMs && s.startedAt < tomorrowMidnightMs) {
        todayWorkCount++
        totalWorkMin += durationMinutes(s.startedAt, s.endedAt)
        if (s.endedAt > lastWorkEndedAt) lastWorkEndedAt = s.endedAt
      }
    }
    if (todayWorkCount > 0) {
      items.push({
        id: 'pomodoro',
        kind: 'summary',
        text: tWith('notification.pomodoroDone', todayWorkCount, fmtMin(totalWorkMin)),
        time: fmtHHmm(lastWorkEndedAt),
        color: 'bg-primary',
      })
      if (todayWorkCount >= dailyPomodoroGoal) {
        items.push({ id: 'goal', kind: 'summary', text: tWith('notification.goalReached', todayWorkCount), time: '', color: 'bg-success' })
      }
    }

    let completedHabits = 0
    for (const h of habits) { if (h.completedDates.includes(todayStr)) completedHabits++ }
    if (completedHabits > 0) {
      items.push({ id: 'habits', kind: 'summary', text: tWith('notification.habitCheckin', completedHabits, habits.length), time: '', color: 'bg-warning' })
    }
    const incompleteHabits = habits.length - completedHabits
    if (incompleteHabits > 0 && habits.length > 0 && new Date().getHours() >= 18) {
      items.push({ id: 'habits-reminder', kind: 'summary', text: tWith('notification.habitsIncomplete', incompleteHabits), time: '', color: 'bg-amber-400' })
    }

    for (const r of dueReminders.slice(0, 5)) {
      items.unshift({
        id: `reminder-${r.id}`,
        kind: 'reminder',
        text: r.title,
        time: '',
        color: 'bg-amber-400',
        reminderId: r.id,
      })
    }

    return { items, todayWorkCount }
  }, [pomodoroSessions, taskFlowTasks, habits, dailyPomodoroGoal, todayStr, tomorrowStr, todayMidnightMs, tomorrowMidnightMs, tWith, dueReminders])

  const hasNotifications = notifications.length > 0
  const hasUnread = hasNotifications && notifications.length !== seenCount

  const progressRing = useMemo(() => {
    if (todayWorkCount <= 0) return null
    const progress = Math.min(todayWorkCount / dailyPomodoroGoal, 1)
    const r = 8
    const c = 2 * Math.PI * r
    const offset = c * (1 - progress)
    return { r, c, offset }
  }, [todayWorkCount, dailyPomodoroGoal])

  const quickNavBadges = useMemo(() => {
    let todayWork = 0
    for (const s of pomodoroSessions) {
      if (s.type === 'work' && s.completed && s.startedAt >= todayMidnightMs && s.startedAt < tomorrowMidnightMs) todayWork++
    }
    let completedHabits = 0
    for (const h of habits) {
      if (h.completedDates.includes(todayStr)) completedHabits++
    }
    let pinnedNotes = 0
    for (const n of notes) {
      if (n.pinned) pinnedNotes++
    }
    return {
      pomodoro: todayWork > 0 ? `${todayWork}/${dailyPomodoroGoal}` : null,
      pomodoroGoalMet: todayWork >= dailyPomodoroGoal,
      habits: habits.length > 0 ? `${completedHabits}/${habits.length}` : null,
      habitsAllDone: habits.length > 0 && completedHabits >= habits.length,
      notes: pinnedNotes > 0 ? String(pinnedNotes) : null,
    }
  }, [pomodoroSessions, habits, notes, dailyPomodoroGoal, todayStr, todayMidnightMs, tomorrowMidnightMs])


  const headerDockItems = useMemo((): DockItemData[] => {
    const slots = buildHeaderDockSlots({
      activePage,
      labels: {
        pomodoro: t('page.pomodoro'),
        habits: t('page.habits'),
        notes: t('page.notes'),
        weather: t('page.weather'),
      },
      badges: quickNavBadges,
    })

    const iconByNavId = Object.fromEntries(
      HEADER_QUICK_NAV_ITEMS.map((item) => [item.id, item.icon]),
    ) as Record<(typeof HEADER_QUICK_NAV_ITEMS)[number]['id'], (typeof HEADER_QUICK_NAV_ITEMS)[number]['icon']>

    const navItems = slots.map((slot) => {
      const Icon = iconByNavId[slot.id]
      const badge = slot.badgeText ? (
        <span className={clsx('dock-badge', slot.badgeTone === 'success' && 'dock-badge--success')}>
          {slot.badgeText.length > 3 ? '•' : slot.badgeText}
        </span>
      ) : null

      return {
        icon: (
          <>
            <Icon size={18} />
            {badge}
          </>
        ),
        label: slot.label,
        onClick: () => onNavigate?.(slot.id),
        className: slot.active ? 'dock-item--active' : undefined,
      }
    })

    const notifBadge =
      hasUnread && hasNotifications ? (
        <span className="dock-badge dock-badge--danger">
          {notifications.length > 99 ? '99+' : notifications.length}
        </span>
      ) : null

    return [
      ...navItems,
      {
        icon: (
          <>
            <Bell size={18} />
            {notifBadge}
          </>
        ),
        label: t('header.notifications'),
        onClick: () => {
          setShowNotifications((open) => {
            if (!open) setSeenCount(notifications.length)
            return !open
          })
        },
        className: showNotifications ? 'dock-item--active' : undefined,
      },
    ]
  }, [
    activePage,
    hasNotifications,
    hasUnread,
    notifications.length,
    onNavigate,
    quickNavBadges,
    showNotifications,
    t,
  ])

  const activeRemaining = getActiveRemainingSec(activePomo, nowMs)
  const activeLabel = activePomo
    ? `${Math.floor(activeRemaining / 60)}:${String(activeRemaining % 60).padStart(2, '0')}`
    : null

  const toggleActivePomo = useCallback(() => {
    if (!activePomo) return
    if (activePomo.targetEnd) pauseActivePomodoro(activePomo.source)
    else resumeActivePomodoro(activePomo.source)
  }, [activePomo])

  const onCompleteReminder = useCallback((id: string) => {
    const reminder = reminders.find((r) => r.id === id)
    if (!reminder) return
    const snapshot = { dueAt: reminder.dueAt, done: reminder.done }
    const patch = completeReminder(reminder)
    updateReminder(id, patch)
    showToast(patch.done ? '提醒已完成' : '已滚到下一期', 'success', {
      label: '撤销',
      onClick: () => updateReminder(id, snapshot),
    }, 8_000)
  }, [reminders, updateReminder])

  const onSnoozeReminder = useCallback((id: string) => {
    const reminder = reminders.find((r) => r.id === id)
    if (!reminder) return
    const prev = reminder.dueAt
    updateReminder(id, { dueAt: snoozeReminderDueAt(30), done: false })
    showToast('已延后 30 分钟', 'info', {
      label: '撤销',
      onClick: () => updateReminder(id, { dueAt: prev, done: false }),
    }, 8_000)
  }, [reminders, updateReminder])

  return (
    <header
      className="header-glass header-float grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-4 md:h-16 md:px-5"
      style={dragRegion}
    >
      <div className="flex items-center gap-3 justify-self-start" style={noDragRegion}>
        <button
          onClick={onOpenMobileSidebar}
          aria-label={t('header.openMenu')}
          className="p-2 icon-glass-btn text-text-muted hover:text-text lg:hidden"
        >
          <Menu size={20} />
        </button>

        <h1 key={title} className="header-title-swap text-lg md:text-xl font-semibold text-text">{title}</h1>

        {activePage === 'hotlist' && hotlistChrome.onRefresh ? (
          <button
            type="button"
            className="hotlist-header-refresh interactive-glass dashboard-chip inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-primary disabled:opacity-50"
            disabled={hotlistChrome.disabled}
            onClick={() => hotlistChrome.onRefresh?.()}
            aria-label={hotlistChrome.label}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${hotlistChrome.refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{hotlistChrome.label}</span>
          </button>
        ) : null}

        {dndEnabled && (
          <span className="hidden sm:inline-flex items-center rounded-lg border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
            防打扰
          </span>
        )}

        {activePomo && activeLabel && (
          <button
            type="button"
            onClick={() => onNavigate?.('pomodoro')}
            className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
            title="打开番茄钟"
          >
            <Timer size={14} className={activePomo.targetEnd ? 'animate-pulse' : ''} />
            <span className="font-mono">{activeLabel}</span>
            <span
              role="button"
              tabIndex={0}
              className="rounded-lg p-0.5 hover:bg-primary/20"
              onClick={(e) => { e.stopPropagation(); toggleActivePomo() }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); toggleActivePomo() } }}
              aria-label={activePomo.targetEnd ? '暂停' : '继续'}
            >
              {activePomo.targetEnd ? <Pause size={12} /> : <Play size={12} />}
            </span>
          </button>
        )}
      </div>

      <div className="relative flex items-center justify-self-center gap-1.5" style={noDragRegion} ref={notifRef}>
        <Dock
          className="header-dock"
          items={headerDockItems}
          panelHeight={40}
          baseItemSize={34}
          magnification={48}
          distance={140}
          dockHeight={40}
          growOnHover={false}
          labelPlacement="below"
          panelAriaLabel="快捷导航"
        />

        {showNotifications && (
            <div className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 animate-fade-in">
            <GlassCard borderRadius={22} className="dashboard-panel p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="shrink-0 text-sm font-medium text-text">{t('header.notifications')}</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifications(false)
                    onNavigate?.('reminders')
                  }}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-surface-lighter hover:text-text"
                >
                  <Settings size={13} aria-hidden="true" />
                  <span>{t('header.manageReminders')}</span>
                </button>
                <button
                  onClick={() => setShowNotifications(false)}
                  aria-label={t('header.closeNotifications')}
                  className="shrink-0 text-text-muted hover:text-text"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {notifications.length > 0 ? notifications.map((n) => (
                  <div
                    key={n.id}
                    className="interactive-glass rounded-xl p-2"
                  >
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 text-left hover:opacity-90"
                      onClick={() => {
                        setShowNotifications(false)
                        if (n.kind === 'reminder') {
                          onNavigate?.('reminders')
                        } else if (n.id === 'habits-reminder' || n.id === 'habits') {
                          onNavigate?.('habits')
                        } else if (n.id === 'overdue' || n.id === 'todos' || n.id === 'due-today' || n.id === 'due-tomorrow') {
                          onNavigate?.('taskflow')
                        } else if (n.id === 'pomodoro' || n.id === 'goal') {
                          onNavigate?.('pomodoro')
                        }
                      }}
                    >
                      <div className={`w-2 h-2 rounded-full ${n.color} mt-1.5 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text">{n.text}</p>
                        {n.time && <p className="text-[10px] text-text-muted mt-0.5">{n.time}</p>}
                      </div>
                    </button>
                    {n.kind === 'reminder' && n.reminderId && (
                      <div className="mt-1.5 flex gap-1.5 pl-4">
                        <button
                          type="button"
                          className="rounded-lg bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success hover:bg-success/25"
                          onClick={() => onCompleteReminder(n.reminderId!)}
                        >
                          完成
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-muted hover:bg-surface-lighter"
                          onClick={() => onSnoozeReminder(n.reminderId!)}
                        >
                          +30分
                        </button>
                      </div>
                    )}
                  </div>
                )) : (
                  <p className="text-xs text-text-muted text-center py-2">{t('header.noNotifications')}</p>
                )}
              </div>
            </GlassCard>
            </div>
          )}
        </div>

      <div className="flex items-center justify-self-end gap-2 md:gap-3" style={noDragRegion}>
        {progressRing && (
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 bg-primary/10 rounded-lg">
              <div className="relative w-5 h-5">
                <svg viewBox="0 0 20 20" className="w-full h-full -rotate-90">
                  <circle cx="10" cy="10" r={progressRing.r} fill="none" stroke="var(--color-primary)" strokeWidth="2" opacity="0.2" />
                  <circle cx="10" cy="10" r={progressRing.r} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeDasharray={progressRing.c} strokeDashoffset={progressRing.offset} strokeLinecap="round" className="transition-all duration-500" />
                </svg>
              </div>
              <span className="text-xs font-medium text-primary">{todayWorkCount}/{dailyPomodoroGoal}</span>
            </div>
        )}


        <div className="ml-1 border-l border-border/60 pl-2">
          <WindowControls />
        </div>
      </div>
    </header>
  )
})
