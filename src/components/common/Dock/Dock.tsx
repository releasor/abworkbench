import {
  motion,
  MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
  type SpringOptions,
  AnimatePresence,
} from 'motion/react'
import React, { Children, cloneElement, useEffect, useMemo, useRef, useState } from 'react'

import './Dock.css'
import {
  dockLabelAnimateY,
  dockLabelClassName,
  type DockLabelPlacement,
} from './dockLabelPlacement'

export type { DockLabelPlacement }
export type DockItemData = {
  icon: React.ReactNode
  label: React.ReactNode
  onClick: () => void
  className?: string
}

export type DockProps = {
  items: DockItemData[]
  className?: string
  distance?: number
  panelHeight?: number
  baseItemSize?: number
  dockHeight?: number
  magnification?: number
  spring?: SpringOptions
  /** When false, outer height stays at panelHeight (for header embedding). */
  growOnHover?: boolean
  panelAriaLabel?: string
  /** Hover label side. Use `below` in top chrome so labels are not clipped. */
  labelPlacement?: DockLabelPlacement
}

type DockItemProps = {
  className?: string
  children: React.ReactNode
  onClick?: () => void
  mouseX: MotionValue<number>
  spring: SpringOptions
  distance: number
  baseItemSize: number
  magnification: number
  label?: React.ReactNode
  labelPlacement: DockLabelPlacement
}

function DockItem({
  children,
  className = '',
  onClick,
  mouseX,
  spring,
  distance,
  magnification,
  baseItemSize,
  label,
  labelPlacement,
}: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const centerXRef = useRef(0)
  const isHovered = useMotionValue(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      centerXRef.current = rect.x + rect.width / 2
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [baseItemSize, magnification])

  const mouseDistance = useTransform(mouseX, (val) => {
    return val - (centerXRef.current || 0)
  })

  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, magnification, baseItemSize],
  )
  const size = useSpring(targetSize, spring)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }

  return (
    <motion.div
      ref={ref}
      style={{
        width: size,
        height: size,
      }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`dock-item ${className}`}
      tabIndex={0}
      role="button"
      aria-label={typeof label === 'string' ? label : undefined}
    >
      {Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child
        return cloneElement(
          child as React.ReactElement<{
            isHovered?: MotionValue<number>
            labelPlacement?: DockLabelPlacement
          }>,
          { isHovered, labelPlacement },
        )
      })}
    </motion.div>
  )
}

type DockLabelProps = {
  className?: string
  children: React.ReactNode
  isHovered?: MotionValue<number>
  labelPlacement?: DockLabelPlacement
}

function DockLabel({
  children,
  className = '',
  isHovered,
  labelPlacement = 'above',
}: DockLabelProps) {
  const [isVisible, setIsVisible] = useState(false)
  const animateY = dockLabelAnimateY(labelPlacement)

  useEffect(() => {
    if (!isHovered) return
    const unsubscribe = isHovered.on('change', (latest) => {
      setIsVisible(latest === 1)
    })
    return () => unsubscribe()
  }, [isHovered])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: animateY }}
          exit={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.2 }}
          className={dockLabelClassName(labelPlacement, className)}
          role="tooltip"
          style={{ x: '-50%' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type DockIconProps = {
  className?: string
  children: React.ReactNode
  isHovered?: MotionValue<number>
  labelPlacement?: DockLabelPlacement
}

function DockIcon({ children, className = '' }: DockIconProps) {
  return <div className={`dock-icon ${className}`}>{children}</div>
}

export default function Dock({
  items,
  className = '',
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = 70,
  distance = 200,
  panelHeight = 68,
  dockHeight = 256,
  baseItemSize = 50,
  growOnHover = true,
  panelAriaLabel = 'Application dock',
  labelPlacement = 'above',
}: DockProps) {
  const mouseX = useMotionValue(Infinity)
  const isHovered = useMotionValue(0)

  const maxHeight = useMemo(
    () => Math.max(dockHeight, magnification + magnification / 2 + 4),
    [magnification, dockHeight],
  )
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight])
  const height = useSpring(heightRow, spring)

  return (
    <motion.div
      style={{ height: growOnHover ? height : panelHeight, scrollbarWidth: 'none' }}
      className="dock-outer"
    >
      <motion.div
        onMouseMove={({ pageX }) => {
          isHovered.set(1)
          mouseX.set(pageX)
        }}
        onMouseLeave={() => {
          isHovered.set(0)
          mouseX.set(Infinity)
        }}
        className={`dock-panel ${className}`}
        style={{ height: panelHeight }}
        role="toolbar"
        aria-label={panelAriaLabel}
      >
        {items.map((item, index) => (
          <DockItem
            key={index}
            onClick={item.onClick}
            className={item.className}
            mouseX={mouseX}
            spring={spring}
            distance={distance}
            magnification={magnification}
            baseItemSize={baseItemSize}
            label={item.label}
            labelPlacement={labelPlacement}
          >
            <DockIcon>{item.icon}</DockIcon>
            <DockLabel>{item.label}</DockLabel>
          </DockItem>
        ))}
      </motion.div>
    </motion.div>
  )
}
