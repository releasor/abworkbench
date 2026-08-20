import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`rounded-panel border border-dashed border-border px-6 py-10 text-center ${className}`}>
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-lighter text-text-muted">
        <Icon size={22} />
      </div>
      <p className="text-sm font-semibold text-text">{title}</p>
      {description && <p className="mt-1 text-xs text-text-muted">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn-primary mt-4"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
