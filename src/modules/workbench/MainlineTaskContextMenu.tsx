import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TaskStatus, WorkbenchTask } from './types'

const STATUS_OPTIONS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: '待办' },
  { status: 'doing', label: '进行中' },
  { status: 'done', label: '已完成' },
]

interface MainlineTaskContextMenuProps {
  task: WorkbenchTask
  x: number
  y: number
  canDelete: boolean
  deleteLabel?: string
  onClose: () => void
  onOpen: () => void
  onStatusChange: (status: TaskStatus) => void
  onDelete: () => void
}

export default function MainlineTaskContextMenu({
  task,
  x,
  y,
  canDelete,
  deleteLabel = '删除',
  onClose,
  onOpen,
  onStatusChange,
  onDelete,
}: MainlineTaskContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const padding = 8
    let nx = x
    let ny = y
    if (x + rect.width > window.innerWidth - padding) nx = window.innerWidth - rect.width - padding
    if (y + rect.height > window.innerHeight - padding) ny = window.innerHeight - rect.height - padding
    if (nx < padding) nx = padding
    if (ny < padding) ny = padding
    setPos({ x: nx, y: ny })
  }, [x, y])

  useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      if (ref.current?.contains(event.target as Node)) return
      onCloseRef.current()
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', handlePointer)
      document.addEventListener('keydown', handleKey)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  return createPortal(
    <div
      ref={ref}
      className="wb-context-menu interactive-glass fixed z-[200] min-w-[10rem] rounded-xl border border-white/10 py-1 shadow-xl"
      style={{ left: pos.x, top: pos.y }}
      role="menu"
      aria-label="主线任务菜单"
    >
      <MenuButton label="打开任务" onClick={() => { onOpen(); onClose() }} />
      <MenuDivider />
      {STATUS_OPTIONS.map((opt) => (
        <MenuButton
          key={opt.status}
          label={opt.label}
          active={task.status === opt.status}
          onClick={() => {
            if (task.status !== opt.status) onStatusChange(opt.status)
            onClose()
          }}
        />
      ))}
      {canDelete ? (
        <>
          <MenuDivider />
          <MenuButton
            label={deleteLabel}
            danger
            onClick={() => {
              onDelete()
              onClose()
            }}
          />
        </>
      ) : null}
    </div>,
    document.body,
  )
}

function MenuButton({
  label,
  active = false,
  danger = false,
  onClick,
}: {
  label: string
  active?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`wb-context-menu-item flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
        danger
          ? 'text-red-300 hover:bg-red-500/10'
          : active
            ? 'text-primary'
            : 'text-text hover:bg-white/5'
      }`}
    >
      {active ? <span className="text-[10px]">✓</span> : <span className="w-2.5" />}
      <span>{label}</span>
    </button>
  )
}

function MenuDivider() {
  return <div className="my-1 border-t border-white/10" role="separator" />
}
