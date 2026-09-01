import type { ReactNode } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Edit3, Flame, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import type { Habit } from '../../store'
import { MILESTONE_LABELS } from './habitConstants'
import type { WeekGridDay } from './habitUtils'
import { getStreakMilestone } from './habitUtils'
import { getScheduleLabel } from './habitSchedule'
import { MonthHabitCalendar, WeekHabitGrid } from './HabitCalendar'

interface HabitProgress {
  count: number
  target: number
  met: boolean
  canCheckIn: boolean
}

interface HabitCardProps {
  habit: Habit
  dateSet: Set<string>
  weekDays: WeekGridDay[]
  todayStr: string
  hour: number
  streak: number
  todayProgress: HabitProgress
  completedThisWeek: number
  isEditing: boolean
  isDeleting: boolean
  isExpandedMonth: boolean
  monthNav: { y: number; m: number } | null
  onToggleToday: (habitId: string) => void
  onToggleMonth: (habitId: string) => void
  onMonthNavChange: (monthNav: { y: number; m: number }) => void
  onStartEdit: (habit: Habit) => void
  onRequestDelete: (habitId: string) => void
  onCancelDelete: () => void
  onConfirmDelete: (habitId: string) => void
  editForm: ReactNode
}

export function HabitCard({
  habit,
  dateSet,
  weekDays,
  todayStr,
  hour,
  streak,
  todayProgress,
  completedThisWeek,
  isEditing,
  isDeleting,
  isExpandedMonth,
  monthNav,
  onToggleToday,
  onToggleMonth,
  onMonthNavChange,
  onStartEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  editForm,
}: HabitCardProps) {
  if (isEditing) return <>{editForm}</>

  const isCompletedToday = todayProgress.met
  const streakAtRisk = streak >= 2 && !isCompletedToday
  const streakMilestone = streak >= 7 ? getStreakMilestone(streak) : undefined
  const totalCheckIns = habit.checkIns?.length ?? habit.completedDates.length
  const scheduleLabel = getScheduleLabel(habit.schedule)
  const checkInLabel = habit.schedule.mode === 'once'
    ? (isCompletedToday ? '今日已打卡' : '立即打卡')
    : isCompletedToday
      ? `今日已完成 ${todayProgress.count}/${todayProgress.target}`
      : todayProgress.count > 0
        ? `继续打卡 ${todayProgress.count}/${todayProgress.target}`
        : `打卡 0/${todayProgress.target}`

  return (
    <article
      data-habit-id={habit.id}
      className={clsx(
        'group overflow-hidden rounded-[28px] border bg-surface/75 shadow-xl shadow-black/10 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 active:scale-[0.995]',
        isCompletedToday ? 'border-success/35' : streakAtRisk ? 'border-warning/35' : 'border-border',
      )}
    >
      <div
        className="relative p-4 md:p-5"
        style={{ background: `linear-gradient(135deg, ${habit.color}18, transparent 48%)` }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div
              className={clsx(
                'relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-3xl text-2xl shadow-lg',
                isCompletedToday && 'ring-2 ring-success/50',
              )}
              style={{ backgroundColor: `${habit.color}24`, color: habit.color }}
            >
              {habit.icon}
              {isCompletedToday && (
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-success text-white shadow-lg">
                  <Check size={13} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-semibold text-text">{habit.name}</h3>
                {streakMilestone && (
                  <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                    {MILESTONE_LABELS[streakMilestone]}里程碑
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <MetaPill className={streakAtRisk ? 'text-warning' : 'text-orange-400'}>
                  <Flame size={12} />
                  {streak} 天连续
                </MetaPill>
                <MetaPill>{completedThisWeek}/7 本周</MetaPill>
                <MetaPill>{scheduleLabel}</MetaPill>
                <MetaPill>累计 {totalCheckIns} 次</MetaPill>
                {streakAtRisk && (
                  <span className="text-warning">
                    {hour >= 20 ? '今晚别断签，补一次就稳了' : hour >= 16 ? '今日还未打卡' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleToday(habit.id)}
              disabled={!todayProgress.canCheckIn && todayProgress.count === 0}
              className={clsx(
                'inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-all',
                isCompletedToday
                  ? 'bg-success/15 text-success hover:bg-success/25'
                  : todayProgress.canCheckIn
                    ? 'bg-primary text-on-primary shadow-lg shadow-primary/25 hover:-translate-y-0.5 hover:bg-primary-dark'
                    : 'cursor-not-allowed bg-surface-lighter text-text-muted',
              )}
            >
              {isCompletedToday && <Check size={16} />}
              {checkInLabel}
            </button>
            <IconButton
              onClick={() => onToggleMonth(habit.id)}
              title={isExpandedMonth ? '收起月视图' : '展开月视图'}
              active={isExpandedMonth}
            >
              <ChevronDown size={17} className={clsx('transition-transform', isExpandedMonth && 'rotate-180')} />
            </IconButton>
            <IconButton onClick={() => onStartEdit(habit)} title="编辑打卡项">
              <Edit3 size={16} />
            </IconButton>
            {isDeleting ? (
              <div className="flex items-center gap-1 rounded-2xl border border-danger/25 bg-danger/10 p-1">
                <button
                  type="button"
                  onClick={() => onConfirmDelete(habit.id)}
                  className="rounded-xl bg-danger px-2.5 py-1 text-xs font-medium text-white"
                >
                  确认
                </button>
                <button
                  type="button"
                  onClick={onCancelDelete}
                  className="rounded-xl px-2.5 py-1 text-xs font-medium text-text-muted hover:text-text"
                >
                  取消
                </button>
              </div>
            ) : (
              <IconButton onClick={() => onRequestDelete(habit.id)} title="删除打卡项" danger>
                <Trash2 size={16} />
              </IconButton>
            )}
          </div>
        </div>

        <div className="mt-5">
          {isExpandedMonth && monthNav ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onMonthNavChange(shiftMonth(monthNav, -1))}
                  className="rounded-xl p-2 text-text-muted transition-colors hover:bg-surface-lighter hover:text-text"
                  aria-label="上个月"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onMonthNavChange({ ...monthNav, y: monthNav.y - 1 })}
                    className="text-xs text-text-muted transition-colors hover:text-primary"
                  >
                    {monthNav.y - 1}
                  </button>
                  <span className="min-w-[118px] rounded-2xl border border-border bg-background/50 px-4 py-2 text-center text-sm font-semibold text-text">
                    {monthNav.y}年{String(monthNav.m + 1).padStart(2, '0')}月
                  </span>
                  <button
                    type="button"
                    onClick={() => onMonthNavChange({ ...monthNav, y: monthNav.y + 1 })}
                    className="text-xs text-text-muted transition-colors hover:text-primary"
                  >
                    {monthNav.y + 1}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onMonthNavChange(shiftMonth(monthNav, 1))}
                  className="rounded-xl p-2 text-text-muted transition-colors hover:bg-surface-lighter hover:text-text"
                  aria-label="下个月"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <MonthHabitCalendar
                year={monthNav.y}
                month={monthNav.m}
                dateSet={dateSet}
                todayStr={todayStr}
                color={habit.color}
                habit={habit}
              />
            </div>
          ) : (
              <WeekHabitGrid days={weekDays} dateSet={dateSet} color={habit.color} habit={habit} />
          )}
        </div>
      </div>
    </article>
  )
}

function MetaPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/40 px-2.5 py-1', className)}>
      {children}
    </span>
  )
}

function IconButton({
  children,
  onClick,
  title,
  active = false,
  danger = false,
}: {
  children: ReactNode
  onClick: () => void
  title: string
  active?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={clsx(
        'flex h-10 w-10 items-center justify-center rounded-2xl border transition-all duration-200 active:scale-95',
        active
          ? 'border-primary/35 bg-primary/10 text-primary'
          : danger
            ? 'border-border bg-surface/70 text-text-muted hover:border-danger/35 hover:bg-danger/10 hover:text-danger'
            : 'border-border bg-surface/70 text-text-muted hover:border-primary/30 hover:bg-primary/10 hover:text-primary',
      )}
    >
      {children}
    </button>
  )
}

function shiftMonth(monthNav: { y: number; m: number }, delta: number): { y: number; m: number } {
  const date = new Date(monthNav.y, monthNav.m + delta, 1)
  return { y: date.getFullYear(), m: date.getMonth() }
}
