import { useState, useRef, useMemo, useEffect, Fragment, useDeferredValue } from 'react'
import { Plus, Trash2, Check, Flag, Edit3, X, CheckCircle2, Archive, ArrowUpDown, ArrowDownAZ, Search, ListEnd, Calendar, Copy, Flame } from 'lucide-react'
import { useStore } from '../../store'
import type { Priority } from '../../store'
import { eventMatchesShortcut, useShortcutStore } from '../../shortcuts'
import { playCompleteSound } from '../../utils/audio'
import { useToday } from '../../hooks/useToday'
import clsx from 'clsx'
import { fmtMin, dayNumToDateStr, dayNumToShortLabel, fmtHHmm, dayNumToYMD } from '../../utils/format'

const priorityConfig = {
  low: { label: '低', color: 'text-success', bg: 'bg-success/15' },
  medium: { label: '中', color: 'text-warning', bg: 'bg-warning/15' },
  high: { label: '高', color: 'text-orange-400', bg: 'bg-orange-500/15' },
  urgent: { label: '紧急', color: 'text-danger', bg: 'bg-danger/15' },
}

const PROGRESS_MARKS = [25, 50, 75]

const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

function trendArrow(v: number) { return v > 0 ? '↑' : '↓' }

function getCompletionDurationLabel(createdAt: number, completedAt: number): string | null {
  const durationMin = Math.floor((completedAt - createdAt) / 60000)
  if (durationMin < 1) return null
  if (durationMin < 60) return `${durationMin}分钟`
  if (durationMin < 1440) return `${Math.floor(durationMin / 60)}小时`
  return `${Math.floor(durationMin / 1440)}天`
}

function getAgeBadge(createdAt: number, nowMs: number): { label: string; color: string } | null {
  const ageDays = Math.floor((nowMs - createdAt) / 86400000)
  if (ageDays < 1) return null
  const color = ageDays >= 30 ? 'bg-red-500/10 text-red-400' : ageDays >= 14 ? 'bg-orange-500/10 text-orange-400' : ageDays >= 7 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-surface-lighter text-text-muted'
  const label = ageDays <= 7 ? `${ageDays} 天前创建` : ageDays <= 30 ? `${Math.floor(ageDays / 7)} 周前创建` : `${Math.floor(ageDays / 30)} 月前创建`
  return { label, color }
}

function getDueDateMs(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d)
}

function getDueDateStatus(dueDate: string, todayMs: number): { label: string; color: string; bg: string } | null {
  const [dy, dm, dd] = dueDate.split('-').map(Number)
  const dueMs = getDueDateMs(dy, dm, dd)
  const diffDays = Math.floor((dueMs - todayMs) / 86400000)

  if (diffDays < 0) return { label: `已逾期 ${Math.abs(diffDays)} 天`, color: 'text-danger', bg: 'bg-danger/15' }
  if (diffDays === 0) return { label: '今天截止', color: 'text-orange-400', bg: 'bg-orange-500/15' }
  if (diffDays === 1) return { label: '明天截止', color: 'text-warning', bg: 'bg-warning/15' }
  if (diffDays <= 3) return { label: `${diffDays} 天后截止`, color: 'text-primary', bg: 'bg-primary/15' }
  return { label: dayNumToShortLabel(Math.floor(dueMs / 86400000)), color: 'text-text-muted', bg: '' }
}

