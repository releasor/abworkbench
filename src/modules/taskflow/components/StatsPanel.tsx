import { useMemo } from 'react';
import { BarChart3, CheckCircle2, Clock3, Copy, Flame, Gauge, Scale, Tag, TimerReset } from 'lucide-react';
import { useTaskStore, getTimeSpentTotal } from '../hooks/useTaskStore';
import { ProductivityHeatmap } from './ProductivityHeatmap';
import { ProductivityTrends } from './ProductivityTrends';
import { StatsChart } from './StatsChart';
import { computeStreak, prevDateStrN, todayStr } from '../dateUtils';
import { playClickSound } from '../utils/sound';
import { showToast } from '../utils/toastEvent';
import { buildEstimationAccuracy } from '../utils/estimationAccuracy';
import type { Priority, Status } from '../types';

const STATUS_LABELS: Record<Status, string> = {
  todo: '待办',
  'in-progress': '进行中',
  review: '审核中',
  done: '已完成',
};

const STATUS_COLORS: Record<Status, string> = {
  todo: '#64748b',
  'in-progress': '#3b82f6',
  review: '#f59e0b',
  done: '#10b981',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#64748b',
  medium: '#f59e0b',
  high: '#fb923c',
  urgent: '#ef4444',
};

function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function getScoreTone(score: number) {
  if (score >= 85) return { label: '火力全开', color: 'text-emerald-300', ring: 'border-emerald-400/40 bg-emerald-500/10' };
  if (score >= 65) return { label: '状态不错', color: 'text-blue-300', ring: 'border-blue-400/40 bg-blue-500/10' };
  if (score >= 40) return { label: '稳步推进', color: 'text-amber-300', ring: 'border-amber-400/40 bg-amber-500/10' };
  return { label: '需要启动', color: 'text-zinc-300', ring: 'border-white/10 bg-white/[0.03]' };
}

