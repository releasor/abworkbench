import type { ElementType, ReactNode } from 'react'
import GlassCard, { type GlassCardProps } from '../common/GlassSurface/GlassCard'

/** Match ShortcutDock / React Bits GlassSurface refraction defaults */
export const SETTINGS_GLASS_SURFACE = {
  borderWidth: 0.08,
  backgroundOpacity: 0,
  saturation: 1.08,
} as const

type SettingsGlassCardProps<T extends ElementType = 'div'> = GlassCardProps<T> & {
  children?: ReactNode
}

export default function SettingsGlassCard<T extends ElementType = 'div'>({
  borderRadius = 22,
  className = '',
  contentClassName = '',
  children,
  ...props
}: SettingsGlassCardProps<T>) {
  return (
    <GlassCard
      borderRadius={borderRadius}
      className={`settings-glass-surface ${className}`.trim()}
      contentClassName={contentClassName}
      {...SETTINGS_GLASS_SURFACE}
      {...props}
    >
      {children}
    </GlassCard>
  )
}
