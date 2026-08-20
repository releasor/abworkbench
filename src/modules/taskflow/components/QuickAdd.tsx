import { useState, useRef, useEffect, useMemo } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { parseSmartInput } from '../utils/smartParse';
import { playClickSound } from '../utils/sound';
import { showToast } from '../utils/toastEvent';
import type { Priority } from '../types'
import { Icon } from './Icon';
import { useTranslation } from '../../../i18n';
import { PRIORITY_LABEL_KEYS } from '../i18n';

const PRIORITY_TEXT_COLORS: Record<Priority, string> = {
  urgent: 'text-red-600 dark:text-red-400',
  high: 'text-orange-600 dark:text-orange-400',
  medium: 'text-text-muted',
  low: 'text-green-600 dark:text-green-400',
};

interface QuickAddProps {
  onSuccess: (msg: string) => void;
}

export function QuickAdd({ onSuccess }: QuickAddProps) {
  const { t, tWith } = useTranslation();
  const createTask = useTaskStore((state) => state.createTask);
  const batchCreateTasks = useTaskStore((state) => state.batchCreateTasks);
  const [title, setTitle] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const parsed = useMemo(() => title.trim() ? parseSmartInput(title) : null, [title]);

  useEffect(() => {
    if (isExpanded && !isBulkMode && inputRef.current) {
      inputRef.current.focus();
    }
    if (isExpanded && isBulkMode && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded, isBulkMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !parsed) return;

    try {
      await createTask({
        title: parsed.title,
        description: '',
        status: 'todo',
        priority: parsed.priority,
        category: 'cat-work',
        tags: parsed.tags,
        dueDate: parsed.dueDate ? parsed.dueDate + 'T00:00:00.000Z' : null,
        recurring: null,
      });

      setTitle('');
      onSuccess(t('taskflow.quickAdd.created'));
      playClickSound();
    } catch {
      showToast('创建任务失败', 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setTitle('');
      setIsExpanded(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = bulkText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return;

    const taskInputs = lines.map((line) => {
      const p = parseSmartInput(line);
      return p.title ? {
        title: p.title,
        description: '',
        status: 'todo' as const,
        priority: p.priority,
        category: 'cat-work',
        tags: p.tags,
        dueDate: p.dueDate ? p.dueDate + 'T00:00:00.000Z' : null,
        recurring: null,
      } : null;
    }).filter(Boolean);

    if (taskInputs.length === 0) return;

    try {
      const created = await batchCreateTasks(taskInputs as Partial<import('../types').Task>[]);

      setBulkText('');
      setIsBulkMode(false);
      setIsExpanded(false);
      onSuccess(tWith('taskflow.quickAdd.bulkCreated', created.length));
      playClickSound();
    } catch {
      showToast('批量创建失败', 'error');
    }
  };

  if (!isExpanded) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setIsExpanded(true)}
          className="group flex flex-1 items-center gap-3 rounded-2xl border border-dashed border-border bg-white/60 px-4 py-3 text-sm text-text-muted shadow-sm transition-all hover:border-blue-400 hover:bg-blue-50/70 hover:text-blue-700 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-500/60 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
          aria-label={t('taskflow.quickAdd.label')}
        >
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/10 text-blue-500 transition group-hover:bg-blue-500 group-hover:text-white">
            <Icon name="plus" className="h-4 w-4" />
          </span>
          <span className="font-medium">{t('taskflow.quickAdd.placeholder')}</span>
          <span className="ml-auto rounded-lg border border-border bg-white px-2 py-1 text-xs text-text-muted dark:border-white/10 dark:bg-white/5">Ctrl+N</span>
        </button>
        <button
          onClick={() => { setIsExpanded(true); setIsBulkMode(true); }}
          className="flex items-center gap-2 rounded-2xl border border-dashed border-border bg-white/60 px-4 py-3 text-sm font-medium text-text-muted shadow-sm transition-all hover:border-emerald-400 hover:bg-emerald-50/70 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-emerald-500/60 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200"
          title={t('taskflow.quickAdd.bulk')}
          aria-label={t('taskflow.quickAdd.bulk')}
        >
          <Icon name="list-lines" className="h-4 w-4" />
          {t('taskflow.quickAdd.bulk')}
        </button>
      </div>
    );
  }

  if (isBulkMode) {
    return (
      <form onSubmit={handleBulkSubmit} className="rounded-3xl border border-emerald-400/30 bg-emerald-50/40 p-3 shadow-xl shadow-emerald-500/10 dark:border-emerald-500/20 dark:bg-emerald-500/10">
        <textarea
          ref={textareaRef}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setBulkText(''); setIsBulkMode(false); setIsExpanded(false); } }}
          className="w-full resize-none rounded-2xl border border-emerald-400/60 bg-white px-4 py-3 text-sm text-text outline-none ring-4 ring-emerald-500/10 placeholder:text-text-muted bg-surface"
          placeholder={t('taskflow.quickAdd.bulkPlaceholder')}
          rows={5}
          aria-label={t('taskflow.quickAdd.bulk')}
          aria-required="true"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            disabled={!bulkText.trim()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('taskflow.quickAdd.batchCreate')}
          >
            {t('taskflow.quickAdd.batchCreate')}
          </button>
          <button
            type="button"
            onClick={() => { setBulkText(''); setIsBulkMode(false); setIsExpanded(false); }}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-text-muted transition hover:bg-surface-lighter dark:border-white/10 dark:bg-white/5"
            aria-label={t('taskflow.quickAdd.cancel')}
          >
            {t('taskflow.quickAdd.cancel')}
          </button>
          <button
            type="button"
            onClick={() => setIsBulkMode(false)}
            className="rounded-xl px-3 py-2 text-sm font-medium text-text-muted transition hover:bg-white/70 dark:hover:bg-white/10"
            aria-label={t('taskflow.quickAdd.single')}
          >
            {t('taskflow.quickAdd.single')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 rounded-3xl border border-blue-400/30 bg-blue-50/40 p-2 shadow-xl shadow-blue-500/10 dark:border-blue-500/20 dark:bg-blue-500/10">
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (!title.trim()) {
              setIsExpanded(false);
            }
          }}
          className="w-full rounded-2xl border border-blue-400/60 bg-white px-4 py-3 text-sm text-text outline-none ring-4 ring-blue-500/10 placeholder:text-text-muted bg-surface"
          placeholder={t('taskflow.quickAdd.inputPlaceholder')}
          aria-label={t('taskflow.quickAdd.label')}
          aria-required="true"
        />
        {parsed && (parsed.tags.length > 0 || parsed.priority !== 'medium' || parsed.dueDate) && (
          <div className="absolute -bottom-5 left-0 flex items-center gap-1.5 text-[10px]">
            {parsed.priority !== 'medium' && (
              <span className={`font-medium ${PRIORITY_TEXT_COLORS[parsed.priority as Priority]}`}>
                {t(PRIORITY_LABEL_KEYS[parsed.priority as Priority])}
              </span>
            )}
            {parsed.dueDate && (
              <span className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded flex items-center gap-0.5">
                <Icon name="calendar" className="w-2.5 h-2.5" />
                {parsed.dueDate.slice(5)}
              </span>
            )}
            {parsed.tags.map((tag) => (
              <span key={tag} className="px-1 py-0.5 bg-surface-lighter text-text-muted rounded">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={!title.trim()}
        className="rounded-2xl bg-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={t('taskflow.quickAdd.create')}
      >
        {t('taskflow.quickAdd.create')}
      </button>
      <button
        type="button"
        onClick={() => {
          setTitle('');
          setIsExpanded(false);
        }}
        className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-text-muted transition hover:bg-surface-lighter dark:border-white/10 dark:bg-white/5"
        aria-label={t('taskflow.quickAdd.cancel')}
      >
        {t('taskflow.quickAdd.cancel')}
      </button>
      <button
        type="button"
        onClick={() => setIsBulkMode(true)}
        className="rounded-2xl px-4 py-2 text-sm font-medium text-text-muted transition hover:bg-white/70 dark:hover:bg-white/10"
        title={t('taskflow.quickAdd.bulk')}
        aria-label={t('taskflow.quickAdd.bulk')}
      >
        {t('taskflow.quickAdd.bulk')}
      </button>
    </form>
  );
}
