export type GlobalSearchType = 'task' | 'note' | 'habit' | 'project' | 'file'

export interface GlobalSearchQuery {
  text: string
  type?: GlobalSearchType
  project?: string
  tag?: string
}

export interface GlobalSearchData {
  tasks: Array<{ id: string; title: string; description?: string; tags?: string[]; category?: string; archived?: boolean }>
  notes: Array<{ id: string; title: string; content: string }>
  habits: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string }>
  files?: Array<{ id: string; name: string; path: string; projectId?: string }>
}

export interface GlobalSearchResult {
  id: string
  type: GlobalSearchType
  title: string
  description: string
  targetId: string
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

export function parseGlobalSearchQuery(query: string): GlobalSearchQuery {
  const parts = query.trim().split(/\s+/).filter(Boolean)
  const rest: string[] = []
  const parsed: GlobalSearchQuery = { text: '' }

  for (const part of parts) {
    const [key, ...valueParts] = part.split(':')
    const value = valueParts.join(':')
    if (key === 'type' && ['task', 'note', 'habit', 'project', 'file'].includes(value)) {
      parsed.type = value as GlobalSearchType
    } else if (key === 'project' && value) {
      parsed.project = value
    } else if (key === 'tag' && value) {
      parsed.tag = value
    } else {
      rest.push(part)
    }
  }

  parsed.text = rest.join(' ')
  return parsed
}

function matchesText(text: string, query: string): boolean {
  if (!query) return true
  return normalize(text).includes(normalize(query))
}

function matchesProject(categoryId: string | undefined, projectName: string | undefined, projects: GlobalSearchData['projects']): boolean {
  if (!projectName) return true
  const query = normalize(projectName)
  const project = projects.find((item) => item.id === categoryId)
  return normalize(categoryId || '').includes(query) || normalize(project?.name || '').includes(query)
}

export function buildGlobalSearchResults(queryText: string, data: GlobalSearchData): GlobalSearchResult[] {
  const query = parseGlobalSearchQuery(queryText)
  const results: GlobalSearchResult[] = []

  if (!query.type || query.type === 'task') {
    for (const task of data.tasks) {
      if (task.archived) continue
      if (!matchesProject(task.category, query.project, data.projects)) continue
      if (query.tag && !(task.tags || []).some((t) => matchesText(t, query.tag!))) continue
      const text = [task.title, task.description || '', ...(task.tags || [])].join(' ')
      if (!matchesText(text, query.text)) continue
      results.push({ id: task.id, type: 'task', title: task.title, description: task.description || '任务', targetId: task.id })
    }
  }

  if (!query.type || query.type === 'note') {
    for (const note of data.notes) {
      const noteText = `${note.title} ${note.content}`
      if (!matchesText(noteText, query.text)) continue
      if (query.project && !matchesText(noteText, query.project)) continue
      // Show content preview with match context
      const preview = note.content.length > 80
        ? note.content.slice(0, 80).replace(/\n/g, ' ') + '...'
        : note.content.replace(/\n/g, ' ') || '笔记'
      results.push({ id: note.id, type: 'note', title: note.title || '未命名笔记', description: preview, targetId: note.id })
    }
  }

  if (!query.type || query.type === 'habit') {
    for (const habit of data.habits) {
      if (!matchesText(habit.name, query.text)) continue
      results.push({ id: habit.id, type: 'habit', title: habit.name, description: '习惯', targetId: habit.id })
    }
  }

  if (!query.type || query.type === 'project') {
    for (const project of data.projects) {
      if (!matchesText(project.name, query.text || query.project || '')) continue
      results.push({ id: project.id, type: 'project', title: project.name, description: '项目空间', targetId: project.id })
    }
  }

  if (!query.type || query.type === 'file') {
    for (const file of data.files || []) {
      if (!matchesProject(file.projectId, query.project, data.projects)) continue
      if (!matchesText(`${file.name} ${file.path}`, query.text)) continue
      results.push({ id: file.id, type: 'file', title: file.name, description: file.path, targetId: file.path })
    }
  }

  return results.slice(0, 20)
}
