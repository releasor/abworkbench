import { lazy, Suspense } from 'react'
import type { Task, ViewMode } from '../types'
import PanelSwitch from '../../../components/common/PanelSwitch'

const KanbanBoard = lazy(() => import('./KanbanBoard').then(m => ({ default: m.KanbanBoard })))
const ListView = lazy(() => import('./ListView').then(m => ({ default: m.ListView })))
const CalendarView = lazy(() => import('./CalendarView').then(m => ({ default: m.CalendarView })))
const ArchiveView = lazy(() => import('./ArchiveView').then(m => ({ default: m.ArchiveView })))
const MatrixView = lazy(() => import('./MatrixView').then(m => ({ default: m.MatrixView })))

interface TaskFlowViewProps {
  viewMode: ViewMode
  onEditTask: (task: Task) => void
  onFocusTask: (task: Task) => void
  onCreateTaskForDate: (date: string) => void
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}

export function TaskFlowView({
  viewMode,
  onEditTask,
  onFocusTask,
  onCreateTaskForDate,
}: TaskFlowViewProps) {
  return (
    <PanelSwitch panelKey={viewMode}>
      <Suspense fallback={<LoadingFallback />}>
        {viewMode === 'list' && (
          <ListView onEditTask={onEditTask} onFocusTask={onFocusTask} />
        )}
        {viewMode === 'calendar' && (
          <CalendarView onEditTask={onEditTask} onCreateTaskForDate={onCreateTaskForDate} />
        )}
        {viewMode === 'board' && (
          <KanbanBoard onEditTask={onEditTask} onFocusTask={onFocusTask} />
        )}
        {viewMode === 'archive' && (
          <ArchiveView onEditTask={onEditTask} />
        )}
        {viewMode === 'matrix' && (
          <MatrixView onEditTask={onEditTask} />
        )}
      </Suspense>
    </PanelSwitch>
  )
}
