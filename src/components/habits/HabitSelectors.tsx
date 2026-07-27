import { memo } from 'react'
import clsx from 'clsx'
import { HABIT_COLORS, HABIT_ICONS } from './habitConstants'

export const IconSelector = memo(function IconSelector({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (icon: string) => void
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">选择图标</span>
        <span className="text-[10px] text-text-muted/60">用于快速识别打卡项</span>
      </div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
        {HABIT_ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            onClick={() => onSelect(icon)}
            title={icon}
            aria-label={`选择图标 ${icon}`}
            className={clsx(
              'group relative h-11 rounded-2xl border text-xl transition-all duration-200',
              selected === icon
                ? 'border-primary bg-primary/15 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_18%,transparent)] scale-[1.04]'
                : 'border-border/70 bg-surface/70 hover:border-primary/50 hover:bg-surface-lighter',
            )}
          >
            <span className="block transition-transform group-hover:scale-110">{icon}</span>
          </button>
        ))}
      </div>
    </section>
  )
})

export const ColorSelector = memo(function ColorSelector({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (color: string) => void
}) {
  return (
    <section>
      <div className="mb-2 text-xs font-medium text-text-muted">选择强调色</div>
      <div className="flex flex-wrap gap-2">
        {HABIT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onSelect(color)}
            title={color}
            aria-label={`选择颜色 ${color}`}
            className={clsx(
              'relative h-9 w-12 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5',
              selected === color ? 'border-white/80 shadow-lg scale-105' : 'border-white/10',
            )}
            style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #000))` }}
          >
            {selected === color && (
              <span className="absolute inset-1 rounded-xl border border-white/60" />
            )}
          </button>
        ))}
      </div>
    </section>
  )
})
