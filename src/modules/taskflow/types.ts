export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Status = 'todo' | 'in-progress' | 'review' | 'done';
export type EnergyLevel = 'low' | 'medium' | 'high';

export const ALL_STATUSES: Status[] = ['todo', 'in-progress', 'review', 'done'];
export const ALL_PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

export const STATUS_CYCLE: Record<Status, Status> = {
  'todo': 'in-progress',
  'in-progress': 'review',
  'review': 'done',
  'done': 'todo',
};

export const PRIORITY_CYCLE: Record<Priority, Priority> = {
  'low': 'medium',
  'medium': 'high',
  'high': 'urgent',
  'urgent': 'low',
};

export const PRIORITY_WEIGHTS: Record<Priority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

export interface TimeEntry {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number; // in seconds
  description: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnId: string;
  type: 'blocks' | 'blocked-by';
}

export interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // Every N days/weeks/months/years
  daysOfWeek?: number[]; // 0=Sunday, 1=Monday, etc.
  dayOfMonth?: number;
  endDate?: string | null;
  maxOccurrences?: number | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  category: string;
  tags: string[];
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  order: number;
  pinned: boolean;
  archived: boolean;
  timeEntries: TimeEntry[];
  estimatedMinutes: number | null;
  nextAction: string;
  energyLevel: EnergyLevel;
  blockerReason: string;
  activityLog: ActivityLog[];
  notes: Note[];
  subtasks: Subtask[];
  dependencies: TaskDependency[];
  recurring: RecurringPattern | null;
  linkedNoteIds: string[];
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface TaskStats {
  total: number;
  completed: number;
  overdue: number;
  byStatus: Record<Status, number>;
  byPriority: Record<Priority, number>;
  completionRate: number;
  totalTimeSpent: number;
  tasksWithTime: number;
  trackingActive: number;
  completedToday: number;
  completedThisWeek: number;
  avgCompletionTimeHours: number | null;
  completedLast7Days: number;
  timeSpentToday: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  category?: string;
  tags?: string[];
  dueDate?: string | null;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  order?: number;
  completedAt?: string | null;
}

export type ViewMode = 'board' | 'list' | 'calendar' | 'archive' | 'matrix';

export interface FilterState {
  search: string;
  status: Status | 'all';
  priority: Priority | 'all';
  category: string | 'all';
  dueDateFrom: string;
  dueDateTo: string;
  tracking: 'all' | 'active';
  pinned: boolean;
  archived: boolean;
  noDueDate: boolean;
  quickWin: boolean;
  stale: boolean;
  energyLevel: 'all' | 'low' | 'medium' | 'high';
  tags: string[];
}

export const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: string }> = {
  todo: { label: '待办', color: 'gray', icon: 'circle' },
  'in-progress': { label: '进行中', color: 'blue', icon: 'clock' },
  review: { label: '审核中', color: 'yellow', icon: 'eye' },
  done: { label: '已完成', color: 'green', icon: 'check-circle' },
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; weight: number }> = {
  low: { label: '低', color: 'green', weight: PRIORITY_WEIGHTS.low },
  medium: { label: '中', color: 'yellow', weight: PRIORITY_WEIGHTS.medium },
  high: { label: '高', color: 'orange', weight: PRIORITY_WEIGHTS.high },
  urgent: { label: '紧急', color: 'red', weight: PRIORITY_WEIGHTS.urgent },
}

export const PRIORITY_HEX_COLORS: Record<Priority, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  urgent: '#ef4444',
}

export const STATUS_HEX_COLORS: Record<Status, string> = {
  todo: '#6b7280',
  'in-progress': '#3b82f6',
  review: '#f59e0b',
  done: '#10b981',
}
