import { useEffect } from 'react'

type KeyHandler = (event: KeyboardEvent) => void

interface KeyBinding {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  handler: KeyHandler
}

export function useKeyboard(bindings: KeyBinding[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow Escape in inputs
        if (event.key !== 'Escape') return
      }

      for (const binding of bindings) {
        const ctrlMatch = binding.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
        const shiftMatch = binding.shift ? event.shiftKey : !event.shiftKey
        const altMatch = binding.alt ? event.altKey : !event.altKey

        if (event.key.toLowerCase() === binding.key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault()
          binding.handler(event)
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bindings])
}
