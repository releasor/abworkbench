import { useMemo } from 'react';
import type { Task } from '../types'
import { computeStreak, prevDateStr, prevDateStrN, dayOfWeek, todayStr, WEEKDAYS } from '../dateUtils';

interface ProductivityHeatmapProps {
  tasks: Task[];
  onDateClick?: (date: string) => void;
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function getIntensity(count: number): string {
  if (count === 0) return 'bg-gray-100 dark:bg-gray-800';
  if (count <= 2) return 'bg-green-200 dark:bg-green-900';
  if (count <= 4) return 'bg-green-400 dark:bg-green-700';
  if (count <= 6) return 'bg-green-600 dark:bg-green-500';
  return 'bg-green-800 dark:bg-green-400';
}

const DOW_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getTooltip(date: string, count: number): string {
  const y = +date.slice(0, 4);
  const m = +date.slice(5, 7);
  const d = +date.slice(8, 10);
  const dow = DOW_NAMES[dayOfWeek(y, m, d)];
  return `${y}年${m}月${d}日 ${dow}: ${count} 个任务完成`;
}

export function ProductivityHeatmap({ tasks, onDateClick }: ProductivityHeatmapProps) {
  const { weeks, totalCompleted, activeDays, currentStreak, longestStreak } = useMemo(() => {
    // Count completions per day and total completed in one pass
    const completions = new Map<string, number>();
    let totalCompleted = 0;
    for (const task of tasks) {
      if (task.status === 'done') totalCompleted++;
      if (task.completedAt) {
        const date = task.completedAt.slice(0, 10);
        completions.set(date, (completions.get(date) || 0) + 1);
      }
    }

    // Find date range (last 52 weeks) using pure string arithmetic
    const endDate = todayStr();
    const totalDays = 52 * 7;
    const allDates: string[] = [];
    for (let i = totalDays - 1; i >= 0; i--) allDates.push(prevDateStrN(endDate, i));

    const weeks: { date: string; count: number }[][] = [];
    for (let w = 0; w < 52; w++) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = allDates[w * 7 + d];
        week.push({ date: dateStr, count: completions.get(dateStr) || 0 });
      }
      weeks.push(week);
    }

    // Calculate stats
    const activeDays = completions.size;

    // Current streak (from today backwards) — pure string arithmetic
    const currentStreak = computeStreak(new Set(completions.keys()), todayStr());

    // Longest streak — compare sorted ISO strings directly
    let longestStreak = 0;
    let tempStreak = 0;
    const sortedDates = [...completions.keys()].sort();
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0 || sortedDates[i - 1] === prevDateStr(sortedDates[i])) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    }

    return { weeks, totalCompleted, activeDays, currentStreak, longestStreak };
  }, [tasks]);

  // Get month labels with positions — parse month from ISO string directly
  const monthLabels = useMemo(() => {
    const labels: { label: string; index: number }[] = [];
    let lastMonth = -1;
    for (let i = 0; i < weeks.length; i++) {
      const firstDay = weeks[i][0];
      if (firstDay) {
        const month = +firstDay.date.slice(5, 7) - 1; // 0-indexed
        if (month !== lastMonth) {
          labels.push({ label: MONTH_LABELS[month], index: i });
          lastMonth = month;
        }
      }
    }
    return labels;
  }, [weeks]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          生产力热力图
        </h3>
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>总计 <strong className="text-gray-900 dark:text-white">{totalCompleted}</strong> 个任务</span>
          <span>活跃 <strong className="text-gray-900 dark:text-white">{activeDays}</strong> 天</span>
          <span>当前连续 <strong className="text-green-600 dark:text-green-400">{currentStreak}</strong> 天</span>
          <span>最长连续 <strong className="text-blue-600 dark:text-blue-400">{longestStreak}</strong> 天</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Month labels */}
          <div className="flex ml-8 mb-1">
            {monthLabels.map(({ label, index }, i) => (
              <div
                key={`${label}-${index}`}
                className="text-xs text-gray-500 dark:text-gray-400"
                style={{ marginLeft: i === 0 ? 0 : `${(index - (monthLabels[i - 1]?.index || 0)) * 14}px` }}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="flex">
            {/* Day labels */}
            <div className="flex flex-col gap-[2px] mr-2">
              {WEEKDAYS.map((label, i) => (
                <div
                  key={label}
                  className="h-[10px] text-[9px] text-gray-500 dark:text-gray-400 flex items-center"
                  style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="flex gap-[2px]">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[2px]">
                  {week.map((day) => (
                    <button
                      key={day.date}
                      className={`w-[10px] h-[10px] rounded-sm transition-colors hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 dark:hover:ring-offset-gray-800 ${getIntensity(day.count)}`}
                      title={getTooltip(day.date, day.count)}
                      onClick={() => onDateClick?.(day.date)}
                      aria-label={getTooltip(day.date, day.count)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 ml-8">
            <span className="text-xs text-gray-500 dark:text-gray-400">少</span>
            <div className="flex gap-1">
              <div className="w-[10px] h-[10px] rounded-sm bg-gray-100 dark:bg-gray-800" title="0 个任务" />
              <div className="w-[10px] h-[10px] rounded-sm bg-green-200 dark:bg-green-900" title="1-2 个任务" />
              <div className="w-[10px] h-[10px] rounded-sm bg-green-400 dark:bg-green-700" title="3-4 个任务" />
              <div className="w-[10px] h-[10px] rounded-sm bg-green-600 dark:bg-green-500" title="5-6 个任务" />
              <div className="w-[10px] h-[10px] rounded-sm bg-green-800 dark:bg-green-400" title="7+ 个任务" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">多</span>
          </div>
        </div>
      </div>
    </div>
  );
}
