import { useState } from 'react';
import type { RecurringPattern } from '../types'
import { WEEKDAYS, todayStr } from '../dateUtils';

interface RecurringTaskEditorProps {
  value: RecurringPattern | null;
  onChange: (pattern: RecurringPattern | null) => void;
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
];

export function RecurringTaskEditor({ value, onChange }: RecurringTaskEditorProps) {
  const [enabled, setEnabled] = useState(!!value);
  const [pattern, setPattern] = useState<RecurringPattern>(
    value || {
      frequency: 'daily',
      interval: 1,
    }
  );

  const handleToggle = () => {
    if (enabled) {
      setEnabled(false);
      onChange(null);
    } else {
      setEnabled(true);
      onChange(pattern);
    }
  };

  const updatePattern = (updates: Partial<RecurringPattern>) => {
    const newPattern = { ...pattern, ...updates };
    setPattern(newPattern);
    if (enabled) {
      onChange(newPattern);
    }
  };

  const toggleDayOfWeek = (day: number) => {
    const days = pattern.daysOfWeek || [];
    const newDays = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort();
    updatePattern({ daysOfWeek: newDays.length > 0 ? newDays : undefined });
  };

  return (
    <div role="group" aria-label="重复任务设置">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-text" id="recurring-label">
          重复任务
        </label>
        <button
          type="button"
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${ enabled ? 'bg-blue-600' : 'bg-surface-lighter ' }`}
          role="switch"
          aria-checked={enabled}
          aria-labelledby="recurring-label"
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${ enabled ? 'translate-x-4' : 'translate-x-0.5' }`}
            aria-hidden="true"
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-3 p-3 bg-surface-lighter rounded-lg" aria-label="重复模式配置">
          <div className="flex gap-2">
            <span className="text-sm text-text-muted py-2">每</span>
            <label htmlFor="recurring-interval" className="sr-only">间隔数量</label>
            <input
              id="recurring-interval"
              type="number"
              min="1"
              max="365"
              value={pattern.interval}
              onChange={(e) => updatePattern({ interval: parseInt(e.target.value) || 1 })}
              className="input w-16 text-center text-sm"
              aria-label="重复间隔"
            />
            <label htmlFor="recurring-frequency" className="sr-only">频率单位</label>
            <select
              id="recurring-frequency"
              value={pattern.frequency}
              onChange={(e) => updatePattern({ frequency: e.target.value as RecurringPattern['frequency'] })}
              className="input flex-1 text-sm"
              aria-label="重复频率"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Weekly: select days */}
          {pattern.frequency === 'weekly' && (
            <div role="group" aria-label="选择星期">
              <p className="text-xs text-text-muted mb-2">选择星期:</p>
              <div className="flex gap-1">
                {WEEKDAYS.map((name, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleDayOfWeek(index)}
                    className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${ pattern.daysOfWeek?.includes(index) ? 'bg-blue-600 text-white' : 'bg-surface-lighter text-text hover:bg-surface-lighter ' }`}
                    aria-pressed={pattern.daysOfWeek?.includes(index)}
                    aria-label={`星期${name}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monthly: select day of month */}
          {pattern.frequency === 'monthly' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">每月第</span>
              <label htmlFor="recurring-day" className="sr-only">每月第几天</label>
              <input
                id="recurring-day"
                type="number"
                min="1"
                max="31"
                value={pattern.dayOfMonth || 1}
                onChange={(e) => updatePattern({ dayOfMonth: parseInt(e.target.value) || 1 })}
                className="input w-16 text-center text-sm"
                aria-label="每月第几天"
              />
              <span className="text-sm text-text-muted">天</span>
            </div>
          )}

          {/* End date */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!pattern.endDate}
                onChange={(e) => updatePattern({ endDate: e.target.checked ? todayStr() : null })}
                className="rounded"
                aria-label="启用结束日期"
              />
              <span className="text-sm text-text-muted">设置结束日期</span>
            </label>
            {pattern.endDate && (
              <>
                <label htmlFor="recurring-end-date" className="sr-only">结束日期</label>
                <input
                  id="recurring-end-date"
                  type="date"
                  value={pattern.endDate.split('T')[0]}
                  onChange={(e) => updatePattern({ endDate: e.target.value ? e.target.value + 'T00:00:00.000Z' : null })}
                  className="input mt-1 text-sm"
                  aria-label="重复任务结束日期"
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
