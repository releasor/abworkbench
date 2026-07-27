const TASKFLOW_TASKS_KEY = 'taskflow-offline-tasks';
const TASKFLOW_CATEGORIES_KEY = 'taskflow-offline-categories';
const TASKFLOW_BACKUPS_KEY = 'taskflow-offline-backups';
const TASKFLOW_PREFERENCE_KEYS = [
  'taskflow-viewMode',
  'taskflow-sort-by',
  'taskflow-sort-reverse',
  'taskflow-kanban-collapsed',
  'taskflow-list-sortField',
  'taskflow-list-sortDir',
  'taskflow-list-compact',
  'taskflow-list-groupBy',
  'taskflow-filter-presets',
  'taskflow-search-history',
] as const;

type JsonRecord = Record<string, unknown>;

export interface DesktopBackupPayload {
  version: 2;
  app: 'Abworkbench';
  exportedAt: string;
  data: JsonRecord;
  taskFlow: {
    tasks: unknown[];
    categories: unknown[];
    backups: unknown[];
    preferences: Record<string, string>;
  };
}

function readJsonArray(key: string): unknown[] {
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readPreferences(): Record<string, string> {
  const preferences: Record<string, string> = {};
  for (const key of TASKFLOW_PREFERENCE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) preferences[key] = value;
  }
  return preferences;
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function createDesktopBackup(data: JsonRecord): DesktopBackupPayload {
  return {
    version: 2,
    app: 'Abworkbench',
    exportedAt: new Date().toISOString(),
    data,
    taskFlow: {
      tasks: readJsonArray(TASKFLOW_TASKS_KEY),
      categories: readJsonArray(TASKFLOW_CATEGORIES_KEY),
      backups: readJsonArray(TASKFLOW_BACKUPS_KEY),
      preferences: readPreferences(),
    },
  };
}

export function downloadJsonBackup(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function restoreTaskFlowBackup(raw: unknown): boolean {
  const source = raw as { taskFlow?: Partial<DesktopBackupPayload['taskFlow']>; data?: JsonRecord } | null;
  const taskFlow = source?.taskFlow;
  if (!taskFlow) return false;

  if (Array.isArray(taskFlow.tasks)) writeJson(TASKFLOW_TASKS_KEY, taskFlow.tasks);
  if (Array.isArray(taskFlow.categories)) writeJson(TASKFLOW_CATEGORIES_KEY, taskFlow.categories);
  if (Array.isArray(taskFlow.backups)) writeJson(TASKFLOW_BACKUPS_KEY, taskFlow.backups);
  if (taskFlow.preferences && typeof taskFlow.preferences === 'object') {
    for (const [key, value] of Object.entries(taskFlow.preferences)) {
      if (TASKFLOW_PREFERENCE_KEYS.includes(key as typeof TASKFLOW_PREFERENCE_KEYS[number]) && typeof value === 'string') {
        localStorage.setItem(key, value);
      }
    }
  }
  return true;
}

export function getLegacyOrCurrentData(raw: unknown): JsonRecord {
  const value = raw as { data?: JsonRecord } | JsonRecord | null;
  if (value && typeof value === 'object' && 'data' in value && value.data && typeof value.data === 'object') {
    return { ...(value.data as JsonRecord) };
  }
  return value && typeof value === 'object' ? { ...(value as JsonRecord) } : {};
}
