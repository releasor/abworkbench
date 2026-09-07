import type { ComponentProps } from 'react'
import BorderGlow from './BorderGlow'
import { useBorderGlowSurfaceColor, useBorderGlowTheme } from './borderGlowTheme'

type CardProps = ComponentProps<'div'> & {
  borderRadius?: number
  borderGlow?: boolean
}

/** TaskFlow-style card with edge glow — BorderGlow is the card shell. */
export default function Card({
  className = '',
  children,
  borderRadius = 12,
  borderGlow = true,
  style,
  ...props
}: CardProps) {
  const glow = useBorderGlowTheme()
  const surface = useBorderGlowSurfaceColor()

  if (!borderGlow) {
    return (
      <div className={`card ${className}`.trim()} style={style} {...props}>
        {children}
      </div>
    )
  }

  return (
    <BorderGlow
      {...glow}
      borderRadius={borderRadius}
      backgroundColor={surface}
      className="w-full min-w-0"
      innerClassName={className}
      style={style}
      {...props}
    >
      {children}
    </BorderGlow>
  )
}
