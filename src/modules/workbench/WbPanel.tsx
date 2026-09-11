import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import clsx from 'clsx'

type WbPanelProps<T extends ElementType = 'section'> = {
  as?: T
  hero?: boolean
  borderRadius?: number
  className?: string
  contentClassName?: string
  children?: ReactNode
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>

/** Light glass panel shell — styling from staggered-theme `.wb-panel` / `.dashboard-panel` (no BorderGlow hooks). */
export default function WbPanel<T extends ElementType = 'section'>({
  as,
  className,
  contentClassName = '',
  children,
  hero = false,
  borderRadius,
  ...props
}: WbPanelProps<T>) {
  const Component = (as ?? 'section') as ElementType
  const radius = borderRadius ?? (hero ? 28 : 22)

  return (
    <Component
      className={clsx(
        'dashboard-panel wb-panel min-w-0',
        hero && 'wb-panel--hero',
        className,
        contentClassName,
      )}
      style={{ borderRadius: `${radius}px` }}
      {...props}
    >
      {children}
    </Component>
  )
}
