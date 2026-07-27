export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(message)
}

export function installChunkRecovery() {
  if (typeof window === 'undefined') return
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    window.location.reload()
  })
  window.addEventListener('error', (event) => {
    if (isStaleChunkError(event.error || event.message)) window.location.reload()
  })
  window.addEventListener('unhandledrejection', (event) => {
    if (isStaleChunkError(event.reason)) window.location.reload()
  })
}
