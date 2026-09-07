import { Children, useLayoutEffect, useRef, type ReactNode } from 'react'

interface SettingsTabCarouselProps {
  activeIndex: number
  children: ReactNode
}

/** Crossfade between settings tab panels (no horizontal transform â€?keeps glass border-radius stable). */
export default function SettingsTabCarousel({ activeIndex, children }: SettingsTabCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const panelRefs = useRef<(HTMLDivElement | null)[]>([])
  const panels = Children.toArray(children)

  useLayoutEffect(() => {
    const panel = panelRefs.current[activeIndex]
    const viewport = viewportRef.current
    if (!panel || !viewport) return

    const syncHeight = () => {
      const next = Math.ceil(panel.getBoundingClientRect().height)
      viewport.style.height = next > 0 ? `${next}px` : 'auto'
    }

    syncHeight()
    const ro = new ResizeObserver(syncHeight)
    ro.observe(panel)
    for (const node of panelRefs.current) {
      if (node && node !== panel) ro.observe(node)
    }
    return () => ro.disconnect()
  }, [activeIndex, panels.length])

  return (
    <div ref={viewportRef} className="settings-tab-viewport">
      <div className="settings-tab-track">
        {panels.map((panel, index) => {
          const isActive = index === activeIndex
          return (
            <div
              key={index}
              ref={(el) => {
                panelRefs.current[index] = el
              }}
              className={`settings-tab-panel${isActive ? ' settings-tab-panel--active' : ''}`}
              role="tabpanel"
              aria-hidden={!isActive}
              inert={isActive ? undefined : true}
            >
              {panel}
            </div>
          )
        })}
      </div>
    </div>
  )
}
