export interface LinkableNote {
  id: string
  title: string
  content: string
}

export interface LinkableTask {
  id: string
  title: string
  description?: string
  tags?: string[]
  category?: string
  status?: string
  archived?: boolean
}

export interface LinkableCategory {
  id: string
  name: string
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

export function extractNoteLinkTokens(text: string): string[] {
  const tokens: string[] = []
  const wikiPattern = /\[\[([^\]]+)\]\]/g
  const hashPattern = /(^|\s)#([\p{L}\p{N}_-]+)/gu

  for (const match of text.matchAll(wikiPattern)) {
    const token = match[1]?.trim()
    if (token) tokens.push(token)
  }
  for (const match of text.matchAll(hashPattern)) {
    const token = match[2]?.trim()
    if (token) tokens.push(token)
  }

  return [...new Set(tokens)]
}

export function findRelatedTasksForNote<T extends LinkableTask>(
  note: LinkableNote,
  tasks: T[],
  categories: LinkableCategory[] = []
): T[] {
  const tokens = extractNoteLinkTokens(`${note.title}\n${note.content}`).map(normalize)
  if (tokens.length === 0) return []

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]))

  return tasks.filter((task) => {
    if (task.archived) return false
    const haystack = [
      task.title,
      task.description || '',
      ...(task.tags || []),
      task.category || '',
      categoryNameById.get(task.category || '') || '',
    ].map(normalize)

    return tokens.some((token) => haystack.some((value) => value.includes(token)))
  })
}

export function findRelatedNotesForTask<T extends LinkableNote>(
  task: LinkableTask,
  notes: T[],
  categories: LinkableCategory[] = []
): T[] {
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]))
  const resolvedCategory = categoryNameById.get(task.category || '') || task.category || ''

  const taskTokens = [
    task.title,
    task.description || '',
    resolvedCategory,
    ...(task.tags || []),
  ].filter(Boolean).map(normalize)

  if (taskTokens.length === 0) return []

  return notes.filter((note) => {
    const noteTokens = extractNoteLinkTokens(`${note.title}\n${note.content}`).map(normalize)
    const noteText = normalize(`${note.title} ${note.content}`)

    // Match if note has explicit link tokens that appear in task fields
    if (noteTokens.length > 0 && noteTokens.some((token) => taskTokens.some((t) => t.includes(token) || token.includes(t)))) return true

    // Match if task title appears in note content (substring)
    if (taskTokens.some((token) => token.length >= 2 && noteText.includes(token))) return true

    return false
  })
}

