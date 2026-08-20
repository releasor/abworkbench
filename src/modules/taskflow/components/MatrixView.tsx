import { useMemo } from 'react'
import { useTaskStore } from '../hooks/useTaskStore'
import { useCategoryMap } from '../hooks/useCategoryMap'
import { PRIORITY_CONFIG } from '../types'
import type { Task } from '../types'
import { todayStr } from '../dateUtils'

interface MatrixViewProps {
  onEditTask: (task: Task) => void
}

type Quadrant = 'urgent-important' | 'important-not-urgent' | 'urgent-not-important' | 'neither'

const QUADRANTS: Array<{ id: Quadrant; label: string; desc: string; color: string }> = [
  { id: 'urgent-important', label: '紧急且重要', desc: '立即执行', color: 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20' },
  { id: 'important-not-urgent', label: '重要不紧急', desc: '计划安排', color: 'border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20' },
  { id: 'urgent-not-important', label: '紧急不重要', desc: '委托他人', color: 'border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20' },
  { id: 'neither', label: '不紧急不重要', desc: '可以删除', color: 'border-border  bg-surface-lighter/50 ' },
]

function classifyTask(task: Task, today: string): Quadrant {
  const isUrgent = task.priority === 'urgent' || task.priority === 'high' || (task.dueDate && task.dueDate.slice(0, 10) <= today)
  const isImportant = task.priority === 'urgent' || task.priority === 'high'
  if (isUrgent && isImportant) return 'urgent-important'
  if (isImportant) return 'important-not-urgent'
  if (isUrgent) return 'urgent-not-important'
  return 'neither'
}

export function MatrixView({ onEditTask }: MatrixViewProps) {
  const getFilteredTasks = useTaskStore((s) => s.getFilteredTasks)
  const tasks = useMemo(() => getFilteredTasks(), [getFilteredTasks])
  const categoryMap = useCategoryMap()

  const quadrants = useMemo(() => {
    const today = todayStr()
    const map: Record<Quadrant, Task[]> = {
      'urgent-important': [],
      'important-not-urgent': [],
      'urgent-not-important': [],
      'neither': [],
    }
    for (const task of tasks) {
      if (task.status === 'done' || task.archived) continue
      map[classifyTask(task, today)].push(task)
    }
    return map
  }, [tasks])

  return (
    <div className="grid grid-cols-2 gap-3 h-[calc(100vh-220px)] min-h-[400px]">
      {QUADRANTS.map((q) => (
        <div key={q.id} className={`rounded-2xl border-2 ${q.color} p-3 flex flex-col overflow-hidden`}>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-text">{q.label}</h3>
              <p className="text-[10px] text-text-muted">{q.desc}</p>
            </div>
            <span className="rounded-full bg-white/60 /60 px-2 py-0.5 text-[10px] font-semibold text-text-muted">
              {quadrants[q.id].length}
            </span>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto">
            {quadrants[q.id].length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-text-muted">暂无任务</div>
            ) : (
              quadrants[q.id].map((task) => {
                const cat = categoryMap.get(task.category)
                return (
                  <div
                    key={task.id}
                    onClick={() => onEditTask(task)}
                    className="cursor-pointer rounded-xl border border-border/60 /60 bg-white p-2.5 transition hover:border-primary/30 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_CONFIG[task.priority].color}`} />
                      <span className="truncate text-xs font-medium text-text">{task.title}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-muted">
                      {cat && <span className="rounded bg-surface-lighter px-1 py-0.5">{cat.name}</span>}
                      {task.dueDate && <span>截止 {task.dueDate.slice(0, 10)}</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
