/**
 * Shared calendar utilities for DatePicker and DateRangePicker.
 * Eliminates duplicated utility functions across both components.
 */

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const
export const MONTH_LABELS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'] as const

export interface CalendarDay {
  date: Date
  dateStr: string
  day: number
  inMonth: boolean
}

/** Format a Date as YYYY-MM-DD string */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Parse a YYYY-MM-DD string into a Date, or null if invalid */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  const date = new Date(`${dateStr}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Get 42 calendar days (6 weeks) for a month grid starting on Monday */
export function getMonthDays(anchorDate: Date): CalendarDay[] {
  const year = anchorDate.getFullYear()
  const month = anchorDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return {
      date,
      dateStr: formatDate(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
    }
  })
}

/** Shift a date by N months */
export function shiftMonth(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}
