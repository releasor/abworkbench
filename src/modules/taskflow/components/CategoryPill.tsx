import type { Category } from '../types';
import { Icon } from './Icon';

interface CategoryPillProps {
  category?: Category;
  fallback?: string;
  count?: number;
  compact?: boolean;
  className?: string;
}

export function CategoryPill({ category, fallback = '未分类', count, compact = false, className = '' }: CategoryPillProps) {
  const color = category?.color || '#64748b';
  const label = category?.name || fallback;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm ${compact ? 'py-0.5 text-[11px]' : ''} ${className}`}
      style={{
        color,
        borderColor: `${color}45`,
        background: `linear-gradient(135deg, ${color}18, ${color}08)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full shadow-sm" style={{ backgroundColor: color }} />
      <span className="truncate">{label}</span>
      {typeof count === 'number' && (
        <span className="ml-0.5 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] dark:bg-white/10">{count}</span>
      )}
    </span>
  );
}

interface CategoryIconProps {
  category?: Category;
  className?: string;
}

export function CategoryIcon({ category, className = '' }: CategoryIconProps) {
  const color = category?.color || '#64748b';
  return (
    <span
      className={`grid h-9 w-9 place-items-center rounded-2xl ${className}`}
      style={{ backgroundColor: `${color}18`, color }}
    >
      <Icon name="folder" className="h-4 w-4" />
    </span>
  );
}