export function StatsPanel() {
  const stats = useTaskStore((state) => state.stats);
  const tasks = useTaskStore((state) => state.tasks);
  const categories = useTaskStore((state) => state.categories);
  const filters = useTaskStore((state) => state.filters);
  const setFilters = useTaskStore((state) => state.setFilters);

  const derived = useMemo(() => {
    const today = todayStr();
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const completionDates = new Set<string>();
    const tagCounts = new Map<string, number>();
    let dueToday = 0;
    let activeTimers = 0;
    let totalTrackedSeconds = 0;
    let completedOnTime = 0;
    let completedWithDue = 0;

    const recentCompleted = tasks
      .filter((task) => task.completedAt)
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
      .slice(0, 5);

    const categoryStats = new Map<string, { name: string; color: string; total: number; done: number }>();

    for (const task of tasks) {
      if (task.completedAt) {
        completionDates.add(task.completedAt.slice(0, 10));
      }
      if (task.dueDate === today && task.status !== 'done') dueToday++;
      if (task.timeEntries.some((entry) => !entry.endTime)) activeTimers++;
      totalTrackedSeconds += getTimeSpentTotal(task);
      if (task.status === 'done' && task.dueDate) {
        completedWithDue++;
        if (task.completedAt && task.completedAt.slice(0, 10) <= task.dueDate) completedOnTime++;
      }

      const category = categoryMap.get(task.category);
      const categoryId = category?.id || 'uncategorized';
      const current = categoryStats.get(categoryId) || {
        name: category?.name || '未分类',
        color: category?.color || '#64748b',
        total: 0,
        done: 0,
      };
      current.total++;
      if (task.status === 'done') current.done++;
      categoryStats.set(categoryId, current);

      for (const tagName of task.tags) {
        tagCounts.set(tagName, (tagCounts.get(tagName) || 0) + 1);
      }
    }

    const currentStreak = computeStreak(completionDates, today);
    let longestStreak = 0;
    let runningStreak = 0;
    const sortedDates = [...completionDates].sort();
    for (let index = 0; index < sortedDates.length; index++) {
      runningStreak = index === 0 || sortedDates[index - 1] === prevDateStrN(sortedDates[index], 1) ? runningStreak + 1 : 1;
      longestStreak = Math.max(longestStreak, runningStreak);
    }

    const completionScore = stats && stats.total > 0 ? (stats.completed / stats.total) * 45 : 0;
    const streakScore = Math.min(25, currentStreak * 4);
    const onTimeScore = completedWithDue > 0 ? (completedOnTime / completedWithDue) * 30 : 15;
    const productivityScore = Math.round(completionScore + streakScore + onTimeScore);

    return {
      activeTimers,
      categoryRows: [...categoryStats.values()].sort((a, b) => b.total - a.total).slice(0, 6),
      dueToday,
      longestStreak,
      onTimeRate: completedWithDue > 0 ? Math.round((completedOnTime / completedWithDue) * 100) : null,
      productivityScore,
      recentCompleted,
      streak: currentStreak,
      tagRows: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
      totalTrackedSeconds,
      estimationAccuracy: buildEstimationAccuracy(tasks),
    };
  }, [categories, stats, tasks]);

  if (!stats) return null;

  const scoreTone = getScoreTone(derived.productivityScore);
  const statusEntries = Object.entries(stats.byStatus) as [Status, number][];
  const priorityEntries = Object.entries(stats.byPriority) as [Priority, number][];

  const copyStatsSummary = () => {
    const lines = [
      'TaskFlow 统计摘要',
      `总任务：${stats.total}`,
      `已完成：${stats.completed}`,
      `完成率：${stats.completionRate}%`,
      `逾期：${stats.overdue}`,
      `今日待处理：${derived.dueToday}`,
      `连续完成：${derived.streak} 天`,
      `累计计时：${formatMinutes(derived.totalTrackedSeconds)}`,
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(
      () => showToast('统计摘要已复制', 'success'),
      () => showToast('复制失败', 'error'),
    );
  };

  return (
    <section className="mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-black/40 shadow-2xl shadow-black/30" role="region" aria-label="任务统计面板">
      <div className="relative border-b border-white/10 p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(59,130,246,.22),transparent_32%),radial-gradient(circle_at_90%_0%,rgba(16,185,129,.14),transparent_30%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
              <BarChart3 className="h-3.5 w-3.5" />
              TaskFlow 数据洞察
            </span>
            <h3 className="mt-4 text-2xl font-bold text-white">任务推进仪表</h3>
            <p className="mt-2 text-sm text-zinc-500">聚合完成率、连续记录、分类表现和计时数据。</p>
          </div>
          <button
            onClick={copyStatsSummary}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <Copy className="h-4 w-4" />
            复制摘要
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Gauge className="h-5 w-5" />} label="效率评分" value={derived.productivityScore} suffix="/100" hint={scoreTone.label} className={scoreTone.ring} valueClassName={scoreTone.color} />
        <MetricCard icon={<CheckCircle2 className="h-5 w-5" />} label="完成率" value={`${stats.completionRate}%`} hint={`${stats.completed}/${stats.total} 已完成`} className="border-emerald-400/30 bg-emerald-500/10" valueClassName="text-emerald-300" />
        <MetricCard icon={<Flame className="h-5 w-5" />} label="连续完成" value={derived.streak} suffix="天" hint={`最长 ${derived.longestStreak} 天`} className="border-orange-400/30 bg-orange-500/10" valueClassName="text-orange-300" />
        <MetricCard icon={<Clock3 className="h-5 w-5" />} label="累计计时" value={formatMinutes(derived.totalTrackedSeconds)} hint={derived.activeTimers > 0 ? `${derived.activeTimers} 个任务计时中` : '暂无运行中的计时'} className="border-sky-400/30 bg-sky-500/10" valueClassName="text-sky-300" />
      </div>

      <div className="grid gap-4 px-6 pb-6 xl:grid-cols-[1fr_1fr_0.85fr]">
        <DistributionCard
          title="状态分布"
          entries={statusEntries.map(([key, count]) => ({ key, label: STATUS_LABELS[key], count, color: STATUS_COLORS[key], active: filters.status === key }))}
          total={stats.total}
          onSelect={(key) => { playClickSound(); setFilters({ status: filters.status === key ? 'all' : key as Status }); }}
        />
        <DistributionCard
          title="优先级分布"
          entries={priorityEntries.map(([key, count]) => ({ key, label: PRIORITY_LABELS[key], count, color: PRIORITY_COLORS[key], active: filters.priority === key }))}
          total={stats.total}
          onSelect={(key) => { playClickSound(); setFilters({ priority: filters.priority === key ? 'all' : key as Priority }); }}
        />
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-zinc-200">快速洞察</h4>
            <TimerReset className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="space-y-3 text-sm">
            <Insight label="今日到期" value={`${derived.dueToday} 个`} />
            <Insight label="逾期任务" value={`${stats.overdue} 个`} danger={stats.overdue > 0} />
            <Insight label="本周完成" value={`${stats.completedThisWeek} 个`} />
            <Insight label="准时完成" value={derived.onTimeRate === null ? '暂无数据' : `${derived.onTimeRate}%`} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-6 pb-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-200"><Scale className="h-4 w-4 text-amber-300" />预估准确度</h4>
          {derived.estimationAccuracy.rows.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">{derived.estimationAccuracy.tendencyLabel}</span>
                <span className={`text-lg font-bold ${derived.estimationAccuracy.accuracyScore >= 70 ? 'text-emerald-300' : derived.estimationAccuracy.accuracyScore >= 40 ? 'text-amber-300' : 'text-red-300'}`}>
                  {derived.estimationAccuracy.accuracyScore}分
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${derived.estimationAccuracy.accuracyScore}%`,
                    backgroundColor: derived.estimationAccuracy.accuracyScore >= 70 ? '#10b981' : derived.estimationAccuracy.accuracyScore >= 40 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
              <div className="text-xs text-zinc-500">
                基于 {derived.estimationAccuracy.rows.length} 个有预估和计时的任务 · 平均偏差 {derived.estimationAccuracy.averageAbsoluteError} 分钟
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {derived.estimationAccuracy.rows.slice(0, 5).map((row) => (
                  <div key={row.taskId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-zinc-300">{row.title}</span>
                    <span className={row.variancePercent > 15 ? 'text-red-300' : row.variancePercent < -15 ? 'text-amber-300' : 'text-emerald-300'}>
                      {row.estimatedMinutes}→{row.actualMinutes}分 ({row.variancePercent > 0 ? '+' : ''}{row.variancePercent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : <EmptyText text="需要有预估时间和实际计时的任务才能计算准确度" />}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="mb-4 text-sm font-semibold text-zinc-200">分类表现</h4>
          <div className="space-y-3">
            {derived.categoryRows.length > 0 ? derived.categoryRows.map((row) => {
              const rate = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
              return (
                <div key={row.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-zinc-300"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />{row.name}</span>
                    <span className="text-zinc-500">{row.done}/{row.total} · {rate}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${rate}%`, backgroundColor: row.color }} />
                  </div>
                </div>
              );
            }) : <EmptyText text="暂无分类数据" />}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-200"><Tag className="h-4 w-4 text-blue-300" />热门标签</h4>
          <div className="flex flex-wrap gap-2">
            {derived.tagRows.length > 0 ? derived.tagRows.map(([tagName, count]) => (
              <span key={tagName} className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-zinc-300">
                #{tagName} <span className="text-zinc-500">{count}</span>
              </span>
            )) : <EmptyText text="暂无标签数据" />}
          </div>
          {derived.recentCompleted.length > 0 && (
            <div className="mt-5 border-t border-white/10 pt-4">
              <h5 className="mb-3 text-xs font-semibold text-zinc-500">最近完成</h5>
              <div className="space-y-2">
                {derived.recentCompleted.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-3 py-2 text-sm text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="truncate line-through decoration-zinc-500">{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="space-y-6 border-t border-white/10 p-6">
        <StatsChart />
        <ProductivityHeatmap tasks={tasks} onDateClick={(date) => setFilters({ dueDateFrom: date, dueDateTo: date })} />
        <ProductivityTrends />
      </div>
    </section>
  );
}

function MetricCard({
  className,
  hint,
  icon,
  label,
  suffix,
  value,
  valueClassName,
}: {
  className: string;
  hint: string;
  icon: React.ReactNode;
  label: string;
  suffix?: string;
  value: number | string;
  valueClassName: string;
}) {
  return (
    <div className={`rounded-3xl border p-5 ${className}`}>
      <div className="mb-5 flex items-center justify-between text-zinc-400">
        <span className="text-sm">{label}</span>
        {icon}
      </div>
      <div className={`text-3xl font-bold ${valueClassName}`}>{value}<span className="text-base font-medium text-zinc-500">{suffix}</span></div>
      <p className="mt-2 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function DistributionCard({
  entries,
  onSelect,
  title,
  total,
}: {
  entries: Array<{ key: string; label: string; count: number; color: string; active: boolean }>;
  onSelect: (key: string) => void;
  title: string;
  total: number;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <h4 className="mb-4 text-sm font-semibold text-zinc-200">{title}</h4>
      <div className="space-y-3">
        {entries.map((entry) => {
          const percentage = total > 0 ? Math.round((entry.count / total) * 100) : 0;
          return (
            <button
              key={entry.key}
              onClick={() => onSelect(entry.key)}
              className={`w-full rounded-2xl p-3 text-left transition ${entry.active ? 'bg-blue-500/15 ring-1 ring-blue-400/40' : 'hover:bg-white/[0.05]'}`}
            >
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-zinc-300"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />{entry.label}</span>
                <span className="text-zinc-500">{entry.count} · {percentage}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-all" style={{ width: `${percentage}%`, backgroundColor: entry.color }} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Insight({ danger, label, value }: { danger?: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-black/25 px-3 py-2">
      <span className="text-zinc-500">{label}</span>
      <span className={danger ? 'font-semibold text-red-300' : 'font-semibold text-zinc-200'}>{value}</span>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-zinc-600">{text}</p>;
}
