import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { formatHourLabel } from './habitSchedule'

interface HourSelectProps {
  value: number
  onChange: (hour: number) => void
  label: string
}

export function HourSelect({ value, onChange, label }: HourSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    selectedRef.current?.scrollIntoView({ block: 'center' })
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative block">
      <span className="mb-2 block text-xs font-medium text-text-muted">{label}</span>
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((prev) => !prev)}
          className="input-field flex h-11 w-full items-center justify-between rounded-2xl px-3 text-left text-sm"
        >
          <span className="text-text">{formatHourLabel(value)}</span>
          <ChevronDown size={16} className={clsx('text-text-muted transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute bottom-full left-0 right-0 z-[80] mb-1 max-h-52 overflow-y-auto rounded-2xl border border-border bg-surface-lighter py-1 shadow-2xl shadow-black/50"
          >
          {Array.from({ length: 24 }, (_, hour) => (
            <li key={hour} role="presentation">
              <button
                ref={hour === value ? selectedRef : undefined}
                type="button"
                role="option"
                aria-selected={hour === value}
                onClick={() => {
                  onChange(hour)
                  setOpen(false)
                }}
                className={clsx(
                  'flex w-full items-center px-3 py-2 text-left text-sm transition-colors',
                  hour === value
                    ? 'bg-primary/20 font-semibold text-primary'
                    : 'text-text hover:bg-surface-light',
                )}
              >
                {formatHourLabel(hour)}
              </button>
            </li>
          ))}
          </ul>
        )}
      </div>
    </div>
  )
}
