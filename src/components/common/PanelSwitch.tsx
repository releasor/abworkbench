import type { ReactNode } from 'react'
import clsx from 'clsx'

interface PanelSwitchProps {
  /** Changes to this remount the enter animation (tab id, view mode, etc.) */
  panelKey: string
  className?: string
  children: ReactNode
  /** Horizontal enter direction; omit for default soft vertical enter */
  slideFrom?: 'left' | 'right'
}

/** Soft enter animation whenever the active panel key changes. */
export default function PanelSwitch({ panelKey, className, children, slideFrom }: PanelSwitchProps) {
  return (
    <div
      key={panelKey}
      className={clsx(
        'panel-switch',
        slideFrom === 'left' && 'panel-switch--from-left',
        slideFrom === 'right' && 'panel-switch--from-right',
        className,
      )}
    >
      {children}
    </div>
  )
}
