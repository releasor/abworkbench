import type { RefObject } from 'react'
import { Plus, Sparkles, X } from 'lucide-react'
import type { HabitSchedule } from '../../store'
import { IconSelector, ColorSelector } from './HabitSelectors'
import { HabitScheduleSelector } from './HabitScheduleSelector'

interface HabitFormProps {
  title: string
  submitLabel: string
  name: string
  icon: string
  color: string
  schedule: HabitSchedule
  inputRef?: RefObject<HTMLInputElement | null>
  onNameChange: (name: string) => void
  onIconChange: (icon: string) => void
  onColorChange: (color: string) => void
  onScheduleChange: (schedule: HabitSchedule) => void
  onSubmit: () => void
  onClose: () => void
}

export function HabitForm({
  title,
  submitLabel,
  name,
  icon,
  color,
  schedule,
  inputRef,
  onNameChange,
  onIconChange,
  onColorChange,
  onScheduleChange,
  onSubmit,
  onClose,
}: HabitFormProps) {
  return (
    <div className="overflow-visible rounded-[28px] border border-border bg-surface/85 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div
        className="border-b border-border/70 p-5"
        style={{ background: `linear-gradient(135deg, ${color}22, transparent 62%)` }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shadow-lg"
              style={{ backgroundColor: `${color}24`, color }}
            >
              {icon}
            </div>
            <div>
              <h3 className="text-base font-semibold text-text">{title}</h3>
              <p className="mt-0.5 text-xs text-text-muted">给自己一个每天都能完成的小承诺。</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-xl p-2 text-text-muted transition-colors hover:bg-surface-lighter hover:text-text"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-text-muted">打卡名称</span>
          <div className="relative">
            <Sparkles size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && onSubmit()}
              placeholder="例如：阅读 30 分钟、早睡、喝水"
              aria-label="打卡名称"
              className="input-field h-[52px] rounded-2xl pl-11 text-base"
              autoFocus
            />
          </div>
        </label>

        <IconSelector selected={icon} onSelect={onIconChange} />
        <ColorSelector selected={color} onSelect={onColorChange} />
        <HabitScheduleSelector schedule={schedule} onChange={onScheduleChange} />

        <button
          type="button"
          onClick={onSubmit}
          className="btn-primary h-12 w-full justify-center rounded-2xl text-base"
        >
          <Plus size={18} />
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
