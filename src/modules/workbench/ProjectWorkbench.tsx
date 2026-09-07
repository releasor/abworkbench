import { useMemo, useState } from 'react'
import MainlineBoard from './MainlineBoard'
import WbPanel from './WbPanel'
import PersonalColumn from './PersonalColumn'
import PoolColumn from './PoolColumn'
import RoomBar from './RoomBar'
import TaskDrawer from './TaskDrawer'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'

interface ProjectWorkbenchProps {
  projectId: string
  onBack: () => void
}

export default function ProjectWorkbench({ projectId, onBack }: ProjectWorkbenchProps) {
  const projects = useWorkbenchStore((s) => s.projects)
  const renameProject = useWorkbenchStore((s) => s.renameProject)
  const tasks = useWorkbenchStore((s) => s.tasks)
  const remotePool = useWorkbenchStore((s) => s.remotePool)
  const remoteMainline = useWorkbenchStore((s) => s.remoteMainline)
  const disconnectBanner = useWorkbenchStore((s) => s.disconnectBanner)
  const clearDisconnectBanner = useWorkbenchStore((s) => s.clearDisconnectBanner)
  const unsyncedLocalMainline = useWorkbenchStore((s) => s.unsyncedLocalMainline)
  const submitLocalMainlineToPool = useWorkbenchStore((s) => s.submitLocalMainlineToPool)
  const isLive = useWorkbenchStore((s) => s.isLiveForProject(projectId))
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  )

  const openTask = useMemo(() => {
    if (!openTaskId) return null
    return (
      tasks.find((t) => t.id === openTaskId) ??
      remotePool.find((t) => t.id === openTaskId) ??
      remoteMainline.find((t) => t.id === openTaskId) ??
      null
    )
  }, [openTaskId, tasks, remotePool, remoteMainline])

  const unsyncedCount = useMemo(() => {
    if (!isLive) return 0
    return unsyncedLocalMainline(projectId).length
  }, [isLive, unsyncedLocalMainline, projectId])

  if (!project) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onBack}
          className="self-start text-sm text-text-muted hover:text-text"
        >
          ← 返回项目列表
        </button>
        <p className="text-sm text-text-muted">项目不存在或已删除</p>
      </div>
    )
  }

  const startRename = () => {
    setNameDraft(project.name)
    setEditingName(true)
  }

  const commitRename = () => {
    const next = nameDraft.trim()
    if (!next) {
      setEditingName(false)
      return
    }
    renameProject(projectId, next)
    setEditingName(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 motion-enter">
      <RoomBar projectId={projectId} />

      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="interactive-glass dashboard-chip rounded-xl px-2.5 py-1 text-xs font-semibold text-text-muted"
        >
          ← 项目列表
        </button>
        {editingName ? (
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setEditingName(false)
            }}
            autoFocus
            aria-label="项目名称"
            className="interactive-glass min-w-0 flex-1 rounded-xl px-2 py-1 text-lg font-semibold text-text bg-transparent outline-none focus:ring-2 focus:ring-primary/30"
          />
        ) : (
          <button
            type="button"
            onClick={startRename}
            title="点击修改项目名称"
            className="truncate text-left text-lg font-semibold text-text hover:text-primary"
          >
            {project.name}
          </button>
        )}
      </header>

      {disconnectBanner ? (
        <WbPanel as="div" className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm text-text">
          <span className="flex-1">{disconnectBanner}</span>
          <button
            type="button"
            onClick={() => clearDisconnectBanner()}
            className="interactive-glass dashboard-chip rounded-xl px-2 py-1 text-xs font-semibold text-text-muted"
          >
            知道了
          </button>
        </WbPanel>
      ) : null}

      {isLive && unsyncedCount > 0 ? (
        <WbPanel as="div" className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm text-text">
          <span className="flex-1 text-text-muted">
            本机主线有 {unsyncedCount} 条未同步到团队（不自动合并）
          </span>
          <button
            type="button"
            onClick={() => void submitLocalMainlineToPool(projectId)}
            className="interactive-glass dashboard-chip rounded-xl px-3 py-1 text-xs font-semibold text-primary disabled:opacity-50"
          >
            提交到所有人
          </button>
        </WbPanel>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <MainlineBoard projectId={projectId} onOpenTask={setOpenTaskId} />
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          <PersonalColumn projectId={projectId} onOpenTask={setOpenTaskId} />
          {isLive ? <PoolColumn projectId={projectId} onOpenTask={setOpenTaskId} /> : null}
        </div>
      </div>

      <TaskDrawer task={openTask} onClose={() => setOpenTaskId(null)} />
    </div>
  )
}
