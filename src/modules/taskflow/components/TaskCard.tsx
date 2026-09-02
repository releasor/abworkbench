import { useState, useMemo, memo, useRef, lazy, Suspense, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Priority, Status } from '../types'
import { STATUS_CYCLE, PRIORITY_CYCLE } from '../types'
import { useTaskStore, getTimeSpentTotal } from '../hooks/useTaskStore';
import { ConfirmDialog } from './ConfirmDialog';
import { highlightText } from '../utils/highlight';
import { api } from '../utils/api';
import { formatRelativeTime } from '../utils/relativeTime';
import { showToast } from '../utils/toastEvent';
import { playClickSound, playCompletionSound } from '../utils/sound';
import { nextDateStrN, todayStr } from '../dateUtils';
import { formatDurationCompact } from '../utils/formatTime';
import { countCompleted } from '../utils/subtaskUtils';
import { SNOOZE_PRESETS } from '../utils/snoozePresets';
import { buildBlockerSummary } from '../utils/taskWorkflow';
import { Icon } from './Icon';
import { CategoryPill } from './CategoryPill';
import { useTranslation } from '../../../i18n';
import { PRIORITY_LABEL_KEYS, STATUS_LABEL_KEYS } from '../i18n';

const TaskContextMenu = lazy(() => import('./TaskContextMenu').then(m => ({ default: m.TaskContextMenu })));

const PRIORITY_STYLES: Record<Priority, string> = {
  low: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  medium: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  high: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  urgent: 'bg-red-500/10 text-red-700 dark:text-red-300',
};

const ENERGY_STYLES: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  medium: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  high: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

const ENERGY_LABELS: Record<string, string> = {
  low: '低精力',
  medium: '中精力',
  high: '高精力',
};

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  isDragging?: boolean;
  onFocus?: (task: Task) => void;
  categoryMap?: Map<string, import('../types').Category>;
  taskTitleById?: Map<string, string>;
  searchQuery?: string;
}

