import { Fragment, useMemo, useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { useCategoryMap } from '../hooks/useCategoryMap';
import { ListRowSkeleton } from './Skeleton';
import { highlightText } from '../utils/highlight';
import type { Task, Status, Priority } from '../types'
import { PRIORITY_CONFIG, STATUS_CONFIG, PRIORITY_HEX_COLORS, ALL_STATUSES } from '../types'
import { formatDurationCompact } from '../utils/formatTime';
import { getTimeSpentTotal } from '../hooks/useTaskStore';
import { Icon } from './Icon';
import { CategoryPill } from './CategoryPill';
import { showToast } from '../utils/toastEvent';
import { playClickSound, playCompletionSound } from '../utils/sound';
import { nextDateStrN, todayStr } from '../dateUtils';
import { countCompleted } from '../utils/subtaskUtils';
import { safeGetString, safeSetString, getBool, setBool } from '../../../utils/safeLocalStorage';

const TaskContextMenu = lazy(() => import('./TaskContextMenu').then(m => ({ default: m.TaskContextMenu })));

interface ListViewProps {
  onEditTask: (task: Task) => void;
  onFocusTask?: (task: Task) => void;
}

type SortField = 'title' | 'status' | 'priority' | 'category' | 'dueDate' | 'estimated' | 'timeSpent' | 'created';
type SortDirection = 'asc' | 'desc';
type GroupBy = 'none' | 'status' | 'priority' | 'category';

const VALID_SORT_FIELDS = new Set<SortField>(['title', 'status', 'priority', 'category', 'dueDate', 'estimated', 'timeSpent', 'created']);
const VALID_SORT_DIRECTIONS = new Set<SortDirection>(['asc', 'desc']);
const VALID_GROUP_BY = new Set<GroupBy>(['none', 'status', 'priority', 'category']);

const PRIORITY_ORDER: Record<Priority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

const STATUS_ORDER: Record<Status, number> = {
  'todo': 0,
  'in-progress': 1,
  'review': 2,
  'done': 3,
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'text-green-600',
  medium: 'text-yellow-600',
  high: 'text-orange-600',
  urgent: 'text-red-600',
};

export function ListView({ onEditTask, onFocusTask }: ListViewProps) {
  const getFilteredTasks = useTaskStore((state) => state.getFilteredTasks);
  const moveTask = useTaskStore((state) => state.moveTask);
  const isLoading = useTaskStore((state) => state.isLoading);
  const filters = useTaskStore((state) => state.filters);
  const setFilters = useTaskStore((state) => state.setFilters);
  const selectedIds = useTaskStore((state) => state.selectedIds);
  const toggleSelect = useTaskStore((state) => state.toggleSelect);
  const selectRange = useTaskStore((state) => state.selectRange);
  const selectAll = useTaskStore((state) => state.selectAll);
  const clearSelection = useTaskStore((state) => state.clearSelection);
  const duplicateTask = useTaskStore((state) => state.duplicateTask);
  const createTask = useTaskStore((state) => state.createTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const tasks = useMemo(() => getFilteredTasks(), [getFilteredTasks]);
  const searchQuery = filters.search;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{ task: Task; x: number; y: number } | null>(null);
  const lastClickedId = useRef<string | null>(null);

  // Memoize selection state
  const { allSelected, someSelected } = useMemo(() => {
    if (tasks.length === 0) return { allSelected: false, someSelected: false };
    let selectedCount = 0;
    for (const t of tasks) {
      if (selectedIds.has(t.id)) selectedCount++;
    }
    return { allSelected: selectedCount === tasks.length, someSelected: selectedCount > 0 };
  }, [tasks, selectedIds]);

  const [sortField, setSortField] = useState<SortField>(() => {
    const stored = safeGetString('taskflow-list-sortField', 'created');
    return VALID_SORT_FIELDS.has(stored as SortField) ? (stored as SortField) : 'created';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const stored = safeGetString('taskflow-list-sortDir', 'desc');
    return VALID_SORT_DIRECTIONS.has(stored as SortDirection) ? (stored as SortDirection) : 'desc';
  });
  const [compact, setCompact] = useState(() =>
    getBool('taskflow-list-compact', false)
  );
  const [groupBy, setGroupBy] = useState<GroupBy>(() => {
    const stored = safeGetString('taskflow-list-groupBy', 'none');
    return VALID_GROUP_BY.has(stored as GroupBy) ? (stored as GroupBy) : 'none';
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Inline title editing
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const trimmed = editTitle.trim();
    const editingTask = tasks.find((task) => task.id === editingId);
    if (trimmed && trimmed !== editingTask?.title) {
      try {
        await updateTask(editingId, { title: trimmed });
      } catch (err) {
        console.error('保存标题失败:', err);
        showToast('保存标题失败', 'error');
      }
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  // O(1) category and task lookup
  const categoryMap = useCategoryMap();

  // Precompute timeSpent totals so sort comparator doesn't re-sum timeEntries per comparison
  const timeSpentMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) map.set(t.id, getTimeSpentTotal(t));
    return map;
  }, [tasks]);

  // Sorted tasks + index map for O(1) shift+click range selection
  const { sortedTasks, taskIndexMap } = useMemo(() => {
    const sorted = [...tasks];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title':
          cmp = a.title.localeCompare(b.title, 'zh-CN');
          break;
        case 'status':
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
        case 'priority':
          cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          break;
        case 'category':
          cmp = (a.category || '').localeCompare(b.category || '', 'zh-CN');
          break;
        case 'dueDate':
          cmp = (a.dueDate || '￿') < (b.dueDate || '￿') ? -1 : (a.dueDate || '￿') > (b.dueDate || '￿') ? 1 : 0;
          break;
        case 'estimated':
          cmp = (a.estimatedMinutes || 0) - (b.estimatedMinutes || 0);
          break;
        case 'timeSpent':
          cmp = (timeSpentMap.get(a.id) || 0) - (timeSpentMap.get(b.id) || 0);
          break;
        case 'created':
          cmp = a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
          break;
      }
      // Pinned tasks always sort to the top regardless of column sort
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    const indexMap = new Map<string, number>();
    for (let i = 0; i < sorted.length; i++) indexMap.set(sorted[i].id, i);
    return { sortedTasks: sorted, taskIndexMap: indexMap };
  }, [tasks, sortField, sortDirection, timeSpentMap]);

  // Group tasks
  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups = new Map<string, Task[]>();
    const groupOrder: string[] = [];
    for (const task of sortedTasks) {
      let key: string;
      switch (groupBy) {
        case 'status':
          key = STATUS_CONFIG[task.status].label;
          break;
        case 'priority':
          key = PRIORITY_CONFIG[task.priority].label;
          break;
        case 'category': {
          const cat = categoryMap.get(task.category);
          key = cat ? cat.name : '未分类';
          break;
        }
        default:
          key = '';
      }
      if (!groups.has(key)) {
        groups.set(key, []);
        groupOrder.push(key);
      }
      groups.get(key)!.push(task);
    }
    return groupOrder.map(name => ({ name, tasks: groups.get(name)! }));
  }, [sortedTasks, groupBy, categoryMap]);

  const toggleGroup = (name: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Total estimated and tracked time — single pass over sortedTasks
  const { totalEstimatedMinutes, totalTimeSpentMinutes } = useMemo(() => {
    let estimated = 0;
    let tracked = 0;
    for (const t of sortedTasks) {
      if (t.estimatedMinutes) estimated += t.estimatedMinutes;
      tracked += timeSpentMap.get(t.id) || 0;
    }
    return { totalEstimatedMinutes: estimated, totalTimeSpentMinutes: Math.round(tracked / 60) };
  }, [sortedTasks, timeSpentMap]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => {
        const next = d === 'asc' ? 'desc' : 'asc';
        safeSetString('taskflow-list-sortDir', next);
        return next;
      });
    } else {
      setSortField(field);
      setSortDirection('asc');
      safeSetString('taskflow-list-sortField', field);
      safeSetString('taskflow-list-sortDir', 'asc');
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return (
      <span className="ml-1 text-blue-500" aria-hidden="true">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll();
    }
  };

  const handleRowContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    setContextMenu({ task, x: e.clientX, y: e.clientY });
  };

  const cellPadding = compact ? 'py-1.5 px-2' : 'py-3 px-4';
  const headerPadding = compact ? 'py-2 px-2' : 'py-3 px-4';
  const todayDatePart = todayStr();

  const renderTaskRow = (task: Task) => {
    const category = categoryMap.get(task.category);
    const isOverdue = task.dueDate && task.dueDate.slice(0, 10) < todayDatePart && task.status !== 'done';
    return (
      <tr
        key={task.id}
        className={`hover:bg-surface-lighter /50 transition-colors ${selectedIds.has(task.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
        role="row"
        aria-label={`任务: ${task.title}`}
        onContextMenu={(e) => handleRowContextMenu(e, task)}
      >
        <td className={cellPadding}>
          <label className="flex items-center justify-center" aria-label={`选择任务: ${task.title}`}>
            <input
              type="checkbox"
              checked={selectedIds.has(task.id)}
              onChange={(e) => {
                e.stopPropagation();
                if (e.nativeEvent instanceof MouseEvent && e.nativeEvent.shiftKey && lastClickedId.current) {
                  const fromIdx = taskIndexMap.get(lastClickedId.current) ?? -1;
                  const toIdx = taskIndexMap.get(task.id) ?? -1;
                  if (fromIdx >= 0 && toIdx >= 0) {
                    const start = Math.min(fromIdx, toIdx);
                    const end = Math.max(fromIdx, toIdx);
                    const ids: string[] = [];
                    for (let i = start; i <= end; i++) ids.push(sortedTasks[i].id);
                    selectRange(ids);
                  }
                } else {
                  toggleSelect(task.id);
                }
                lastClickedId.current = task.id;
              }}
              onClick={(e) => e.stopPropagation()}
              className="rounded border-border text-blue-600 focus:ring-blue-500"
            />
          </label>
        </td>
        <td
          className={`${cellPadding} cursor-pointer`}
          onClick={() => { if (editingId !== task.id) onEditTask(task); }}
          tabIndex={0}
          onKeyDown={(e) => { if (editingId !== task.id && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onEditTask(task); } }}
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {task.pinned && (
                <Icon name="pin" className="w-3 h-3 text-amber-500 flex-shrink-0" filled />
              )}
              {editingId === task.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                    if (e.key === 'Escape') { e.stopPropagation(); cancelEdit(); }
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-medium bg-white border border-blue-400 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full max-w-[300px]"
                  aria-label="编辑任务标题"
                />
              ) : (
                <span
                  className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-text-muted' : 'text-text '} cursor-text`}
                  onDoubleClick={(e) => { e.stopPropagation(); startEditing(task); }}
                  title="双击编辑标题"
                >
                  {searchQuery ? highlightText(task.title, searchQuery) : task.title}
                </span>
              )}
              {compact && task.tags.length > 0 && (
                <div className="flex gap-1">
                  {task.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-[10px] px-1 py-0.5 bg-surface-lighter text-text-muted rounded">#{tag}</span>
                  ))}
                  {task.tags.length > 2 && <span className="text-[10px] text-text-muted">+{task.tags.length - 2}</span>}
                </div>
              )}
              {compact && task.subtasks && task.subtasks.length > 0 && (
                <span className="text-[10px] text-text-muted">{countCompleted(task.subtasks)}/{task.subtasks.length}</span>
              )}
            </div>
            {!compact && task.description && (
              <span className="text-xs text-text-muted line-clamp-1 mt-0.5">
                {searchQuery ? highlightText(task.description, searchQuery) : task.description}
              </span>
            )}
            {!compact && (
              <div className="flex items-center gap-2 mt-1">
                {task.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {task.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 bg-surface-lighter text-text-muted rounded cursor-pointer hover:bg-surface-lighter"
                        onClick={(e) => { e.stopPropagation(); setFilters({ search: `#${tag}` }); }}
                        title={`筛选标签: ${tag}`}
                      >#{tag}</span>
                    ))}
                    {task.tags.length > 3 && <span className="text-[10px] text-text-muted">+{task.tags.length - 3}</span>}
                  </div>
                )}
                {task.subtasks && task.subtasks.length > 0 && (() => {
                  const completedCount = countCompleted(task.subtasks);
                  const allDone = completedCount === task.subtasks.length;
                  return (
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-surface-lighter rounded-full overflow-hidden max-w-[60px]">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.round((completedCount / task.subtasks.length) * 100)}%`, backgroundColor: allDone ? '#10b981' : '#3b82f6' }}
                          aria-hidden="true"
                        />
                      </div>
                      <span className="text-[10px] text-text-muted">{completedCount}/{task.subtasks.length}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </td>
        <td className={`${cellPadding} cursor-pointer`} onClick={() => onEditTask(task)}>
          <select
            value={task.status}
            onChange={(e) => { e.stopPropagation(); moveTask(task.id, e.target.value as Status); }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`任务状态: ${task.title}`}
            className="text-xs px-2 py-1 bg-surface-lighter border-0 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </td>
        <td className={`${cellPadding} cursor-pointer`} onClick={() => onEditTask(task)}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_HEX_COLORS[task.priority] }} aria-hidden="true" />
            <span className={`text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>{PRIORITY_CONFIG[task.priority].label}</span>
          </div>
        </td>
        <td className={`${cellPadding} cursor-pointer`} onClick={() => onEditTask(task)}>
          {category && <CategoryPill category={category} compact />}
        </td>
        <td className={`${cellPadding} cursor-pointer`} onClick={() => onEditTask(task)}>
          {task.dueDate && (
            <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-text-muted'}`}>
              {task.dueDate.slice(5, 7)}/{task.dueDate.slice(8, 10)}
            </span>
          )}
        </td>
        <td className={`${cellPadding} cursor-pointer`} onClick={() => onEditTask(task)}>
          {task.estimatedMinutes && <span className="text-xs text-text-muted">{task.estimatedMinutes}分钟</span>}
        </td>
        <td className={`${cellPadding} cursor-pointer`} onClick={() => onEditTask(task)}>
          {(() => {
            const seconds = timeSpentMap.get(task.id) || 0;
            if (seconds === 0) return null;
            return <span className="text-xs text-text-muted">{formatDurationCompact(seconds)}</span>;
          })()}
        </td>
        <td className={`${cellPadding} cursor-pointer`} onClick={() => onEditTask(task)}>
          <span className="text-xs text-text-muted">{task.createdAt.slice(5, 7)}/{task.createdAt.slice(8, 10)}</span>
        </td>
        <td className={cellPadding}>
          <div className="flex items-center gap-1">
            {onFocusTask && (
              <button
                onClick={(e) => { e.stopPropagation(); onFocusTask(task); }}
                className="p-1 text-text-muted hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded hover:bg-surface-lighter"
                aria-label={`专注模式: ${task.title}`}
                title="专注模式"
              >
                <Icon name="eye" className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); duplicateTask(task.id); }}
              className="p-1 text-text-muted hover:text-green-500 dark:hover:text-green-400 transition-colors rounded hover:bg-surface-lighter"
              aria-label={`复制任务: ${task.title}`}
              title="复制"
            >
              <Icon name="duplicate" className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="card overflow-hidden mt-4" role="region" aria-label="任务列表视图">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
            {sortedTasks.length} 个任务
          </span>
          {totalEstimatedMinutes > 0 && (
            <span className="text-xs text-text-muted" title={`总计预计时长: ${totalEstimatedMinutes}分钟`}>
              预计 {Math.floor(totalEstimatedMinutes / 60) > 0 ? `${Math.floor(totalEstimatedMinutes / 60)}小时` : ''}{totalEstimatedMinutes % 60 > 0 ? `${totalEstimatedMinutes % 60}分钟` : ''}
            </span>
          )}
          {totalTimeSpentMinutes > 0 && (
            <span className="text-xs text-text-muted" title={`总计已用时长: ${totalTimeSpentMinutes}分钟`}>
              已用 {Math.floor(totalTimeSpentMinutes / 60) > 0 ? `${Math.floor(totalTimeSpentMinutes / 60)}小时` : ''}{totalTimeSpentMinutes % 60 > 0 ? `${totalTimeSpentMinutes % 60}分钟` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="group-by" className="sr-only">分组方式</label>
          <select
            id="group-by"
            value={groupBy}
            onChange={(e) => { const v = e.target.value as GroupBy; setGroupBy(v); setCollapsedGroups(new Set()); safeSetString('taskflow-list-groupBy', v); }}
            className="text-xs px-2 py-1 rounded border border-border bg-white text-text-muted"
            aria-label="分组方式"
          >
            <option value="none">不分组</option>
            <option value="status">按状态分组</option>
            <option value="priority">按优先级分组</option>
            <option value="category">按分类分组</option>
          </select>
          <button
            onClick={() => { const next = !compact; setCompact(next); setBool('taskflow-list-compact', next); }}
            className="text-xs px-2 py-1 rounded hover:bg-surface-lighter transition-colors text-text-muted"
            aria-label={compact ? '切换到详细视图' : '切换到紧凑视图'}
            title={compact ? '详细视图' : '紧凑视图'}
          >
            {compact ? '详细' : '紧凑'}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" role="table" aria-label="任务列表">
          <thead>
            <tr className="border-b border-border">
              <th className={`text-left ${headerPadding} w-10`} scope="col">
                <label className="flex items-center justify-center" aria-label={allSelected ? '取消全选' : '全选所有任务'}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={handleSelectAll}
                    className="rounded border-border text-blue-600 focus:ring-blue-500"
                    aria-label={allSelected ? '取消全选' : '全选所有任务'}
                  />
                </label>
              </th>
              <th
                className={`text-left ${headerPadding} text-xs font-medium text-text-muted uppercase cursor-pointer hover:text-text select-none`}
                scope="col"
                onClick={() => handleSort('title')}
                aria-sort={sortField === 'title' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                任务{sortIndicator('title')}
              </th>
              <th
                className={`text-left ${headerPadding} text-xs font-medium text-text-muted uppercase cursor-pointer hover:text-text select-none`}
                scope="col"
                onClick={() => handleSort('status')}
                aria-sort={sortField === 'status' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                状态{sortIndicator('status')}
              </th>
              <th
                className={`text-left ${headerPadding} text-xs font-medium text-text-muted uppercase cursor-pointer hover:text-text select-none`}
                scope="col"
                onClick={() => handleSort('priority')}
                aria-sort={sortField === 'priority' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                优先级{sortIndicator('priority')}
              </th>
              <th
                className={`text-left ${headerPadding} text-xs font-medium text-text-muted uppercase cursor-pointer hover:text-text select-none`}
                scope="col"
                onClick={() => handleSort('category')}
                aria-sort={sortField === 'category' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                分类{sortIndicator('category')}
              </th>
              <th
                className={`text-left ${headerPadding} text-xs font-medium text-text-muted uppercase cursor-pointer hover:text-text select-none`}
                scope="col"
                onClick={() => handleSort('dueDate')}
                aria-sort={sortField === 'dueDate' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                截止日期{sortIndicator('dueDate')}
              </th>
              <th
                className={`text-left ${headerPadding} text-xs font-medium text-text-muted uppercase cursor-pointer hover:text-text select-none`}
                scope="col"
                onClick={() => handleSort('estimated')}
                aria-sort={sortField === 'estimated' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                预计{sortIndicator('estimated')}
              </th>
              <th
                className={`text-left ${headerPadding} text-xs font-medium text-text-muted uppercase cursor-pointer hover:text-text select-none`}
                scope="col"
                onClick={() => handleSort('timeSpent')}
                aria-sort={sortField === 'timeSpent' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                已用{sortIndicator('timeSpent')}
              </th>
              <th
                className={`text-left ${headerPadding} text-xs font-medium text-text-muted uppercase cursor-pointer hover:text-text select-none`}
                scope="col"
                onClick={() => handleSort('created')}
                aria-sort={sortField === 'created' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                创建{sortIndicator('created')}
              </th>
              <th className={`text-center ${headerPadding} w-10`} scope="col">
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <>
                <ListRowSkeleton />
                <ListRowSkeleton />
                <ListRowSkeleton />
                <ListRowSkeleton />
                <ListRowSkeleton />
              </>
            ) : groupedTasks ? (
              groupedTasks.map(group => (
                collapsedGroups.has(group.name) ? (
                  <tr key={`group-${group.name}`} className="bg-surface-lighter cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-inset" onClick={() => toggleGroup(group.name)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGroup(group.name); } }} role="button" aria-label={`${group.name} (${group.tasks.length} 个任务)`} aria-expanded={false}>
                    <td colSpan={10} className={`${headerPadding} text-xs font-medium text-text-muted`}>
                      <span className="mr-2" aria-hidden="true">&#9654;</span>
                      {group.name} ({group.tasks.length})
                    </td>
                  </tr>
                ) : (
                  <Fragment key={`group-${group.name}`}>
                    <tr key={`group-${group.name}`} className="bg-surface-lighter cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-inset" onClick={() => toggleGroup(group.name)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGroup(group.name); } }} role="button" aria-label={`${group.name} (${group.tasks.length} 个任务)`} aria-expanded={true}>
                      <td colSpan={10} className={`${headerPadding} text-xs font-medium text-text-muted`}>
                        <span className="mr-2" aria-hidden="true">&#9660;</span>
                        {group.name} ({group.tasks.length})
                      </td>
                    </tr>
                    {group.tasks.map(task => renderTaskRow(task))}
                  </Fragment>
                )
              ))
            ) : (
              sortedTasks.map(task => renderTaskRow(task))
            )}
          </tbody>
        </table>

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-text-muted">
            <Icon name="clipboard" className="w-10 h-10 mb-2 text-text-muted" />
            {filters.search ? (
              <>
                <p className="text-sm">
                  没有找到匹配「<span className="font-medium text-text-muted">{highlightText(filters.search, filters.search)}</span>」的任务
                </p>
                <button
                  onClick={() => createTask({ title: filters.search })}
                  className="mt-2 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  aria-label={`创建任务「${filters.search}」`}
                >
                  + 创建「{filters.search}」
                </button>
              </>
            ) : (
              <>
                <p className="text-sm">暂无任务</p>
                <p className="text-xs mt-1">点击"新建任务"开始创建</p>
              </>
            )}
          </div>
        )}
      </div>

      {contextMenu && (
        <Suspense fallback={null}>
          <TaskContextMenu
            task={contextMenu.task}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onEdit={() => onEditTask(contextMenu.task)}
            onFocus={onFocusTask ? () => onFocusTask(contextMenu.task) : () => {}}
            onDuplicate={async () => {
              try {
                await duplicateTask(contextMenu.task.id);
                playClickSound();
              } catch (err) { console.error('复制任务失败:', err); showToast('复制任务失败', 'error'); }
            }}
            onDelete={async () => {
              try {
                await deleteTask(contextMenu.task.id);
                setContextMenu(null);
                playClickSound();
              } catch (err) { console.error('删除任务失败:', err); showToast('删除任务失败', 'error'); }
            }}
            onTogglePin={async () => {
              try {
                await updateTask(contextMenu.task.id, { pinned: !contextMenu.task.pinned });
                playClickSound();
              } catch (err) { console.error('置顶操作失败:', err); showToast('置顶操作失败', 'error'); }
            }}
            onCycleStatus={async (status) => {
              try {
                await moveTask(contextMenu.task.id, status);
                if (status === 'done') playCompletionSound(); else playClickSound();
              } catch (err) { console.error('更新状态失败:', err); showToast('更新状态失败', 'error'); }
            }}
            onCyclePriority={async (priority) => {
              try {
                await updateTask(contextMenu.task.id, { priority });
                playClickSound();
              } catch (err) { console.error('更新优先级失败:', err); showToast('更新优先级失败', 'error'); }
            }}
            onSnooze={async (days) => {
              try {
                const newDueDate = nextDateStrN(todayStr(), days) + 'T00:00:00.000Z';
                await updateTask(contextMenu.task.id, { dueDate: newDueDate });
              } catch (err) { console.error('推迟失败:', err); showToast('推迟失败', 'error'); }
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
