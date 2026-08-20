import { useMemo, type CSSProperties } from 'react'
import { useStore } from '../../store'

const PARTICLE_COUNT = 22

interface ParticleStyle extends CSSProperties {
  ['--dx']?: string
  ['--dy']?: string
}

/** Fixed noise + light drifting particles (Mineradio-inspired, optional). */
export default function AmbientEffects() {
  const visualNoise = useStore((s) => s.visualNoise)
  const visualParticles = useStore((s) => s.visualParticles)

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const left = 6 + ((i * 17) % 88)
        const top = 10 + ((i * 29) % 75)
        const duration = 9 + (i % 7) * 1.4
        const delay = (i * 0.55) % 6
        const dx = (i % 2 === 0 ? 1 : -1) * (18 + (i % 5) * 8)
        const dy = -40 - (i % 6) * 14
        return { id: i, left, top, duration, delay, dx, dy }
      }),
    [],
  )

  if (!visualNoise && !visualParticles) return null

  return (
    <>
      {visualNoise && <div className="ambient-noise" aria-hidden />}
      {visualParticles && (
        <div className="ambient-particles" aria-hidden>
          {particles.map((p) => {
            const style: ParticleStyle = {
              left: `${p.left}%`,
              top: `${p.top}%`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
            }
            return <span key={p.id} className="ambient-particle" style={style} />
          })}
        </div>
      )}
    </>
  )
}
