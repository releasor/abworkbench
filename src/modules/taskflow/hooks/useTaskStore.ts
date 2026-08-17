import { create } from 'zustand';
import type { Task, Category, TaskStats, FilterState, Status, Priority } from '../types'
import { PRIORITY_WEIGHTS } from '../types'
import { api, checkOffline } from '../utils/api';
import { matchesSearchQuery, buildCategoryNameMap } from '../utils/searchMatch';
import { todayStr, prevDateStrN } from '../dateUtils';
import { safeGetString, safeSetString, getBool, setBool } from '../../../utils/safeLocalStorage';
import { errorMessage } from '../../../utils/errors';

export type SortBy = 'order' | 'priority' | 'dueDate' | 'createdAt' | 'title' | 'estimated' | 'timeSpent' | 'urgency';

export const SORT_OPTIONS: { value: SortBy }[] = [
  { value: 'order' },
  { value: 'urgency' },
  { value: 'priority' },
  { value: 'dueDate' },
  { value: 'createdAt' },
  { value: 'title' },
  { value: 'estimated' },
  { value: 'timeSpent' },
];

const SORT_STORAGE_KEY = 'taskflow-sort-by';
const SORT_REVERSE_KEY = 'taskflow-sort-reverse';

const VALID_SORT_VALUES = new Set(SORT_OPTIONS.map((o) => o.value));

function loadSortBy(): SortBy {
  const stored = safeGetString(SORT_STORAGE_KEY, 'order');
  return VALID_SORT_VALUES.has(stored as SortBy) ? (stored as SortBy) : 'order';
}

function saveSortBy(sortBy: SortBy): void {
  safeSetString(SORT_STORAGE_KEY, sortBy);
}

function loadSortReverse(): boolean {
  return getBool(SORT_REVERSE_KEY, false);
}

function saveSortReverse(reverse: boolean): void {
  setBool(SORT_REVERSE_KEY, reverse);
}

interface TaskStore {
  tasks: Task[];
  categories: Category[];
  stats: TaskStats | null;
  filters: FilterState;
  sortBy: SortBy;
  sortReverse: boolean;
  selectedIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  lastDeletedTasks: Task[];

