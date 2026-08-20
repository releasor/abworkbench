import { Calendar, Flame } from 'lucide-react'
import type { TaskFlowSummaryStats } from '../utils/summaryStats'
import { useTranslation } from '../../../i18n'

interface TaskFlowSummaryProps {
  stats: TaskFlowSummaryStats
}

export function TaskFlowSummary({ stats }: TaskFlowSummaryProps) {
  const { t, tWith } = useTranslation()
  const summaryCards = [
    {
      label: t('taskflow.summary.total'),
      value: stats.total,
      accent: 'from-blue-500 to-sky-400',
      detail: stats.overdue > 0 ? tWith('taskflow.summary.overdueCount', stats.overdue) : null,
      detailClass: 'text-danger',
    },
    {
      label: t('taskflow.summary.active'),
      value: stats.active,
      accent: 'from-amber-500 to-orange-500',
      detail: stats.total > 0 ? tWith('taskflow.summary.completionRate', stats.completionRate) : null,
      detailClass: 'text-orange-400',
    },
    {
      label: t('taskflow.summary.completed'),
      value: stats.completed,
      accent: 'from-emerald-500 to-teal-400',
      detail: stats.todayCompleted > 0 ? tWith('taskflow.summary.todayCount', stats.todayCompleted) : null,
      detailClass: 'text-success',
    },
  ]

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="group relative overflow-hidden rounded-3xl border border-border bg-white/70 p-4 text-left shadow-xl shadow-black/5 transition hover:-translate-y-0.5 hover:shadow-2xl dark:border-white/10 dark:bg-white/[0.03] dark:shadow-black/25">
            <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${card.accent}`} />
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{card.label}</div>
              <div className={`h-2 w-2 rounded-full bg-gradient-to-br ${card.accent} shadow-sm`} />
            </div>
            <div className="text-3xl font-black tracking-tight text-text">{card.value}</div>
            <div className={`mt-3 h-1.5 rounded-full bg-gradient-to-r ${card.accent} opacity-90`} />
            {card.detail && (
              <div className={`mt-2 text-[11px] font-medium ${card.detailClass}`}>{card.detail}</div>
            )}
          </div>
        ))}
      </div>

      {stats.total > 0 && (
        <div className="rounded-3xl border border-border bg-white/70 p-5 shadow-xl shadow-black/5 dark:border-white/10 dark:bg-white/[0.03] dark:shadow-black/25">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text">{t('taskflow.summary.progress')}</span>
            <span className={`text-sm font-medium ${stats.active === 0 ? 'text-success' : 'text-primary'}`}>
              {stats.completionRate}%
            </span>
          </div>
          <div className="h-2.5 bg-surface-lighter rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${stats.completionRate}%`,
                background: stats.active === 0
                  ? 'linear-gradient(135deg, var(--color-success), #059669)'
                  : stats.completionRate >= 75
                    ? 'linear-gradient(135deg, var(--color-success), var(--color-primary))'
                    : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-text-muted">
            <div className="flex items-center gap-3">
              {stats.completionStreak >= 2 && (
                <span className="flex items-center gap-1">
                  <Flame size={10} className={stats.completionStreak >= 14 ? 'text-amber-400' : stats.completionStreak >= 7 ? 'text-orange-400' : 'text-warning'} />
                  {tWith('taskflow.summary.streak', stats.completionStreak)}
                </span>
              )}
              {stats.weekCompleted > 0 && (
                <span>{tWith('taskflow.summary.weekStats', stats.weekCompleted, stats.dailyAvg)}</span>
              )}
            </div>
            {stats.avgCompletionMin > 0 && (
              <span>{tWith('taskflow.summary.avgTime', stats.avgCompletionMin >= 60 ? `${Math.floor(stats.avgCompletionMin / 60)}h${stats.avgCompletionMin % 60}m` : `${stats.avgCompletionMin}m`)}</span>
            )}
          </div>
        </div>
      )}

      {stats.overdue > 0 && (
        <div className="glass-card p-3 flex items-center gap-3 border-danger/30">
          <div className="w-8 h-8 rounded-lg bg-danger/15 flex items-center justify-center">
            <Calendar size={16} className="text-danger" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-danger font-medium">{tWith('taskflow.summary.overdueTasks', stats.overdue)}</div>
            <div className="text-xs text-text-muted">{t('taskflow.summary.overdueHint')}</div>
          </div>
        </div>
      )}
    </>
  )
}
