import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

type DragScrollState = {
  dragging: boolean
  startX: number
  scrollLeft: number
  pointerId: number
}

/** Hide scrollbar; pan horizontally by click-drag / touch-drag. */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>(): {
  ref: RefObject<T | null>
  onPointerDown: (event: ReactPointerEvent<T>) => void
  onPointerMove: (event: ReactPointerEvent<T>) => void
  onPointerUp: (event: ReactPointerEvent<T>) => void
  onPointerCancel: (event: ReactPointerEvent<T>) => void
} {
  const ref = useRef<T | null>(null)
  const state = useRef<DragScrollState>({
    dragging: false,
    startX: 0,
    scrollLeft: 0,
    pointerId: -1,
  })

  const endDrag = useCallback((event: ReactPointerEvent<T>) => {
    const el = ref.current
    if (!el || !state.current.dragging) return
    state.current = { ...state.current, dragging: false, pointerId: -1 }
    el.classList.remove('is-dragging')
    if (el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId)
    }
  }, [])

  const onPointerDown = useCallback((event: ReactPointerEvent<T>) => {
    const el = ref.current
    if (!el || event.button !== 0) return
    state.current = {
      dragging: true,
      startX: event.clientX,
      scrollLeft: el.scrollLeft,
      pointerId: event.pointerId,
    }
    el.setPointerCapture(event.pointerId)
    el.classList.add('is-dragging')
  }, [])

  const onPointerMove = useCallback((event: ReactPointerEvent<T>) => {
    const el = ref.current
    if (!el || !state.current.dragging) return
    const dx = event.clientX - state.current.startX
    el.scrollLeft = state.current.scrollLeft - dx
  }, [])

  return {
    ref,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  }
}
