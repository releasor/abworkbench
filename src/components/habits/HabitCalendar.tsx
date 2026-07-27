import type { CSSProperties } from 'react'
import clsx from 'clsx'
import type { WeekGridDay } from './habitUtils'
import { getMonthGridDays } from './habitUtils'
import { WEEKDAY_SHORT_LABELS } from './habitConstants'

interface WeekHabitGridProps {
  days: WeekGridDay[]
  dateSet: Set<string>
  color: string
}

interface MonthHabitCalendarProps {
  year: number
  month: number
  dateSet: Set<string>
  todayStr: string
  color: string
}

export function WeekHabitGrid({ days, dateSet, color }: WeekHabitGridProps) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const isCompleted = dateSet.has(day.dateStr)
        return (
          <div
            key={day.dateStr}
            className={clsx(
              'relative min-h-[72px] rounded-2xl border p-2 transition-all duration-200',
              isCompleted
                ? 'border-transparent shadow-lg'
                : day.isToday
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border/70 bg-surface/55 hover:border-border',
            )}
            style={isCompleted ? { background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 58%, #050505))` } : {}}
          >
            <div className={clsx('text-[11px] font-medium', isCompleted ? 'text-white/80' : day.isToday ? 'text-primary' : 'text-text-muted')}>
              {day.weekday}
            </div>
            <div className={clsx('mt-2 text-lg font-semibold', isCompleted ? 'text-white' : 'text-text')}>
              {day.day}
            </div>
            <div className={clsx('absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full text-[11px]', isCompleted ? 'bg-white/20 text-white' : 'bg-surface-lighter text-text-muted')}>
              {isCompleted ? '✓' : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function MonthHabitCalendar({ year, month, dateSet, todayStr, color }: MonthHabitCalendarProps) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background/40 p-3">
      <div className="mb-2 grid grid-cols-7 gap-1.5">
        {WEEKDAY_SHORT_LABELS.map((weekday) => (
          <div key={weekday} className="py-1 text-center text-[11px] font-medium text-text-muted">{weekday}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {getMonthGridDays(year, month).map((day, index) => {
          const isCompleted = dateSet.has(day.dateStr)
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
                'flex aspect-square items-center justify-center rounded-2xl border text-sm font-semibold transition-all duration-200',
                !day.isCurrentMonth && 'opacity-25',
                isCompleted && day.isCurrentMonth
                  ? 'border-transparent text-white shadow-md'
                  : isToday
                    ? 'bg-surface/80'
                    : 'border-border/60 bg-surface/55 text-text-muted hover:bg-surface-lighter',
              )}
              style={style}
              title={day.dateStr}
            >
              {isCompleted && day.isCurrentMonth ? '✓' : day.day}
            </div>
          )
        })}
      </div>
    </div>
  )
}
