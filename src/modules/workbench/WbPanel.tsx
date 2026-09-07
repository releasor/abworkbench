import type { ComponentPropsWithoutRef, ElementType } from 'react'
import clsx from 'clsx'
import BorderGlow from '../../components/common/BorderGlow/BorderGlow'
import { useBorderGlowSurfaceColor, useBorderGlowTheme } from '../../components/common/BorderGlow/borderGlowTheme'

type WbPanelProps<T extends ElementType = 'section'> = {
  as?: T
  hero?: boolean
  borderRadius?: number
} & ComponentPropsWithoutRef<T>

export default function WbPanel<T extends ElementType = 'section'>({
  as,
  className,
  children,
  hero = false,
  borderRadius,
  ...props
}: WbPanelProps<T>) {
  const Component = (as ?? 'section') as ElementType
  const glow = useBorderGlowTheme()
  const surface = useBorderGlowSurfaceColor()
  const radius = borderRadius ?? (hero ? 22 : 16)

  return (
    <BorderGlow
      {...glow}
      borderRadius={radius}
      backgroundColor={surface}
      className={clsx('wb-panel-glow h-full min-h-0 w-full min-w-0', hero && 'wb-panel-glow--hero')}
      innerClassName="h-full min-h-0"
    >
      <Component
        className={clsx('wb-panel', hero && 'wb-panel--hero', className)}
        {...props}
      >
        {children}
      </Component>
    </BorderGlow>
  )
}
