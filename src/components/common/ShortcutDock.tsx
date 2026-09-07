import { memo } from 'react'
import { acceleratorToKeys } from '../../shortcuts'
import GlassSurface from './GlassSurface/GlassSurface'

interface ShortcutDockProps {
  launcherHint: string
}

/** Bottom-right shortcut pill â?React Bits GlassSurface (reference defaults) */
export default memo(function ShortcutDock({ launcherHint }: ShortcutDockProps) {
  return (
    <GlassSurface
      width="auto"
      height="auto"
      borderRadius={999}
      borderWidth={0.08}
      className="shortcut-dock hidden md:flex no-motion"
      contentClassName="shortcut-dock__content"
      data-overlay-interactive="true"
      title="ĺżŤćˇé?
    >
      <kbd>{acceleratorToKeys(launcherHint).join('+')}</kbd>
      <span>ĺżŤć</span>
    </GlassSurface>
  )
})