export default function TodoList() {
  const todos = useStore((s) => s.todos)
  const addTodo = useStore((s) => s.addTodo)
  const toggleTodo = useStore((s) => s.toggleTodo)
  const deleteTodo = useStore((s) => s.deleteTodo)
  const clearCompletedTodos = useStore((s) => s.clearCompletedTodos)
  const updateTodo = useStore((s) => s.updateTodo)
  const duplicateTodo = useStore((s) => s.duplicateTodo)
  const [newText, setNewText] = useState('')
  const [newPriority, setNewPriority] = useState<Priority>('medium')
  const [newDueDate, setNewDueDate] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editPriority, setEditPriority] = useState<Priority>('medium')
  const [editDueDate, setEditDueDate] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('all')
  const shortcutOverrides = useShortcutStore((s) => s.overrides)
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'dueDate'>('date')
  const [completedAtBottom, setCompletedAtBottom] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)
  const searchRegex = useMemo(
    () => deferredSearch ? new RegExp(`(${deferredSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi') : null,
    [deferredSearch]
  )
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { todayStr, todayMidnightMs } = useToday()
  const dayOfWeek = useMemo(() => {
    const rawDay = (Math.floor(todayMidnightMs / 86400000) + 4) % 7
    return rawDay === 0 ? 7 : rawDay
  }, [todayMidnightMs])

  const filteredTodos = useMemo(
    () => {
      const searchLower = deferredSearch.toLowerCase()
      return todos
        .filter((t) => {
          if (filter === 'active' && t.completed) return false
          if (filter === 'completed' && !t.completed) return false
          if (filter === 'overdue' && (t.completed || !t.dueDate || t.dueDate >= todayStr)) return false
          if (searchLower && !t.text.toLowerCase().includes(searchLower)) return false
          return true
        })
        .sort((a, b) => {
          if (completedAtBottom) {
            if (a.completed !== b.completed) return a.completed ? 1 : -1
          }
          if (sortBy === 'priority') {
            const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
            if (priorityDiff !== 0) return priorityDiff
            return b.createdAt - a.createdAt
          }
          if (sortBy === 'dueDate') {
            if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : b.createdAt - a.createdAt
            if (a.dueDate) return -1
            if (b.dueDate) return 1
            return b.createdAt - a.createdAt
          }
          return b.createdAt - a.createdAt
        })
        .map((t) => ({
          ...t,
          dateDisplay: t.completed && t.completedAt
            ? `完成于 ${dayNumToShortLabel(Math.floor(t.completedAt / 86400000))} ${fmtHHmm(t.completedAt)}`
            : `${dayNumToShortLabel(Math.floor(t.createdAt / 86400000))} ${fmtHHmm(t.createdAt)}`,
          completionDurationLabel: t.completed && t.completedAt ? getCompletionDurationLabel(t.createdAt, t.completedAt) : null,
          ageBadge: !t.completed ? getAgeBadge(t.createdAt, todayMidnightMs) : null,
          dueStatus: t.dueDate && !t.completed ? getDueDateStatus(t.dueDate, todayMidnightMs) : null,
        }))
    },
    [todos, filter, sortBy, deferredSearch, completedAtBottom, todayStr, todayMidnightMs]
  )

  // Pre-compute today-created set and completed count in one pass
  const { todayCreatedIds, filteredCompletedCount } = useMemo(() => {
    const set = new Set<string>()
    let completedCount = 0
    const tomorrowMidnightMs = todayMidnightMs + 86400000
    for (const t of filteredTodos) {
      if (t.createdAt >= todayMidnightMs && t.createdAt < tomorrowMidnightMs) set.add(t.id)
      if (t.completed) completedCount++
    }
    return { todayCreatedIds: set, filteredCompletedCount: completedCount }
  }, [filteredTodos, todayMidnightMs])

  // First completed index for separator
  const firstCompletedIndex = useMemo(() => {
    if (!completedAtBottom || filter === 'completed' || filter === 'active') return -1
    return filteredTodos.findIndex((t, i) => t.completed && i > 0 && !filteredTodos[i - 1].completed)
  }, [filteredTodos, completedAtBottom, filter])

  const stats = useMemo(() => {
    const DAY = 86400000
    const todayDayNum = Math.floor(todayMidnightMs / DAY)
    const todayDay = (todayDayNum + 4) % 7
    const dayOfMonth = dayNumToYMD(todayDayNum).d
    const weekStartMs = todayMidnightMs - ((todayDay === 0 ? 6 : todayDay - 1) * DAY)
    const weekStartDayNum = Math.floor(weekStartMs / DAY)
    const weekEndStr = dayNumToDateStr(weekStartDayNum + 6)
    const monthStart = todayMidnightMs - (dayOfMonth - 1) * DAY

    // Single pass over todos
    let completed = 0
    let monthAdded = 0
    let monthCompleted = 0
    let active = 0
    let overdue = 0
    let dueToday = 0
    let todayCompleted = 0
    let todayAdded = 0
    let weekCompleted = 0
    let weekAdded = 0
    let lastWeekCompleted = 0
    let lastWeekAdded = 0
    let completionDurationSum = 0
    let completedWithDurationCount = 0
    let dueThisWeek = 0
    const completedDayNums = new Set<number>()

    for (const t of todos) {
      const createdDayNum = Math.floor(t.createdAt / DAY)
      if (createdDayNum === todayDayNum) todayAdded++
      if (createdDayNum >= weekStartDayNum) weekAdded++
      if (createdDayNum >= weekStartDayNum - 7 && createdDayNum < weekStartDayNum) lastWeekAdded++
      if (t.createdAt >= monthStart) monthAdded++

      if (t.completed) {
        completed++
        if (t.completedAt) {
          completionDurationSum += t.completedAt - t.createdAt
          completedWithDurationCount++
          const completedDayNum = Math.floor(t.completedAt / DAY)
          completedDayNums.add(completedDayNum)
          if (completedDayNum === todayDayNum) todayCompleted++
          if (completedDayNum >= weekStartDayNum) weekCompleted++
          if (completedDayNum >= weekStartDayNum - 7 && completedDayNum < weekStartDayNum) lastWeekCompleted++
          if (t.completedAt >= monthStart) monthCompleted++
        }
      } else {
        active++
        if (t.dueDate) {
          if (t.dueDate < todayStr) overdue++
          else if (t.dueDate === todayStr) dueToday++
          else if (t.dueDate > todayStr && t.dueDate <= weekEndStr) dueThisWeek++
        }
      }
    }

    const weekCompletionRate = weekAdded > 0 ? Math.round((weekCompleted / weekAdded) * 100) : -1
    const weekTrend = lastWeekCompleted > 0 ? Math.round(((weekCompleted - lastWeekCompleted) / lastWeekCompleted) * 100) : weekCompleted > 0 ? 100 : 0
    const weekAddedTrend = lastWeekAdded > 0 ? Math.round(((weekAdded - lastWeekAdded) / lastWeekAdded) * 100) : weekAdded > 0 ? 100 : 0
    const lastWeekCompletionRate = lastWeekAdded > 0 ? Math.round((lastWeekCompleted / lastWeekAdded) * 100) : -1
    const avgCompletionMin = completedWithDurationCount > 0 ? Math.round(completionDurationSum / completedWithDurationCount / 60000) : 0

    // Completion streak using day-number set (pure arithmetic, no format calls)
    let completionStreak = 0
    for (let i = 0; i < 365; i++) {
      if (completedDayNums.has(todayDayNum - i)) completionStreak++
      else if (i > 0) break
    }

    return {
      total: todos.length,
      completed,
      active,
      overdue,
      dueToday,
      todayCompleted,
      todayAdded,
      monthAdded,
      monthCompleted,
      weekCompleted,
      weekAdded,
      weekCompletionRate,
      lastWeekCompleted,
      weekTrend,
      lastWeekAdded,
      weekAddedTrend,
      lastWeekCompletionRate,
      avgCompletionMin,
      dueThisWeek,
      completionStreak,
    }
  }, [todos, todayStr, todayMidnightMs])

  const completionProgress = useMemo(() => {
    if (stats.total === 0) return null
    const pct = Math.round((stats.completed / stats.total) * 100)
    const milestone = pct === 100 ? null : pct >= 75 ? '快完成了！' : pct >= 50 ? '过半了！' : pct >= 25 ? '继续加油！' : '好的开始！'
    const dailyAvgNum = stats.weekCompleted > 0 ? stats.weekCompleted / dayOfWeek : 0
    const dailyAvg = dailyAvgNum.toFixed(1)
    const estDays = stats.active > 0 && stats.avgCompletionMin > 0 && dailyAvgNum > 0 ? Math.ceil(stats.active / dailyAvgNum) : 0
    const barGradient = stats.active === 0
      ? 'linear-gradient(135deg, var(--color-success), #059669)'
      : pct >= 75
      ? 'linear-gradient(135deg, var(--color-success), var(--color-primary))'
      : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))'
    return { pct, milestone, dailyAvg, estDays, barGradient }
  }, [stats, dayOfWeek])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (eventMatchesShortcut('taskListQuickAdd', e)) {
        e.preventDefault()
        inputRef.current?.focus()
      } else if (eventMatchesShortcut('taskListFilter', e)) {
        e.preventDefault()
        setFilter((prev) => prev === 'all' ? 'active' : prev === 'active' ? 'completed' : prev === 'completed' ? 'overdue' : 'all')
      } else if (eventMatchesShortcut('taskListSort', e)) {
        e.preventDefault()
        setSortBy((prev) => prev === 'date' ? 'priority' : prev === 'priority' ? 'dueDate' : 'date')
      } else if (eventMatchesShortcut('taskListCompletedBottom', e)) {
        e.preventDefault()
        setCompletedAtBottom((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcutOverrides])

  const handleAdd = () => {
    if (!newText.trim()) return
    addTodo(newText.trim(), newPriority, newDueDate || undefined)
    setNewText('')
    setNewDueDate('')
    inputRef.current?.focus()
  }

  const startEdit = (id: string, text: string, priority: Priority, dueDate?: string) => {
    setEditingId(id)
    setEditText(text)
    setEditPriority(priority)
    setEditDueDate(dueDate || '')
  }

  const saveEdit = () => {
    if (editingId && editText.trim()) {
      updateTodo(editingId, { text: editText.trim(), priority: editPriority, dueDate: editDueDate || undefined })
    }
    setEditingId(null)
  }

  const filterButtons = useMemo(() => [
    { key: 'all' as const, label: '全部', count: stats.total },
    { key: 'active' as const, label: '进行中', count: stats.active },
    { key: 'completed' as const, label: '已完成', count: stats.completed },
    { key: 'overdue' as const, label: '逾期', count: stats.overdue },
  ], [stats.total, stats.active, stats.completed, stats.overdue])

  const todoStatCards = useMemo(() => [
    {
      label: '全部', value: stats.total, filterKey: 'all' as const, color: 'from-primary to-primary-dark',
      sub: stats.todayAdded > 0
        ? `今日新增 ${stats.todayAdded} 个${stats.overdue > 0 ? ` · ${stats.overdue} 个逾期` : ''}`
        : stats.weekAdded > 0
        ? `本周新增 ${stats.weekAdded} 个${stats.weekAddedTrend !== 0 ? ` · ${trendArrow(stats.weekAddedTrend)}${Math.abs(stats.weekAddedTrend)}%` : ''}`
        : stats.monthAdded > 0 ? `本月新增 ${stats.monthAdded} 个` : undefined,
      subColor: stats.overdue > 0 && stats.todayAdded > 0 ? 'text-danger' : 'text-primary',
    },
    {
      label: '进行中', value: stats.active, filterKey: 'active' as const, color: 'from-warning to-secondary',
      sub: stats.overdue > 0 ? `${stats.overdue} 个逾期`
        : stats.dueToday > 0 ? `今日截止 ${stats.dueToday} 个`
        : stats.dueThisWeek > 0 ? `本周截止 ${stats.dueThisWeek} 个`
        : stats.total > 0 ? `完成率 ${Math.round((stats.completed / stats.total) * 100)}%${stats.weekCompletionRate >= 0 ? ` · 本周 ${stats.weekCompletionRate}%${stats.lastWeekCompletionRate >= 0 && stats.weekCompletionRate !== stats.lastWeekCompletionRate ? ` ${trendArrow(stats.weekCompletionRate - stats.lastWeekCompletionRate)}${Math.abs(stats.weekCompletionRate - stats.lastWeekCompletionRate)}%` : ''}` : ''}`
        : undefined,
      subColor: stats.overdue > 0 ? 'text-danger' : 'text-orange-400',
    },
    {
      label: '已完成', value: stats.completed, filterKey: 'completed' as const, color: 'from-success to-emerald-600',
      sub: stats.todayCompleted > 0 ? `今日 ${stats.todayCompleted} 个${stats.weekCompletionRate >= 0 ? ` · 本周完成率 ${stats.weekCompletionRate}%` : ''}`
        : stats.weekCompleted > 0 ? `本周 ${stats.weekCompleted} 个${stats.weekTrend !== 0 ? ` · ${trendArrow(stats.weekTrend)}${Math.abs(stats.weekTrend)}%` : ''}`
        : stats.monthCompleted > 0 ? `本月 ${stats.monthCompleted} 个` : undefined,
      subExtra: stats.avgCompletionMin > 0 ? `均耗时 ${fmtMin(stats.avgCompletionMin)}` : undefined,
    },
  ], [stats])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {todoStatCards.map((stat) => (
          <button
            key={stat.label}
            onClick={() => setFilter(stat.filterKey)}
            className={`glass-card p-3 md:p-4 text-left transition-all hover:scale-[1.02] ${
              filter === stat.filterKey ? 'ring-1 ring-primary/40' : ''
            }`}
          >
            <div className="text-xs md:text-sm text-text-muted mb-1">{stat.label}</div>
            <div className="text-xl md:text-2xl font-bold text-text">{stat.value}</div>
            <div className={`h-1 mt-2 rounded-full bg-gradient-to-r ${stat.color}`} />
            {stat.sub && <div className={`text-[10px] mt-1 ${stat.subColor || 'text-success'}`}>{stat.sub}{('subExtra' in stat && stat.subExtra) ? <span className="ml-1 text-text-muted">· {stat.subExtra}</span> : null}</div>}
          </button>
        ))}
      </div>

      {/* Overdue Warning */}
      {stats.overdue > 0 && (
        <div role="alert" className="glass-card p-3 flex items-center gap-3 border-danger/30">
          <div className="w-8 h-8 rounded-lg bg-danger/15 flex items-center justify-center">
            <Calendar size={16} className="text-danger" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-danger font-medium">{stats.overdue} 个任务已逾期</div>
            <div className="text-xs text-text-muted">请尽快处理或更新截止日期</div>
          </div>
        </div>
      )}

      {/* Due Today Warning */}
      {stats.overdue === 0 && stats.dueToday > 0 && (
        <div role="alert" className="glass-card p-3 flex items-center gap-3 border-orange-500/30">
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <Calendar size={16} className="text-orange-400" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-orange-400 font-medium">{stats.dueToday} 个任务今日截止</div>
            <div className="text-xs text-text-muted">记得按时完成哦</div>
          </div>
        </div>
      )}

      {/* Completion Progress */}
      {completionProgress && (
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-text">完成进度</span>
              <span className={`text-sm font-medium ${stats.active === 0 ? 'text-success' : 'text-primary'}`}>
                {completionProgress.pct}%
              </span>
            </div>
            <div className="h-2 bg-surface-lighter rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${completionProgress.pct}%`, background: completionProgress.barGradient }}
              />
            </div>
            <div className="flex justify-between mt-1 px-[1px]">
              {PROGRESS_MARKS.map((mark) => (
                <div key={mark} className={`w-1 h-1 rounded-full ${completionProgress.pct >= mark ? 'bg-primary' : 'bg-surface-lighter'}`} />
              ))}
            </div>
            {stats.active === 0 && stats.completed > 0 ? (
              <div className="text-xs text-success mt-2 text-center font-medium">
                所有任务已完成！干得漂亮！
              </div>
            ) : completionProgress.milestone ? (
              <div className="text-xs text-text-muted mt-2 text-center">{completionProgress.milestone}</div>
            ) : null}
            {stats.completionStreak >= 2 && (
              <div className="flex items-center justify-center gap-1.5 mt-1.5">
                <Flame size={12} className={stats.completionStreak >= 14 ? 'text-amber-400' : stats.completionStreak >= 7 ? 'text-orange-400' : 'text-warning'} />
                <span className={`text-[10px] font-medium ${stats.completionStreak >= 14 ? 'text-amber-400' : stats.completionStreak >= 7 ? 'text-orange-400' : 'text-warning'}`}>
                  连续完成 {stats.completionStreak} 天
                </span>
              </div>
            )}
            {stats.weekCompleted > 0 && (
              <div className="text-[10px] text-text-muted mt-1 text-center">
                本周已完成 {stats.weekCompleted} 个任务 · 日均 {completionProgress.dailyAvg} 个
                {completionProgress.estDays > 0 && (
                  <span> · 按均速约 {completionProgress.estDays <= 1 ? '今天' : completionProgress.estDays <= 7 ? `${completionProgress.estDays} 天` : `${Math.ceil(completionProgress.estDays / 7)} 周`} 完成剩余</span>
                )}
              </div>
            )}
          </div>
      )}

      {/* Add Todo */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            ref={inputRef}
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
              if (e.key === 'Escape') {
                setNewText('')
                inputRef.current?.blur()
              }
            }}
            placeholder="添加新任务..."
            aria-label="添加新任务"
            className="input-field flex-1"
          />
          <div className="flex gap-2 sm:gap-3">
            <div className="relative">
              <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="input-field pl-8 w-28 sm:w-32 text-center text-xs"
                aria-label="截止日期"
                title="截止日期"
              />
            </div>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as Priority)}
              className="input-field w-20 sm:w-24 text-center"
              aria-label="优先级"
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="urgent">紧急</option>
            </select>
            <button onClick={handleAdd} className="btn-primary flex-1 sm:flex-none justify-center">
              <Plus size={18} />
              <span className="sm:inline">添加</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          {filterButtons.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              aria-label={`${f.label}，${f.count} 个任务`}
              className={clsx(
                'px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-all',
                filter === f.key
                  ? f.key === 'overdue'
                    ? 'bg-red-500/15 text-red-500'
                    : 'bg-primary/15 text-primary'
                  : f.key === 'overdue' && f.count > 0
                    ? 'text-red-500 hover:text-red-400 hover:bg-red-500/10'
                    : 'text-text-muted hover:text-text hover:bg-surface-lighter'
              )}
            >
              {f.label}
              <span className={clsx(
                'ml-1.5 text-[10px] font-mono',
                f.key === 'overdue' && f.count > 0 && filter !== 'overdue'
                  ? 'text-red-500 font-semibold'
                  : filter === f.key ? 'opacity-80' : 'opacity-50'
              )}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy(sortBy === 'date' ? 'priority' : sortBy === 'priority' ? 'dueDate' : 'date')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text hover:bg-surface-lighter transition-colors"
            aria-label={sortBy === 'date' ? '当前按时间排序，点击切换为按优先级排序' : sortBy === 'priority' ? '当前按优先级排序，点击切换为按截止日期排序' : '当前按截止日期排序，点击切换为按时间排序'}
            title={sortBy === 'date' ? '按时间排序' : sortBy === 'priority' ? '按优先级排序' : '按截止日期排序'}
          >
            {sortBy === 'date' ? <ArrowDownAZ size={14} /> : sortBy === 'priority' ? <ArrowUpDown size={14} /> : <Calendar size={14} />}
            {sortBy === 'date' ? '时间' : sortBy === 'priority' ? '优先级' : '截止日'}
          </button>
          <button
            onClick={() => setCompletedAtBottom(!completedAtBottom)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors',
              completedAtBottom ? 'text-primary bg-primary/10' : 'text-text-muted hover:text-text hover:bg-surface-lighter'
            )}
            aria-pressed={completedAtBottom}
            aria-label={completedAtBottom ? '已完成置底：开，点击关闭' : '已完成置底：关，点击开启'}
            title={completedAtBottom ? '已完成置底：开' : '已完成置底：关'}
          >
            <ListEnd size={14} />
            <span className="hidden sm:inline">已完成置底</span>
          </button>
          {stats.completed > 0 && (
            showClearConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-muted">确认清除 {stats.completed} 个？</span>
                <button
                  onClick={() => {
                    clearCompletedTodos()
                    setShowClearConfirm(false)
                  }}
                  className="px-2 py-1 rounded text-xs text-white bg-danger hover:bg-danger/80 transition-colors"
                >
                  确认
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-1 rounded text-xs text-text-muted hover:bg-surface-lighter transition-colors"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
              >
                <Archive size={14} />
                清除已完成
              </button>
            )
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              if (searchQuery) setSearchQuery('')
              else if (filter !== 'all') setFilter('all')
            }
          }}
          placeholder="搜索任务..."
          aria-label="搜索任务"
          className="input-field pl-8 pr-8 py-2 text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label="清除搜索"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {searchQuery && (
        <div className="text-xs text-text-muted">
          找到 {filteredTodos.length} 个匹配任务
          {filteredTodos.length > 0 && (
            <span className="ml-1">
              · {filteredTodos.length - filteredCompletedCount} 进行中{filteredCompletedCount > 0 ? ` · ${filteredCompletedCount} 已完成` : ''}
            </span>
          )}
        </div>
      )}

      {/* Todo List */}
      <div className="space-y-2">
        {filteredTodos.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-text-muted opacity-50" />
            <p className="text-text-muted mb-3">
              {searchQuery
                ? `没有找到包含"${searchQuery}"的任务`
                : filter === 'completed'
                ? '还没有完成的任务'
                : filter === 'active'
                ? '所有任务都完成了！'
                : '添加你的第一个任务吧'}
            </p>
            {searchQuery && (
              <button
                onClick={() => {
                  addTodo(searchQuery.trim(), newPriority, newDueDate || undefined)
                  setSearchQuery('')
                }}
                className="btn-primary text-sm"
              >
                <Plus size={16} />
                创建任务: "{searchQuery}"
              </button>
            )}
          </div>
        ) : (
          filteredTodos.map((todo, index) => {
            const priority = priorityConfig[todo.priority]
            return (
              <Fragment key={todo.id}>
                {index === firstCompletedIndex && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-text-muted px-2">已完成 ({filteredCompletedCount})</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
              <div
                className={`glass-card p-3 md:p-4 flex items-center gap-3 group transition-all duration-300 ${
                  completingId === todo.id ? 'scale-[0.98] opacity-70' : ''
                } ${todo.dueStatus?.color === 'text-danger' ? 'border-l-2 border-l-danger' : ''}`}
                style={{ animation: `fadeIn 0.3s ease-out ${Math.min(index * 50, 500)}ms both` }}
              >
                {/* Checkbox */}
                <button
                  aria-label={todo.completed ? '标记为未完成' : '标记为已完成'}
                  onClick={() => {
                    if (!todo.completed) {
                      playCompleteSound()
                      setCompletingId(todo.id)
                      setTimeout(() => {
                        toggleTodo(todo.id)
                        setCompletingId((prev) => prev === todo.id ? null : prev)
                      }, 400)
                    } else {
                      toggleTodo(todo.id)
                    }
                  }}
                  className={clsx(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 active:scale-90',
                    todo.completed
                      ? 'bg-success border-success'
                      : 'border-border hover:border-primary'
                  )}
                >
                  {todo.completed && <Check size={14} className="text-white" />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {editingId === todo.id ? (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit()
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="input-field py-1 text-sm flex-1"
                        aria-label="编辑任务"
                        autoFocus
                      />
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="input-field py-1 text-xs w-28"
                        aria-label="截止日期"
                        title="截止日期"
                      />
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value as Priority)}
                        className="input-field py-1 text-xs w-16"
                        aria-label="优先级"
                      >
                        <option value="low">低</option>
                        <option value="medium">中</option>
                        <option value="high">高</option>
                        <option value="urgent">紧急</option>
                      </select>
                      <button onClick={saveEdit} aria-label="保存编辑" className="p-1 text-success hover:bg-success/10 rounded">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setEditingId(null)} aria-label="取消编辑" className="p-1 text-text-muted hover:bg-surface-lighter rounded">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p
                        className={clsx(
                          'text-sm transition-all',
                          todo.completed && 'line-through text-text-muted'
                        )}
                      >
                        {searchQuery ? (
                          todo.text.split(searchRegex!).map((part, i) =>
                            part.toLowerCase() === searchQuery.toLowerCase() ? (
                              <mark key={i} className="bg-warning/30 text-text rounded-sm px-0.5">{part}</mark>
                            ) : (
                              part
                            )
                          )
                        ) : (
                          todo.text
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full', priority.bg, priority.color)}>
                          <Flag size={10} className="inline mr-1" />
                          {priority.label}
                        </span>
                        {todo.dueStatus && (
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full', todo.dueStatus.bg, todo.dueStatus.color)}>
                            <Calendar size={10} className="inline mr-1" />
                            {todo.dueStatus.label}
                          </span>
                        )}

                        <span className="text-xs text-text-muted">
                          {todo.dateDisplay}
                        </span>
                        {todo.completionDurationLabel && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-lighter text-text-muted">耗时 {todo.completionDurationLabel}</span>
                        )}
                        {todayCreatedIds.has(todo.id) && !todo.completed && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">今天</span>
                        )}
                        {todo.ageBadge && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${todo.ageBadge.color}`}>{todo.ageBadge.label}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {editingId !== todo.id && (
                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(todo.id, todo.text, todo.priority, todo.dueDate)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                      title="编辑"
                      aria-label="编辑任务"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => duplicateTodo(todo.id)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-warning hover:bg-warning/10 transition-colors"
                      title="复制任务"
                      aria-label="复制任务"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      title="删除"
                      aria-label="删除任务"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              </Fragment>
            )
          })
        )}
      </div>

      {/* Keyboard Shortcuts */}
      <div className="hidden md:flex items-center justify-center gap-4 text-[10px] text-text-muted/50">
        <span><kbd className="px-1 py-0.5 bg-surface-lighter rounded border border-border text-[9px] font-mono">N</kbd> 新建任务</span>
        <span><kbd className="px-1 py-0.5 bg-surface-lighter rounded border border-border text-[9px] font-mono">F</kbd> 切换筛选</span>
        <span><kbd className="px-1 py-0.5 bg-surface-lighter rounded border border-border text-[9px] font-mono">S</kbd> 切换排序</span>
      </div>
    </div>
  )
}
