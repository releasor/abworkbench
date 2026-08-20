import { memo } from 'react'

/** SVG backdrop filter borrowed from Mineradio control glass. */
function GlassFilterSvg() {
  return (
    <svg width="0" height="0" aria-hidden className="pointer-events-none absolute">
      <defs>
        <filter id="abwb-control-glass-filter" colorInterpolationFilters="sRGB" x="-12%" y="-28%" width="124%" height="156%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.75" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="0.5" result="softNoise" />
          <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="8" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="0.35" result="refracted" />
          <feSpecularLighting in="softNoise" surfaceScale="1.4" specularConstant="0.55" specularExponent="18" lightingColor="#ffffff" result="spec">
            <fePointLight x="40" y="-30" z="120" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specMask" />
          <feComposite in="refracted" in2="specMask" operator="arithmetic" k1="0" k2="1" k3="0.22" k4="0" />
        </filter>
      </defs>
    </svg>
  )
}

export default memo(GlassFilterSvg)
