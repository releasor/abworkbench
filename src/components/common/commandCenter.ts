export interface CommandCenterNote {
  id: string
  title: string
  content: string
  updatedAt: number
}

export type CommandCenterSuggestionKind =
  | 'create-task'
  | 'create-note'
  | 'quick-expense'
  | 'quick-health'
  | 'quick-reminder'
  | 'open-note'

export interface CommandCenterSuggestion {
  id: string
  kind: CommandCenterSuggestionKind
  label: string
  description: string
  payload: string
  noteId?: string
}

const PREFIXES: Array<{ pattern: RegExp; kind: CommandCenterSuggestionKind; label: string; description: string }> = [
  { pattern: /^(任务|todo|task)\s+(.+)$/i, kind: 'create-task', label: '新建任务', description: '直接创建到任务流' },
  { pattern: /^(笔记|note)\s+(.+)$/i, kind: 'create-note', label: '新建笔记', description: '创建一条快速笔记' },
  { pattern: /^(支出|expense)\s+(.+)$/i, kind: 'quick-expense', label: '记录支出', description: '写入本地笔记，后续可归档' },
  { pattern: /^(健康|health)\s+(.+)$/i, kind: 'quick-health', label: '记录健康', description: '写入本地健康记录笔记' },
  { pattern: /^(提醒|remind|reminder)\s+(.+)$/i, kind: 'quick-reminder', label: '记录提醒', description: '写入本地提醒笔记' },
]

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function matchPrefixedAction(query: string): CommandCenterSuggestion | null {
  for (const prefix of PREFIXES) {
    const match = query.match(prefix.pattern)
    if (!match) continue
    const payload = normalize(match[2])
    if (!payload) return null
    return {
      id: `${prefix.kind}-${payload}`,
      kind: prefix.kind,
      label: `${prefix.label}：${payload}`,
      description: prefix.description,
      payload,
    }
  }
  return null
}

function buildFreeTextActions(query: string): CommandCenterSuggestion[] {
  const prefixed = matchPrefixedAction(query)
  if (prefixed) return [prefixed]

  return [
    {
      id: `create-task-${query}`,
      kind: 'create-task',
      label: `新建任务：${query}`,
      description: '按 Enter 直接加入任务流',
      payload: query,
    },
    {
      id: `create-note-${query}`,
      kind: 'create-note',
      label: `新建笔记：${query}`,
      description: '把当前输入保存为笔记',
      payload: query,
    },
  ]
}

function buildNoteMatches(query: string, notes: CommandCenterNote[]): CommandCenterSuggestion[] {
  const lowerQuery = query.toLowerCase()
  return notes
    .filter((note) => `${note.title}\n${note.content}`.toLowerCase().includes(lowerQuery))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5)
    .map((note) => ({
      id: `note-${note.id}`,
      kind: 'open-note' as const,
      label: `打开笔记：${note.title || '未命名笔记'}`,
      description: note.content ? note.content.replace(/\s+/g, ' ').slice(0, 64) : '空白笔记',
      payload: query,
      noteId: note.id,
    }))
}

export function buildCommandCenterSuggestions(queryText: string, notes: CommandCenterNote[]): CommandCenterSuggestion[] {
  const query = normalize(queryText)
  if (!query) return []
  return [...buildFreeTextActions(query), ...buildNoteMatches(query, notes)]
}

