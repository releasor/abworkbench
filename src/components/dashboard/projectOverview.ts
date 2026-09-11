/** Dashboard「项目概览」— derived from Workbench projects, not TaskFlow categories. */

export type ProjectOverviewInputProject = {
  id: string
  name: string
}

export type ProjectOverviewInputTask = {
  projectId: string
  title: string
  status: string
  dueDate?: string | null
  order: number
}

export type ProjectOverviewRow = {
  id: string
  name: string
  color: string
  total: number
  active: number
  progress: number
  nextTitle: string | null
}

const PROJECT_COLORS = ['#818cf8', '#22d3ee', '#f59e0b', '#34d399', '#f472b6', '#a78bfa', '#fb7185', '#38bdf8']

function colorForProject(id: string, index: number): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PROJECT_COLORS[(hash + index) % PROJECT_COLORS.length]
}

function pickNextTitle(tasks: ProjectOverviewInputTask[]): string | null {
  const active = tasks.filter((t) => t.status !== 'done')
  if (active.length === 0) return null
  active.sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'doing') return -1
      if (b.status === 'doing') return 1
    }
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return a.order - b.order
  })
  return active[0]?.title ?? null
}

export function buildWorkbenchProjectOverview(
  projects: ProjectOverviewInputProject[],
  tasks: ProjectOverviewInputTask[],
  limit = 4,
): ProjectOverviewRow[] {
  const byProject = new Map<string, ProjectOverviewInputTask[]>()
  for (const task of tasks) {
    const list = byProject.get(task.projectId)
    if (list) list.push(task)
    else byProject.set(task.projectId, [task])
  }

  const rows = projects.map((project, index) => {
    const projectTasks = byProject.get(project.id) ?? []
    let doneCount = 0
    for (const t of projectTasks) {
      if (t.status === 'done') doneCount++
    }
    const total = projectTasks.length
    const active = total - doneCount
    const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0
    return {
      id: project.id,
      name: project.name,
      color: colorForProject(project.id, index),
      total,
      active,
      progress,
      nextTitle: pickNextTitle(projectTasks),
    }
  })

  return rows
    .slice()
    .sort((a, b) => {
      if (b.active !== a.active) return b.active - a.active
      if (b.total !== a.total) return b.total - a.total
      return a.name.localeCompare(b.name, 'zh')
    })
    .slice(0, limit)
}
