import { useMemo } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { computeStreak, todayStr } from '../dateUtils';
import { Icon } from './Icon';

export function ProgressBar() {
  const tasks = useTaskStore((state) => state.tasks);

  const { stats, streak } = useMemo(() => {
    let done = 0;
    let inProgress = 0;
    const completionDates = new Set<string>();
    for (const t of tasks) {
      if (t.status === 'done') {
        done++;
        if (t.completedAt) completionDates.add(t.completedAt.slice(0, 10));
      } else if (t.status === 'in-progress') inProgress++;
    }
    const total = tasks.length;
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
    const streak = computeStreak(completionDates, todayStr());
    return { stats: { total, done, inProgress, percentage }, streak };
  }, [tasks]);

  return (
    <div className="flex items-center gap-4 py-2" role="progressbar" aria-valuenow={stats.percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`任务完成进度 ${stats.percentage}%`}>
      <div className="flex-1">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
            style={{ width: `${stats.percentage}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {streak > 0 && (
          <span className="text-amber-500 dark:text-amber-400 flex items-center gap-1" title={`连续 ${streak} 天完成任务`}>
            <Icon name="fire" className="w-3.5 h-3.5" filled />
            {streak}天
          </span>
        )}
        {stats.inProgress > 0 && (
          <span className="text-blue-500 dark:text-blue-400">
            {stats.inProgress} 进行中
          </span>
        )}
        <span className="text-gray-500 dark:text-gray-400">
          {stats.done}/{stats.total} 已完成
        </span>
        <span className="font-semibold text-blue-600 dark:text-blue-400">
          {stats.percentage}%
        </span>
      </div>
    </div>
  );
}
