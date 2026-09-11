import type { CSSProperties } from 'react'
import clsx from 'clsx'
import type { Habit } from '../../store'
import type { WeekGridDay } from './habitUtils'
import { getMonthGridDays } from './habitUtils'
import { getEffectiveCheckIns } from './habitSchedule'
import { WEEKDAY_SHORT_LABELS } from './habitConstants'
import { GlassCard } from '../common/GlassSurface'

interface WeekHabitGridProps {
  days: WeekGridDay[]
  dateSet: Set<string>
  color: string
  habit?: Habit
}

interface MonthHabitCalendarProps {
  year: number
  month: number
  dateSet: Set<string>
  todayStr: string
  color: string
  habit?: Habit
}

function getDayCount(habit: Habit | undefined, dateStr: string): number {
  if (!habit) return 0
  return getEffectiveCheckIns(habit, dateStr).length
}

export function WeekHabitGrid({ days, dateSet, color, habit }: WeekHabitGridProps) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const isCompleted = dateSet.has(day.dateStr)
        const count = getDayCount(habit, day.dateStr)
        const showCount = count > 1 || (habit?.schedule.mode !== 'once' && count > 0)
        return (
          <GlassCard
            key={day.dateStr}
            borderRadius={16}
            className={clsx(
              'dashboard-panel relative min-h-[72px] p-2 transition-all duration-200',
              isCompleted
                ? 'border-transparent shadow-lg'
                : day.isToday
                  ? 'border-primary/50 bg-primary/10'
                  : '',
            )}
            style={isCompleted ? { background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 58%, #050505))` } : undefined}
          >
            <div className={clsx('text-[11px] font-medium', isCompleted ? 'text-white/80' : day.isToday ? 'text-primary' : 'text-text')}>
              {day.weekday}
            </div>
            <div className={clsx('mt-2 font-numeric text-lg font-semibold tabular-nums', isCompleted ? 'text-white' : 'text-text')}>
              {day.day}
            </div>
            <div className={clsx('absolute bottom-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-numeric text-[11px] tabular-nums', isCompleted ? 'bg-white/20 text-white' : 'bg-white/15 text-text')}>
              {showCount ? count : isCompleted ? '✓' : ''}
            </div>
          </GlassCard>
        )
      })}
    </div>
  )
}

export function MonthHabitCalendar({ year, month, dateSet, todayStr, color, habit }: MonthHabitCalendarProps) {
  return (
    <div className="interactive-glass rounded-3xl p-3">
      <div className="mb-2 grid grid-cols-7 gap-1.5">
        {WEEKDAY_SHORT_LABELS.map((weekday) => (
          <div key={weekday} className="py-1 text-center text-[11px] font-medium text-text">{weekday}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {getMonthGridDays(year, month).map((day, index) => {
          const isCompleted = dateSet.has(day.dateStr)
          const count = getDayCount(habit, day.dateStr)
          const showCount = count > 1 || (habit?.schedule.mode !== 'once' && count > 0)
          const isToday = day.dateStr === todayStr
          const style: CSSProperties = isCompleted && day.isCurrentMonth
            ? { background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 55%, #050505))` }
            : isToday
              ? { borderColor: color, color }
              : {}

          return (
            <div
              key={`${day.dateStr}-${index}`}
              className={clsx(
                'flex aspect-square items-center justify-center rounded-2xl border font-numeric text-sm font-semibold tabular-nums transition-all duration-200',
                !day.isCurrentMonth && 'opacity-25',
                isCompleted && day.isCurrentMonth
                  ? 'border-transparent text-white shadow-md'
                  : isToday
                    ? 'bg-white/12'
                    : 'interactive-glass border-transparent text-text',
              )}
              style={style}
              title={day.dateStr}
            >
              {isCompleted && day.isCurrentMonth ? (showCount ? count : '✓') : day.day}
            </div>
          )
        })}
      </div>
    </div>
  )
}
