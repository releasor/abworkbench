import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category } from '../types';
import { Icon } from './Icon';
import { CategoryIcon, CategoryPill } from './CategoryPill';

interface CategorySelectProps {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  counts?: Map<string, number>;
  allLabel?: string;
  allowAll?: boolean;
  label?: string;
}

export function CategorySelect({ categories, value, onChange, counts, allLabel = '所有分类', allowAll = false, label = '分类' }: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedCategory = useMemo(() => categories.find((category) => category.id === value), [categories, value]);
  const selectedCount = selectedCategory ? counts?.get(selectedCategory.id) : undefined;
  const allCount = useMemo(() => categories.reduce((sum, category) => sum + (counts?.get(category.id) || 0), 0), [categories, counts]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex min-w-[13rem] items-center gap-3 rounded-2xl border px-4 py-2.5 text-left shadow-sm transition-all ${ value !== 'all' ? 'border-blue-400/60 bg-blue-500/10 text-blue-700 dark:text-blue-200' : 'border-border bg-white/70 text-text hover:border-blue-300 dark:border-white/10 dark:bg-white/[0.03] ' }`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
      >
        {selectedCategory ? (
          <CategoryIcon category={selectedCategory} className="h-8 w-8 rounded-xl" />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-surface-lighter text-text-muted dark:bg-white/10">
            <Icon name="folder" className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</span>
          <span className="mt-0.5 block truncate text-sm font-bold">{selectedCategory?.name || allLabel}</span>
        </span>
        {typeof selectedCount === 'number' && <span className="rounded-full bg-black/5 px-2 py-1 text-xs font-semibold dark:bg-white/10">{selectedCount}</span>}
        <Icon name="chevron-down" className={`h-4 w-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-[22rem] overflow-hidden rounded-3xl border border-border glass-card p-2 shadow-2xl"
          role="listbox"
          aria-label={label}
        >
          {allowAll && (
            <button
              type="button"
              onClick={() => choose('all')}
              className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${value === 'all' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-200' : 'hover:bg-surface-lighter dark:hover:bg-white/10'}`}
              role="option"
              aria-selected={value === 'all'}
            >
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-surface-lighter text-text-muted dark:bg-white/10">
                <Icon name="folder" className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-bold">{allLabel}</span>
                <span className="block text-xs text-text-muted">查看所有分类任务</span>
              </span>
              <span className="rounded-full bg-black/5 px-2 py-1 text-xs font-semibold dark:bg-white/10">{allCount}</span>
            </button>
          )}

          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {categories.map((category) => {
              const isSelected = category.id === value;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => choose(category.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${ isSelected ? 'bg-blue-500/10' : 'hover:bg-surface-lighter dark:hover:bg-white/10' }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <CategoryIcon category={category} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-text">{category.name}</span>
                    <span className="block text-xs text-text-muted">{counts?.get(category.id) || 0} 个任务</span>
                  </span>
                  {isSelected ? <Icon name="check" className="h-4 w-4 text-blue-500" /> : <CategoryPill category={category} count={counts?.get(category.id)} compact />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
