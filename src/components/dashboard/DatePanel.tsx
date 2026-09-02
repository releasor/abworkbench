import { memo, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import clsx from 'clsx'
import {
  eachDayInMonth,
  getDayCalendarInfo,
  getDayOfYear,
  getWeekdayLabel,
  getWeekOfYear,
  mondayStartOffset,
} from '../../utils/chineseCalendar'

const WEEKDAY_HEADERS = ['一', '二', '三', '四', '五', '六', '日'] as const
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i)
const YEAR_OPTIONS = Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i)

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default memo(function DatePanel() {
  const today = useMemo(() => new Date(), [])
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(() => new Date(today))

  const monthDays = useMemo(
    () => eachDayInMonth(viewMonth.getFullYear(), viewMonth.getMonth()),
    [viewMonth],
  )
  const leadingBlanks = mondayStartOffset(monthDays[0])
  const selectedInfo = useMemo(() => getDayCalendarInfo(selected), [selected])
  const monthWatermark = String(viewMonth.getMonth() + 1).padStart(2, '0')

  const shiftMonth = (delta: number) => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  return (
    <div className="liquid-glass-panel modal-panel-cinematic overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        <div className="relative min-w-0 flex-1 p-4 md:p-5">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[140px] font-black text-text/[0.04]">
            {monthWatermark}
          </div>

          <div className="relative mb-4 flex flex-wrap items-center gap-2">
            <select
              value={viewMonth.getFullYear()}
              onChange={(e) => setViewMonth(new Date(Number(e.target.value), viewMonth.getMonth(), 1))}
              className="rounded-xl liquid-glass-chip px-3 py-2 text-sm font-semibold text-text outline-none focus:border-primary/40"
              aria-label="选择年份"
            >
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={viewMonth.getMonth()}
              onChange={(e) => setViewMonth(new Date(viewMonth.getFullYear(), Number(e.target.value), 1))}
              className="rounded-xl liquid-glass-chip px-3 py-2 text-sm font-semibold text-text outline-none focus:border-primary/40"
              aria-label="选择月份"
            >
              {MONTH_OPTIONS.map((month) => (
                <option key={month} value={month}>{String(month + 1).padStart(2, '0')}</option>
              ))}
            </select>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="grid h-9 w-9 place-items-center rounded-xl liquid-glass-chip text-text-muted transition hover:border-primary/30 hover:text-text"
                aria-label="上个月"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date()
                  setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1))
                  setSelected(now)
                }}
                className="rounded-xl liquid-glass-chip px-3 py-2 text-xs font-semibold text-text-muted transition hover:border-primary/30 hover:text-primary"
              >
                今天
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="grid h-9 w-9 place-items-center rounded-xl liquid-glass-chip text-text-muted transition hover:border-primary/30 hover:text-text"
                aria-label="下个月"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="relative grid grid-cols-7 gap-1.5">
            {WEEKDAY_HEADERS.map((label, index) => (
              <div
                key={label}
                className={clsx(
                  'py-1 text-center text-[11px] font-bold',
                  index >= 5 ? 'text-danger/80' : 'text-text-muted',
                )}
              >
                {label}
              </div>
            ))}

            {Array.from({ length: leadingBlanks }).map((_, index) => (
              <div key={`blank-${index}`} />
            ))}

            {monthDays.map((day) => {
              const info = getDayCalendarInfo(day)
              const isToday = isSameDay(day, today)
              const isSelected = isSameDay(day, selected)
              const weekend = day.getDay() === 0 || day.getDay() === 6
              const highlightFestival = Boolean(info.festival || info.holidayName)

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelected(day)}
                  className={clsx(
                    'relative flex min-h-[58px] flex-col items-center justify-center rounded-2xl border px-1 py-1.5 text-left transition',
                    isSelected
                      ? 'border-primary bg-primary text-white shadow-lg shadow-primary/25'
                      : isToday
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : highlightFestival
                          ? 'border-danger/15 bg-danger/5 text-text hover:bg-danger/10'
                          : weekend
                            ? 'border-transparent bg-transparent text-danger/80 hover:bg-surface-lighter/70'
                            : 'border-transparent bg-transparent text-text hover:bg-surface-lighter/70',
                  )}
                >
                  {(info.isRestDay || info.isWorkDay) && (
                    <span
                      className={clsx(
                        'absolute right-1 top-1 rounded px-1 text-[9px] font-bold leading-none',
                        info.isWorkDay ? 'bg-primary/15 text-primary' : 'bg-danger/15 text-danger',
                        isSelected && 'bg-white/20 text-white',
                      )}
                    >
                      {info.isWorkDay ? '班' : '休'}
                    </span>
                  )}
                  <span className="text-sm font-bold tabular-nums">{day.getDate()}</span>
                  <span
                    className={clsx(
                      'mt-0.5 max-w-full truncate text-[10px]',
                      isSelected ? 'text-white/85' : 'text-text-muted',
                    )}
                  >
                    {info.lunarLabel}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="liquid-glass-pane w-full border-t border-white/10 p-4 md:p-5 lg:w-[280px] lg:border-l lg:border-t-0">
          <div className="mb-4 text-center">
            <div className="text-sm font-semibold text-text">
              {selected.getFullYear()}-{String(selected.getMonth() + 1).padStart(2, '0')}-{String(selected.getDate()).padStart(2, '0')}
              {' '}
              {getWeekdayLabel(selected)}
            </div>
            <div className="mx-auto mt-3 grid h-16 w-16 place-items-center rounded-2xl bg-primary text-2xl font-black text-white shadow-lg shadow-primary/25">
              {selected.getDate()}
            </div>
            <p className="mt-3 text-sm font-medium text-text">{selectedInfo.lunarFull}</p>
            <p className="mt-1 text-xs text-text-muted">
              {selectedInfo.yearGanZhi}({selectedInfo.yearShengXiao})年 · 第{getWeekOfYear(selected)}周 · 第{getDayOfYear(selected)}天
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl liquid-glass-chip px-3 py-2">
              <div className="text-[10px] text-text-muted">生肖</div>
              <div className="mt-1 text-sm font-semibold text-text">{selectedInfo.yearShengXiao}</div>
            </div>
            <div className="rounded-2xl liquid-glass-chip px-3 py-2">
              <div className="text-[10px] text-text-muted">星座</div>
              <div className="mt-1 text-sm font-semibold text-text">{selectedInfo.constellation}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-success/20 bg-success/10 p-3 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-success">
                <CalendarDays size={14} />
                宜
              </div>
              <p className="text-xs leading-relaxed text-text">{selectedInfo.yi.slice(0, 8).join(' · ') || '—'}</p>
            </div>
            <div className="rounded-2xl border border-danger/20 bg-danger/10 p-3 backdrop-blur-sm">
              <div className="mb-2 text-xs font-bold text-danger">忌</div>
              <p className="text-xs leading-relaxed text-text">{selectedInfo.ji.slice(0, 8).join(' · ') || '—'}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-text-muted">
            <div className="rounded-xl liquid-glass-chip px-2.5 py-2">喜神 {selectedInfo.positions.xi}</div>
            <div className="rounded-xl liquid-glass-chip px-2.5 py-2">财神 {selectedInfo.positions.cai}</div>
            <div className="rounded-xl liquid-glass-chip px-2.5 py-2">福神 {selectedInfo.positions.fu}</div>
            <div className="rounded-xl liquid-glass-chip px-2.5 py-2">阳贵 {selectedInfo.positions.yangGui}</div>
          </div>
        </aside>
      </div>
    </div>
  )
})
