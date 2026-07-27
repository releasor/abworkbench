import { useState, memo } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Circle } from 'lucide-react'
import { useTranslation } from '../../i18n'
import WidgetCard from './WidgetCard'
import clsx from 'clsx'

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function subMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() - months, 1)
}

function isToday(date: Date): boolean {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

function getDay(date: Date): number {
  return date.getDay()
}

function eachDayOfInterval(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const current = new Date(start)
  while (current <= end) {
    days.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  return days
}

export default memo(function CalendarWidget() {
  const { t } = useTranslation()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selected, setSelected] = useState<Date | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval(monthStart, monthEnd)
  const startDay = getDay(monthStart)

  const dayNames = t('calendar.dayNames') as unknown as string[]

  return (
    <WidgetCard title={t('calendar.title')} icon={<CalendarIcon size={14} />}>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="grid h-9 w-9 place-items-center rounded-2xl border border-border bg-background/60 text-text-muted transition-all hover:border-primary/30 hover:bg-surface-lighter hover:text-text"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => setCurrentMonth(new Date())}
          className="rounded-2xl border border-border bg-background/60 px-4 py-2 text-sm font-bold text-text transition-colors hover:border-primary/30 hover:text-primary"
        >
          {currentMonth.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
        </button>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="grid h-9 w-9 place-items-center rounded-2xl border border-border bg-background/60 text-text-muted transition-all hover:border-primary/30 hover:bg-surface-lighter hover:text-text"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map(day => (
          <div key={day} className="py-1 text-center text-[11px] font-bold text-text-muted">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {days.map(day => {
          const today = isToday(day)
          const isSelected = selected && day.toDateString() === selected.toDateString()
          const isWeekend = getDay(day) === 0 || getDay(day) === 6

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelected(day)}
              className={clsx(
                'aspect-square rounded-2xl flex flex-col items-center justify-center text-xs font-semibold transition-all relative',
                today
                  ? 'bg-primary text-white shadow-lg shadow-primary/25'
                  : isSelected
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
                  : isWeekend
                  ? 'text-text-muted hover:bg-surface-lighter/50 hover:text-text'
                  : 'text-text hover:bg-surface-lighter'
              )}
            >
              {day.getDate()}
              {today && <Circle size={3} className="absolute bottom-1 fill-current" />}
            </button>
          )
        })}
      </div>

      {selected && !isToday(selected) && (
        <div className="mt-4 rounded-2xl border border-border bg-background/50 px-3 py-2 text-center text-xs text-text-muted">
          {selected.toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      )}
    </WidgetCard>
  )
})
