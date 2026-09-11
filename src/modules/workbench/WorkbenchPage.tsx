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
      <div className="wb-page flex min-h-[12rem] flex-1 items-center justify-center text-sm text-text-muted">
        加载中…
      </div>
    )
  }

  if (projectId) {
    return (
      <ProjectWorkbench
        projectId={projectId}
        onBack={() => setProjectId(null)}
      />
    )
  }

  return (
    <div className="wb-page wb-page-list min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <ProjectList onOpenProject={setProjectId} />
    </div>
  )
}