export const TaskCard = memo(function TaskCard({ task, onEdit, isDragging, onFocus, categoryMap: categoryMapProp, taskTitleById: taskTitleByIdProp, searchQuery: searchQueryProp }: TaskCardProps) {
  const { t } = useTranslation();
  const handleEdit = useCallback(() => onEdit(task), [onEdit, task]);
  const handleFocus = useCallback(() => { if (onFocus) onFocus(task); }, [onFocus, task]);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const duplicateTask = useTaskStore((state) => state.duplicateTask);
  const moveTask = useTaskStore((state) => state.moveTask);
  const refreshTask = useTaskStore((state) => state.refreshTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const storeSearchQuery = useTaskStore((state) => state.filters.search);
  const searchQuery = searchQueryProp ?? storeSearchQuery;
  const setFilters = useTaskStore((state) => state.setFilters);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [snoozePos, setSnoozePos] = useState<{ top: number; left: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const snoozeBtnRef = useRef<HTMLButtonElement>(null);
  const snoozeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSnooze) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (snoozeBtnRef.current?.contains(target)) return;
      if (snoozeMenuRef.current?.contains(target)) return;
      setShowSnooze(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSnooze(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showSnooze]);
  const priorityLabel = t(PRIORITY_LABEL_KEYS[task.priority]);
  const statusLabel = t(STATUS_LABEL_KEYS[task.status]);
  const categoryMap = categoryMapProp || new Map();
  const category = categoryMap.get(task.category);
  // Build fallback map from dependencies only (no full task list subscription)
  const fallbackTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const dep of (task.dependencies || [])) {
      map.set(dep.dependsOnId, '未命名前置任务');
    }
    return map;
  }, [task.dependencies]);
  const taskTitleById = taskTitleByIdProp || fallbackTitleMap;
  const blockerSummary = useMemo(() => buildBlockerSummary({
    task,
    dependencyTitles: (task.dependencies || [])
      .filter((dependency) => dependency.type === 'blocked-by')
      .map((dependency) => taskTitleById.get(dependency.dependsOnId) || '未命名前置任务'),
  }), [task, taskTitleById]);
  const todayDatePart = todayStr();
  const tomorrowDatePart = nextDateStrN(todayDatePart, 1);
  const dueDatePart = task.dueDate ? task.dueDate.slice(0, 10) : null;
  const isOverdue = dueDatePart && dueDatePart < todayDatePart && task.status !== 'done';
  const isDueSoon = !isOverdue && dueDatePart && task.status !== 'done' && dueDatePart >= todayDatePart && dueDatePart <= tomorrowDatePart;
  const subtaskProgress = useMemo(() => {
    if (!task.subtasks || task.subtasks.length === 0) return null;
    const completed = countCompleted(task.subtasks);
    return { completed, total: task.subtasks.length, percent: Math.round((completed / task.subtasks.length) * 100) };
  }, [task.subtasks]);

  const timeSpentMinutes = useMemo(() => {
    return Math.round(getTimeSpentTotal(task) / 60);
  }, [task]);

  const createdRelative = useMemo(
    () => formatRelativeTime(task.createdAt),
    [task.createdAt]
  );

  const isTracking = useMemo(() => {
    const entries = task.timeEntries;
    if (!entries) return false;
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].endTime) return true;
    }
    return false;
  }, [task.timeEntries]);

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await doDuplicate();
  };

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await doTogglePin();
  };

  const handleDelete = () => {
    const title = task.title;
    deleteTask(task.id);
    setShowConfirm(false);
    playClickSound();
    showToast(`已删除: ${title}`, 'info', {
      label: '撤销',
      onClick: async () => {
        await useTaskStore.getState().undoDelete();
        showToast('已恢复任务', 'success');
      },
    });
  };

  const handleSnooze = async (days: number) => {
    const newDueDate = nextDateStrN(todayStr(), days) + 'T00:00:00.000Z';
    const label = SNOOZE_PRESETS.find((p) => p.days === days)?.label ?? `${days}天后`;
    try {
      await updateTask(task.id, { dueDate: newDueDate });
      playClickSound();
      showToast(`已推迟到${label}`, 'success');
    } catch {
      showToast('推迟任务失败', 'error');
    }
    setShowSnooze(false);
  };

  const handleSnoozeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showSnooze) {
      setShowSnooze(false);
      return;
    }
    const rect = snoozeBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = 148;
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
      const top = Math.min(rect.bottom + 6, window.innerHeight - 220);
      setSnoozePos({ top, left });
    }
    setShowSnooze(true);
  };

  const handleCycleStatus = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextStatus = STATUS_CYCLE[task.status];
    if (!nextStatus) return;
    try {
      await moveTask(task.id, nextStatus);
      if (nextStatus === 'done') playCompletionSound(); else playClickSound();
      showToast(`状态 → ${t(STATUS_LABEL_KEYS[nextStatus])}`, 'success');
    } catch {
      showToast('更新状态失败', 'error');
    }
  };

  const handleCyclePriority = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextPriority = PRIORITY_CYCLE[task.priority];
    if (!nextPriority) return;
    try {
      await updateTask(task.id, { priority: nextPriority });
      playClickSound();
      showToast(`优先级 → ${t(PRIORITY_LABEL_KEYS[nextPriority])}`, 'success');
    } catch {
      showToast('更新优先级失败', 'error');
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleContextStatusChange = async (status: Status) => {
    try {
      await moveTask(task.id, status);
      if (status === 'done') playCompletionSound(); else playClickSound();
    } catch {
      showToast('更新状态失败', 'error');
    }
  };

  const handleContextPriorityChange = async (priority: Priority) => {
    try {
      await updateTask(task.id, { priority });
      playClickSound();
    } catch {
      showToast('更新优先级失败', 'error');
    }
  };

  const doDuplicate = async () => {
    try {
      await duplicateTask(task.id);
      playClickSound();
    } catch {
      showToast('复制任务失败', 'error');
    }
  };

  const doTogglePin = async () => {
    try {
      await updateTask(task.id, { pinned: !task.pinned });
      playClickSound();
    } catch {
      showToast('置顶操作失败', 'error');
    }
  };

  const handleToggleTimer = async () => {
    try {
      if (isTracking) {
        await api.tasks.stopTime(task.id);
      } else {
        await api.tasks.startTime(task.id);
      }
      await refreshTask(task.id);
      playClickSound();
    } catch {
      showToast('计时器操作失败', 'error');
    }
  };

  return (
    <>
      <div
        onClick={handleEdit}
        onContextMenu={handleContextMenu}
        role="article"
        tabIndex={0}
        aria-label={`${t('todo.task')}: ${task.title}, ${t('taskflow.sort.priority')}: ${priorityLabel}, ${t('taskflow.status.label')}: ${statusLabel}${task.pinned ? `, ${t('taskflow.filter.pinned')}` : ''}${isOverdue ? `, ${t('taskflow.filter.overdue')}` : ''}${isDueSoon ? `, ${t('taskflow.filter.dueSoon')}` : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleEdit();
          }
        }}
        className={`group relative cursor-pointer overflow-hidden rounded-3xl border border-border glass-card p-3.5 transition-all hover:-translate-y-0.5 hover:border-blue-300/70 active:scale-[0.98] ${task.pinned ? 'ring-1 ring-amber-300/70 dark:ring-amber-500/60' : ''} ${isOverdue ? 'ring-1 ring-red-400/70' : ''} ${isDueSoon ? 'ring-1 ring-amber-400/70' : ''} ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
      >
        {/* Priority & Category */}
        <div className="relative mb-2 flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${PRIORITY_STYLES[task.priority]}`}>
              {priorityLabel}
            </span>
            {category && (
              <CategoryPill category={category} compact />
            )}
            {task.status === 'done' && (
              <span className="rounded-full bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-700 dark:text-green-300">
                ✓ {t('taskflow.status.done')}
              </span>
            )}
            {isTracking && (
              <span className="flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-1 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" aria-hidden="true" />
                {t('taskflow.filter.tracking')}
              </span>
            )}
            {task.pinned && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300" aria-label={t('taskflow.filter.pinned')}>
                <Icon name="pin" className="w-2.5 h-2.5" filled />
                {t('taskflow.filter.pinned')}
              </span>
            )}
          </div>
          {/* Absolute + pointer-events-none when hidden: invisible toolbar was eating clicks / covering tags */}
          <div
            className={`absolute right-0 top-0 z-20 flex items-center gap-0.5 rounded-xl border border-border bg-white/95 p-0.5 shadow-sm transition-opacity dark:border-white/10 dark:bg-surface/95 ${showSnooze ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100'}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleCycleStatus}
              className="rounded-lg p-1 transition hover:bg-blue-100 dark:hover:bg-blue-900/30"
              aria-label={`${t('taskflow.status.change')}: ${statusLabel}`}
              title={`${t('taskflow.status.changeTo')}: ${t(STATUS_LABEL_KEYS[STATUS_CYCLE[task.status] as Status])}`}
            >
              <Icon name="refresh" className="w-3.5 h-3.5 text-blue-500" />
            </button>
            <button
              type="button"
              onClick={handleCyclePriority}
              className="rounded-lg p-1 transition hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
              aria-label={`${t('taskflow.priority.change')}: ${priorityLabel}`}
              title={`${t('taskflow.status.changeTo')}: ${t(PRIORITY_LABEL_KEYS[PRIORITY_CYCLE[task.priority]])}`}
            >
              <Icon name="lightning" className="w-3.5 h-3.5 text-yellow-500" />
            </button>
            <div className="relative">
              <button
                ref={snoozeBtnRef}
                type="button"
                onClick={handleSnoozeClick}
                className={`rounded-lg p-1 transition hover:bg-indigo-100 dark:hover:bg-indigo-900/30 ${showSnooze ? 'bg-indigo-100 dark:bg-indigo-900/30' : ''}`}
                aria-label={t('taskflow.task.snooze')}
                title={t('taskflow.task.snooze')}
                aria-expanded={showSnooze}
                aria-haspopup="menu"
              >
                <Icon name="clock" className="w-3.5 h-3.5 text-indigo-500" />
              </button>
            </div>
            <button
              onClick={handleTogglePin}
              className={`rounded-lg p-1 transition ${task.pinned ? 'hover:bg-amber-100 dark:hover:bg-amber-900/30' : 'hover:bg-surface-lighter dark:hover:bg-white/10'}`}
              aria-label={task.pinned ? t('taskflow.task.unpin') : t('taskflow.filter.pinned')}
              title={task.pinned ? t('taskflow.task.unpin') : t('taskflow.filter.pinned')}
            >
              <Icon name="pin" className={`w-3.5 h-3.5 ${task.pinned ? 'text-amber-500' : 'text-text-muted'}`} filled={task.pinned} />
            </button>
            <button
              onClick={handleDuplicate}
              className="rounded-lg p-1 transition hover:bg-surface-lighter dark:hover:bg-white/10"
              aria-label={`复制任务: ${task.title}`}
            >
              <Icon name="duplicate" className="w-3.5 h-3.5 text-text-muted" />
            </button>
            {onFocus && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFocus();
                }}
                className="rounded-lg p-1 transition hover:bg-teal-100 dark:hover:bg-teal-900/30"
                aria-label={t('dashboard.startFocus')}
                title={t('dashboard.startFocus')}
              >
                <Icon name="eye" className="w-3.5 h-3.5 text-teal-500" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirm(true);
              }}
              className="rounded-lg p-1 transition hover:bg-red-100 dark:hover:bg-red-900/30"
              aria-label={`删除任务: ${task.title}`}
            >
              <Icon name="trash" className="w-3.5 h-3.5 text-red-500" />
            </button>
          </div>
        </div>

        {/* Title */}
        <h4 className={`mb-1 line-clamp-2 text-sm font-bold leading-snug ${task.status === 'done' ? 'line-through text-text-muted ' : 'text-text '}`}>
          {searchQuery ? highlightText(task.title, searchQuery) : task.title}
        </h4>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-text-muted mb-2 line-clamp-2">
            {searchQuery ? highlightText(task.description, searchQuery) : task.description}
          </p>
        )}

        {(task.nextAction || task.energyLevel) && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {task.nextAction && (
              <span className="min-w-0 rounded-full bg-blue-500/10 px-2 py-1 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                下一步：{task.nextAction}
              </span>
            )}
            {task.energyLevel && (
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${ENERGY_STYLES[task.energyLevel] || ENERGY_STYLES.medium}`}>
                {ENERGY_LABELS[task.energyLevel] || ENERGY_LABELS.medium}
              </span>
            )}
          </div>
        )}

        {blockerSummary.isBlocked && (
          <div className="mb-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-800 dark:text-amber-200">
            {blockerSummary.label}
          </div>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.tags.map((tag) => (
              <button
                key={tag}
                onClick={(e) => {
                  e.stopPropagation();
                  setFilters({ search: `#${tag}` });
                }}
                className="rounded-full bg-surface-lighter px-2 py-1 text-[10px] font-medium text-text-muted transition-colors hover:bg-blue-100 hover:text-blue-600 dark:bg-white/10 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                aria-label={`筛选标签: ${tag}`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Subtask Progress */}
        {subtaskProgress && (
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-lighter dark:bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${subtaskProgress.percent}%`,
                  backgroundColor: subtaskProgress.completed === subtaskProgress.total ? '#10b981' : '#3b82f6',
                }}
              />
            </div>
            <span className="text-[10px] text-text-muted flex-shrink-0">
              {subtaskProgress.completed}/{subtaskProgress.total}
            </span>
          </div>
        )}

        {/* Time Tracking */}
        {task.estimatedMinutes && (
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <Icon name="clock" className="w-3 h-3 text-text-muted" />
              <span className="text-[10px] text-text-muted">
                {t('taskflow.sort.estimated')} {task.estimatedMinutes} {t('settings.minutes')}
                {timeSpentMinutes > 0 && (
                  <span className="ml-1">
                    · {t('taskflow.sort.timeSpent')} {timeSpentMinutes} {t('settings.minutes')}
                  </span>
                )}
              </span>
            </div>
            {timeSpentMinutes > 0 && (
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-lighter dark:bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round((timeSpentMinutes / task.estimatedMinutes) * 100))}%`,
                    backgroundColor: timeSpentMinutes > task.estimatedMinutes ? '#ef4444' : '#3b82f6',
                  }}
                  aria-hidden="true"
                />
              </div>
            )}
          </div>
        )}

        {/* Recurring Indicator */}
        {task.recurring && (
          <div className="flex items-center gap-2 mb-2">
            <Icon name="refresh" className="w-3 h-3 text-purple-500" />
            <span className="text-[10px] text-purple-600 dark:text-purple-400">
              {t('taskflow.task.recurring')}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-xs text-text-muted dark:border-white/10">
          {task.dueDate && (
            <div
              className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : ''} ${isDueSoon ? 'text-yellow-600 font-medium' : ''} cursor-help`}
              title={task.dueDate.replace('T', ' ').slice(0, 16)}
            >
              <Icon name="calendar" className="w-3 h-3" />
              {isOverdue ? `${t('taskflow.filter.overdue')} ${task.dueDate.slice(5, 7)}/${task.dueDate.slice(8, 10)}` : isDueSoon ? `${t('taskflow.filter.dueSoon')} ${task.dueDate.slice(5, 7)}/${task.dueDate.slice(8, 10)}` : `${task.dueDate.slice(5, 7)}/${task.dueDate.slice(8, 10)}`}
            </div>
          )}
          <div className="flex items-center gap-2">
            {/* Quick timer toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTimer();
              }}
              className={`p-0.5 rounded transition-colors ${ isTracking ? 'text-purple-500 hover:bg-purple-100 dark:hover:bg-purple-900/30' : 'text-text-muted hover:text-purple-500 hover:bg-surface-lighter ' }`}
              aria-label={isTracking ? t('taskflow.task.stopTimer') : t('taskflow.task.startTimer')}
              title={isTracking ? t('taskflow.task.stopTimer') : t('taskflow.task.startTimer')}
            >
              {isTracking ? (
                <Icon name="pause" className="w-3.5 h-3.5" filled />
              ) : (
                <Icon name="clock" className="w-3.5 h-3.5" />
              )}
            </button>
            {task.dependencies && task.dependencies.length > 0 && (
              <div className="flex items-center gap-0.5" title={`${task.dependencies.length} 个依赖`}>
                <Icon name="link" className="w-3 h-3" />
                <span className="text-[10px]">{task.dependencies.length}</span>
              </div>
            )}
            {task.notes && task.notes.length > 0 && (
              <div className="flex items-center gap-0.5" title={`${task.notes.length} 条备注${task.notes[0]?.content ? `\n${task.notes[0].content.slice(0, 80)}${task.notes[0].content.length > 80 ? '...' : ''}` : ''}`}>
                <Icon name="chat" className="w-3 h-3" />
                <span className="text-[10px]">{task.notes.length}</span>
              </div>
            )}
            {timeSpentMinutes > 0 && (
              <div className="flex items-center gap-0.5 text-purple-500" title={`已跟踪 ${timeSpentMinutes} 分钟`}>
                <Icon name="clock" className="w-3 h-3" />
                <span className="text-[10px]">{formatDurationCompact(timeSpentMinutes * 60)}</span>
              </div>
            )}
            <div
              className="flex items-center gap-1 cursor-help"
              title={task.createdAt.replace('T', ' ').slice(0, 16)}
            >
              <Icon name="clock" className="w-3 h-3" />
              {createdRelative}
            </div>
          </div>
        </div>
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="删除任务"
          message={`确定要删除「${task.title}」吗？此操作不可撤销。`}
          confirmText="删除"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {showSnooze && snoozePos && createPortal(
        <div
          ref={snoozeMenuRef}
          className="fixed z-[80] min-w-[148px] rounded-2xl border border-border bg-white p-1.5 shadow-2xl shadow-black/30 dark:border-white/10 dark:bg-surface dark:shadow-black/60"
          style={{ top: snoozePos.top, left: snoozePos.left }}
          role="menu"
          aria-label={t('taskflow.task.snooze')}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {SNOOZE_PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              role="menuitem"
              onClick={() => handleSnooze(p.days)}
              className="w-full rounded-xl px-3 py-2 text-left text-xs text-text transition hover:bg-surface-lighter dark:hover:bg-white/10"
            >
              {p.label}
            </button>
          ))}
        </div>,
        document.body,
      )}

      {contextMenu && (
        <Suspense fallback={null}>
          <TaskContextMenu
            task={task}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onEdit={handleEdit}
            onFocus={handleFocus}
            onDuplicate={doDuplicate}
            onDelete={() => setShowConfirm(true)}
            onTogglePin={doTogglePin}
            onCycleStatus={handleContextStatusChange}
            onCyclePriority={handleContextPriorityChange}
            onSnooze={handleSnooze}
          />
        </Suspense>
      )}
    </>
  );
});
