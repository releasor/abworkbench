import { memo, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
        className="absolute inset-0 modal-veil"
        onClick={onClose}
        aria-label="关闭时间日期弹窗"
      />
      <div
        className={`datetime-modal-panel relative z-10 w-full ${mode === 'clock' ? 'max-w-2xl' : 'max-w-5xl'}`}
        onClick={(event) => event.stopPropagation()}
      >
        {mode === 'clock' ? <TimePanel /> : <DatePanel />}
      </div>
    </div>,
    document.body,
  )
})
