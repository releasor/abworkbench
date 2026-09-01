import { useState, useMemo, useRef, useCallback } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { useStore } from '../../../store';
import { TemplateSelector } from './TemplateSelector';
import { SubtaskList } from './SubtaskList';
import { NoteList } from './NoteList';
import { Icon } from './Icon';
import { TimeTracker } from './TimeTracker';
import { DatePicker } from './DatePicker';
import { CategorySelect } from './CategorySelect';
import { TaskDependency } from './TaskDependency';
import { RecurringTaskEditor } from './RecurringTaskEditor';
import { api } from '../utils/api';
import { showToast } from '../utils/toastEvent';
import { playClickSound, playCompletionSound } from '../utils/sound';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { Task, Status, Priority, RecurringPattern, EnergyLevel } from '../types'
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../types'
import { formatRelativeTime } from '../utils/relativeTime';
import { buildSmartTaskPlan, mergeSmartPlanIntoTask } from '../utils/smartPlanner';
import { errorMessage } from '../../../utils/errors';
import { findRelatedNotesForTask } from '../../../components/notes/noteTaskLinks';

interface TaskModalProps {
  task: Task | null;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  prefillDate?: string | null;
}

type Tab = 'details' | 'activity';

function createInitialTaskForm(task: Task | null, prefillDate?: string | null) {
  if (task) {
    return {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      category: task.category,
      tags: task.tags,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      tagInput: '',
      estimatedMinutes: task.estimatedMinutes?.toString() || '',
      nextAction: task.nextAction || '',
      energyLevel: task.energyLevel || 'medium' as EnergyLevel,
      blockerReason: task.blockerReason || '',
      plannedSubtasks: [] as string[],
      pinned: task.pinned || false,
      recurring: task.recurring || null,
    };
  }

  return {
    title: '',
    description: '',
    status: 'todo' as Status,
    priority: 'medium' as Priority,
    category: 'cat-work',
    tags: [] as string[],
    dueDate: prefillDate || '',
    tagInput: '',
    estimatedMinutes: '',
    nextAction: '',
    energyLevel: 'medium' as EnergyLevel,
    blockerReason: '',
    plannedSubtasks: [] as string[],
    pinned: false,
    recurring: null as RecurringPattern | null,
  };
}

