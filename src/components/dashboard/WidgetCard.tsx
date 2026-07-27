import { useState, memo } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'

interface WidgetCardProps {
  title: string
  icon: ReactNode
  badge?: ReactNode
  children: ReactNode
  className?: string
  defaultCollapsed?: boolean
}

export default memo(function WidgetCard({ title, icon, badge, children, className = '', defaultCollapsed = false }: WidgetCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div className={clsx('group relative overflow-hidden rounded-[30px] border border-border bg-surface/80 p-5 shadow-xl shadow-black/5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10', className)}>
      <div className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-primary/10 blur-3xl opacity-0 transition-opacity group-hover:opacity-100" />
      <h3
        className="relative mb-4 flex cursor-pointer select-none items-center gap-2 text-sm font-bold text-text"
        onClick={() => setCollapsed(c => !c)}
      >
        <span className="grid h-9 w-9 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          {icon}
        </span>
        <span>{title}</span>
        {badge && <span className="ml-auto">{badge}</span>}
        {!badge && (
          <span className="ml-auto grid h-8 w-8 place-items-center rounded-xl bg-background/60 text-text-muted transition-colors group-hover:text-text">
            <ChevronDown
              size={14}
              className={clsx('transition-transform', collapsed && '-rotate-90')}
            />
          </span>
        )}
      </h3>

      <div className={clsx(
        'relative overflow-hidden transition-all duration-300',
        collapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'
      )}>
        {children}
      </div>
    </div>
  )
})
