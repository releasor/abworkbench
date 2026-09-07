import { memo, useMemo } from 'react'
import { Clock, Globe2, BriefcaseBusiness, Timer, Sunrise, Sunset, Banknote } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { useTick } from '../../hooks/useTick'
import { useStore } from '../../store'
import { useToday } from '../../hooks/useToday'
import { buildWorkdayStatus, readWorkdaySettings, formatCountdown, formatCurrency } from './workday'
import GlowPanel from '../common/BorderGlow/GlowPanel'

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

  const workCountdown = workdayStatus.phase === 'working'
    ? formatCountdown(workdayStatus.remainingMs)
    : workdayStatus.phase === 'before'
      ? formatCountdown(workdayStatus.startAt.getTime() - now.getTime())
      : '00:00:00'

  const pomoPct = Math.min(100, (todayPomodoros / Math.max(1, dailyPomodoroGoal)) * 100)

  return (
    <GlowPanel borderRadius={34} className="modal-panel-cinematic overflow-hidden">
      <div className="relative p-5 md:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm font-bold text-text">
            <span className="grid h-9 w-9 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Clock size={16} />
            </span>
            {t('clock.title')}
          </div>
          <span className="rounded-full border border-border bg-background/45 px-3 py-1 text-xs font-semibold text-text-muted">
            {period}
          </span>
        </div>

        <div className="relative mt-6 text-center">
          <div className="font-mono text-5xl font-black tabular-nums tracking-tight text-text md:text-6xl">
            {timeStr}
          </div>
          <p className="mt-2 text-sm text-text-muted">{dateStr}</p>
        </div>

        <div className="relative mt-6">
          <div className="mb-2 flex items-center justify-between text-[11px] text-text-muted">
            <span>今日进度</span>
            <span className="font-mono tabular-nums">{Math.round(dayProgress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-background/55">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-400 to-success transition-all duration-500"
              style={{ width: `${dayProgress}%` }}
            />
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3.5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
              <BriefcaseBusiness size={13} />
              {workPhaseLabel}
            </div>
            <div className="font-mono text-xl font-black tabular-nums text-text">{workCountdown}</div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted">
              <span className="inline-flex items-center gap-1"><Sunrise size={11} />{workdaySettings.startTime}</span>
              <span className="inline-flex items-center gap-1"><Sunset size={11} />{workdaySettings.endTime}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-lighter">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-success" style={{ width: `${workdayStatus.progress}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/40 p-3.5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-text-muted">
              <Banknote size={13} className="text-success" />
              今日已赚
            </div>
            <div className="text-xl font-black text-success">{formatCurrency(workdayStatus.todayEarned)}</div>
            <p className="mt-2 text-[10px] text-text-muted">工作日进度 {workdayStatus.progress}%</p>
          </div>

          <div className="rounded-2xl border border-border bg-background/40 p-3.5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-text-muted">
              <Timer size={13} className="text-primary" />
              今日番茄
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-text">{todayPomodoros}</span>
              <span className="text-[11px] text-text-muted">/ {dailyPomodoroGoal}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-background/70">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pomoPct}%` }} />
            </div>
          </div>
        </div>

        <div className="relative mt-5">
          <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-text-muted">
            <Globe2 size={13} className="text-primary" />
            世界时间
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {worldTimes.map((zone) => (
              <div key={zone.timeZone} className="rounded-xl border border-border bg-background/35 px-3 py-2.5 text-center">
                <div className="text-[10px] text-text-muted">{zone.label}</div>
                <div className="mt-1 font-mono text-sm font-bold tabular-nums text-text">{zone.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlowPanel>
  )
})
