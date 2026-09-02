import { memo, useMemo } from 'react'
import { Clock, Globe2, BriefcaseBusiness, Timer, Sunrise, Sunset } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { useTick } from '../../hooks/useTick'
import { useStore } from '../../store'
import { useToday } from '../../hooks/useToday'
import { buildWorkdayStatus, readWorkdaySettings, formatCountdown, formatCurrency } from './workday'
import { getWeekdayLabel } from '../../utils/chineseCalendar'

const WORLD_ZONES = [
  { label: '北京', timeZone: 'Asia/Shanghai' },
  { label: '东京', timeZone: 'Asia/Tokyo' },
  { label: '伦敦', timeZone: 'Europe/London' },
  { label: '纽约', timeZone: 'America/New_York' },
] as const

function formatZoneTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  })
}

export default memo(function TimePanel() {
  const { t } = useTranslation()
  const now = useTick(1000)
  const { todayMidnightMs, tomorrowMidnightMs } = useToday()
  const pomodoroSessions = useStore((s) => s.pomodoroSessions)
  const dailyPomodoroGoal = useStore((s) => s.dailyPomodoroGoal)

  const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false })
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const hour = now.getHours()
  const period = hour < 6 ? '深夜' : hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上'
  const dayProgress = ((hour * 60 + now.getMinutes()) / 1440) * 100
  const workdaySettings = useMemo(() => readWorkdaySettings(), [])
  const workdayStatus = useMemo(() => buildWorkdayStatus({ now, settings: workdaySettings }), [now, workdaySettings])

  const todayPomodoros = useMemo(
    () => pomodoroSessions.filter((s) => s.type === 'work' && s.completed && s.startedAt >= todayMidnightMs && s.startedAt < tomorrowMidnightMs).length,
    [pomodoroSessions, todayMidnightMs, tomorrowMidnightMs],
  )

  const worldTimes = WORLD_ZONES.map((zone) => ({
    ...zone,
    time: formatZoneTime(now, zone.timeZone),
  }))

  const workPhaseLabel = workdayStatus.phase === 'before'
    ? '尚未上班'
    : workdayStatus.phase === 'working'
      ? '工作中'
      : workdayStatus.phase === 'done'
        ? '已下班'
        : '工时设置无效'

  return (
    <div className="liquid-glass-panel modal-panel-cinematic overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="relative overflow-hidden p-5 md:p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-text">
              <span className="grid h-9 w-9 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Clock size={16} />
              </span>
              {t('clock.title')}
            </div>
            <span className="rounded-full liquid-glass-chip px-3 py-1 text-xs font-semibold text-text-muted">{period}</span>
          </div>

          <div className="relative py-6 text-center">
            <div className="font-mono text-5xl font-black tabular-nums tracking-tight text-text md:text-6xl">
              {timeStr}
            </div>
            <p className="mt-3 text-sm text-text-muted">{dateStr}</p>
            <p className="mt-1 text-xs text-text-muted">{getWeekdayLabel(now)} · 今日已过 {Math.round(dayProgress)}%</p>
          </div>

          <div className="relative">
            <div className="mb-2 flex items-center justify-between text-[11px] text-text-muted">
              <span>今日进度</span>
              <span>{Math.round(dayProgress)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-background/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-400 to-success transition-all duration-500"
                style={{ width: `${dayProgress}%` }}
              />
            </div>
          </div>
        </div>

        <aside className="liquid-glass-pane border-t border-white/10 p-5 md:p-6 lg:border-l lg:border-t-0">
          <div className="mb-4 rounded-2xl border border-primary/25 bg-primary/10 p-4 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
              <BriefcaseBusiness size={14} />
              工作日
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] text-text-muted">{workPhaseLabel}</div>
                <div className="mt-1 font-mono text-2xl font-black tabular-nums text-text">
                  {workdayStatus.phase === 'working' ? formatCountdown(workdayStatus.remainingMs) : workdayStatus.phase === 'before' ? formatCountdown(workdayStatus.startAt.getTime() - now.getTime()) : '00:00:00'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-text-muted">今日已赚</div>
                <div className="mt-1 text-sm font-bold text-success">{formatCurrency(workdayStatus.todayEarned)}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-text-muted">
              <span className="inline-flex items-center gap-1"><Sunrise size={11} />{workdaySettings.startTime}</span>
              <span>{workdayStatus.progress}%</span>
              <span className="inline-flex items-center gap-1"><Sunset size={11} />{workdaySettings.endTime}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-lighter">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-success" style={{ width: `${workdayStatus.progress}%` }} />
            </div>
          </div>

          <div className="mb-4 rounded-2xl liquid-glass-chip p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-text">
              <Timer size={14} className="text-primary" />
              今日番茄
            </div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-black text-text">{todayPomodoros}</div>
              <div className="text-xs text-text-muted">目标 {dailyPomodoroGoal}</div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/70">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, (todayPomodoros / Math.max(1, dailyPomodoroGoal)) * 100)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-text">
              <Globe2 size={14} className="text-primary" />
              世界时间
            </div>
            <div className="grid grid-cols-2 gap-2">
              {worldTimes.map((zone) => (
                <div key={zone.timeZone} className="rounded-xl liquid-glass-chip px-3 py-2">
                  <div className="text-[10px] text-text-muted">{zone.label}</div>
                  <div className="mt-1 font-mono text-sm font-bold tabular-nums text-text">{zone.time}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
})
