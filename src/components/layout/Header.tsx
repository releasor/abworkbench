import { Search, Bell, Menu, X, Moon, Sun, Timer, Pause, Play } from 'lucide-react'
import { useState, useEffect, useMemo, useRef, useCallback, memo, type CSSProperties } from 'react'
import { useStore } from '../../store'
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore'
import { useTranslation } from '../../i18n'
import { useToday } from '../../hooks/useToday'
import { nextDateStr } from '../../modules/taskflow/dateUtils'
import { useTick } from '../../hooks/useTick'
import { durationMinutes, fmtMin, dayNumToFullLabel, fmtHHmm } from '../../utils/format'
import { useShortcutStore } from '../../shortcuts'
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

const dragRegion = { WebkitAppRegion: 'drag' } as CSSProperties
const noDragRegion = { WebkitAppRegion: 'no-drag' } as CSSProperties

const LiveClock = memo(function LiveClock() {
  const { t } = useTranslation()
  const time = useTick(1000)
  const dayNum = Math.floor(time.getTime() / 86400000)
  const weekdayNames = t('calendar.dayNames') as unknown as string[]
  const weekday = weekdayNames[(dayNum + 4) % 7]
  const dateLabel = dayNumToFullLabel(dayNum)
  const h = String(time.getHours()).padStart(2, '0')
  const m = String(time.getMinutes()).padStart(2, '0')
  const s = String(time.getSeconds()).padStart(2, '0')
  return (
    <>
      <div className="text-sm text-text-muted hidden sm:block">
        {dateLabel} {weekday}
      </div>
      <div className="hidden md:block text-sm font-mono text-text-muted px-3 py-1.5 bg-surface rounded-lg">
        {h}:{m}:{s}
      </div>
    </>
  )
})

interface HeaderProps {
  title: string
  onOpenCommandPalette?: () => void
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

export default memo(function Header({ title, onOpenCommandPalette, onOpenMobileSidebar, onNavigate }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [seenCount, setSeenCount] = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)
  const { t, tWith } = useTranslation()
  const themeMode = useStore((s) => s.themeMode)
  const toggleThemeMode = useStore((s) => s.toggleThemeMode)
  const pomodoroSessions = useStore((s) => s.pomodoroSessions)
  const taskFlowTasks = useTaskStore((s) => s.tasks)
  const habits = useStore((s) => s.habits)
  const dailyPomodoroGoal = useStore((s) => s.dailyPomodoroGoal)
  const commandPaletteHotkey = useShortcutStore((s) => s.getAccelerator('commandPalette'))
  const { todayStr, todayMidnightMs, tomorrowMidnightMs } = useToday()
  const tomorrowStr = useMemo(() => nextDateStr(todayStr), [todayStr])
  const { items: reminders, update: updateReminder } = useSyncedLocalCollection<WorkspaceReminder>(REMINDERS_KEY, [])
  const nowMs = useTick(1000).getTime()
  const [activePomo, setActivePomo] = useState<ActivePomodoroState | null>(() => readActivePomodoro())
  const [dndEnabled, setDndEnabled] = useState(() => readLocalValue(FOCUS_DND_KEY) === 'true')

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
      className="header-glass header-float flex h-14 shrink-0 items-center justify-between px-4 md:h-16 md:px-5"
      style={dragRegion}
    >
      <div className="flex items-center gap-3" style={noDragRegion}>
        <button
          onClick={onOpenMobileSidebar}
          aria-label={t('header.openMenu')}
          className="p-2 icon-glass-btn text-text-muted hover:text-text lg:hidden"
        >
          <Menu size={20} />
        </button>

        <h1 key={title} className="header-title-swap text-lg md:text-xl font-semibold text-text">{title}</h1>

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

      <div className="flex items-center gap-2 md:gap-3" style={noDragRegion}>
        <button
          onClick={toggleThemeMode}
          aria-label={themeMode === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
          title={themeMode === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
          className="p-2 icon-glass-btn text-text-muted hover:text-text"
        >
          {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          onClick={onOpenCommandPalette}
          className="search-pill relative hidden sm:flex items-center gap-2 pl-9 pr-12 py-2 w-48 md:w-64 text-sm cursor-pointer transition-colors"
        >
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <span className="text-text-muted">{t('header.searchPlaceholder')}</span>
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] text-text-muted rounded-md border border-border/80 bg-black/20">
            {commandPaletteHotkey}
          </kbd>
        </button>

        <button
          onClick={onOpenCommandPalette}
          aria-label={t('header.search')}
          className="p-2 icon-glass-btn text-text-muted hover:text-text sm:hidden"
        >
          <Search size={18} />
        </button>

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

        <LiveClock />

        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications)
              if (!showNotifications) setSeenCount(notifications.length)
            }}
            aria-expanded={showNotifications}
            className="p-2 icon-glass-btn text-text-muted hover:text-text relative"
            aria-label={t('header.notifications')}
          >
            <Bell size={18} />
            {hasUnread && hasNotifications && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center px-1 text-[10px] font-bold text-white bg-danger rounded-full" aria-live="polite">
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-72 glass-card p-3 shadow-xl z-50 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text">{t('header.notifications')}</span>
                <button
                  onClick={() => setShowNotifications(false)}
                  aria-label={t('header.closeNotifications')}
                  className="text-text-muted hover:text-text"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {notifications.length > 0 ? notifications.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-lg bg-surface-lighter/50 p-2"
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
            </div>
          )}
        </div>

        <div className="ml-1 pl-2 border-l border-border/60">
          <WindowControls />
        </div>
      </div>
    </header>
  )
})
