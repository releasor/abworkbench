import type { ReactNode } from 'react'
import { Flame, Gauge, Target, Trophy } from 'lucide-react'
import clsx from 'clsx'
import type { Habit } from '../../store'
import type { HabitBodyStats } from './habitUtils'

interface HabitStatsProps {
  habits: Habit[]
  habitDateSets: Array<Set<string>>
  todayStr: string
  stats: HabitBodyStats
  weekCompletions: number
}

export function HabitStats({
  habits,
  habitDateSets,
  todayStr,
  stats,
  weekCompletions,
}: HabitStatsProps) {
  const { totalCompletedToday, completionRate, totalStreak, activeStreaks, totalCompletions } = stats
  const progressLabel = habits.length > 0 ? `${totalCompletedToday}/${habits.length}` : '0/0'
  const tone = completionRate >= 80 ? 'text-success' : completionRate >= 50 ? 'text-warning' : 'text-primary'

  return (
    <div className="overflow-hidden rounded-[32px] border border-border bg-surface/80 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="relative p-5 md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(59,130,246,0.18),transparent_34%),radial-gradient(circle_at_100%_10%,rgba(16,185,129,0.13),transparent_30%)]" />
        <div className="relative grid gap-5 lg:grid-cols-[1.25fr_2fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Target size={14} />
              每日打卡
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-text">今天完成 {progressLabel}</h2>
            <p className="mt-2 text-sm text-text-muted">
              {habits.length === 0 ? '添加第一个打卡项，开始建立稳定节奏。' : completionRate === 100 ? '今日全部完成，节奏非常漂亮。' : '把目标拆小一点，每天都能向前一点。'}
            </p>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-surface-lighter">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-info to-success transition-all duration-700"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard icon={<Target size={17} />} label="打卡项" value={habits.length} detail={`本周 ${weekCompletions} 次`} />
            <StatCard icon={<Trophy size={17} />} label="今日完成" value={progressLabel} detail={`累计 ${totalCompletions} 次`} accent="text-success" />
            <StatCard icon={<Flame size={17} />} label="最长连续" value={`${totalStreak} 天`} detail={activeStreaks > 0 ? `${activeStreaks} 项保持中` : '等待点燃'} accent="text-warning" />
            <StatCard icon={<Gauge size={17} />} label="完成率" value={`${completionRate}%`} detail="今日进度" accent={tone} />
          </div>
        </div>

        {habits.length > 0 && habits.length <= 10 && (
          <div className="relative mt-5 flex flex-wrap gap-2 border-t border-border/60 pt-4">
            {habits.map((habit, index) => {
              const done = habitDateSets[index].has(todayStr)
              return (
                <div
                  key={habit.id}
                  title={`${habit.icon} ${habit.name}${done ? ' 已完成' : ' 未完成'}`}
                  className={clsx(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all',
                    done
                      ? 'border-success/30 bg-success/10 text-success'
                      : 'border-border bg-surface/70 text-text-muted',
                  )}
                >
                  <span>{done ? '✓' : habit.icon}</span>
                  <span className="max-w-[9rem] truncate">{habit.name}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  detail,
  accent = 'text-primary',
}: {
  icon: ReactNode
  label: string
  value: string | number
  detail: string
  accent?: string
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background/45 p-4 shadow-inner shadow-white/5">
      <div className={clsx('mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-surface-lighter', accent)}>
        {icon}
      </div>
      <div className="text-2xl font-semibold text-text">{value}</div>
      <div className="mt-1 text-xs text-text-muted">{label} · {detail}</div>
    </div>
  )
}
