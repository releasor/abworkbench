import { useEffect, useState } from 'react'
import {
  WORKSPACE_MODE_EVENT,
  type WorkspaceModeChangeDetail,
} from '../../utils/workspaceModeEffects'

/** Brief cinematic veil when entering Deep Work mode. */
export default function DeepWorkTransition() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let timer = 0
    const onMode = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceModeChangeDetail>).detail
      if (!detail || detail.next !== 'deep' || detail.prev === 'deep') return
      window.clearTimeout(timer)
      setShow(true)
      timer = window.setTimeout(() => setShow(false), 920)
    }
    window.addEventListener(WORKSPACE_MODE_EVENT, onMode)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(WORKSPACE_MODE_EVENT, onMode)
    }
  }, [])

  if (!show) return null
  return <div className="deep-work-veil" aria-hidden />
}
