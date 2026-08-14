import { useMemo, useState, useRef } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { useCategoryMap } from '../hooks/useCategoryMap';
import { formatRelativeTime } from '../utils/relativeTime';
import { exportToJSON, exportToCSV, exportToMarkdown } from '../utils/export';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { ConfirmDialog } from './ConfirmDialog';
import { playClickSound } from '../utils/sound';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { dayOfWeek, WEEKDAYS } from '../dateUtils';
import { Icon } from './Icon';
import { CategoryPill } from './CategoryPill';

function formatDuration(createdISO: string, completedISO: string): string {
  const ms = Date.parse(completedISO) - Date.parse(createdISO);
  if (ms < 0) return '';
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}天${hours % 24 > 0 ? `${hours % 24}时` : ''}`;
  if (hours > 0) return `${hours}时${Math.floor((ms % 3600000) / 60000) > 0 ? `${Math.floor((ms % 3600000) / 60000)}分` : ''}`;
  const mins = Math.floor(ms / 60000);
  return mins > 0 ? `${mins}分` : '<1分';
}

interface CompletedTasksProps {
  onClose: () => void;
  onEditTask: (task: import('../types').Task) => void;
}

export function CompletedTasks({ onClose, onEditTask }: CompletedTasksProps) {
  const tasks = useTaskStore((state) => state.tasks);
  const categories = useTaskStore((state) => state.categories);
  const archiveTask = useTaskStore((state) => state.archiveTask);
  const batchArchive = useTaskStore((state) => state.batchArchive);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(exportMenuRef, () => setShowExportMenu(false), showExportMenu);
  const trapRef = useFocusTrap<HTMLDivElement>();
  useEscapeKey(onClose);

  // O(1) category lookup
  const categoryMap = useCategoryMap();

  const completedTasks = useMemo(() => {
    const filtered: typeof tasks = [];
    for (const t of tasks) {
      if (t.status === 'done') filtered.push(t);
    }
    filtered.sort((a, b) => {
      if (!a.completedAt) return 1;
      if (!b.completedAt) return -1;
      return a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : 0;
    });
    return filtered;
  }, [tasks]);

  // Combined single pass: relative time + duration maps
  const { relativeTimeMap, durationMap } = useMemo(() => {
    const relMap = new Map<string, string>();
    const durMap = new Map<string, string>();
    for (const t of completedTasks) {
      if (t.completedAt) {
        relMap.set(t.id, formatRelativeTime(t.completedAt));
        if (t.completedAt !== t.createdAt) {
          durMap.set(t.id, formatDuration(t.createdAt, t.completedAt));
        }
      }
    }
    return { relativeTimeMap: relMap, durationMap: durMap };
  }, [completedTasks]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, typeof completedTasks>();
    for (const task of completedTasks) {
      // Use first 10 chars of ISO string (yyyy-MM-dd) directly - no Date parsing needed
      const date = task.completedAt ? task.completedAt.slice(0, 10) : '未知日期';
      let group = groups.get(date);
      if (!group) {
        group = [];
        groups.set(date, group);
      }
      group.push(task);
    }
    return Array.from(groups.entries()).map(([date, tasks]) => {
      let header: string;
      if (date === '未知日期') {
        header = date;
      } else {
        const y = +date.slice(0, 4);
        const m = +date.slice(5, 7);
        const d = +date.slice(8, 10);
        header = `${m}月${d}日 周${WEEKDAYS[dayOfWeek(y, m, d)]}`;
      }
      return [date, tasks, header] as [string, typeof completedTasks, string];
    });
  }, [completedTasks]);

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="已完成任务"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-2xl card p-6 animate-bounce-in max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold" id="completed-tasks-title">已完成任务</h2>
            <p className="text-sm text-gray-500">共 {completedTasks.length} 个任务</p>
          </div>
          <div className="flex items-center gap-2">
            {completedTasks.length > 0 && (
              <>
                <div className="relative" ref={exportMenuRef}>
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="text-xs px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    aria-label="导出已完成任务"
                    aria-expanded={showExportMenu}
                    aria-haspopup="menu"
                  >
                    导出
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 top-full mt-1 w-36 card p-1 shadow-lg animate-slide-in z-10" role="menu">
                      <button
                        onClick={() => { exportToJSON(completedTasks, categories); setShowExportMenu(false); }}
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        role="menuitem"
                      >
                        导出 JSON
                      </button>
                      <button
                        onClick={() => { exportToCSV(completedTasks, categories); setShowExportMenu(false); }}
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        role="menuitem"
                      >
                        导出 CSV
                      </button>
                      <button
                        onClick={() => { exportToMarkdown(completedTasks, categories); setShowExportMenu(false); }}
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        role="menuitem"
                      >
                        导出 Markdown
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowArchiveConfirm(true)}
                  className="text-xs px-3 py-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                  aria-label="归档全部已完成任务"
                >
                  全部归档
                </button>
              </>
            )}
            <button onClick={onClose} className="btn btn-ghost p-1.5" aria-label="关闭">
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {completedTasks.length === 0 ? (
          <div className="text-center py-12">
            <Icon name="check-circle" className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-400">暂无已完成的任务</p>
          </div>
        ) : (
          <div className="space-y-6" role="list" aria-label="已完成任务列表">
            {groupedByDate.map(([date, dateTasks, header]) => (
              <div key={date} role="listitem">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 sticky top-0 bg-white dark:bg-gray-800 py-1">
                  {header}
                </h3>
                <div className="space-y-2">
                  {dateTasks.map((task) => {
                    const category = categoryMap.get(task.category);
                    return (
                      <div
                        key={task.id}
                        onClick={() => {
                          onEditTask(task);
                          onClose();
                        }}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors group"
                        role="button"
                        tabIndex={0}
                        aria-label={`编辑任务: ${task.title}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onEditTask(task);
                            onClose();
                          }
                        }}
                      >
                        <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                          <Icon name="check" className="w-3 h-3 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 line-through">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-1 mt-0.5">
                              {task.description}
                            </p>
                          )}
                        </div>
                        {category && <CategoryPill category={category} compact className="flex-shrink-0" />}
                        {durationMap.has(task.id) && (
                          <span className="text-[10px] text-gray-400 flex-shrink-0" title="创建到完成耗时">
                            {durationMap.get(task.id)}
                          </span>
                        )}
                        {relativeTimeMap.has(task.id) ? (
                          <span
                            className="text-xs text-gray-400 flex-shrink-0 cursor-help"
                            title={task.completedAt!.replace('T', ' ').slice(0, 19)}
                          >
                            {relativeTimeMap.get(task.id)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 flex-shrink-0" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            archiveTask(task.id);
                            playClickSound();
                          }}
                          className="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors rounded opacity-0 group-hover:opacity-100"
                          aria-label={`归档任务: ${task.title}`}
                          title="归档"
                        >
                          <Icon name="archive" className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showArchiveConfirm && (
        <ConfirmDialog
          title="归档全部已完成任务"
          message={`确定要归档全部 ${completedTasks.length} 个已完成任务吗？归档后任务将从默认视图中隐藏。`}
          confirmText="归档全部"
          variant="default"
          onConfirm={async () => {
            try {
              const ids = completedTasks.map((t) => t.id);
              useTaskStore.setState({ selectedIds: new Set(ids) });
              await batchArchive();
              setShowArchiveConfirm(false);
              onClose();
              playClickSound();
            } catch {
              void window.electronAPI?.notify?.({ title: '归档失败', body: '请稍后重试' });
            }
          }}
          onCancel={() => setShowArchiveConfirm(false)}
        />
      )}
    </div>
  );
}
