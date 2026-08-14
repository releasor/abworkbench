import { useEffect, useMemo, useRef, useState } from 'react';
import { nextDateStrN, todayStr as getTodayStr } from '../dateUtils';
import { WEEKDAY_LABELS, MONTH_LABELS, parseDate, getMonthDays, shiftMonth } from '../utils/calendarUtils';
import { Icon } from './Icon';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
}

function formatDisplay(dateStr: string): string {
  const date = parseDate(dateStr);
  if (!date) return '未设置截止日期';
  return `${date.getMonth() + 1}月${date.getDate()}日 · 周${WEEKDAY_LABELS[(date.getDay() + 6) % 7]}`;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseDate(value) ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const todayStr = getTodayStr();
  const selectedDate = parseDate(value);
  const days = useMemo(() => getMonthDays(viewDate), [viewDate]);

  const presets = useMemo(() => [
    { label: '今天', sub: '立即处理', dateStr: todayStr },
    { label: '明天', sub: '下一天', dateStr: nextDateStrN(todayStr, 1) },
    { label: '后天', sub: '留出缓冲', dateStr: nextDateStrN(todayStr, 2) },
    { label: '下周', sub: '七天后', dateStr: nextDateStrN(todayStr, 7) },
    { label: '下个月', sub: '长期计划', dateStr: nextDateStrN(todayStr, 30) },
  ], [todayStr]);

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
    onChange(dateStr);
    const date = parseDate(dateStr);
    if (date) setViewDate(date);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative" role="group" aria-label="日期选择器">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition-all ${
          value
            ? 'border-blue-500/60 bg-blue-500/10 text-blue-700 shadow-blue-500/10 dark:text-blue-200'
            : 'border-gray-200 bg-white/75 text-gray-700 hover:border-blue-400/70 hover:bg-blue-50/70 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-blue-500/60 dark:hover:bg-blue-500/10'
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${value ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300'}`}>
          <Icon name="calendar" className="w-4 h-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">Due date</span>
          <span className="mt-0.5 block truncate text-sm font-semibold">{formatDisplay(value)}</span>
        </span>
        <Icon name="chevron-down" className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-3 w-[28rem] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl shadow-black/15 dark:border-white/10 dark:bg-[#0d0d0f] dark:shadow-black/60"
          role="dialog"
          aria-label="选择截止日期"
        >
          <div className="border-b border-gray-200 p-3 dark:border-white/10">
            <div className="grid grid-cols-5 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => selectDate(preset.dateStr)}
                  className={`rounded-2xl px-3 py-2 text-left transition ${
                    value === preset.dateStr
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-600 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-blue-500/10 dark:hover:text-blue-200'
                  }`}
                >
                  <span className="block text-xs font-bold">{preset.label}</span>
                  <span className={`block text-[10px] ${value === preset.dateStr ? 'text-blue-100' : 'text-gray-400'}`}>{preset.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-gray-950 dark:text-white">{viewDate.getFullYear()}年 {MONTH_LABELS[viewDate.getMonth()]}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{selectedDate ? formatDisplay(value) : '选择一个任务截止日'}</div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setViewDate((date) => shiftMonth(date, -1))}
                  className="grid h-9 w-9 place-items-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
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
                  className="grid h-9 w-9 place-items-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="下个月"
                >
                  <Icon name="chevron-right" className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_LABELS.map((weekday) => (
                <div key={weekday} className="py-1 text-center text-[11px] font-semibold text-gray-400 dark:text-gray-500">{weekday}</div>
              ))}
              {days.map((calendarDay) => {
                const isSelected = calendarDay.dateStr === value;
                const isToday = calendarDay.dateStr === todayStr;
                return (
                  <button
                    key={calendarDay.dateStr}
                    type="button"
                    onClick={() => selectDate(calendarDay.dateStr)}
                    className={`relative h-10 rounded-xl text-sm font-semibold transition-all ${
                      isSelected
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                        : calendarDay.inMonth
                          ? 'text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-white/10'
                          : 'text-gray-300 hover:bg-gray-50 dark:text-gray-700 dark:hover:bg-white/5'
                    }`}
                  >
                    {calendarDay.day}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="w-full border-t border-gray-200 px-4 py-3 text-sm font-semibold text-gray-500 transition hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:hover:bg-red-500/10 dark:hover:text-red-300"
            >
              清除截止日期
            </button>
          )}
        </div>
      )}
    </div>
  );
}
