import {
  useRef,
  useCallback,
  useEffect,
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { readLightTheme } from './borderGlowTheme'
import './BorderGlow.css'

const FLOW_SMOOTHING = 0.2

export type BorderGlowProps = {
  children?: ReactNode
  className?: string
  innerClassName?: string
  edgeSensitivity?: number
  glowColor?: string
  backgroundColor?: string
  /** Opaque color for border-mesh padding mask; defaults to backgroundColor */
  glowMaskColor?: string
  borderRadius?: number
  glowRadius?: number
  glowIntensity?: number
  coneSpread?: number
  animated?: boolean
  colors?: string[]
  fillOpacity?: number
} & Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'>

function parseHSL(hslStr: string): { h: number; s: number; l: number } {
  const match = hslStr.match(/([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?/)
  if (!match) return { h: 40, s: 80, l: 80 }
  return { h: parseFloat(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) }
}

function buildGlowVars(glowColor: string, intensity: number): Record<string, string> {
  const { h, s, l } = parseHSL(glowColor)
  const base = `${h}deg ${s}% ${l}%`
  const opacities = [100, 60, 50, 40, 30, 20, 10]
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10']
  const vars: Record<string, string> = {}
  for (let i = 0; i < opacities.length; i++) {
    vars[`--glow-color${keys[i]}`] = `hsl(${base} / ${Math.min(opacities[i] * intensity, 100)}%)`
  }
  return vars
}

const GRADIENT_POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%']
const GRADIENT_KEYS = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven']
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1]

function buildGradientVars(colors: string[]): Record<string, string> {
  const vars: Record<string, string> = {}
  for (let i = 0; i < 7; i++) {
    const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)]
    vars[GRADIENT_KEYS[i]] = `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`
  }
  vars['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`
  return vars
}

function isLightColor(color: string): boolean {
  const value = color.trim().replace('#', '')
  if (!/^[\da-f]{3}([\da-f]{3})?$/i.test(value)) return false
  const hex = value.length === 3 ? value.split('').map((char) => char + char).join('') : value
  const red = parseInt(hex.slice(0, 2), 16)
  const green = parseInt(hex.slice(2, 4), 16)
  const blue = parseInt(hex.slice(4, 6), 16)
  return red * 0.2126 + green * 0.7152 + blue * 0.0722 > 180
}

function easeOutCubic(x: number) { return 1 - Math.pow(1 - x, 3) }
function easeInCubic(x: number) { return x * x * x }

function lerpAngle(current: number, target: number, t: number): number {
  const delta = ((target - current + 540) % 360) - 180
  return current + delta * t
}

interface AnimateOpts {
  start?: number
  end?: number
  duration?: number
  delay?: number
  ease?: (t: number) => number
  onUpdate: (v: number) => void
  onEnd?: () => void
}

function animateValue({ start = 0, end = 100, duration = 1000, delay = 0, ease = easeOutCubic, onUpdate, onEnd }: AnimateOpts) {
  const t0 = performance.now() + delay
  function tick() {
    const elapsed = performance.now() - t0
    const t = Math.min(elapsed / duration, 1)
    onUpdate(start + (end - start) * ease(t))
    if (t < 1) requestAnimationFrame(tick)
    else if (onEnd) onEnd()
  }
  setTimeout(() => requestAnimationFrame(tick), delay)
}

export default function BorderGlow({
  children,
  className = '',
  innerClassName = '',
  style,
  edgeSensitivity = 30,
  glowColor = '40 80 80',
  backgroundColor = '#120F17',
  glowMaskColor,
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1.0,
  coneSpread = 25,
  animated = false,
  colors = ['#c084fc', '#f472b6', '#38bdf8'],
  fillOpacity = 0.5,
  ...htmlProps
}: BorderGlowProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const flowRafRef = useRef<number | null>(null)
  const flowStateRef = useRef({ edge: 0, edgeTarget: 0, angle: 45, angleTarget: 45 })

  const applyFlowVars = useCallback((edge: number, angle: number) => {
    const card = cardRef.current
    if (!card) return
    card.style.setProperty('--edge-proximity', edge.toFixed(3))
    card.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`)
  }, [])

  const stopFlowLoop = useCallback(() => {
    if (flowRafRef.current != null) {
      cancelAnimationFrame(flowRafRef.current)
      flowRafRef.current = null
    }
  }, [])

  const startFlowLoop = useCallback(() => {
    if (flowRafRef.current != null) return

    const step = () => {
      const state = flowStateRef.current
      const nextEdge = state.edge + (state.edgeTarget - state.edge) * FLOW_SMOOTHING
      const nextAngle = lerpAngle(state.angle, state.angleTarget, FLOW_SMOOTHING)
      state.edge = nextEdge
      state.angle = nextAngle
      applyFlowVars(nextEdge, nextAngle)

      const edgeDone = Math.abs(state.edgeTarget - state.edge) < 0.25
      const angleDone = Math.abs(((state.angleTarget - state.angle + 540) % 360) - 180) < 0.35
      if (edgeDone && angleDone) {
        state.edge = state.edgeTarget
        state.angle = state.angleTarget
        applyFlowVars(state.edge, state.angle)
        flowRafRef.current = null
        return
      }

      flowRafRef.current = requestAnimationFrame(step)
    }

    flowRafRef.current = requestAnimationFrame(step)
  }, [applyFlowVars])

  const getCenterOfElement = useCallback((el: HTMLElement) => {
    const { width, height } = el.getBoundingClientRect()
    return [width / 2, height / 2]
  }, [])

  const getEdgeProximity = useCallback((el: HTMLElement, x: number, y: number) => {
    const [cx, cy] = getCenterOfElement(el)
    const dx = x - cx
    const dy = y - cy
    let kx = Infinity
    let ky = Infinity
    if (dx !== 0) kx = cx / Math.abs(dx)
    if (dy !== 0) ky = cy / Math.abs(dy)
    return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1)
  }, [getCenterOfElement])

  const getCursorAngle = useCallback((el: HTMLElement, x: number, y: number) => {
    const [cx, cy] = getCenterOfElement(el)
    const dx = x - cx
    const dy = y - cy
    if (dx === 0 && dy === 0) return 0
    const radians = Math.atan2(dy, dx)
    let degrees = radians * (180 / Math.PI) + 90
    if (degrees < 0) degrees += 360
    return degrees
  }, [getCenterOfElement])

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (!card) return

    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const edge = getEdgeProximity(card, x, y)
    const angle = getCursorAngle(card, x, y)

    flowStateRef.current.edgeTarget = edge * 100
    flowStateRef.current.angleTarget = angle
    startFlowLoop()
  }, [getEdgeProximity, getCursorAngle, startFlowLoop])

  const handlePointerLeave = useCallback(() => {
    flowStateRef.current.edgeTarget = 0
    startFlowLoop()
  }, [startFlowLoop])

  useEffect(() => () => stopFlowLoop(), [stopFlowLoop])

  useEffect(() => {
    if (!animated || !cardRef.current) return
    const card = cardRef.current
    const angleStart = 110
    const angleEnd = 465
    card.classList.add('sweep-active')
    flowStateRef.current.angle = angleStart
    flowStateRef.current.angleTarget = angleStart
    applyFlowVars(0, angleStart)

    animateValue({ duration: 500, onUpdate: (v) => {
      flowStateRef.current.edge = v
      flowStateRef.current.edgeTarget = v
      applyFlowVars(v, flowStateRef.current.angle)
    } })
    animateValue({
      ease: easeInCubic,
      duration: 1500,
      end: 50,
      onUpdate: (v) => {
        const angle = (angleEnd - angleStart) * (v / 100) + angleStart
        flowStateRef.current.angle = angle
        flowStateRef.current.angleTarget = angle
        applyFlowVars(flowStateRef.current.edge, angle)
      },
    })
    animateValue({
      ease: easeOutCubic,
      delay: 1500,
      duration: 2250,
      start: 50,
      end: 100,
      onUpdate: (v) => {
        const angle = (angleEnd - angleStart) * (v / 100) + angleStart
        flowStateRef.current.angle = angle
        flowStateRef.current.angleTarget = angle
        applyFlowVars(flowStateRef.current.edge, angle)
      },
    })
    animateValue({
      ease: easeInCubic,
      delay: 2500,
      duration: 1500,
      start: 100,
      end: 0,
      onUpdate: (v) => {
        flowStateRef.current.edge = v
        flowStateRef.current.edgeTarget = v
        applyFlowVars(v, flowStateRef.current.angle)
      },
      onEnd: () => card.classList.remove('sweep-active'),
    })
  }, [animated, applyFlowVars])

  const glowVars = buildGlowVars(glowColor, glowIntensity)
  const lightSurface = isLightColor(backgroundColor) || readLightTheme()
  const maskColor = glowMaskColor ?? backgroundColor

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`border-glow-card${lightSurface ? ' border-glow-card--light' : ''} ${className}`.trim()}
      style={{
        '--card-bg': maskColor,
        '--edge-sensitivity': edgeSensitivity,
        '--border-radius': `${borderRadius}px`,
        '--glow-padding': `${glowRadius}px`,
        '--cone-spread': coneSpread,
        '--fill-opacity': fillOpacity,
        ...glowVars,
        ...buildGradientVars(colors),
        ...style,
      } as CSSProperties}
      {...htmlProps}
    >
      <span className="edge-light" aria-hidden />
      <div className={`border-glow-inner ${innerClassName}`.trim()}>
        {children}
      </div>
    </div>
  )
}
