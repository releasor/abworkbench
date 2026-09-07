import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import BorderGlow from './BorderGlow'
import { useBorderGlowSurfaceColor, useBorderGlowTheme } from './borderGlowTheme'

export type GlowPanelProps = {
  children?: ReactNode
  className?: string
  innerClassName?: string
  borderRadius?: number
} & Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'>

/** Modal / popover shell ? BorderGlow card with theme defaults (same glass as dashboard). */
export default function GlowPanel({
  className = '',
  innerClassName = '',
  borderRadius = 34,
  children,
  ...props
}: GlowPanelProps) {
  const theme = useBorderGlowTheme()
  const surface = useBorderGlowSurfaceColor()

  return (
    <BorderGlow
      {...theme}
      backgroundColor={surface}
      glowMaskColor={surface}
      borderRadius={borderRadius}
      className={`glow-panel border-glow-card--glass relative z-10 ${className}`.trim()}
      innerClassName={`glass-card-shell ${innerClassName}`.trim()}
      {...props}
    >
      {children}
    </BorderGlow>
  )
}
