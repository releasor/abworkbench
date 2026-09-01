import type { ReactNode } from 'react'
import type { TaskStatus, WorkbenchTask } from './types'

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '待办',
  doing: '进行中',
  done: '已完成',
}

interface TaskRowProps {
  task: WorkbenchTask
  onOpen: (taskId: string) => void
  trailing?: ReactNode
}

export default function TaskRow({ task, onOpen, trailing }: TaskRowProps) {
  return (
    <div className="wb-task flex items-center gap-2 px-3 py-2.5 pl-3.5" data-status={task.status}>
      <button type="button" onClick={() => onOpen(task.id)} className="min-w-0 flex-1 text-left">
        <div className="wb-task-title truncate text-sm">{task.title}</div>
        <span className={`wb-chip wb-chip--${task.status} mt-1.5 inline-block px-2 py-0.5 text-[10px]`}>
          {STATUS_LABEL[task.status]}
        </span>
      </button>
      {trailing}
    </div>
  )
}
