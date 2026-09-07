import type { ComponentProps, ComponentPropsWithoutRef, CSSProperties, ElementType } from 'react'
import BorderGlow from '../BorderGlow/BorderGlow'
import { useBorderGlowSurfaceColor, useBorderGlowTheme } from '../BorderGlow/borderGlowTheme'
import GlassSurface, { type GlassSurfaceProps } from './GlassSurface'

/** React Bits reference defaults — chromatic edge refraction via difference blend */
export const GLASS_CARD_DEFAULTS = {
  backgroundOpacity: 0,
  saturation: 1.08,
} satisfies Partial<GlassSurfaceProps>

type GlassCardOwnProps = {
  borderRadius?: number
  borderGlow?: boolean
}

export type GlassCardProps<T extends ElementType = 'div'> = GlassCardOwnProps &
  Omit<GlassSurfaceProps, 'variant'> &
  Omit<ComponentPropsWithoutRef<T>, keyof GlassSurfaceProps | 'as' | keyof GlassCardOwnProps> & {
    as?: T
  }

/** Same glass shell as dashboard hero (`border-glow-card--glass`). */
export default function GlassCard<T extends ElementType = 'div'>({
  as,
  className = '',
  borderRadius = 34,
  borderGlow = true,
  children,
  contentClassName = '',
  width,
  height,
  style,
  ...props
}: GlassCardProps<T>) {
  const glowTheme = useBorderGlowTheme()
  const surface = useBorderGlowSurfaceColor()
  const Component = (as ?? 'div') as ElementType
  const interactiveProps = props as { onClick?: unknown; role?: string }
  const isInteractive =
    typeof interactiveProps.onClick === 'function' || interactiveProps.role === 'button'

  if (!borderGlow) {
    const surfaceProps = {
      as,
      variant: 'card' as const,
      borderRadius,
      className: `glass-card ${isInteractive ? 'interactive-glass-card' : ''} ${className}`.trim(),
      contentClassName,
      children,
      style,
      ...GLASS_CARD_DEFAULTS,
      ...props,
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
    }
    return <GlassSurface {...(surfaceProps as ComponentProps<typeof GlassSurface>)} />
  }

  const outerStyle: CSSProperties = {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...style,
  }

  return (
    <BorderGlow
      {...glowTheme}
      backgroundColor={surface}
      glowMaskColor={surface}
      borderRadius={borderRadius}
      className={`glass-card-glow border-glow-card--glass w-full min-w-0${isInteractive ? ' interactive-glass-card' : ''}`}
      innerClassName="glass-card-shell"
      style={outerStyle}
    >
      <Component
        className={`h-full w-full min-w-0 ${className} ${contentClassName}`.trim()}
        {...props}
      >
        {children}
      </Component>
    </BorderGlow>
  )
}
