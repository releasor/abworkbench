import type { EnergyLevel } from '../types'
import { nextDateStrN, dayOfWeek as calcDayOfWeek } from '../dateUtils'

export type QuickCreateKind = 'task' | 'note' | 'reminder' | 'project'
export type QuickCreateRepeat = 'once' | 'daily' | 'weekly' | 'monthly'

export interface QuickCreateProject {
  id: string
  name: string
}

export interface QuickCreateOptions {
  today?: string
  projects?: QuickCreateProject[]
}

export interface QuickCreateResult {
  kind: QuickCreateKind
  title: string
  raw: string
  dueDate: string | null
  dueTime: string | null
  estimatedMinutes: number | null
  energyLevel: EnergyLevel
  repeat: QuickCreateRepeat
  projectId?: string
  tags: string[]
  subtasks: string[]
}

const CN_WEEKDAY: Record<string, number> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 }

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Use pure arithmetic date functions instead of Date objects
function addDays(date: string, days: number): string {
  return nextDateStrN(date, days)
}

function dayOfWeek(date: string): number {
  return calcDayOfWeek(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)))
}

function normalizeTime(hour: string, minute?: string): string {
  return `${hour.padStart(2, '0')}:${(minute || '00').padStart(2, '0')}`
}

function matchDueDate(text: string, today: string): { dueDate: string | null; token?: string } {
  if (/(今天|today)/i.test(text)) return { dueDate: today, token: text.match(/今天|today/i)?.[0] }
  if (/(明天|tomorrow)/i.test(text)) return { dueDate: addDays(today, 1), token: text.match(/明天|tomorrow/i)?.[0] }
  if (/后天/.test(text)) return { dueDate: addDays(today, 2), token: '后天' }
  const weekMatch = text.match(/(下周|周)([一二三四五六日天])/)
  if (weekMatch) {
    const target = CN_WEEKDAY[weekMatch[2]]
    const current = dayOfWeek(today)
    const base = (target - current + 7) % 7 || 7
    return { dueDate: addDays(today, base + (weekMatch[1] === '下周' ? 7 : 0)), token: weekMatch[0] }
  }
  const isoMatch = text.match(/\d{4}-\d{1,2}-\d{1,2}/)
  if (isoMatch) return { dueDate: isoMatch[0], token: isoMatch[0] }
  return { dueDate: null }
}

function matchProjectId(tags: string[], projects: QuickCreateProject[] = []): string | undefined {
  for (const tag of tags) {
    const project = projects.find((item) => item.name === tag || item.id === tag)
    if (project) return project.id
  }
  return undefined
}

function cleanupTitle(text: string): string {
  return text
    .replace(/^(任务|todo|task|笔记|note|提醒|remind|reminder|项目|project)\s+/i, '')
    .replace(/\b(remind|reminder)\b/gi, '')
    .replace(/提醒/g, '')
    .replace(/每(日|天|周|月)/g, '')
    .replace(/(今天|明天|后天|下周[一二三四五六日天]|周[一二三四五六日天]|today|tomorrow)/gi, '')
    .replace(/\d{4}-\d{1,2}-\d{1,2}/g, '')
    .replace(/\d{1,2}\s*[点:：]\s*\d{0,2}/g, '')
    .replace(/\d+\s*(分钟|分|min|m)/gi, '')
    .replace(/(低|中|高)精力/g, '')
    .replace(/#\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseQuickCreateInput(input: string, options: QuickCreateOptions = {}): QuickCreateResult {
  const raw = input.trim()
  const today = options.today || todayISO()
  const [mainPart, ...subtaskParts] = raw.split('/').map((part) => part.trim()).filter(Boolean)
  const tags = [...raw.matchAll(/#([^\s#]+)/g)].map((match) => match[1])
  const due = matchDueDate(raw, today)
  const timeMatch = raw.match(/(\d{1,2})\s*(?:点|:|：)\s*(\d{1,2})?/)
  const durationMatch = raw.match(/(\d{1,3})\s*(分钟|分|min|m)/i)
  const energyMatch = raw.match(/(低|中|高)精力/)
  const repeat: QuickCreateRepeat = /每(日|天)/.test(raw) ? 'daily' : /每周/.test(raw) ? 'weekly' : /每月/.test(raw) ? 'monthly' : 'once'
  const kind: QuickCreateKind = /^(项目|project)\s+/i.test(raw) ? 'project' : /^(笔记|note)\s+/i.test(raw) ? 'note' : /^(提醒|remind|reminder)\s+|提醒/.test(raw) ? 'reminder' : 'task'
  const title = cleanupTitle(mainPart || raw) || raw

  return {
    kind,
    title,
    raw,
    dueDate: due.dueDate,
    dueTime: timeMatch ? normalizeTime(timeMatch[1], timeMatch[2]) : null,
    estimatedMinutes: durationMatch ? Number(durationMatch[1]) : null,
    energyLevel: energyMatch?.[1] === '低' ? 'low' : energyMatch?.[1] === '高' ? 'high' : 'medium',
    repeat,
    projectId: matchProjectId(tags, options.projects),
    tags,
    subtasks: subtaskParts.map(cleanupTitle).filter(Boolean),
  }
}

export function buildQuickCreateDueAt(parsed: Pick<QuickCreateResult, 'dueDate' | 'dueTime'>): string | null {
  if (!parsed.dueDate) return null
  return `${parsed.dueDate}T${parsed.dueTime || '09:00'}`
}

export function buildQuickCreateSubtasks(parsed: Pick<QuickCreateResult, 'subtasks'>): Array<{ id: string; title: string; completed: boolean; createdAt: string }> {
  return parsed.subtasks.map((title, index) => ({
    id: `quick-${Date.now().toString(36)}-${index}`,
    title,
    completed: false,
    createdAt: new Date().toISOString(),
  }))
}
