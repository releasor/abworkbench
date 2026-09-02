import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock, Copy, Download, FileText, Palette, Pin, ClipboardCopy, Trash2 } from 'lucide-react'
import clsx from 'clsx'

type NoteListItemNote = {
  id: string
  title: string
  content: string
  color: string
  pinned?: boolean
  relativeTime?: string
  tags?: string[]
}

type Highlighted = { title: ReactNode[]; content: ReactNode[] } | undefined

const NOTE_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4']

interface NoteListItemProps {
  note: NoteListItemNote
  isActive: boolean
  highlighted?: Highlighted
  onSelect: () => void
  onPin: () => void
  onDuplicate: () => void
  onCopy: () => void
  onExport: () => void
  onDelete: () => void
  onColorChange: (color: string) => void
}

export function NoteListItem({
  note,
  isActive,
  highlighted,
  onSelect,
  onPin,
  onDuplicate,
  onCopy,
  onExport,
  onDelete,
  onColorChange,
}: NoteListItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [colorMenuOpen, setColorMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeMenuRef = useRef<() => void>(() => {})

  const openMenu = useCallback((x: number, y: number) => {
    const padding = 12
    const menuWidth = 176
    const menuHeight = 240
    setMenuPos({
      x: Math.max(padding, Math.min(x, window.innerWidth - menuWidth - padding)),
      y: Math.max(padding, Math.min(y, window.innerHeight - menuHeight - padding)),
    })
    setColorMenuOpen(false)
    setMenuOpen(true)
  }, [])

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    setColorMenuOpen(false)
  }, [])

  closeMenuRef.current = closeMenu

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenuRef.current()
    }
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      closeMenuRef.current()
    }
    const timer = window.setTimeout(() => {
      document.addEventListener('keydown', onKeyDown)
      document.addEventListener('mousedown', onPointerDown)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const padding = 12
    setMenuPos((prev) => {
      let x = prev.x
      let y = prev.y
      if (x + rect.width > window.innerWidth - padding) x = window.innerWidth - rect.width - padding
      if (y + rect.height > window.innerHeight - padding) y = window.innerHeight - rect.height - padding
      if (x < padding) x = padding
      if (y < padding) y = padding
      return x === prev.x && y === prev.y ? prev : { x, y }
    })
  }, [menuOpen, colorMenuOpen])

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    openMenu(event.clientX, event.clientY)
  }

  return (
    <>
      <article
        onClick={onSelect}
        onContextMenu={handleContextMenu}
        aria-current={isActive ? 'true' : undefined}
        className={clsx(
          'note-list-item cursor-pointer rounded-lg px-2 py-1.5',
          isActive && 'note-list-item--active',
          menuOpen && 'note-list-item--menu-open',
        )}
        style={{ '--note-accent': note.color } as CSSProperties}
      >
        <div className="note-list-item__body flex items-center gap-1.5">
          <div
            className={clsx(
              'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-white',
              isActive && 'shadow-[0_4px_12px_color-mix(in_srgb,var(--note-accent)_35%,transparent),inset_0_1px_0_rgba(255,255,255,0.35)]',
            )}
            style={{ backgroundColor: note.color }}
          >
            <FileText size={10} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h3
                className={clsx(
                  'min-w-0 flex-1 truncate text-[11px] font-semibold text-text',
                  isActive && 'font-bold',
                )}
              >
                {highlighted?.title ?? note.title}
              </h3>
              {note.pinned && <Pin size={10} className="flex-shrink-0 fill-warning text-warning" />}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-text-muted">
              <span className="inline-flex min-w-0 flex-1 items-center gap-0.5 truncate">
                <Clock size={9} className="shrink-0" />
                <span className="truncate">{note.relativeTime}</span>
              </span>
              {!isActive && (
                <span className="max-w-[42%] truncate text-[9px] opacity-80">
                  {note.content ? note.content.replace(/\s+/g, ' ').slice(0, 18) : '空白'}
                </span>
              )}
              {isActive && (
                <span
                  className="note-list-item__badge shrink-0 rounded-full px-1.5 py-px text-[9px] font-medium"
                  style={{ color: note.color }}
                >
                  编辑中
                </span>
              )}
            </div>
          </div>
        </div>
      </article>

      {menuOpen && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="笔记操作菜单"
          className="fixed z-[80] min-w-[168px] overflow-hidden rounded-xl border border-border bg-surface-lighter py-1 shadow-2xl shadow-black/50"
          style={{ left: menuPos.x, top: menuPos.y }}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
            <MenuAction icon={<Pin size={14} />} label={note.pinned ? '取消置顶' : '置顶'} onClick={() => { onPin(); closeMenu() }} />
            <MenuAction
              icon={<Palette size={14} />}
              label="更换颜色"
              onClick={() => setColorMenuOpen((prev) => !prev)}
              active={colorMenuOpen}
            />
            {colorMenuOpen && (
              <div className="border-t border-border/60 px-2 py-2">
                <div className="grid grid-cols-8 gap-1.5">
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={color}
                      aria-label={`选择颜色 ${color}`}
                      onClick={() => {
                        onColorChange(color)
                        closeMenu()
                      }}
                      className={clsx(
                        'h-5 w-5 rounded-md border transition-transform hover:scale-110',
                        note.color === color ? 'border-white/80 scale-110' : 'border-white/10',
                      )}
                      style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #000))` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <MenuAction icon={<Copy size={14} />} label="复制笔记" onClick={() => { onDuplicate(); closeMenu() }} />
            <MenuAction icon={<ClipboardCopy size={14} />} label="复制到剪贴板" onClick={() => { onCopy(); closeMenu() }} />
            <MenuAction icon={<Download size={14} />} label="导出笔记" onClick={() => { onExport(); closeMenu() }} />
            <div className="my-1 border-t border-border/60" />
            <MenuAction
              icon={<Trash2 size={14} />}
              label="删除笔记"
              danger
              onClick={() => { onDelete(); closeMenu() }}
            />
        </div>,
        document.body,
      )}
    </>
  )
}

function MenuAction({
  icon,
  label,
  onClick,
  active = false,
  danger = false,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
        danger
          ? 'text-danger hover:bg-danger/10'
          : active
            ? 'bg-primary/15 text-primary'
            : 'text-text hover:bg-surface-light',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
