import { useMemo, useState } from 'react'
import MainlineLaneBoard from './MainlineLaneBoard'
import WbPanel from './WbPanel'
import RoomBar from './RoomBar'
import TaskDrawer from './TaskDrawer'
import TeamMainlineToolbar from './TeamMainlineToolbar'
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
  const submitLocalMainlineToTeam = useWorkbenchStore((s) => s.submitLocalMainlineToTeam)
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

  const personalMainlineSubtitle = isLive
    ? '仅本机可见；可拖到团队主线同步给全员'
    : '未开房时仅显示个人主线；开房后可同步到团队主线'

  const boardRowClass = isLive ? 'wb-board-row--live' : 'wb-board-row--solo'

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
    <div className="wb-page flex h-full min-h-0 flex-1 flex-col gap-2 px-2 pb-2 pt-1 motion-enter">
      <RoomBar projectId={projectId} />

      <header className="flex shrink-0 items-center gap-2">
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
        {isLive ? <TeamMainlineToolbar projectId={projectId} /> : null}
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
            个人主线有 {unsyncedCount} 条未同步到团队主线
          </span>
          <button
            type="button"
            onClick={() => void submitLocalMainlineToTeam(projectId)}
            className="interactive-glass dashboard-chip rounded-xl px-3 py-1 text-xs font-semibold text-primary disabled:opacity-50"
          >
            提交到团队主线
          </button>
        </WbPanel>
      ) : null}

      <div
        className={'wb-board-row flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row ' + boardRowClass}
      >
        <MainlineLaneBoard
          projectId={projectId}
          kind="personalMainline"
          title="个人主线"
          subtitle={personalMainlineSubtitle}
          onOpenTask={setOpenTaskId}
        />
        {isLive ? (
          <MainlineLaneBoard
            projectId={projectId}
            kind="teamMainline"
            title="团队主线"
            subtitle="开房后全员可见；成员提交的任务会出现在这里"
            onOpenTask={setOpenTaskId}
          />
        ) : null}
      </div>

      <TaskDrawer task={openTask} onClose={() => setOpenTaskId(null)} />
    </div>
  )
}
