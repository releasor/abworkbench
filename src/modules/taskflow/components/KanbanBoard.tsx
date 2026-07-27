import { useState, useMemo, useRef, memo } from 'react';
import type { DragEvent } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { useCategoryMap } from '../hooks/useCategoryMap';
import { TaskCard } from './TaskCard';
import { KanbanColumnSkeleton } from './Skeleton';
import type { Task, Status } from '../types'
import { STATUS_HEX_COLORS, ALL_STATUSES } from '../types'
import { formatDurationCompact } from '../utils/formatTime';
import { getTimeSpentTotal } from '../hooks/useTaskStore';
import { highlightText } from '../utils/highlight';
import { playClickSound, playCompletionSound } from '../utils/sound';
import { showToast } from '../utils/toastEvent';
import { Icon } from './Icon';
import { useTranslation } from '../../../i18n';
import { STATUS_LABEL_KEYS } from '../i18n';
import { safeGet, safeSet } from '../../../utils/safeLocalStorage';

interface KanbanBoardProps {
  onEditTask: (task: Task) => void;
  onFocusTask?: (task: Task) => void;
}

export const KanbanBoard = memo(function KanbanBoard({ onEditTask, onFocusTask }: KanbanBoardProps) {
  const { t, tWith } = useTranslation();
  const getFilteredTasks = useTaskStore((state) => state.getFilteredTasks);
  const moveTask = useTaskStore((state) => state.moveTask);
  const createTask = useTaskStore((state) => state.createTask);
  const reorderTasks = useTaskStore((state) => state.reorderTasks);
  const isLoading = useTaskStore((state) => state.isLoading);
  const filters = useTaskStore((state) => state.filters);
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ taskId: string; position: 'before' | 'after' } | null>(null);
  const [quickAddStatus, setQuickAddStatus] = useState<Status | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const quickAddRef = useRef<HTMLInputElement>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<Status>>(() => {
    const saved = safeGet<Status[]>('taskflow-kanban-collapsed', []);
    return new Set(saved);
  });

  const toggleCollapse = (status: Status) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      safeSet('taskflow-kanban-collapsed', [...next]);
      return next;
    });
  };
  const tasks = useMemo(() => getFilteredTasks(), [getFilteredTasks]);
  const totalTasks = tasks.length;
  const categoryMap = useCategoryMap();
  const taskTitleById = useMemo(() => new Map(tasks.map((t) => [t.id, t.title])), [tasks]);

  // Group tasks by status with precomputed priority counts, estimated time, and tracked time
  const columnData = useMemo(() => {
    const grouped: Record<Status, { tasks: Task[]; urgentCount: number; highCount: number; estimatedMinutes: number; trackedMinutes: number; pinnedCount: number }> = {
      'todo': { tasks: [], urgentCount: 0, highCount: 0, estimatedMinutes: 0, trackedMinutes: 0, pinnedCount: 0 },
      'in-progress': { tasks: [], urgentCount: 0, highCount: 0, estimatedMinutes: 0, trackedMinutes: 0, pinnedCount: 0 },
      'review': { tasks: [], urgentCount: 0, highCount: 0, estimatedMinutes: 0, trackedMinutes: 0, pinnedCount: 0 },
      'done': { tasks: [], urgentCount: 0, highCount: 0, estimatedMinutes: 0, trackedMinutes: 0, pinnedCount: 0 },
    };

    for (const task of tasks) {
      const col = grouped[task.status];
      col.tasks.push(task);
      if (task.priority === 'urgent') col.urgentCount++;
      else if (task.priority === 'high') col.highCount++;
      if (task.pinned) col.pinnedCount++;
      if (task.estimatedMinutes) col.estimatedMinutes += task.estimatedMinutes;
      const totalSeconds = getTimeSpentTotal(task);
      if (totalSeconds > 0) col.trackedMinutes += Math.round(totalSeconds / 60);
    }

    return grouped;
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {[1, 2, 3, 4].map((i) => (
          <KanbanColumnSkeleton key={i} />
        ))}
      </div>
    );
  }

  const handleDragStart = (e: DragEvent, task: Task) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingTaskId(task.id);
  };

  const handleDragOver = (e: DragEvent, status: Status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleTaskDragOver = (e: DragEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';
    setDropTarget({ taskId: task.id, position });
  };

  const handleDragLeave = (e: DragEvent) => {
    // Only clear if leaving the column entirely (not moving between children)
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
      setDropTarget(null);
    }
  };

  const handleDrop = async (e: DragEvent, status: Status) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('taskId');
    if (!draggedId) {
      setDragOverColumn(null);
      setDraggingTaskId(null);
      setDropTarget(null);
      return;
    }

    const columnTasks = columnData[status].tasks;
    let draggedInColumn = false;
    for (let j = 0; j < columnTasks.length; j++) {
      if (columnTasks[j].id === draggedId) { draggedInColumn = true; break; }
    }

    if (draggedInColumn && dropTarget && dropTarget.taskId !== draggedId) {
      // Reorder within the same column
      try {
        const ids: string[] = [];
        for (let j = 0; j < columnTasks.length; j++) ids.push(columnTasks[j].id);
        const fromIdx = ids.indexOf(draggedId);
        ids.splice(fromIdx, 1);
        let toIdx = ids.indexOf(dropTarget.taskId);
        if (dropTarget.position === 'after') toIdx++;
        ids.splice(toIdx, 0, draggedId);
        await reorderTasks(ids);
      } catch (err) {
        console.error('重排任务失败:', err);
        showToast('重排任务失败', 'error');
      }
    } else if (!draggedInColumn) {
      // Move to a different column
      try {
        await moveTask(draggedId, status);
        if (status === 'done') playCompletionSound(); else playClickSound();
      } catch (err) {
        console.error('移动任务失败:', err);
        showToast('移动任务失败', 'error');
      }
    }

    setDragOverColumn(null);
    setDraggingTaskId(null);
    setDropTarget(null);
  };

  const handleQuickAdd = async (status: Status) => {
    const title = quickAddTitle.trim();
    if (!title) return;
    try {
      await createTask({ title, status });
      setQuickAddTitle('');
      setQuickAddStatus(null);
      playClickSound();
    } catch (err) {
      console.error('创建任务失败:', err);
      showToast('创建任务失败', 'error');
    }
  };

  const startQuickAdd = (status: Status) => {
    setQuickAddStatus(status);
    setQuickAddTitle('');
    setTimeout(() => quickAddRef.current?.focus(), 0);
  };

  return (
    <>
    <div
      className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-4"
      role="region"
      aria-label={t('taskflow.board.label')}
      aria-roledescription={t('taskflow.view.board')}
    >
      {ALL_STATUSES.map((status) => {
        const { tasks: columnTasks, urgentCount, highCount, estimatedMinutes, trackedMinutes, pinnedCount } = columnData[status];
        const statusLabel = t(STATUS_LABEL_KEYS[status]);
        const isOver = dragOverColumn === status;
        const isCollapsed = collapsedColumns.has(status);

        return (
          <div
            key={status}
            className={`relative flex flex-col overflow-hidden rounded-[30px] border shadow-2xl shadow-black/5 transition-all duration-200 dark:shadow-black/25 ${
              isOver
                ? 'border-blue-400 bg-blue-50/70 ring-4 ring-blue-500/10 dark:border-blue-500/70 dark:bg-blue-500/10'
                : 'border-gray-200 bg-white/80 dark:border-white/10 dark:bg-white/[0.035]'
            } ${isCollapsed ? 'min-h-[360px] w-16 min-w-0 xl:w-auto' : 'min-h-[420px]'}`}
            role="region"
            aria-label={tWith('taskflow.board.columnLabel', statusLabel, columnTasks.length)}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div
              className="absolute inset-x-0 top-0 h-1 opacity-90"
              style={{ backgroundColor: STATUS_HEX_COLORS[status] }}
              aria-hidden="true"
            />
            {/* Column Header */}
            <div className={`flex items-center justify-between border-b border-gray-100/80 px-4 pb-3 pt-4 dark:border-white/10 ${isCollapsed ? 'flex-col gap-2' : ''}`}>
              <div className={`flex items-center gap-2 ${isCollapsed ? 'flex-col' : ''}`}>
                <button
                  onClick={() => toggleCollapse(status)}
                  className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                  aria-label={isCollapsed ? `${t('sidebar.expand')} ${statusLabel}` : `${t('sidebar.collapse')} ${statusLabel}`}
                  aria-expanded={!isCollapsed}
                >
                  <Icon name="chevron-down" className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className="h-3 w-3 rounded-full shadow-sm"
                  style={{ backgroundColor: STATUS_HEX_COLORS[status] }}
                  aria-hidden="true"
                />
                {!isCollapsed && (
                  <>
                    <h3 className="text-sm font-black tracking-tight text-gray-800 dark:text-gray-100">
                      {statusLabel}
                    </h3>
                    <span
                      className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500 dark:bg-white/10 dark:text-gray-300"
                      aria-label={`${columnTasks.length} ${t('todo.task')}`}
                    >
                      {columnTasks.length}
                    </span>
                  </>
                )}
                {isCollapsed && (
                  <span className="text-[10px] text-gray-500 font-medium">{columnTasks.length}</span>
                )}
              </div>
              {!isCollapsed && (
                <>
                {columnTasks.length > 0 && (
                  <div className="flex items-center gap-1" aria-hidden="true">
                    {urgentCount > 0 && (
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-sm shadow-red-500/40" title={`${urgentCount} 个紧急任务`} />
                    )}
                    {highCount > 0 && (
                      <div className="h-1.5 w-1.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/40" title={`${highCount} 个高优先级`} />
                    )}
                    {estimatedMinutes > 0 && (
                      <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-300" title={`预计 ${estimatedMinutes} 分钟`}>
                        {formatDurationCompact(estimatedMinutes * 60)}
                      </span>
                    )}
                    {trackedMinutes > 0 && (
                      <span className="ml-0.5 rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-500" title={`已跟踪 ${trackedMinutes} 分钟`}>
                        · {formatDurationCompact(trackedMinutes * 60)}
                      </span>
                    )}
                    {pinnedCount > 0 && (
                      <span className="ml-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500" title={`${pinnedCount} 个置顶任务`}>
                        📌 {pinnedCount}
                      </span>
                    )}
                  </div>
                )}
                </>
              )}
            </div>

            {/* Cards */}
            {!isCollapsed && (
            <div
              className="min-h-[240px] flex-1 space-y-3 bg-gradient-to-b from-transparent to-black/[0.015] p-3 dark:to-white/[0.015]"
              role="list"
              aria-label={`${statusLabel} ${t('todo.task')}`}
            >
              {columnTasks.map((task) => (
                <div key={task.id}>
                  {dropTarget?.taskId === task.id && dropTarget.position === 'before' && (
                    <div className="h-0.5 bg-blue-500 rounded-full mx-2 mb-1" aria-hidden="true" />
                  )}
                  <div
                    draggable
                    role="listitem"
                    aria-label={`任务: ${task.title}`}
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragOver={(e) => handleTaskDragOver(e, task)}
                    onDragEnd={() => { setDraggingTaskId(null); setDropTarget(null); }}
                  >
                    <TaskCard task={task} onEdit={onEditTask} isDragging={draggingTaskId === task.id} onFocus={onFocusTask} categoryMap={categoryMap} taskTitleById={taskTitleById} searchQuery={filters.search} />
                  </div>
                  {dropTarget?.taskId === task.id && dropTarget.position === 'after' && (
                    <div className="h-0.5 bg-blue-500 rounded-full mx-2 mt-1" aria-hidden="true" />
                  )}
                </div>
              ))}

              {columnTasks.length === 0 && (
                <div
                  className="flex h-40 items-center justify-center rounded-[24px] border border-dashed border-gray-200 bg-gray-50/70 text-sm text-gray-400 dark:border-white/10 dark:bg-white/[0.025] dark:text-gray-500"
                  aria-label={t('taskflow.board.empty')}
                >
                  <div className="text-center">
                    <Icon name="plus" className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
                    <span>{t('taskflow.board.empty')}</span>
                  </div>
                </div>
              )}

              {/* Quick Add */}
              {quickAddStatus === status ? (
                <div className="p-2">
                  <input
                    ref={quickAddRef}
                    type="text"
                    value={quickAddTitle}
                    onChange={(e) => setQuickAddTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleQuickAdd(status);
                      if (e.key === 'Escape') { setQuickAddStatus(null); setQuickAddTitle(''); }
                    }}
                    onBlur={() => { setQuickAddStatus(null); setQuickAddTitle(''); }}
                    className="w-full rounded-2xl border border-blue-400/70 bg-white px-4 py-3 text-sm text-gray-900 shadow-lg shadow-blue-500/10 outline-none ring-4 ring-blue-500/10 dark:bg-gray-950 dark:text-gray-100"
                    placeholder={t('taskflow.quickAdd.inputPlaceholder')}
                    aria-label={`${t('taskflow.quickAdd.label')} ${statusLabel}`}
                  />
                </div>
              ) : (
                <button
                  onClick={() => startQuickAdd(status)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-3 text-xs font-semibold text-gray-400 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
                  aria-label={`${t('taskflow.board.addTask')} ${statusLabel}`}
                >
                  <Icon name="plus" className="w-4 h-4" />
                  {t('taskflow.board.addTask')}
                </button>
              )}
            </div>
            )}
          </div>
        );
      })}
    </div>
    {totalTasks === 0 && (
      <div className="mx-auto mt-8 flex max-w-md flex-col items-center justify-center rounded-3xl border border-gray-200 bg-white/70 px-8 py-10 text-center shadow-xl shadow-black/5 dark:border-white/10 dark:bg-white/[0.03] dark:shadow-black/30">
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/10 text-blue-500">
          <Icon name="clipboard" className="w-7 h-7" />
        </div>
        {filters.search ? (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              没有找到匹配「<span className="font-semibold text-gray-800 dark:text-gray-100">{highlightText(filters.search, filters.search)}</span>」的任务
            </p>
            <button
              onClick={() => createTask({ title: filters.search })}
              className="mt-4 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-600"
              aria-label={`创建任务「${filters.search}」`}
            >
              + 创建「{filters.search}」
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('taskflow.board.empty')}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('taskflow.board.emptyHint')}</p>
          </>
        )}
      </div>
    )}
    </>
  );
})
