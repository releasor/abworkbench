import { useEffect } from 'react'
import { matchesAccelerator } from './parse'
import { useShortcutStore } from './store'

type ShortcutHandler = (event: KeyboardEvent) => void

interface UseAppShortcutOptions {
  /** When false, the binding is inactive. Default true. */
  enabled?: boolean
  /** Allow firing while focused in inputs (default false; Escape-like keys often need true). */
  allowInInputs?: boolean
}

/**
 * Bind a catalog shortcut id to a handler. Reads live accelerator from the shortcut store.
 */
export function useAppShortcut(
  id: string,
  handler: ShortcutHandler,
  options: UseAppShortcutOptions = {},
) {
  const accelerator = useShortcutStore((s) => s.getAccelerator(id))
  const { enabled = true, allowInInputs = false } = options

  useEffect(() => {
    if (!enabled || !accelerator) return

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || Boolean(target?.isContentEditable)
      if (inField && !allowInInputs) return

      if (!matchesAccelerator(event, accelerator)) return
      event.preventDefault()
      handler(event)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [accelerator, allowInInputs, enabled, handler])
}

/** Match an event against the current accelerator for a shortcut id (non-hook). */
export function eventMatchesShortcut(id: string, event: KeyboardEvent): boolean {
  const accelerator = useShortcutStore.getState().getAccelerator(id)
  return Boolean(accelerator) && matchesAccelerator(event, accelerator)
}