export function TaskModal({ task, onClose, onSuccess, prefillDate }: TaskModalProps) {
  const createTask = useTaskStore((state) => state.createTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const categories = useTaskStore((state) => state.categories);
  const tasks = useTaskStore((state) => state.tasks);
  const refreshStoreTask = useTaskStore((state) => state.refreshTask);
  const trapRef = useFocusTrap<HTMLDivElement>();
  const isEditing = !!task;
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [currentTask, setCurrentTask] = useState<Task | null>(task);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Collect all unique tags for autocomplete
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const t of tasks) {
      for (const tag of t.tags) {
        tagSet.add(tag);
      }
    }
    return [...tagSet].sort();
  }, [tasks]);

  const handleSubtaskUpdate = useCallback(async () => {
    if (!task) return;
    try {
      const updated = await api.tasks.get(task.id);
      setCurrentTask(updated);
      await refreshStoreTask(task.id);
    } catch {
      showToast('刷新任务数据失败', 'error');
    }
  }, [task, refreshStoreTask]);

  const [form, setForm] = useState(() => createInitialTaskForm(task, prefillDate));

  // Global notes for task-note linking
  const globalNotes = useStore((s) => s.notes)
  const relatedNotes = useMemo(() => {
    if (!currentTask) return []
    return findRelatedNotesForTask(
      { id: currentTask.id, title: currentTask.title, description: currentTask.description, tags: currentTask.tags, category: currentTask.category },
      globalNotes.map((n) => ({ id: n.id, title: n.title, content: n.content })),
      categories.map((c) => ({ id: c.id, name: c.name }))
    )
  }, [currentTask, globalNotes, categories])

  const linkedNoteIds = useMemo(() => currentTask?.linkedNoteIds || [], [currentTask?.linkedNoteIds])
  const linkedNotes = useMemo(
    () => globalNotes.filter((n) => linkedNoteIds.includes(n.id)),
    [globalNotes, linkedNoteIds]
  )
  const suggestedNotes = useMemo(
    () => relatedNotes.filter((n) => !linkedNoteIds.includes(n.id)).slice(0, 5),
    [relatedNotes, linkedNoteIds]
  )

  const toggleLinkedNote = useCallback(async (noteId: string) => {
    if (!currentTask) return
    const current = currentTask.linkedNoteIds || []
    const next = current.includes(noteId)
      ? current.filter((id) => id !== noteId)
      : [...current, noteId]
    try {
      await updateTask(currentTask.id, { linkedNoteIds: next })
      setCurrentTask({ ...currentTask, linkedNoteIds: next })
    } catch {
      showToast('更新关联笔记失败', 'error')
    }
  }, [currentTask, updateTask])

  // Filter tag suggestions based on input
  const tagSuggestions = useMemo(() => {
    const input = form.tagInput.trim().toLowerCase();
    if (!input) return [];
    return allTags
      .filter((tag) => tag.toLowerCase().includes(input) && !form.tags.includes(tag))
      .slice(0, 5);
  }, [form.tagInput, allTags, form.tags]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const plannedSubtasks = form.plannedSubtasks.map((title, index) => ({
        id: `planned-${Date.now().toString(36)}-${index}`,
        title,
        completed: false,
        createdAt: now,
      }));

      const data = {
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
        priority: form.priority,
        category: form.category,
        tags: form.tags,
        dueDate: form.dueDate ? form.dueDate + 'T00:00:00.000Z' : null,
        estimatedMinutes: form.estimatedMinutes ? parseInt(form.estimatedMinutes) : null,
        nextAction: form.nextAction.trim(),
        energyLevel: form.energyLevel,
        blockerReason: form.blockerReason.trim(),
        pinned: form.pinned,
        recurring: form.recurring,
        ...(plannedSubtasks.length > 0 ? { subtasks: plannedSubtasks } : {}),
      };

      if (isEditing && task) {
        // Auto-stop time tracking when marking as done
        if (data.status === 'done' && task.status !== 'done' && task.timeEntries) {
          let hasActiveTimer = false;
          for (let i = 0; i < task.timeEntries.length; i++) {
            if (!task.timeEntries[i].endTime) { hasActiveTimer = true; break; }
          }
          if (hasActiveTimer) {
            await api.tasks.stopTime(task.id);
          }
        }
        await updateTask(task.id, data);
        onSuccess?.('任务已更新');
        if (data.status === 'done' && task.status !== 'done') playCompletionSound(); else playClickSound();
      } else {
        await createTask(data);
        onSuccess?.('任务已创建');
        playClickSound();
      }
      onClose();
    } catch (err) {
      showToast(errorMessage(err) || '操作失败', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateSmartPlan = async () => {
    if (!form.title.trim()) {
      showToast('请先输入任务标题', 'error');
      return;
    }

    const plan = buildSmartTaskPlan({
      title: form.title,
      description: form.description,
    });

    setForm((prev) => ({
      ...prev,
      estimatedMinutes: plan.estimatedMinutes.toString(),
      nextAction: plan.nextAction,
      energyLevel: plan.energyLevel,
      plannedSubtasks: isEditing ? [] : plan.subtasks,
    }));

    if (isEditing && currentTask) {
      const merged = mergeSmartPlanIntoTask(currentTask, plan);
      await updateTask(currentTask.id, {
        estimatedMinutes: merged.estimatedMinutes,
        nextAction: merged.nextAction,
        energyLevel: merged.energyLevel,
        subtasks: merged.subtasks,
      });
      setCurrentTask(merged);
    }

    showToast(isEditing ? '已生成下一步和子任务' : '已生成智能规划，保存后创建子任务', 'success');
  };

  const addTag = () => {
    const tag = form.tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag], tagInput: '' });
    }
  };

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) });
  };

  const activityLog = useMemo(() => task?.activityLog || [], [task]);
  const reversedActivityLog = useMemo(
    () => [...activityLog].reverse().map((entry) => ({
      ...entry,
      relative: formatRelativeTime(entry.timestamp),
    })),
    [activityLog]
  );

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const formEl = document.querySelector('form');
      if (formEl) formEl.requestSubmit();
    }
  };

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden px-4 pt-8 pb-6 sm:pt-12"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? '编辑任务' : '新建任务'}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal — wider + shorter footprint */}
      <div className="relative z-10 flex w-full max-w-3xl max-h-[min(68vh,640px)] flex-col overflow-hidden card p-0 shadow-2xl shadow-black/40 animate-bounce-in">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-lg font-semibold" id="modal-title">
            {isEditing ? '编辑任务' : '新建任务'}
          </h2>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <TemplateSelector
                onSelect={(template) => {
                  setForm({
                    ...form,
                    title: template.title || '',
                    description: template.description || '',
                    priority: template.priority || 'medium',
                    category: template.category || 'cat-work',
                    tags: template.tags || [],
                  });
                }}
              />
            )}
            <button
              onClick={onClose}
              className="btn btn-ghost p-1.5"
              aria-label="关闭"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs (only show when editing) */}
        {isEditing && (
          <div className="flex shrink-0 gap-4 border-b border-border px-6" role="tablist" aria-label="任务信息选项卡">
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-2 pt-3 text-sm font-medium border-b-2 transition-colors ${ activeTab === 'details' ? 'border-blue-500 text-blue-600' : 'border-transparent text-text-muted hover:text-text' }`}
              role="tab"
              aria-selected={activeTab === 'details'}
              aria-controls="tab-details"
              id="tab-btn-details"
            >
              详情
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`pb-2 pt-3 text-sm font-medium border-b-2 transition-colors ${ activeTab === 'activity' ? 'border-blue-500 text-blue-600' : 'border-transparent text-text-muted hover:text-text' }`}
              role="tab"
              aria-selected={activeTab === 'activity'}
              aria-controls="tab-activity"
              id="tab-btn-activity"
            >
              活动日志 ({activityLog.length})
            </button>
          </div>
        )}

        {activeTab === 'details' ? (
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
            role="tabpanel"
            id="tab-details"
            aria-labelledby="tab-btn-details"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {/* Title + Description */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="task-title" className="mb-1 block text-sm font-medium">
                  标题 <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="task-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input w-full"
                  placeholder="输入任务标题..."
                  autoFocus
                  required
                  aria-required="true"
                />
              </div>
              <div className="min-w-0">
                <label htmlFor="task-description" className="mb-1 block text-sm font-medium">描述</label>
                <textarea
                  id="task-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input w-full resize-none"
                  rows={2}
                  placeholder="添加描述..."
                />
              </div>
            </div>

            {/* Smart Planning — full width, no nested crush */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text">智能规划</div>
                  <div className="text-xs text-text-muted">下一步行动、精力、耗时与子任务</div>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateSmartPlan}
                  className="btn btn-secondary shrink-0 text-sm"
                >
                  一键生成
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="min-w-0 sm:col-span-1">
                  <label htmlFor="task-next-action" className="mb-1 block text-xs font-medium text-text-muted">下一步行动</label>
                  <input
                    id="task-next-action"
                    type="text"
                    value={form.nextAction}
                    onChange={(e) => setForm({ ...form, nextAction: e.target.value })}
                    className="input w-full"
                    placeholder="例如：先列出资料清单"
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="task-energy" className="mb-1 block text-xs font-medium text-text-muted">精力等级</label>
                  <select
                    id="task-energy"
                    value={form.energyLevel}
                    onChange={(e) => setForm({ ...form, energyLevel: e.target.value as EnergyLevel })}
                    className="input w-full"
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label htmlFor="task-estimated-smart" className="mb-1 block text-xs font-medium text-text-muted">预计耗时（分钟）</label>
                  <input
                    id="task-estimated-smart"
                    type="number"
                    min="1"
                    max="9999"
                    value={form.estimatedMinutes}
                    onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })}
                    className="input w-full"
                    placeholder="分钟"
                  />
                </div>
              </div>
              {!isEditing && form.plannedSubtasks.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs font-medium text-text-muted">保存时创建的子任务</div>
                  <div className="space-y-1">
                    {form.plannedSubtasks.map((title, index) => (
                      <div key={`${title}-${index}`} className="flex items-center gap-2 text-xs text-text-muted">
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-blue-500/15 text-[10px] text-blue-600 dark:text-blue-300">{index + 1}</span>
                        <span>{title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Blocker */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <label htmlFor="task-blocker-reason" className="block text-sm font-semibold text-text">
                阻塞原因
              </label>
              <textarea
                id="task-blocker-reason"
                value={form.blockerReason}
                onChange={(e) => setForm({ ...form, blockerReason: e.target.value })}
                className="input mt-2 w-full resize-none"
                rows={2}
                placeholder="例如：等待设计稿确认、接口还没准备好、需要他人反馈"
              />
            </div>

            {/* Status / Priority / Category / Due — 2x2, each cell min-w-0 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="task-status" className="mb-1 block text-sm font-medium">状态</label>
                <select
                  id="task-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
                  className="input w-full"
                >
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label htmlFor="task-priority" className="mb-1 block text-sm font-medium">优先级</label>
                <select
                  id="task-priority"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                  className="input w-full"
                >
                  {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-0 overflow-visible">
                <label className="mb-1 block text-sm font-medium">分类</label>
                <CategorySelect
                  categories={categories}
                  value={form.category}
                  onChange={(category) => setForm({ ...form, category })}
                  label="任务分类"
                />
              </div>
              <div className="min-w-0 overflow-visible">
                <label htmlFor="task-due-date" className="mb-1 block text-sm font-medium">截止日期</label>
                <DatePicker
                  value={form.dueDate}
                  onChange={(value) => setForm({ ...form, dueDate: value })}
                />
              </div>
            </div>

            {/* Pin + Recurring */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <input
                  id="task-pinned"
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                  className="rounded border-border text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="task-pinned" className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon name="pin" className="h-4 w-4 text-amber-500" filled={form.pinned} />
                  置顶任务
                </label>
              </div>
              <div className="min-w-0 flex-1">
                <RecurringTaskEditor
                  value={form.recurring}
                  onChange={(recurring) => setForm({ ...form, recurring })}
                />
              </div>
            </div>

            {/* Tags */}
            <div className="min-w-0">
              <label htmlFor="task-tags" className="mb-1 block text-sm font-medium">标签</label>
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    ref={tagInputRef}
                    id="task-tags"
                    type="text"
                    value={form.tagInput}
                    onChange={(e) => setForm({ ...form, tagInput: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                      if (e.key === 'Escape') {
                        setForm({ ...form, tagInput: '' });
                      }
                    }}
                    className="input flex-1"
                    placeholder="输入标签后回车..."
                    aria-describedby="tags-help"
                    aria-autocomplete="list"
                    aria-controls="tag-suggestions"
                  />
                  <button type="button" onClick={addTag} className="btn btn-secondary">
                    添加
                  </button>
                </div>
                {/* Tag Suggestions */}
                {tagSuggestions.length > 0 && (
                  <div
                    id="tag-suggestions"
                    className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-border z-10 py-1"
                    role="listbox"
                    aria-label="标签建议"
                  >
                    {tagSuggestions.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, tags: [...form.tags, tag], tagInput: '' });
                          tagInputRef.current?.focus();
                        }}
                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-surface-lighter transition-colors flex items-center gap-2"
                        role="option"
                        aria-selected={false}
                      >
                        <span className="text-xs px-1.5 py-0.5 bg-surface-lighter text-text-muted rounded">
                          #{tag}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p id="tags-help" className="text-xs text-text-muted mt-1">
                输入标签后按回车键或点击添加按钮，支持自动补全
              </p>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-blue-900 dark:hover:text-blue-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Subtasks (only when editing) */}
            {isEditing && currentTask && (
              <div className="border-t border-border pt-3">
                <SubtaskList
                  taskId={currentTask.id}
                  subtasks={currentTask.subtasks || []}
                  onUpdate={handleSubtaskUpdate}
                />
              </div>
            )}

            {/* Notes (only when editing) */}
            {isEditing && currentTask && (
              <div className="border-t border-border pt-3">
                <NoteList
                  taskId={currentTask.id}
                  notes={currentTask.notes || []}
                  onUpdate={handleSubtaskUpdate}
                />
              </div>
            )}

            {/* Linked Global Notes (only when editing) */}
            {isEditing && currentTask && (
              <div className="border-t border-border pt-3">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-text">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                  关联笔记
                  {linkedNotes.length > 0 && (
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">{linkedNotes.length}</span>
                  )}
                </h4>

                {linkedNotes.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {linkedNotes.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => toggleLinkedNote(note.id)}
                        className="group inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title="点击取消关联"
                      >
                        <span className="max-w-[120px] truncate">{note.title || '无标题'}</span>
                        <span className="opacity-50 group-hover:opacity-100">×</span>
                      </button>
                    ))}
                  </div>
                )}

                {suggestedNotes.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] text-text-muted">可能相关的笔记：</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedNotes.map((note) => (
                        <button
                          key={note.id}
                          type="button"
                          onClick={() => toggleLinkedNote(note.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-lighter px-2 py-1 text-xs text-text-muted transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:border-blue-800 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                          title="点击关联"
                        >
                          <span className="max-w-[120px] truncate">{note.title || '无标题'}</span>
                          <span className="opacity-50">+</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {linkedNotes.length === 0 && suggestedNotes.length === 0 && (
                  <p className="text-xs text-text-muted">暂无关联笔记。在笔记中使用 #标签 或 [[任务名]] 可自动匹配。</p>
                )}
              </div>
            )}

            {/* Time Tracking (only when editing) */}
            {isEditing && currentTask && (
              <div className="border-t border-border pt-3">
                <TimeTracker
                  taskId={currentTask.id}
                  timeEntries={currentTask.timeEntries || []}
                  estimatedMinutes={currentTask.estimatedMinutes}
                  onUpdate={handleSubtaskUpdate}
                />
              </div>
            )}

            {/* Dependencies (only when editing) */}
            {isEditing && currentTask && (
              <div className="border-t border-border pt-3">
                <TaskDependency
                  taskId={currentTask.id}
                  dependencies={currentTask.dependencies || []}
                  onUpdate={handleSubtaskUpdate}
                />
              </div>
            )}

            </div>
            </div>

            {/* Actions — always visible at bottom of panel */}
            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
              <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSubmitting}>
                取消
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? '保存中...' : isEditing ? '保存' : '创建'}
              </button>
            </div>
          </form>
        ) : (
          /* Activity Log Tab */
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4" role="tabpanel" id="tab-activity" aria-labelledby="tab-btn-activity">
            {activityLog.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">暂无活动记录</p>
            ) : (
              reversedActivityLog.map((entry) => (
                  <div key={entry.id} className="flex gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" aria-hidden="true" />
                    <div className="flex-1">
                      <p className="text-text">{entry.details}</p>
                      <p
                        className="text-xs text-text-muted mt-0.5 cursor-help"
                        title={entry.timestamp.replace('T', ' ').slice(0, 19)}
                      >
                        {entry.relative}
                      </p>
                    </div>
                  </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
