import { useState, useMemo } from 'react'
import { useTaskStore } from '../hooks/useTaskStore'
import { useCategoryMap } from '../hooks/useCategoryMap'
import { Icon } from './Icon'
import { formatRelativeTime } from '../utils/relativeTime'
import { showToast } from '../utils/toastEvent'
import { PRIORITY_CONFIG } from '../types'
import type { Task } from '../types'

interface ArchiveViewProps {
  onEditTask: (task: Task) => void
}

export function ArchiveView({ onEditTask }: ArchiveViewProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const [search, setSearch] = useState('')

  const archivedTasks = useMemo(() => {
    let list = tasks.filter((t) => t.archived)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
    }
    return list.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
  }, [tasks, search])

  const categoryMap = useCategoryMap()

  const handleUnarchive = async (taskId: string) => {
    try {
      await updateTask(taskId, { archived: false })
    } catch {
      showToast('取消归档失败', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索归档任务..."
            aria-label="搜索归档任务"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <span className="text-sm text-gray-500">{archivedTasks.length} 个归档任务</span>
      </div>

      {archivedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Icon name="archive" className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">{search ? '没有匹配的归档任务' : '暂无归档任务'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {archivedTasks.map((task) => {
            const cat = categoryMap.get(task.category)
            return (
              <div
                key={task.id}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 transition hover:border-primary/30"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_CONFIG[task.priority].color}`} />
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onEditTask(task)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEditTask(task); } }} aria-label={`编辑任务: ${task.title}`}>
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">{task.title}</span>
                    {cat && (
                      <span className="flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[10px] text-gray-500">{cat.name}</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
                    <span>{PRIORITY_CONFIG[task.priority].label}</span>
                    <span>·</span>
                    <span>归档于 {formatRelativeTime(task.updatedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleUnarchive(task.id)}
                  className="flex-shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs text-gray-500 transition hover:border-primary/30 hover:text-primary opacity-0 group-hover:opacity-100"
                  title="取消归档"
                  aria-label={`取消归档: ${task.title}`}
                >
                  取消归档
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
