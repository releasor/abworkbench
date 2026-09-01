import { useEffect, useMemo, useRef, useState } from 'react';
import { nextDateStrN, todayStr as getTodayStr } from '../dateUtils';
import { WEEKDAY_LABELS, MONTH_LABELS, parseDate, getMonthDays, shiftMonth } from '../utils/calendarUtils';
import { Icon } from './Icon';

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (range: { dueDateFrom: string; dueDateTo: string }) => void;
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return '未选择';
  const date = parseDate(dateStr);
  if (!date) return dateStr;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseDate(from || to) ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const todayStr = getTodayStr();
  const hasRange = Boolean(from || to);

  const days = useMemo(() => getMonthDays(viewDate), [viewDate]);
  const presets = useMemo(() => {
    const tomorrowStr = nextDateStrN(todayStr, 1);
    const weekEndStr = nextDateStrN(todayStr, 6);
    const nextWeekEndStr = nextDateStrN(todayStr, 13);
    return [
      { label: '今天', sub: '只看今日', range: { dueDateFrom: todayStr, dueDateTo: todayStr } },
      { label: '明天', sub: '下一天', range: { dueDateFrom: tomorrowStr, dueDateTo: tomorrowStr } },
      { label: '未来 7 天', sub: '短期计划', range: { dueDateFrom: todayStr, dueDateTo: weekEndStr } },
      { label: '未来 14 天', sub: '冲刺周期', range: { dueDateFrom: todayStr, dueDateTo: nextWeekEndStr } },
    ];
  }, [todayStr]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectDate = (dateStr: string) => {
    if (!from || (from && to) || dateStr < from) {
      onChange({ dueDateFrom: dateStr, dueDateTo: '' });
      return;
    }
    onChange({ dueDateFrom: from, dueDateTo: dateStr });
  };

  const applyPreset = (range: { dueDateFrom: string; dueDateTo: string }) => {
    onChange(range);
    const targetDate = parseDate(range.dueDateFrom);
    if (targetDate) setViewDate(targetDate);
    setOpen(false);
  };

  const clearRange = () => {
    onChange({ dueDateFrom: '', dueDateTo: '' });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`group flex min-w-[18rem] items-center gap-3 rounded-2xl border px-4 py-2.5 text-left shadow-sm transition-all ${ hasRange ? 'border-blue-500/60 bg-blue-500/10 text-blue-700 shadow-blue-500/10 dark:text-blue-200' : 'border-border bg-white/70 text-text hover:border-blue-400/70 hover:bg-blue-50/70 dark:bg-white/[0.03] dark:hover:border-blue-500/60 dark:hover:bg-blue-500/10' }`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="选择日期范围"
      >
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${hasRange ? 'bg-blue-500 text-white' : 'bg-surface-lighter text-text-muted '}`}>
          <Icon name="calendar" className="w-4 h-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">Due range</span>
          <span className="mt-0.5 block truncate text-sm font-semibold">
            {hasRange ? `${formatDisplay(from)} — ${formatDisplay(to)}` : '选择截止日期范围'}
          </span>
        </span>
        <Icon name="chevron-down" className={`w-4 h-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-3 w-[34rem] overflow-hidden rounded-3xl border border-border glass-card shadow-2xl"
          role="dialog"
          aria-label="日期范围日历"
        >
          <div className="flex items-stretch">
            <aside className="w-40 border-r border-border bg-surface-lighter/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mb-3 px-2 text-xs font-semibold text-text-muted">快速选择</div>
              <div className="space-y-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset.range)}
                    className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-white hover:shadow-sm dark:hover:bg-white/10"
                  >
                    <span className="block text-sm font-semibold text-text">{preset.label}</span>
                    <span className="block text-[11px] text-text-muted">{preset.sub}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={clearRange}
                className="mt-4 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium text-text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              >
                清除范围
              </button>
            </aside>

            <section className="flex-1 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-text dark:text-white">{viewDate.getFullYear()}年 {MONTH_LABELS[viewDate.getMonth()]}</div>
                  <div className="text-xs text-text-muted">
                    {hasRange ? `${formatDisplay(from)} 至 ${formatDisplay(to)}` : '选择开始日期，再选择结束日期'}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setViewDate((date) => shiftMonth(date, -1))}
                    className="grid h-9 w-9 place-items-center rounded-xl text-text-muted transition hover:bg-surface-lighter hover:text-text dark:hover:bg-white/10 dark:hover:text-white"
                    aria-label="上个月"
                  >
                    <Icon name="chevron-left" className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewDate(new Date())}
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                  >
                    今天
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewDate((date) => shiftMonth(date, 1))}
                    className="grid h-9 w-9 place-items-center rounded-xl text-text-muted transition hover:bg-surface-lighter hover:text-text dark:hover:bg-white/10 dark:hover:text-white"
                    aria-label="下个月"
                  >
                    <Icon name="chevron-right" className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_LABELS.map((weekday) => (
                  <div key={weekday} className="py-1 text-center text-[11px] font-semibold text-text-muted">{weekday}</div>
                ))}
                {days.map((calendarDay) => {
                  const isStart = calendarDay.dateStr === from;
                  const isEnd = calendarDay.dateStr === to;
                  const inRange = from && to && calendarDay.dateStr > from && calendarDay.dateStr < to;
                  const isToday = calendarDay.dateStr === todayStr;

                  return (
                    <button
                      key={calendarDay.dateStr}
                      type="button"
                      onClick={() => selectDate(calendarDay.dateStr)}
                      className={`relative h-10 rounded-xl text-sm font-semibold transition-all ${ isStart || isEnd ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : inRange ? 'bg-blue-500/10 text-blue-600 dark:text-blue-200' : calendarDay.inMonth ? 'text-text hover:bg-surface-lighter dark:hover:bg-white/10' : 'text-text-muted hover:bg-surface-lighter dark:text-text-muted dark:hover:bg-white/5' }`}
                    >
                      {calendarDay.day}
                      {isToday && !(isStart || isEnd) && (
                        <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
