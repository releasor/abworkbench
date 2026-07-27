import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../utils/api';
import type { Task } from '../types'
import { formatDurationCN } from '../utils/formatTime';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { dayOfWeek, WEEKDAYS } from '../dateUtils';
import { Icon } from './Icon';

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

function formatDateLong(dateStr: string): string {
  const y = +dateStr.slice(0, 4);
  const m = +dateStr.slice(5, 7);
  const d = +dateStr.slice(8, 10);
  const dow = WEEKDAYS[dayOfWeek(y, m, d)];
  return `${y}年${m}月${d}日 ${dow}`;
}

function formatHour(hour: number): string {
  if (hour === 0) return '午夜12点';
  if (hour < 6) return `凌晨${hour}点`;
  if (hour < 12) return `上午${hour}点`;
  if (hour === 12) return '中午12点';
  if (hour < 18) return `下午${hour - 12}点`;
  return `晚上${hour - 12}点`;
}

function getScoreEmoji(score: number): string {
  if (score >= 80) return '🌟';
  if (score >= 60) return '✨';
  if (score >= 40) return '💪';
  return '🌱';
}

interface DailyReviewProps {
  onClose: () => void;
  onEditTask: (task: Task) => void;
}

interface DailyReviewData {
  today: {
    date: string;
    completed: number;
    created: number;
    timeSpent: number;
    topTasks: Array<{ id: string; title: string; priority: string; completedAt: string }>;
    categories: Record<string, number>;
  };
  tomorrow: {
    date: string;
    dueTasks: Array<{ id: string; title: string; priority: string; dueDate: string }>;
    inProgress: Array<{ id: string; title: string; priority: string }>;
  };
  insights: {
    completionRate: number;
    avgTaskTime: number;
    mostProductiveHour: number;
    streakDays: number;
    productivityScore: number;
  };
}

export function DailyReview({ onClose, onEditTask }: DailyReviewProps) {
  const [data, setData] = useState<DailyReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>();
  useEscapeKey(onClose);

  const loadReview = useCallback(async () => {
    try {
      const result = await api.dailyReview.get();
      setData(result);
    } catch (err) {
      console.error('Failed to load daily review:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadReview();
    });
  }, [loadReview]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadReview();
  }, [loadReview]);

  const categoryEntries = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.today.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [data]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="每日回顾"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              每日回顾
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {formatDateLong(data.today.date)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              aria-label="刷新数据"
            >
              <Icon name="refresh" className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="关闭"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Productivity Score */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">今日生产力评分</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-5xl font-bold">{data.insights.productivityScore}</span>
                <span className="text-xl opacity-90">/100</span>
              </div>
            </div>
            <div className="text-6xl">{getScoreEmoji(data.insights.productivityScore)}</div>
          </div>
          <div className="mt-4 w-full bg-white/20 rounded-full h-2">
            <div
              className="bg-white rounded-full h-2 transition-all duration-1000"
              style={{ width: `${data.insights.productivityScore}%` }}
            />
          </div>
        </div>

        {/* Today's Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {data.today.completed}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">已完成</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {data.today.created}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400">新创建</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {formatDurationCN(data.today.timeSpent)}
            </p>
            <p className="text-sm text-purple-600 dark:text-purple-400">专注时间</p>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">📊 洞察分析</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">完成率:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.insights.completionRate}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">平均任务时长:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.insights.avgTaskTime}分钟
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">最高效时段:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatHour(data.insights.mostProductiveHour)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">连续完成天数:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.insights.streakDays}天 🔥
              </span>
            </div>
          </div>
        </div>

        {/* Top Completed Tasks */}
        {data.today.topTasks.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">✅ 今日完成的重要任务</h3>
            <div className="space-y-2">
              {data.today.topTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onEditTask(task as unknown as Task)}
                >
                  <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-gray-500'}`} />
                  <span className="flex-1 text-gray-900 dark:text-white">{task.title}</span>
                  <span className="text-xs text-gray-500">
                    {task.completedAt.slice(11, 16)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Distribution */}
        {categoryEntries.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">📁 分类分布</h3>
            <div className="space-y-2">
              {categoryEntries.map(([category, count]) => (
                <div key={category} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-20 truncate">{category}</span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                    <div
                      className="bg-blue-500 rounded-full h-4 transition-all duration-500"
                      style={{ width: `${(count / data.today.completed) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tomorrow's Preview */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">📅 明日预览</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-2">待办任务 ({data.tomorrow.dueTasks.length})</p>
              {data.tomorrow.dueTasks.length > 0 ? (
                <div className="space-y-2">
                  {data.tomorrow.dueTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm"
                    >
                      <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-gray-500'}`} />
                      <span className="truncate text-gray-900 dark:text-white">{task.title}</span>
                    </div>
                  ))}
                  {data.tomorrow.dueTasks.length > 3 && (
                    <p className="text-xs text-gray-500">还有 {data.tomorrow.dueTasks.length - 3} 个任务...</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">没有待办任务</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-2">进行中 ({data.tomorrow.inProgress.length})</p>
              {data.tomorrow.inProgress.length > 0 ? (
                <div className="space-y-2">
                  {data.tomorrow.inProgress.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm"
                    >
                      <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-gray-500'}`} />
                      <span className="truncate text-gray-900 dark:text-white">{task.title}</span>
                    </div>
                  ))}
                  {data.tomorrow.inProgress.length > 3 && (
                    <p className="text-xs text-gray-500">还有 {data.tomorrow.inProgress.length - 3} 个任务...</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">没有进行中的任务</p>
              )}
            </div>
          </div>
        </div>

        {/* Motivational Message */}
        <div className="mt-6 text-center">
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {data.insights.productivityScore >= 80
              ? '太棒了！你今天表现非常出色！继续保持！'
              : data.insights.productivityScore >= 60
              ? '做得很好！明天继续加油！'
              : data.insights.productivityScore >= 40
              ? '不错的开始！每天进步一点点！'
              : '新的一天，新的开始！相信自己！'}
          </p>
        </div>
      </div>
    </div>
  );
}
