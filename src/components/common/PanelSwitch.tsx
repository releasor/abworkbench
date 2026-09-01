import type { ReactNode } from 'react'
import clsx from 'clsx'

interface PanelSwitchProps {
  /** Changes to this remount the enter animation (tab id, view mode, etc.) */
  panelKey: string
  className?: string
  children: ReactNode
}

/** Soft enter animation whenever the active panel key changes. */
export default function PanelSwitch({ panelKey, className, children }: PanelSwitchProps) {
  return (
    <div key={panelKey} className={clsx('panel-switch', className)}>
      {children}
    </div>
  )
}
