import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { Plus, Sparkles, Target, BarChart3 } from 'lucide-react'
import type { Habit, HabitSchedule } from '../../store'
import { useStore } from '../../store'
import { eventMatchesShortcut, useShortcutStore } from '../../shortcuts'
import { playHabitSound } from '../../utils/audio'
import { showToast } from '../../modules/taskflow/utils/toastEvent'
import { useToday } from '../../hooks/useToday'
import { useCurrentHour } from '../../hooks/useCurrentHour'
import { HABIT_COLORS, HABIT_ICONS, HABIT_TEMPLATES } from './habitConstants'
import { HabitCard } from './HabitCard'
import { HabitForm } from './HabitForm'
import { HabitStats } from './HabitStats'
import { createDefaultSchedule } from './HabitScheduleSelector'
import { getHabitProgress } from './habitSchedule'
import {
  getHabitComputedStats,
  getWeekDayNums,
  getWeekGridDays,
} from './habitUtils'
import { dayNumToDateStr } from '../../utils/format'
import PanelSwitch from '../common/PanelSwitch'
import { smoothNavigate } from '../../utils/smoothNavigate'

const HabitAnalytics = lazy(() => import('./HabitAnalytics'))

export default function HabitTracker() {
  const habits = useStore((state) => state.habits)
  const addHabit = useStore((state) => state.addHabit)
  const checkInHabit = useStore((state) => state.checkInHabit)
  const undoHabitCheckIn = useStore((state) => state.undoHabitCheckIn)
  const deleteHabit = useStore((state) => state.deleteHabit)
  const updateHabit = useStore((state) => state.updateHabit)
  const lastDeletedHabitRef = useRef<Habit | null>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const shortcutOverrides = useShortcutStore((s) => s.overrides)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null)
  const [monthNav, setMonthNav] = useState<{ y: number; m: number } | null>(null)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState(HABIT_ICONS[0])
  const [newColor, setNewColor] = useState(HABIT_COLORS[0])
  const [newSchedule, setNewSchedule] = useState<HabitSchedule>(createDefaultSchedule)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const { todayStr, todayMidnightMs } = useToday()
  const todayDayNum = Math.floor(todayMidnightMs / 86400000)
  const hour = useCurrentHour()

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (eventMatchesShortcut('habitsAdd', event)) {
        event.preventDefault()
        setShowAddForm(true)
        setTimeout(() => nameInputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcutOverrides])

  const weekDayNums = useMemo(() => getWeekDayNums(todayDayNum), [todayDayNum])
  const weekGridDays = useMemo(() => getWeekGridDays(weekDayNums, todayDayNum), [weekDayNums, todayDayNum])
  const thisWeekDateStrs = useMemo(() => weekDayNums.map(dayNumToDateStr), [weekDayNums])
  const habitDateSets = useMemo(() => habits.map((habit) => new Set(habit.completedDates)), [habits])

  const { bodyStats, streakMap, weekCompletions, perHabitStats } = useMemo(
    () => getHabitComputedStats(habits, habitDateSets, todayStr, thisWeekDateStrs),
    [habits, habitDateSets, todayStr, thisWeekDateStrs],
  )

  const resetForm = () => {
    setNewName('')
    setNewIcon(HABIT_ICONS[0])
    setNewColor(HABIT_COLORS[0])
    setNewSchedule(createDefaultSchedule())
  }

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) return
    addHabit(name, newIcon, newColor, newSchedule)
    resetForm()
    setShowAddForm(false)
  }

  const startEdit = (habit: Habit) => {
    setEditingId(habit.id)
    setNewName(habit.name)
    setNewIcon(habit.icon)
    setNewColor(habit.color)
    setNewSchedule(habit.schedule)
  }

  const saveEdit = () => {
    const name = newName.trim()
    if (editingId && name) {
      updateHabit(editingId, { name, icon: newIcon, color: newColor, schedule: newSchedule })
    }
    setEditingId(null)
    resetForm()
  }

  const handleToggleToday = (habitId: string) => {
    const habit = habits.find((item) => item.id === habitId)
    if (!habit) return
    const progress = getHabitProgress(habit, todayStr)
    const shouldUndo = progress.met || (progress.count > 0 && !progress.canCheckIn)

    if (!progress.canCheckIn && progress.count === 0) {
      showToast('当前不在打卡时段内', 'info')
      return
    }

    try {
      playHabitSound(!shouldUndo)
    } catch {
      // Sound playback is non-critical, ignore errors
    }

    if (shouldUndo) {
      undoHabitCheckIn(habitId, todayStr)
      const nextCount = Math.max(0, progress.count - 1)
      showToast(
        nextCount > 0 ? `已撤销 1 次：${habit.name}（${nextCount}/${progress.target}）` : `已取消打卡：${habit.name}`,
        'info',
        {
          label: '恢复',
          onClick: () => checkInHabit(habitId),
        },
      )
      return
    }

    checkInHabit(habitId)
    const nextCount = progress.count + 1
    const nextMet = nextCount >= progress.target
    showToast(
      nextMet ? `今日目标达成：${habit.name}` : `已打卡：${habit.name}（${nextCount}/${progress.target}）`,
      'success',
      {
        label: '撤销',
        onClick: () => undoHabitCheckIn(habitId, todayStr),
      },
    )
  }

  const restoreDeletedHabit = useCallback(() => {
    const habit = lastDeletedHabitRef.current
    if (!habit) return false
    lastDeletedHabitRef.current = null
    useStore.setState((s) => ({
      habits: [habit, ...s.habits.filter((h) => h.id !== habit.id)],
    }))
    showToast('已恢复打卡项', 'success')
    return true
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (!lastDeletedHabitRef.current) return
      e.preventDefault()
      restoreDeletedHabit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [restoreDeletedHabit])

  useEffect(() => {
    const applyFocus = () => {
      let id = ''
      try {
        id = sessionStorage.getItem('abworkbench-focus-habit') || ''
        if (id) sessionStorage.removeItem('abworkbench-focus-habit')
      } catch {
        return
      }
      if (!id) return
      queueMicrotask(() => {
        const el = document.querySelector(`[data-habit-id="${CSS.escape(id)}"]`) as HTMLElement | null
        if (!el) return
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el.classList.add('ring-2', 'ring-primary')
        window.setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2200)
      })
    }
    queueMicrotask(applyFocus)
  }, [habits])

  const toggleMonthExpand = (habitId: string) => {
    if (expandedMonthId === habitId) {
      setExpandedMonthId(null)
      setMonthNav(null)
      return
    }

    const now = new Date()
    setExpandedMonthId(habitId)
    setMonthNav({ y: now.getFullYear(), m: now.getMonth() })
  }

  const closeAddForm = () => {
    setShowAddForm(false)
    resetForm()
  }

  const closeEditForm = () => {
    setEditingId(null)
    resetForm()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Analytics toggle */}
      <div className="flex items-center gap-2" role="tablist" aria-label="习惯视图">
        <button
          role="tab"
          aria-selected={!showAnalytics}
          onClick={() => smoothNavigate(() => setShowAnalytics(false))}
          className={`segment-tab rounded-xl px-3 py-1.5 text-xs font-medium ${!showAnalytics ? 'bg-primary text-on-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          打卡
        </button>
        <button
          role="tab"
          aria-selected={showAnalytics}
          onClick={() => smoothNavigate(() => setShowAnalytics(true))}
          className={`segment-tab inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium ${showAnalytics ? 'bg-primary text-on-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          <BarChart3 size={12} />
          分析
        </button>
      </div>

      <PanelSwitch panelKey={showAnalytics ? 'analytics' : 'checkin'}>
      {showAnalytics ? (
        <Suspense fallback={<div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>}>
          <HabitAnalytics habits={habits} />
        </Suspense>
      ) : (
        <div className="flex flex-col gap-5">
          <HabitStats
            habits={habits}
            habitDateSets={habitDateSets}
            todayStr={todayStr}
            stats={bodyStats}
            weekCompletions={weekCompletions}
          />

      {showAddForm ? (
        <HabitForm
          title="新增每日打卡"
          submitLabel="添加打卡项"
          name={newName}
          icon={newIcon}
          color={newColor}
          schedule={newSchedule}
          inputRef={nameInputRef}
          onNameChange={setNewName}
          onIconChange={setNewIcon}
          onColorChange={setNewColor}
          onScheduleChange={setNewSchedule}
          onSubmit={handleAdd}
          onClose={closeAddForm}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="group flex w-full items-center justify-between rounded-[26px] border border-dashed border-primary/45 bg-primary/10 px-5 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary/20"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/25">
              <Plus size={20} />
            </span>
            <span>
              <span className="block text-base font-semibold text-text">新增每日打卡</span>
              <span className="text-sm text-text-muted">按下 N 快速创建，坚持从一个小动作开始。</span>
            </span>
          </span>
          <kbd className="hidden rounded-xl border border-border bg-background/60 px-2.5 py-1 text-xs font-mono text-text-muted sm:block">N</kbd>
        </button>
      )}

      {habits.length === 0 ? (
        <div className="overflow-hidden rounded-[32px] border border-border bg-surface/75 p-7 text-center shadow-xl shadow-black/10">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <Target size={34} />
          </div>
          <h3 className="text-xl font-semibold text-text">还没有每日打卡</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-text-muted">
            先选一个容易完成的动作，连续做几天，系统会帮你记录节奏和连续天数。
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {HABIT_TEMPLATES.map((template) => (
              <button
                key={template.name}
                type="button"
                onClick={() => addHabit(template.name, template.icon, template.color, template.schedule)}
                aria-label={`创建习惯: ${template.name}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-background/50 px-4 py-3 text-sm text-text-muted transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-text"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
                  style={{ backgroundColor: `${template.color}22` }}
                >
                  {template.icon}
                </span>
                {template.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
            <Sparkles size={16} className="text-primary" />
            今日打卡清单
          </div>
          {habits.map((habit, index) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              dateSet={habitDateSets[index]}
              weekDays={weekGridDays}
              todayStr={todayStr}
              hour={hour}
              streak={streakMap.get(habit.id) || 0}
              todayProgress={getHabitProgress(habit, todayStr)}
              completedThisWeek={perHabitStats.get(habit.id)?.completedThisWeek || 0}
              isEditing={editingId === habit.id}
              isDeleting={deletingId === habit.id}
              isExpandedMonth={expandedMonthId === habit.id}
              monthNav={monthNav}
              onToggleToday={handleToggleToday}
              onToggleMonth={toggleMonthExpand}
              onMonthNavChange={setMonthNav}
              onStartEdit={startEdit}
              onRequestDelete={setDeletingId}
              onCancelDelete={() => setDeletingId(null)}
              onConfirmDelete={(habitId) => {
                const habit = habits.find((h) => h.id === habitId)
                deleteHabit(habitId)
                setDeletingId(null)
                if (habit) {
                  lastDeletedHabitRef.current = habit
                  showToast(`已删除打卡：${habit.name}（Ctrl+Z 可撤销）`, 'info', {
                    label: '撤销',
                    onClick: () => { restoreDeletedHabit() },
                  }, 10_000)
                }
              }}
              editForm={
                <HabitForm
                  title="编辑每日打卡"
                  submitLabel="保存修改"
                  name={newName}
                  icon={newIcon}
                  color={newColor}
                  schedule={newSchedule}
                  onNameChange={setNewName}
                  onIconChange={setNewIcon}
                  onColorChange={setNewColor}
                  onScheduleChange={setNewSchedule}
                  onSubmit={saveEdit}
                  onClose={closeEditForm}
                />
              }
            />
          ))}
        </div>
      )}
        </div>
      )}
      </PanelSwitch>
    </div>
  )
}
