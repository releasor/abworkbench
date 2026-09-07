import type { ReactNode } from 'react'
import GlassCard, { type GlassCardProps } from '../common/GlassSurface/GlassCard'

type SettingsGlassCardProps = GlassCardProps & {
  children?: ReactNode
}

export default function SettingsGlassCard({
  borderRadius = 22,
  className = '',
  contentClassName = '',
  borderWidth = 0.08,
  backgroundOpacity = 0,
  saturation = 1.08,
  children,
  ...props
}: SettingsGlassCardProps) {
  return (
    <GlassCard
      borderRadius={borderRadius}
      className={`settings-glass-surface ${className}`.trim()}
      contentClassName={contentClassName}
      borderWidth={borderWidth}
      backgroundOpacity={backgroundOpacity}
      saturation={saturation}
      {...props}
    >
      {children}
    </GlassCard>
  )
}
