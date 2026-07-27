import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckSquare, StickyNote, X, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../../store';
import { useTaskStore } from '../../modules/taskflow/hooks/useTaskStore';
import { buildQuickCreateDueAt, buildQuickCreateSubtasks, parseQuickCreateInput } from '../../modules/taskflow/utils/quickCreateParser';
import { showToast } from '../../modules/taskflow/utils/toastEvent';
import { appendLocalCollection } from '../../utils/localData';
import { useShortcutStore } from '../../shortcuts';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CaptureMode = 'task' | 'note';

export default function QuickCaptureModal({ isOpen, onClose }: QuickCaptureModalProps) {
  const [mode, setMode] = useState<CaptureMode>('task');
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const createTask = useTaskStore((state) => state.createTask);
  const createCategory = useTaskStore((state) => state.createCategory);
  const categories = useTaskStore((state) => state.categories);
  const addNote = useStore((state) => state.addNote);
  const quickCaptureHotkey = useShortcutStore((s) => s.getAccelerator('quickCapture'));
  const updateNote = useStore((state) => state.updateNote);

  const parsedTask = useMemo(() => (text.trim() ? parseQuickCreateInput(text.trim(), { projects: categories }) : null), [categories, text]);

  useEffect(() => {
    if (!isOpen) return;
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const submit = async () => {
    const value = text.trim();
    if (!value) return;

    if (mode === 'task') {
      const parsed = parseQuickCreateInput(value, { projects: categories });
      if (parsed.kind === 'note') {
        addNote();
        const note = useStore.getState().notes[0];
        if (note) updateNote(note.id, { title: parsed.title || value.slice(0, 36), content: parsed.raw });
        showToast('已保存快速笔记', 'success');
      } else if (parsed.kind === 'reminder') {
        appendLocalCollection('abworkbench-reminders', {
          id: `reminder-${Date.now().toString(36)}`,
          title: parsed.title || value,
          dueAt: buildQuickCreateDueAt(parsed) || new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
          repeat: parsed.repeat,
          done: false,
          projectId: parsed.projectId,
        });
        showToast('已保存提醒', 'success');
      } else if (parsed.kind === 'project') {
        await createCategory({ name: parsed.title || value, color: '#3b82f6', icon: 'folder' });
        showToast('已创建项目', 'success');
      } else {
        await createTask({
          title: parsed.title || value,
          description: parsed.raw,
          status: 'todo',
          priority: parsed.raw.includes('紧急') || parsed.raw.includes('高优先') ? 'high' : 'medium',
          category: parsed.projectId || categories[0]?.id || 'cat-work',
          tags: parsed.tags,
          dueDate: parsed.dueDate,
          estimatedMinutes: parsed.estimatedMinutes,
          energyLevel: parsed.energyLevel,
          nextAction: parsed.subtasks[0] || parsed.title,
          subtasks: buildQuickCreateSubtasks(parsed),
          recurring: null,
        });
        showToast('已快速创建任务', 'success');
      }
    } else {
      addNote();
      const note = useStore.getState().notes[0];
      if (note) {
        updateNote(note.id, {
          title: value.split('\n')[0].slice(0, 36) || '快速笔记',
          content: value,
        });
      }
      showToast('已保存快速笔记', 'success');
    }

    setText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} aria-label="关闭快速捕获" />
      <section className="relative w-full max-w-xl overflow-hidden rounded-[34px] border border-white/10 bg-zinc-950/95 p-5 shadow-2xl shadow-black/70">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/80 to-transparent" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/15 p-3 text-blue-300">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">全局快速捕获</h2>
              <p className="text-xs text-zinc-500">{quickCaptureHotkey} 随时记录想法、任务和灵感。</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-black/35 p-1">
          <CaptureTab active={mode === 'task'} icon={<CheckSquare className="h-4 w-4" />} label="任务" onClick={() => setMode('task')} />
          <CaptureTab active={mode === 'note'} icon={<StickyNote className="h-4 w-4" />} label="笔记" onClick={() => setMode('note')} />
        </div>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void submit();
            }
          }}
          rows={5}
          className="w-full resize-none rounded-3xl border border-white/10 bg-black/45 px-4 py-4 text-sm leading-6 text-white outline-none ring-4 ring-transparent placeholder:text-zinc-600 transition focus:border-blue-400/60 focus:ring-blue-500/10"
          placeholder={mode === 'task' ? '输入任务，例如：完成报告 #工作 紧急 明天' : '写下笔记内容，第一行会作为标题'}
        />

        {mode === 'task' && parsedTask && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-zinc-400">类型：{parsedTask.kind}</span>
            {parsedTask.dueDate && <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-blue-200">日期：{parsedTask.dueDate}</span>}
            {parsedTask.estimatedMinutes && <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-200">估时：{parsedTask.estimatedMinutes} 分钟</span>}
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-zinc-400">精力：{parsedTask.energyLevel}</span>
            {parsedTask.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-200">#{tag}</span>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-600">按 <kbd className="rounded border border-white/10 bg-black px-1.5 py-0.5">Ctrl</kbd> + <kbd className="rounded border border-white/10 bg-black px-1.5 py-0.5">Enter</kbd> 保存</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10">取消</button>
            <button onClick={() => void submit()} disabled={!text.trim()} className="rounded-2xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50">
              保存
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CaptureTab({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
        active ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-zinc-500 hover:bg-white/10 hover:text-zinc-200',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
