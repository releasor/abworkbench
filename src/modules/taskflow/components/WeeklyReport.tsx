import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatDurationCN } from '../utils/formatTime';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { showToast } from '../utils/toastEvent';
import { Icon } from './Icon';

interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  summary: {
    completed: number;
    created: number;
    timeSpent: number;
    avgDailyScore: number;
    activeDays: number;
    totalDays: number;
  };
  dailyBreakdown: Array<{
    date: string;
    completed: number;
    timeSpent: number;
    score: number;
  }>;
  topCategories: Array<{ name: string; count: number }>;
  topTags: Array<{ name: string; count: number }>;
  streakDays: number;
  comparison: {
    prevWeekCompleted: number;
    change: number;
    trend: 'up' | 'down' | 'flat';
  };
}

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

interface WeeklyReportProps {
  onClose: () => void;
}

export function WeeklyReport({ onClose }: WeeklyReportProps) {
  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const trapRef = useFocusTrap<HTMLDivElement>();
  useEscapeKey(onClose);

  useEffect(() => {
    api.weeklyReport.get().then(setData).catch((err) => {
      showToast('加载周报失败', 'error');
      console.error('WeeklyReport load failed:', err);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-lg w-full mx-4 animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-6" />
          <div className="space-y-4">
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, dailyBreakdown, comparison, topCategories, topTags, streakDays } = data;
  const maxCompleted = Math.max(...dailyBreakdown.map(d => d.completed), 1);
  const trendArrow = comparison.trend === 'up' ? '↑' : comparison.trend === 'down' ? '↓' : '→';
  const trendColor = comparison.trend === 'up' ? 'text-green-500' : comparison.trend === 'down' ? 'text-red-500' : 'text-gray-400';

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="周报"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">周报</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {data.weekStart} ~ {data.weekEnd}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="关闭"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{summary.completed}</p>
            <p className="text-sm text-green-600 dark:text-green-400">完成任务</p>
            {comparison.change !== 0 && (
              <p className={`text-xs mt-1 ${trendColor}`}>
                {trendArrow} {Math.abs(comparison.change)} 较上周
              </p>
            )}
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{summary.created}</p>
            <p className="text-sm text-blue-600 dark:text-blue-400">新建任务</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{formatDurationCN(summary.timeSpent)}</p>
            <p className="text-sm text-purple-600 dark:text-purple-400">专注时间</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{summary.activeDays}/{summary.totalDays}</p>
            <p className="text-sm text-amber-600 dark:text-amber-400">活跃天数</p>
          </div>
        </div>

        {/* Streak */}
        {streakDays > 0 && (
          <div className="mb-6 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                连续完成 {streakDays} 天
              </span>
              {streakDays >= 7 && (
                <span className="text-xs px-2 py-0.5 bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300 rounded-full ml-auto">
                  一周达人
                </span>
              )}
            </div>
          </div>
        )}

        {/* Daily Breakdown Chart */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">每日完成</h3>
          <div className="flex items-end gap-2 h-32">
            {dailyBreakdown.map((day, i) => {
              const height = maxCompleted > 0 ? (day.completed / maxCompleted) * 100 : 0;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">{day.completed > 0 ? day.completed : ''}</span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t transition-all duration-500 ${
                        day.completed > 0 ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">{DAY_NAMES[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Scores */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">每日评分</h3>
          <div className="flex items-center gap-2">
            {dailyBreakdown.map((day, i) => (
              <div key={day.date} className="flex-1 text-center">
                <div className={`text-lg font-bold ${
                  day.score >= 60 ? 'text-green-600 dark:text-green-400' :
                  day.score >= 40 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {day.score}
                </div>
                <div className="text-[10px] text-gray-400">{DAY_NAMES[i]}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-center">
            <span className="text-sm text-gray-500">平均分: </span>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{summary.avgDailyScore}</span>
          </div>
        </div>

        {/* Top Categories */}
        {topCategories.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">热门分类</h3>
            <div className="space-y-2">
              {topCategories.map((cat) => (
                <div key={cat.name} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">{cat.name}</span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-blue-500 rounded-full h-3 transition-all duration-500"
                      style={{ width: `${(cat.count / summary.completed) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-8 text-right">{cat.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Tags */}
        {topTags.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">热门标签</h3>
            <div className="flex flex-wrap gap-2">
              {topTags.map((tag) => (
                <span
                  key={tag.name}
                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full"
                >
                  #{tag.name} <span className="text-gray-400">({tag.count})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Comparison with previous week */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">上周完成</span>
            <span className="font-medium text-gray-900 dark:text-white">{comparison.prevWeekCompleted} 个</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-500">变化</span>
            <span className={`font-medium ${trendColor}`}>
              {trendArrow} {Math.abs(comparison.change)} 个
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
