import { useEffect, useState } from 'react'
import BorderGlow from '../../components/common/BorderGlow/BorderGlow'
import { useBorderGlowSurfaceColor, useBorderGlowTheme } from '../../components/common/BorderGlow/borderGlowTheme'
import ProjectList from './ProjectList'
import ProjectWorkbench from './ProjectWorkbench'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'

export default function WorkbenchPage() {
  const hydrate = useWorkbenchStore((s) => s.hydrate)
  const hydrated = useWorkbenchStore((s) => s.hydrated)
  const [projectId, setProjectId] = useState<string | null>(null)
  const glowTheme = useBorderGlowTheme()
  const surfaceColor = useBorderGlowSurfaceColor()

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const stage = !hydrated ? (
    <div className="flex h-full min-h-[16rem] items-center justify-center text-sm text-text-muted">
      加载中…
    </div>
  ) : (
    <div className="wb-content-scroll">
      {projectId ? (
        <ProjectWorkbench projectId={projectId} onBack={() => setProjectId(null)} />
      ) : (
        <ProjectList onOpenProject={setProjectId} />
      )}
    </div>
  )

  return (
    <BorderGlow
      {...glowTheme}
      borderRadius={22}
      backgroundColor={surfaceColor}
      glowMaskColor={surfaceColor}
      className="wb-stage-frame border-glow-card--glass h-full min-h-0 w-full"
      innerClassName="wb-stage flex h-full min-h-0 flex-col page-enter-key"
    >
      {stage}
    </BorderGlow>
  )
}
