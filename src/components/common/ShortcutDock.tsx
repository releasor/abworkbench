import { memo } from 'react'
import { acceleratorToKeys } from '../../shortcuts'
import GlassSurface from './GlassSurface/GlassSurface'

interface ShortcutDockProps {
  launcherHint: string
}

/** Bottom-right shortcut pill ? React Bits GlassSurface (reference defaults) */
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
      title={'\u6253\u5f00\u542f\u52a8\u5668'}
    >
      <kbd>{acceleratorToKeys(launcherHint).join('+')}</kbd>
      <span>{'\u5feb\u641c'}</span>
    </GlassSurface>
  )
})
