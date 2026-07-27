import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DesktopOnlyFallback } from './DesktopOnlyFallback.tsx'
import { installChunkRecovery } from './utils/chunkRecovery.ts'

const root = createRoot(document.getElementById('root')!)
const isDesktopRuntime = Boolean(window.electronAPI)

installChunkRecovery()

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  // Prevent the default browser behavior (console error)
  event.preventDefault()
  // Log to console in development
  if (import.meta.env.DEV) {
    console.error('Unhandled promise rejection:', event.reason)
  }
})

root.render(
  <StrictMode>
    {isDesktopRuntime ? <App /> : <DesktopOnlyFallback />}
  </StrictMode>,
)
