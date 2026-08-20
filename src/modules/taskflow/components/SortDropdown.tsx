import { useState, useRef } from 'react';
import type { SortBy } from '../hooks/useTaskStore';
import { useTaskStore, SORT_OPTIONS } from '../hooks/useTaskStore';
import { useClickOutside } from '../hooks/useClickOutside';
import { Icon } from './Icon';
import { useTranslation } from '../../../i18n';
import { SORT_LABEL_KEYS } from '../i18n';

const SORT_ICONS: Record<SortBy, string> = {
  order: '↕',
  urgency: '🔥',
  priority: '🎯',
  dueDate: '📅',
  createdAt: '🕐',
  title: '🔤',
  estimated: '⏱',
  timeSpent: '⌛',
};

interface SortDropdownProps {
  variant?: 'dropdown' | 'inline';
}

function SortInline() {
  const { t } = useTranslation();
  const sortBy = useTaskStore((state) => state.sortBy);
  const setSortBy = useTaskStore((state) => state.setSortBy);
  const sortReverse = useTaskStore((state) => state.sortReverse);
  const setSortReverse = useTaskStore((state) => state.setSortReverse);

  return (
    <div className="flex items-center gap-2">
      <Icon name="sort" className="w-4 h-4 text-text-muted" />
      <label htmlFor="sort-select" className="sr-only">{t('taskflow.sort.order')}</label>
      <select
        id="sort-select"
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as SortBy)}
        className="text-sm bg-transparent border-0 text-text-muted focus:ring-0 cursor-pointer"
        aria-label={t('taskflow.sort.order')}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{t(SORT_LABEL_KEYS[opt.value])}</option>
        ))}
      </select>
      <button
        onClick={() => setSortReverse(!sortReverse)}
        className={`p-1 rounded transition-colors ${ sortReverse ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-text-muted hover:text-text ' }`}
        aria-label={sortReverse ? t('taskflow.sort.ascending') : t('taskflow.sort.descending')}
        title={sortReverse ? t('taskflow.sort.ascending') : t('taskflow.sort.descending')}
      >
        <span className="text-xs font-mono">{sortReverse ? '↑' : '↓'}</span>
      </button>
    </div>
  );
}

function SortDropdownMenu() {
  const { t } = useTranslation();
  const sortBy = useTaskStore((state) => state.sortBy);
  const setSortBy = useTaskStore((state) => state.setSortBy);
  const sortReverse = useTaskStore((state) => state.sortReverse);
  const setSortReverse = useTaskStore((state) => state.setSortReverse);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentSort = SORT_OPTIONS.find((o) => o.value === sortBy);
  const currentSortLabel = currentSort ? t(SORT_LABEL_KEYS[currentSort.value]) : '';

  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-ghost p-2 flex items-center gap-1"
        title={t('taskflow.sort.order')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${t('taskflow.sort.order')}: ${currentSortLabel}`}
      >
        <Icon name="sort" className="w-5 h-5" />
        <span className="hidden sm:inline text-xs">{currentSortLabel}{sortReverse ? ' ↑' : ''}</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-border py-1 z-50 animate-fade-in"
          role="listbox"
          aria-label={t('taskflow.sort.order')}
        >
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setSortBy(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-lighter transition-colors ${ sortBy === option.value ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-text ' }`}
              role="option"
              aria-selected={sortBy === option.value}
            >
              <span aria-hidden="true">{SORT_ICONS[option.value]}</span>
              <span>{t(SORT_LABEL_KEYS[option.value])}</span>
              {sortBy === option.value && (
                <Icon name="check" className="w-4 h-4 ml-auto" />
              )}
            </button>
          ))}
          <div className="border-t border-border my-1" aria-hidden="true" />
          <button
            onClick={() => setSortReverse(!sortReverse)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-lighter transition-colors text-text"
            role="option"
            aria-selected={sortReverse}
          >
            <span aria-hidden="true">{sortReverse ? '↑' : '↓'}</span>
            <span>{sortReverse ? t('taskflow.sort.ascending') : t('taskflow.sort.descending')}</span>
            {sortReverse && (
              <Icon name="check" className="w-4 h-4 ml-auto text-blue-600 dark:text-blue-400" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export function SortDropdown({ variant = 'dropdown' }: SortDropdownProps) {
  return variant === 'inline' ? <SortInline /> : <SortDropdownMenu />;
}

/**
 * SortControl — inline variant of SortDropdown.
 * Re-exports SortDropdown with variant="inline" for backward compatibility.
 */
export function SortControl() {
  return <SortDropdown variant="inline" />;
}
