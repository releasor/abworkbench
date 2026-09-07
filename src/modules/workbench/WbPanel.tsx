import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import clsx from 'clsx'
import GlassCard, { type GlassCardProps } from '../../components/common/GlassSurface/GlassCard'

type WbPanelProps<T extends ElementType = 'section'> = {
  as?: T
  hero?: boolean
  borderRadius?: number
  className?: string
  contentClassName?: string
  children?: ReactNode
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>

export default function WbPanel<T extends ElementType = 'section'>({
  as,
  className,
  contentClassName = '',
  children,
  hero = false,
  borderRadius,
  ...props
}: WbPanelProps<T>) {
  const radius = borderRadius ?? (hero ? 28 : 22)

  // GlassCard's default `as: 'div'` generic rejects polymorphic tags; cast like SettingsGlassCard.
  const cardProps = {
    as: as ?? 'section',
    borderRadius: radius,
    className: clsx(
      'dashboard-panel wb-panel',
      hero && 'wb-panel--hero',
      className,
    ),
    contentClassName,
    children,
    ...props,
  } as GlassCardProps

  return <GlassCard {...cardProps} />
}
