import { memo } from 'react'
import type { ReactNode } from 'react'

/**
 * Shared keyboard shortcut badge component.
 * Displays a styled keyboard key indicator.
 */
export const Kbd = memo(function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="mx-1 hidden rounded-lg border border-border bg-surface-lighter px-1.5 py-0.5 font-mono text-[9px] text-text-muted md:inline">
      {children}
    </kbd>
  )
})
