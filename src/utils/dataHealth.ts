export interface DataHealthInput {
  todos: unknown[]
  notes: Array<{ id: string; title: string; content: string }>
  pomodoroSessions: unknown[]
  habits: unknown[]
  taskFlowTasks: Array<{ id: string; title: string; status?: string; archived?: boolean }>
  backups: Array<{ modified?: string }>
}

export interface DataHealthIssue {
  id: string
  title: string
  detail: string
  severity: 'info' | 'warning' | 'danger'
}

export interface DataHealthReport {
  totalBytes: number
  totalSizeLabel: string
  backupStatus: 'ok' | 'missing'
  lastBackupLabel: string
  duplicateTaskCount: number
  emptyNoteCount: number
  issues: DataHealthIssue[]
}

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function buildDataHealthReport(input: DataHealthInput): DataHealthReport {
  const totalBytes =
    byteLength(input.todos) +
    byteLength(input.notes) +
    byteLength(input.pomodoroSessions) +
    byteLength(input.habits) +
    byteLength(input.taskFlowTasks) +
    byteLength(input.backups)

  const titleCounts = new Map<string, number>()
  for (const task of input.taskFlowTasks) {
    if (task.archived) continue
    const title = task.title.trim().toLowerCase()
    if (!title) continue
    titleCounts.set(title, (titleCounts.get(title) || 0) + 1)
  }
  const duplicateTaskCount = [...titleCounts.values()].filter((count) => count > 1).length
  const emptyNoteCount = input.notes.filter((note) => !note.title.trim() && !note.content.trim() || note.title.trim() && !note.content.trim()).length
  const lastBackup = input.backups
    .map((backup) => backup.modified)
    .filter(Boolean)
    .sort()
    .at(-1)

  const issues: DataHealthIssue[] = []
  if (duplicateTaskCount > 0) {
    issues.push({ id: 'duplicate-tasks', title: '重复任务', detail: `${duplicateTaskCount} 组标题重复`, severity: 'warning' })
  }
  if (emptyNoteCount > 0) {
    issues.push({ id: 'empty-notes', title: '空笔记', detail: `${emptyNoteCount} 篇笔记没有正文`, severity: 'info' })
  }
  if (!lastBackup) {
    issues.push({ id: 'backup-missing', title: '暂无自动备份', detail: '编辑任务后会自动生成快照', severity: 'warning' })
  }

  return {
    totalBytes,
    totalSizeLabel: formatBytes(totalBytes),
    backupStatus: lastBackup ? 'ok' : 'missing',
    lastBackupLabel: lastBackup ? new Date(lastBackup).toLocaleString('zh-CN') : '暂无',
    duplicateTaskCount,
    emptyNoteCount,
    issues,
  }
}