  fetchTasks: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  createCategory: (data: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id'>>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  refreshTask: (id: string) => Promise<void>;
  createTask: (task: Partial<Task>) => Promise<void>;
  batchCreateTasks: (tasks: Partial<Task>[]) => Promise<Task[]>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  undoDelete: () => Promise<void>;
  moveTask: (id: string, newStatus: Status) => Promise<void>;
  setFilters: (filters: Partial<FilterState>) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSortReverse: (reverse: boolean) => void;
  toggleSelect: (id: string) => void;
  selectRange: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  batchDelete: () => Promise<void>;
  batchUpdateStatus: (status: Status) => Promise<void>;
  batchUpdatePriority: (priority: Priority) => Promise<void>;
  batchUpdateCategory: (category: string) => Promise<void>;
  batchAddTags: (tags: string[]) => Promise<void>;
  batchRemoveTags: (tags: string[]) => Promise<void>;
  batchSnooze: (days: number) => Promise<void>;
  archiveTask: (id: string) => Promise<void>;
  unarchiveTask: (id: string) => Promise<void>;
  batchArchive: () => Promise<void>;
  batchUnarchive: () => Promise<void>;
  duplicateTask: (id: string) => Promise<void>;
  batchDuplicate: () => Promise<void>;
  batchPin: () => Promise<void>;
  batchUnpin: () => Promise<void>;
  reorderTasks: (orderedIds: string[]) => Promise<void>;
  getFilteredTasks: () => Task[];
  clearError: () => void;
}

// Memoization cache for getFilteredTasks
let _cacheKey = '';
let _cacheResult: Task[] = [];
let _cacheTasksRef: Task[] | null = null;
let _cacheCatMapRef: Category[] | null = null;
let _cacheCatMap: Map<string, string> = new Map();
const EMPTY_MAP: Map<string, string> = new Map();

// Debounce timer for fetchStats
let _statsTimer: ReturnType<typeof setTimeout> | null = null;

// Auto-dismiss timer for error messages
let _errorTimer: ReturnType<typeof setTimeout> | null = null;
const ERROR_DISMISS_MS = 5000;

function setErrorWithAutoDismiss(set: SetFn, message: string) {
  if (_errorTimer) clearTimeout(_errorTimer);
  set({ error: message });
  _errorTimer = setTimeout(() => {
    set({ error: null });
    _errorTimer = null;
  }, ERROR_DISMISS_MS);
}

type GetFn = () => TaskStore;
type SetFn = {
  (fn: (state: TaskStore) => Partial<TaskStore>): void;
  (partial: Partial<TaskStore>): void;
};

async function batchMerge(
  get: GetFn,
  set: SetFn,
  apiCall: (ids: string[]) => Promise<Task[]>,
  opts: { clearSelection?: boolean; refreshStats?: boolean } = {},
) {
  const { selectedIds } = get();
  try {
    const results = await apiCall([...selectedIds]);
    const updatedMap = new Map(results.map((r) => [r.id, r]));
    set((state) => ({
      tasks: state.tasks.map((t) => updatedMap.get(t.id) || t),
      ...(opts.clearSelection ? { selectedIds: new Set() } : {}),
    }));
    if (opts.refreshStats) get().fetchStats();
  } catch (err) {
    set({ error: errorMessage(err) });
  }
}

function getUrgencyScore(task: Task, nowMs: number): number {
  if (task.status === 'done') return -1000;
  let score = PRIORITY_WEIGHTS[task.priority] * 25;
  if (task.dueDate) {
    const dueMs = Date.parse(task.dueDate);
    const hoursUntilDue = (dueMs - nowMs) / 3600000;
    if (hoursUntilDue < 0) {
      score += 200 + Math.min(100, -hoursUntilDue);
    } else if (hoursUntilDue < 24) {
      score += 150 - hoursUntilDue * 2;
    } else if (hoursUntilDue < 72) {
      score += 80 - hoursUntilDue;
    } else if (hoursUntilDue < 168) {
      score += 30;
    }
  }
  if (task.pinned) score += 50;
  return score;
}

export function getTimeSpentTotal(t: Task): number {
  if (!t.timeEntries || t.timeEntries.length === 0) return 0;
  let total = 0;
  for (const e of t.timeEntries) total += e.duration;
  return total;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  categories: [],
  stats: null,
  filters: {
    search: '',
    status: 'all',
    priority: 'all',
    category: 'all',
    dueDateFrom: '',
    dueDateTo: '',
    tracking: 'all',
    pinned: false,
    archived: false,
    noDueDate: false,
    quickWin: false,
    stale: false,
    energyLevel: 'all',
    tags: [],
  },
  sortBy: loadSortBy(),
  sortReverse: loadSortReverse(),
  selectedIds: new Set(),
  isLoading: false,
  error: null,
  lastDeletedTasks: [],

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      await checkOffline();
      const tasks = await api.tasks.list();
      set({ tasks, isLoading: false });
    } catch (err) {
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  fetchCategories: async () => {
    try {
      await checkOffline();
      const categories = await api.categories.list();
      set({ categories });
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  createCategory: async (data) => {
    try {
      const category = await api.categories.create(data);
      set((state) => ({ categories: [...state.categories, category] }));
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  updateCategory: async (id, updates) => {
    try {
      const category = await api.categories.update(id, updates);
      set((state) => ({
        categories: state.categories.map((c) => (c.id === id ? category : c)),
      }));
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  deleteCategory: async (id) => {
    try {
      await api.categories.delete(id);
      set((state) => ({
        categories: state.categories.filter((c) => c.id !== id),
      }));
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  fetchStats: async () => {
    // Debounce: delay 50ms to batch rapid mutations into one API call
    if (_statsTimer) clearTimeout(_statsTimer);
    _statsTimer = setTimeout(async () => {
      _statsTimer = null;
      try {
        const stats = await api.stats.get();
        set({ stats });
      } catch (err) {
        setErrorWithAutoDismiss(set, errorMessage(err));
      }
    }, 50);
  },

  refreshTask: async (id) => {
    try {
      const task = await api.tasks.get(id);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? task : t)),
      }));
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  createTask: async (taskData) => {
    try {
      const task = await api.tasks.create(taskData);
      set((state) => ({ tasks: [...state.tasks, task] }));
      get().fetchStats();
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  batchCreateTasks: async (taskInputs) => {
    try {
      const tasks = await api.tasks.batchCreate(taskInputs);
      set((state) => ({ tasks: [...state.tasks, ...tasks] }));
      get().fetchStats();
      return tasks;
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
      return [];
    }
  },

  updateTask: async (id, updates) => {
    try {
      const task = await api.tasks.update(id, updates);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? task : t)),
      }));
      get().fetchStats();
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  deleteTask: async (id) => {
    try {
      const task = get().tasks.find((t) => t.id === id);
      await api.tasks.delete(id);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        selectedIds: new Set([...state.selectedIds].filter((sid) => sid !== id)),
        lastDeletedTasks: task ? [task] : [],
      }));
      get().fetchStats();
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  undoDelete: async () => {
    const { lastDeletedTasks } = get();
    if (lastDeletedTasks.length === 0) return;
    try {
      // Use import (not create) to preserve the original task IDs,
      // so dependency references from other tasks remain valid.
      const restored = await api.tasks.import(lastDeletedTasks);
      const restoredIds = new Set(restored.map((t) => t.id));
      set((state) => ({
        tasks: [...state.tasks.filter((t) => !restoredIds.has(t.id)), ...restored],
        lastDeletedTasks: [],
      }));
      get().fetchStats();
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  moveTask: async (id, newStatus) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task || task.status === newStatus) return;
    // Auto-stop time tracking when moving to done
    let hasActiveTimer = false;
    if (newStatus === 'done' && task.timeEntries) {
      for (let i = 0; i < task.timeEntries.length; i++) {
        if (!task.timeEntries[i].endTime) { hasActiveTimer = true; break; }
      }
    }
    if (hasActiveTimer) {
      await api.tasks.stopTime(id);
    }
    await get().updateTask(id, { status: newStatus });
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
  },

  setSortBy: (sortBy) => {
    saveSortBy(sortBy);
    set({ sortBy });
  },

  setSortReverse: (reverse) => {
    saveSortReverse(reverse);
    set({ sortReverse: reverse });
  },

  toggleSelect: (id) => {
    set((state) => {
      const newSelected = new Set(state.selectedIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return { selectedIds: newSelected };
    });
  },

  selectRange: (ids) => {
    set((state) => {
      const newSelected = new Set(state.selectedIds);
      for (const id of ids) newSelected.add(id);
      return { selectedIds: newSelected };
    });
  },

  selectAll: () => {
    const filtered = get().getFilteredTasks();
    set({ selectedIds: new Set(filtered.map((t) => t.id)) });
  },

  clearSelection: () => {
    set({ selectedIds: new Set() });
  },

  batchDelete: async () => {
    const { selectedIds, tasks } = get();
    const deleted = tasks.filter((t) => selectedIds.has(t.id));
    try {
      await api.tasks.batchDelete([...selectedIds]);
      set((state) => ({
        tasks: state.tasks.filter((t) => !selectedIds.has(t.id)),
        selectedIds: new Set(),
        lastDeletedTasks: deleted,
      }));
      get().fetchStats();
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  batchUpdateStatus: async (status) => {
    await batchMerge(get, set, (ids) => api.tasks.batchUpdateStatus(ids, status), { clearSelection: true, refreshStats: true });
  },

  batchUpdatePriority: async (priority) => {
    await batchMerge(get, set, (ids) => api.tasks.batchUpdatePriority(ids, priority), { clearSelection: true, refreshStats: true });
  },

  batchUpdateCategory: async (category) => {
    await batchMerge(get, set, (ids) => api.tasks.batchUpdateCategory(ids, category), { clearSelection: true, refreshStats: true });
  },

  batchAddTags: async (tags) => {
    await batchMerge(get, set, (ids) => api.tasks.batchAddTags(ids, tags));
  },

  batchRemoveTags: async (tags) => {
    await batchMerge(get, set, (ids) => api.tasks.batchRemoveTags(ids, tags));
  },

  batchSnooze: async (days) => {
    await batchMerge(get, set, (ids) => api.tasks.batchSnooze(ids, days));
  },

  archiveTask: async (id) => {
    try {
      const task = await api.tasks.archive(id);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? task : t)),
      }));
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  unarchiveTask: async (id) => {
    try {
      const task = await api.tasks.unarchive(id);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? task : t)),
      }));
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  batchArchive: async () => {
    await batchMerge(get, set, (ids) => api.tasks.batchArchive(ids), { clearSelection: true });
  },

  batchUnarchive: async () => {
    await batchMerge(get, set, (ids) => api.tasks.batchUnarchive(ids), { clearSelection: true });
  },

  duplicateTask: async (id) => {
    try {
      const task = await api.tasks.duplicate(id);
      set((state) => ({ tasks: [...state.tasks, task] }));
      get().fetchStats();
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  batchDuplicate: async () => {
    const { selectedIds } = get();
    try {
      const tasks = await api.tasks.batchDuplicate([...selectedIds]);
      set((state) => ({
        tasks: [...state.tasks, ...tasks],
        selectedIds: new Set(),
      }));
      get().fetchStats();
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  batchPin: async () => {
    await batchMerge(get, set, (ids) => api.tasks.batchPin(ids), { clearSelection: true });
  },

  batchUnpin: async () => {
    await batchMerge(get, set, (ids) => api.tasks.batchUnpin(ids), { clearSelection: true });
  },

  clearError: () => set({ error: null }),

  reorderTasks: async (orderedIds) => {
    try {
      const results = await api.tasks.reorder(orderedIds);
      const updatedMap = new Map(results.map((r) => [r.id, r]));
      set((state) => ({
        tasks: state.tasks.map((t) => updatedMap.get(t.id) || t),
      }));
    } catch (err) {
      setErrorWithAutoDismiss(set, errorMessage(err));
    }
  },

  getFilteredTasks: () => {
    const { tasks, filters, sortBy, sortReverse, categories } = get();

    // Generate cache key from inputs (fast: reference checks + string comparisons)
    // Also check tasks array reference to detect task updates that don't change length
    const key = `${filters.status}:${filters.priority}:${filters.category}:${filters.search || ''}:${filters.dueDateFrom || ''}:${filters.dueDateTo || ''}:${filters.noDueDate ? 1 : 0}:${filters.tracking || ''}:${filters.pinned ? 1 : 0}:${filters.archived ? 1 : 0}:${filters.quickWin ? 1 : 0}:${filters.stale ? 1 : 0}:${filters.energyLevel || ''}:${(filters.tags || []).join(',')}:${sortBy}:${sortReverse ? 1 : 0}:${categories.length}`;
    if (key === _cacheKey && tasks === _cacheTasksRef && categories === _cacheCatMapRef) return _cacheResult;

    // Precompute date range as ISO string prefixes for O(1) comparison
    const fromStr = filters.dueDateFrom || null;
    const toStr = filters.dueDateTo ? filters.dueDateTo + 'T23:59:59.999' : null;
    // Use date string prefix — ISO lexicographic order matches chronological order
    const staleThreshold = filters.stale ? prevDateStrN(todayStr(), 7) : null;

    // Use cached category name map (only rebuild when categories reference changes)
    if (categories !== _cacheCatMapRef) {
      _cacheCatMapRef = categories;
      _cacheCatMap = buildCategoryNameMap(categories);
    }
    const categoryNameMap = filters.search ? _cacheCatMap : EMPTY_MAP;

    const filtered = tasks.filter((task) => {
      if (filters.status !== 'all' && task.status !== filters.status) return false;
      if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
      if (filters.category !== 'all' && task.category !== filters.category) return false;
      if (filters.search && !matchesSearchQuery(task, filters.search, categoryNameMap)) return false;
      if (fromStr || toStr) {
        if (!task.dueDate) return false;
        if (fromStr && task.dueDate < fromStr) return false;
        if (toStr && task.dueDate > toStr) return false;
      }
      if (filters.noDueDate && task.dueDate) return false;
      if (filters.tracking === 'active') {
        const entries = task.timeEntries;
        if (!entries || entries.length === 0) return false;
        let hasActive = false;
        for (let j = 0; j < entries.length; j++) {
          if (!entries[j].endTime) { hasActive = true; break; }
        }
        if (!hasActive) return false;
      }
      if (filters.pinned && !task.pinned) return false;
      if (!filters.archived && task.archived) return false;
      if (filters.quickWin) {
        if (task.status === 'done') return false;
        const isHighPriority = task.priority === 'high' || task.priority === 'urgent';
        const isQuick = task.estimatedMinutes !== null && task.estimatedMinutes <= 30;
        if (!isHighPriority || !isQuick) return false;
      }
      if (filters.stale) {
        if (task.status === 'done') return false;
        if (task.updatedAt >= staleThreshold!) return false;
      }
      if (filters.energyLevel !== 'all' && task.energyLevel !== filters.energyLevel) return false;
      if (filters.tags.length > 0) {
        const taskTags = task.tags || [];
        if (!filters.tags.every((tag) => taskTags.includes(tag))) return false;
      }
      return true;
    });

    // Precompute timestamp once for urgency scoring (not per-comparison)
    const nowUrgency = sortBy === 'urgency' ? Date.now() : 0;

    // Precompute timeSpent totals for O(1) lookup during sort (avoids O(n log n) loop-in-loop)
    let timeSpentMap: Map<string, number> | null = null;
    if (sortBy === 'timeSpent') {
      timeSpentMap = new Map();
      for (const t of filtered) {
        timeSpentMap.set(t.id, getTimeSpentTotal(t));
      }
    }

    const sorted = filtered.sort((a, b) => {
      // Pinned tasks always sort to the top
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      let result: number;
      switch (sortBy) {
        case 'priority':
          result = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
          break;
        case 'dueDate':
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          result = a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
          break;
        case 'createdAt':
          result = a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
          break;
        case 'title':
          result = a.title.localeCompare(b.title, 'zh-CN');
          break;
        case 'estimated':
          result = (a.estimatedMinutes || 0) - (b.estimatedMinutes || 0);
          break;
        case 'timeSpent':
          result = (timeSpentMap!.get(b.id) || 0) - (timeSpentMap!.get(a.id) || 0);
          break;
        case 'urgency':
          result = getUrgencyScore(b, nowUrgency) - getUrgencyScore(a, nowUrgency);
          break;
        case 'order':
        default:
          result = a.order - b.order;
      }
      return sortReverse ? -result : result;
    });

    _cacheKey = key;
    _cacheTasksRef = tasks;
    _cacheResult = sorted;
    return sorted;
  },
}));
