import type { HabitSchedule } from '../../store'
import { DEFAULT_HABIT_SCHEDULE } from './habitSchedule'
import { HourSelect } from './HourSelect'

interface HabitScheduleSelectorProps {
  schedule: HabitSchedule
  onChange: (schedule: HabitSchedule) => void
}

const MODE_OPTIONS: Array<{ value: HabitSchedule['mode']; label: string; hint: string }> = [
  { value: 'once', label: '每日一次', hint: '每天完成 1 次即达标' },
  { value: 'multiple', label: '每日多次', hint: '同一天可多次打卡，达到目标次数即达标' },
  { value: 'window', label: '时段内多次', hint: '在指定时间段内打卡，达到目标次数即达标' },
]

export function HabitScheduleSelector({ schedule, onChange }: HabitScheduleSelectorProps) {
  const targetCount = Math.max(1, schedule.targetCount || 1)

  const setMode = (mode: HabitSchedule['mode']) => {
    if (mode === 'once') {
      onChange({ mode, targetCount: 1 })
      return
    }
    onChange({
      mode,
      targetCount: Math.max(2, targetCount),
      windowStartHour: mode === 'window' ? (schedule.windowStartHour ?? 6) : undefined,
      windowEndHour: mode === 'window' ? (schedule.windowEndHour ?? 9) : undefined,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-2 block text-xs font-medium text-text-muted">打卡频率</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                schedule.mode === option.value
                  ? 'border-primary/50 bg-primary/15 text-text ring-1 ring-primary/30'
                  : 'border-border bg-surface-lighter/70 text-text hover:border-primary/25'
              }`}
            >
              <div className={schedule.mode === option.value ? 'text-sm font-semibold text-primary' : 'text-sm font-semibold text-text'}>
                {option.label}
              </div>
              <div className="mt-1 text-[11px] leading-4 text-text-muted">{option.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {schedule.mode !== 'once' && (
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-text-muted">目标次数</span>
          <input
            type="number"
            min={2}
            max={99}
            value={targetCount}
            onChange={(event) => onChange({
              ...schedule,
              targetCount: Math.max(2, Math.min(99, Number(event.target.value) || 2)),
            })}
            className="input-field h-11 w-full rounded-2xl px-4 text-sm"
          />
        </label>
      )}

      {schedule.mode === 'window' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <HourSelect
            label="开始时间"
            value={schedule.windowStartHour ?? 6}
            onChange={(hour) => onChange({ ...schedule, windowStartHour: hour })}
          />
          <HourSelect
            label="结束时间"
            value={schedule.windowEndHour ?? 9}
            onChange={(hour) => onChange({ ...schedule, windowEndHour: hour })}
          />
        </div>
      )}
    </div>
  )
}

export function createDefaultSchedule(): HabitSchedule {
  return { ...DEFAULT_HABIT_SCHEDULE }
}
