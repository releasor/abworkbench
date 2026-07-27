import { memo } from 'react'
import { Clock, Calendar } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { useTick } from '../../hooks/useTick'

export default memo(function ClockWidget() {
  const { t } = useTranslation()
  const now = useTick(1000)

  const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false })
  const dateStr = now.toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const hour = now.getHours()
  const period = hour < 6 ? '深夜' : hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上'
  const dayProgress = ((hour * 60 + now.getMinutes()) / 1440) * 100

  return (
    <div className="relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-[34px] border border-border bg-surface/85 p-6 shadow-2xl shadow-black/10 backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-text">
          <span className="grid h-9 w-9 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <Clock size={16} />
          </span>
          {t('clock.title')}
        </div>
        <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-semibold text-text-muted">{period}</span>
      </div>
      <div className="relative text-center">
        <div className="text-6xl font-black tracking-tight text-text font-mono tabular-nums md:text-7xl">
        {timeStr}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-text-muted">
          <Calendar size={14} />
          <span>{dateStr}</span>
        </div>
      </div>
      <div className="relative">
        <div className="mb-2 flex items-center justify-between text-[11px] text-text-muted">
          <span>今日进度</span>
          <span>{Math.round(dayProgress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-background/70">
          <div className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-400 to-success transition-all duration-500" style={{ width: `${dayProgress}%` }} />
        </div>
      </div>
    </div>
  )
})
