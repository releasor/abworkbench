import { useEffect, useState } from 'react'
import ProjectList from './ProjectList'
import ProjectWorkbench from './ProjectWorkbench'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'

export default function WorkbenchPage() {
  const hydrate = useWorkbenchStore((s) => s.hydrate)
  const hydrated = useWorkbenchStore((s) => s.hydrated)
  const [projectId, setProjectId] = useState<string | null>(null)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!hydrated) {
    return (
      <div className="wb-stage flex h-full min-h-[16rem] items-center justify-center text-sm text-text-muted">
        加载中…
      </div>
    )
  }

  return (
    <div className="wb-stage flex h-full min-h-0 flex-col gap-3 p-1 page-enter-key">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {projectId ? (
          <ProjectWorkbench projectId={projectId} onBack={() => setProjectId(null)} />
        ) : (
          <ProjectList onOpenProject={setProjectId} />
        )}
      </div>
    </div>
  )
}
