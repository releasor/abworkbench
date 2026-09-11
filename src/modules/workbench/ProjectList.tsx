import { useState } from 'react'
import { showToast } from '../taskflow/utils/toastEvent'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'
import WbPanel from './WbPanel'

interface ProjectListProps {
  onOpenProject: (projectId: string) => void
}

export default function ProjectList({ onOpenProject }: ProjectListProps) {
  const projects = useWorkbenchStore((s) => s.projects)
  const createProject = useWorkbenchStore((s) => s.createProject)
  const connection = useWorkbenchStore((s) => s.connection)
  const joinRoom = useWorkbenchStore((s) => s.joinRoom)
  const disconnect = useWorkbenchStore((s) => s.disconnect)
  const [name, setName] = useState('')
  const [joinUrl, setJoinUrl] = useState('')
  const [joinPassphrase, setJoinPassphrase] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      showToast('请先为项目命名', 'error')
      return
    }
    const id = createProject(trimmed)
    if (!id) {
      showToast('创建项目失败', 'error')
      return
    }
    setName('')
    onOpenProject(id)
  }

  const onJoin = async () => {
    setBusy(true)
    try {
      const result = await joinRoom({
        baseUrl: joinUrl.trim(),
        passphrase: joinPassphrase.trim() || undefined,
        displayName: displayName.trim() || undefined,
      })
      if (!result.ok) {
        showToast(result.error, 'error')
        return
      }
      showToast('已加入房间', 'success')
      onOpenProject(result.projectId)
    } finally {
      setBusy(false)
    }
  }

  const liveName =
    connection.projectName ||
    projects.find((p) => p.id === connection.projectId)?.name ||
    '项目'

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 p-4 motion-enter lg:flex-row lg:gap-5">
      {/* Left: collaboration / create */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <WbPanel hero className="p-6 md:p-8">
          <div className="home-kicker mb-3 inline-flex items-center gap-2">
            <span>工作台</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-text md:text-4xl">项目协作</h1>
          <p className="mt-2 text-sm text-text-muted">
            先创建并命名项目；开房在项目内进行，且只绑定那一个项目。
          </p>
        </WbPanel>

        {connection.mode !== 'offline' && connection.projectId ? (
          <WbPanel as="div" className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
            <span className="wb-mode-pill" data-mode={connection.mode}>
              {connection.mode === 'hosting' ? '已开房' : '已加入'}
            </span>
            <span className="text-text">
              房间绑定：<strong>{liveName}</strong>
            </span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => onOpenProject(connection.projectId!)}
                className="interactive-glass dashboard-chip rounded-xl px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
              >
                进入该项目
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void disconnect()}
                className="interactive-glass dashboard-chip rounded-xl px-3 py-1 text-xs font-semibold text-text-muted"
              >
                断开
              </button>
            </div>
          </WbPanel>
        ) : (
          <WbPanel className="p-4">
            <h2 className="text-sm font-semibold text-text">加入他人房间</h2>
            <p className="mt-1 text-xs text-text-muted">加入后会进入对方当前开房的那一个项目。</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
                <span className="text-[10px] text-text-muted">主机地址</span>
                <input
                  value={joinUrl}
                  onChange={(e) => setJoinUrl(e.target.value)}
                  placeholder="http://192.168.x.x:端口"
                  className="interactive-glass rounded-xl px-2 py-1.5 text-xs text-text bg-transparent outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="flex w-24 flex-col gap-1">
                <span className="text-[10px] text-text-muted">口令</span>
                <input
                  value={joinPassphrase}
                  onChange={(e) => setJoinPassphrase(e.target.value)}
                  placeholder="可选"
                  className="interactive-glass rounded-xl px-2 py-1.5 text-xs text-text bg-transparent outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="flex w-24 flex-col gap-1">
                <span className="text-[10px] text-text-muted">显示名</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="可选"
                  className="interactive-glass rounded-xl px-2 py-1.5 text-xs text-text bg-transparent outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <button
                type="button"
                disabled={busy || !joinUrl.trim()}
                onClick={() => void onJoin()}
                className="interactive-glass dashboard-chip rounded-xl px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
              >
                加入
              </button>
            </div>
          </WbPanel>
        )}

        <WbPanel hero className="p-4">
          <h2 className="text-sm font-semibold text-text">第一步：命名并创建项目</h2>
          <p className="mt-1 text-xs text-text-muted">这里填的是项目名称，不是任务。开房请进入项目后再点。</p>
          <div className="mt-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              placeholder="例如：产品迭代 / 毕业设计"
              autoFocus
              aria-label="项目名称"
              className="interactive-glass min-w-0 flex-1 rounded-xl px-3 py-2 text-sm text-text bg-transparent outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={submit}
              className="interactive-glass dashboard-chip shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
            >
              创建项目
            </button>
          </div>
        </WbPanel>
      </div>

      {/* Right: existing projects */}
      <section className="flex min-h-0 w-full flex-col lg:w-[min(22rem,38%)] lg:shrink-0">
        <h2 className="mb-2 shrink-0 text-sm font-semibold text-text">已有项目</h2>
        {projects.length === 0 ? (
          <WbPanel as="div" className="rounded-xl border-dashed px-4 py-8 text-center text-sm text-text-muted">
            还没有项目。请在左侧输入名称后点「创建项目」。
          </WbPanel>
        ) : (
          <ul className="motion-stagger flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
            {projects.map((p) => {
              const isBound = connection.projectId === p.id && connection.mode !== 'offline'
              return (
                <li key={p.id} className="shrink-0">
                  <WbPanel
                    as="button"
                    type="button"
                    onClick={() => onOpenProject(p.id)}
                    className="wb-project-card flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="truncate text-sm font-medium text-text">{p.name}</span>
                    <span className="ml-3 shrink-0 text-xs text-primary">
                      {isBound ? '协作中 →' : '进入 →'}
                    </span>
                  </WbPanel>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
