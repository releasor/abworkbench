import { memo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import DatePanel from './DatePanel'
import TimePanel from './TimePanel'

export type DateTimePanelMode = 'clock' | 'date'

interface DateTimePanelModalProps {
  mode: DateTimePanelMode | null
  onClose: () => void
}

export default memo(function DateTimePanelModal({ mode, onClose }: DateTimePanelModalProps) {
  useEffect(() => {
    if (!mode) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, onClose])

  if (!mode) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'clock' ? '时钟面板' : '日期面板'}
    >
      <button
        type="button"
        className="absolute inset-0 modal-veil liquid-glass-veil"
        onClick={onClose}
        aria-label="关闭时间日期弹窗"
      />
      <div className="relative z-10 w-full max-w-5xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-2 -top-2 z-20 rounded-full border border-white/20 liquid-glass-chip p-2 text-text-muted shadow-lg transition hover:text-text"
          aria-label="关闭"
        >
          <X size={18} />
        </button>
        {mode === 'clock' ? <TimePanel /> : <DatePanel />}
      </div>
    </div>,
    document.body,
  )
})
