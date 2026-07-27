import { useEffect, useState } from 'react'
import { acceleratorFromEvent, acceleratorToKeys } from '../../shortcuts'

interface ShortcutRecorderProps {
  value: string
  recording: boolean
  onStartRecording: () => void
  onChange: (accelerator: string) => void
  onCancel: () => void
  conflictLabel?: string
}

export default function ShortcutRecorder({
  value,
  recording,
  onStartRecording,
  onChange,
  onCancel,
  conflictLabel,
}: ShortcutRecorderProps) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!recording) setDraft(value)
  }, [recording, value])

  useEffect(() => {
    if (!recording) return

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        onCancel()
        return
      }
      const next = acceleratorFromEvent(event)
      if (!next) return
      setDraft(next)
      onChange(next)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onCancel, onChange, recording])

  const keys = acceleratorToKeys(recording ? draft : value)

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onStartRecording}
        className={`flex min-w-[7.5rem] items-center justify-center gap-1 rounded-xl border px-2 py-1.5 transition-colors ${
          recording
            ? 'border-primary bg-primary/15 text-primary ring-2 ring-primary/30'
            : 'border-border bg-surface-lighter text-text hover:border-primary/40'
        }`}
        title={recording ? '按下新快捷键，Esc 取消' : '点击后按下新快捷键'}
      >
        {recording ? (
          <span className="text-xs font-medium">按下快捷键…</span>
        ) : (
          keys.map((key) => (
            <kbd
              key={key}
              className="min-w-[28px] rounded-lg border border-border bg-background px-2 py-0.5 text-center font-mono text-xs text-text"
            >
              {key}
            </kbd>
          ))
        )}
      </button>
      {conflictLabel && (
        <span className="max-w-[220px] text-right text-[11px] text-warning">与「{conflictLabel}」冲突</span>
      )}
    </div>
  )
}
