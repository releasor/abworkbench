import { useState, useRef } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { useClickOutside } from '../hooks/useClickOutside';
import { ConfirmDialog } from './ConfirmDialog';
import { playClickSound, playCompletionSound } from '../utils/sound';
import type { Status, Priority } from '../types'
import { STATUS_CONFIG, PRIORITY_CONFIG, ALL_STATUSES, ALL_PRIORITIES, PRIORITY_HEX_COLORS } from '../types'
import { SNOOZE_PRESETS } from '../utils/snoozePresets';
import { Icon } from './Icon';
import { CategoryIcon, CategoryPill } from './CategoryPill';

interface BatchToolbarProps {
  onSuccess: (msg: string) => void;
}

export function BatchToolbar({ onSuccess }: BatchToolbarProps) {
  const selectedIds = useTaskStore((state) => state.selectedIds);
  const clearSelection = useTaskStore((state) => state.clearSelection);
  const selectAll = useTaskStore((state) => state.selectAll);
  const batchDelete = useTaskStore((state) => state.batchDelete);
  const batchUpdateStatus = useTaskStore((state) => state.batchUpdateStatus);
  const batchUpdatePriority = useTaskStore((state) => state.batchUpdatePriority);
  const batchUpdateCategory = useTaskStore((state) => state.batchUpdateCategory);
  const batchAddTags = useTaskStore((state) => state.batchAddTags);
  const batchRemoveTags = useTaskStore((state) => state.batchRemoveTags);
  const batchSnooze = useTaskStore((state) => state.batchSnooze);
  const batchArchive = useTaskStore((state) => state.batchArchive);
  const batchUnarchive = useTaskStore((state) => state.batchUnarchive);
  const batchDuplicate = useTaskStore((state) => state.batchDuplicate);
  const batchPin = useTaskStore((state) => state.batchPin);
  const batchUnpin = useTaskStore((state) => state.batchUnpin);
  const categories = useTaskStore((state) => state.categories);
  const tasks = useTaskStore((state) => state.tasks);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const categoryRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const snoozeRef = useRef<HTMLDivElement>(null);

  useClickOutside(categoryRef, () => setShowCategoryMenu(false), showCategoryMenu);
  useClickOutside(tagRef, () => setShowTagInput(false), showTagInput);
  useClickOutside(snoozeRef, () => setShowSnoozeMenu(false), showSnoozeMenu);

  let hasArchived = false;
  let hasUnarchived = false;
  let hasPinned = false;
  let hasUnpinned = false;
  if (selectedIds.size > 0) {
    for (const task of tasks) {
      if (!selectedIds.has(task.id)) continue;
      if (task.archived) hasArchived = true;
      else hasUnarchived = true;
      if (task.pinned) hasPinned = true;
      else hasUnpinned = true;
      if (hasArchived && hasUnarchived && hasPinned && hasUnpinned) break;
    }
  }

  if (selectedIds.size === 0) return null;

  const handleDelete = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    await batchDelete();
    onSuccess(`已删除 ${selectedIds.size} 个任务`);
    setShowDeleteConfirm(false);
    playClickSound();
  };

  const handleStatusChange = async (status: Status) => {
    await batchUpdateStatus(status);
    onSuccess(`已将 ${selectedIds.size} 个任务状态更改为 ${STATUS_CONFIG[status].label}`);
    if (status === 'done') playCompletionSound(); else playClickSound();
  };

  const handlePriorityChange = async (priority: Priority) => {
    await batchUpdatePriority(priority);
    onSuccess(`已将 ${selectedIds.size} 个任务优先级更改为 ${PRIORITY_CONFIG[priority].label}`);
    playClickSound();
  };

  const handleCategoryChange = async (categoryId: string) => {
    await batchUpdateCategory(categoryId);
    const cat = categories.find((c) => c.id === categoryId);
    onSuccess(`已将 ${selectedIds.size} 个任务分类更改为 ${cat?.name || categoryId}`);
    setShowCategoryMenu(false);
  };

  const handleAddTag = async () => {
    const tag = tagInput.trim();
    if (!tag) return;
    await batchAddTags([tag]);
    onSuccess(`已为 ${selectedIds.size} 个任务添加标签 #${tag}`);
    setTagInput('');
    setShowTagInput(false);
  };

  const handleRemoveTag = async () => {
    const tag = tagInput.trim();
    if (!tag) return;
    await batchRemoveTags([tag]);
    onSuccess(`已从 ${selectedIds.size} 个任务移除标签 #${tag}`);
    setTagInput('');
    setShowTagInput(false);
  };

  const handleSnooze = async (days: number, label: string) => {
    await batchSnooze(days);
    onSuccess(`已将 ${selectedIds.size} 个任务推迟${label}`);
    setShowSnoozeMenu(false);
    playClickSound();
  };

  const handleArchive = async () => {
    await batchArchive();
    onSuccess(`已归档 ${selectedIds.size} 个任务`);
    playClickSound();
  };

  const handleUnarchive = async () => {
    await batchUnarchive();
    onSuccess(`已取消归档 ${selectedIds.size} 个任务`);
    playClickSound();
  };

  const handleDuplicate = async () => {
    await batchDuplicate();
    onSuccess(`已复制 ${selectedIds.size} 个任务`);
    playClickSound();
  };

  const handlePin = async () => {
    await batchPin();
    onSuccess(`已置顶 ${selectedIds.size} 个任务`);
    playClickSound();
  };

  const handleUnpin = async () => {
    await batchUnpin();
    onSuccess(`已取消置顶 ${selectedIds.size} 个任务`);
    playClickSound();
  };

  return (
    <>
    <div
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 card px-4 py-2 shadow-xl animate-slide-in"
      role="toolbar"
      aria-label="批量操作工具栏"
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          已选 {selectedIds.size} 项
        </span>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true" />

        <div className="flex items-center gap-1" role="group" aria-label="更改状态">
          {ALL_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={`标记为${STATUS_CONFIG[status].label}`}
              aria-label={`将选中任务标记为${STATUS_CONFIG[status].label}`}
            >
              {STATUS_CONFIG[status].label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true" />

        <div className="flex items-center gap-1" role="group" aria-label="更改优先级">
          {ALL_PRIORITIES.map((priority) => (
            <button
              key={priority}
              onClick={() => handlePriorityChange(priority)}
              className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
              title={`设置为${PRIORITY_CONFIG[priority].label}优先级`}
              aria-label={`将选中任务设置为${PRIORITY_CONFIG[priority].label}优先级`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: PRIORITY_HEX_COLORS[priority] }}
                aria-hidden="true"
              />
              {PRIORITY_CONFIG[priority].label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true" />

        <div className="relative" ref={categoryRef}>
          <button
            onClick={() => setShowCategoryMenu(!showCategoryMenu)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-500/15 dark:text-blue-300"
            title="更改分类"
            aria-label="更改选中任务的分类"
            aria-expanded={showCategoryMenu}
          >
            <Icon name="folder" className="h-3.5 w-3.5" />
            分类
          </button>
          {showCategoryMenu && (
            <div className="absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-3xl border border-gray-200 bg-white p-2 shadow-2xl shadow-black/15 dark:border-white/10 dark:bg-[#0d0d0f] dark:shadow-black/60">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-gray-100 dark:hover:bg-white/10"
                  aria-label={`分类为 ${cat.name}`}
                >
                  <CategoryIcon category={cat} className="h-8 w-8 rounded-xl" />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{cat.name}</span>
                  <CategoryPill category={cat} compact />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true" />

        <div className="relative" ref={tagRef}>
          <button
            onClick={() => setShowTagInput(!showTagInput)}
            className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="批量标签操作"
            aria-label="批量添加或移除标签"
            aria-expanded={showTagInput}
          >
            标签
          </button>
          {showTagInput && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 card p-2 shadow-lg z-50 w-48">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTag();
                }}
                className="input w-full text-xs mb-2"
                placeholder="输入标签..."
                autoFocus
                aria-label="标签名称"
              />
              <div className="flex gap-1">
                <button
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                  className="flex-1 text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="添加标签"
                >
                  添加
                </button>
                <button
                  onClick={handleRemoveTag}
                  disabled={!tagInput.trim()}
                  className="flex-1 text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="移除标签"
                >
                  移除
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true" />

        <div className="relative" ref={snoozeRef}>
          <button
            onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
            className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
            title="批量推迟任务"
            aria-label="批量推迟选中任务"
            aria-expanded={showSnoozeMenu}
          >
            <Icon name="clock" className="w-3 h-3 text-indigo-500" />
            推迟
          </button>
          {showSnoozeMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 card p-1 shadow-lg z-50 min-w-[100px]">
              {SNOOZE_PRESETS.map((p) => (
                <button key={p.days} onClick={() => handleSnooze(p.days, p.label)} className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true" />

        <button
          onClick={handleDuplicate}
          className="text-xs px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-1"
          title="复制选中任务"
          aria-label={`复制选中的${selectedIds.size}个任务`}
        >
          <Icon name="duplicate" className="w-3 h-3 text-green-500" />
          复制
        </button>

        {hasUnpinned && (
          <button
            onClick={handlePin}
            className="text-xs px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-1"
            title="置顶选中任务"
            aria-label={`置顶选中的${selectedIds.size}个任务`}
          >
            <Icon name="pin" className="w-3 h-3 text-amber-500" filled />
            置顶
          </button>
        )}

        {hasPinned && (
          <button
            onClick={handleUnpin}
            className="text-xs px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-1"
            title="取消置顶选中任务"
            aria-label={`取消置顶选中的${selectedIds.size}个任务`}
          >
            <Icon name="pin" className="w-3 h-3 text-gray-400" />
            取消置顶
          </button>
        )}

        {hasUnarchived && (
          <button
            onClick={handleArchive}
            className="text-xs px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-1"
            title="归档选中任务"
            aria-label={`归档选中的${selectedIds.size}个任务`}
          >
            <Icon name="archive" className="w-3 h-3 text-amber-500" />
            归档
          </button>
        )}

        {hasArchived && (
          <button
            onClick={handleUnarchive}
            className="text-xs px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-1"
            title="取消归档选中任务"
            aria-label={`取消归档选中的${selectedIds.size}个任务`}
          >
            <Icon name="archive" className="w-3 h-3 text-blue-500" />
            取消归档
          </button>
        )}

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true" />

        <button
          onClick={handleDelete}
          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          aria-label={`删除选中的${selectedIds.size}个任务`}
        >
          删除
        </button>

        <button
          onClick={selectAll}
          className="text-xs px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label="全选所有任务"
        >
          全选
        </button>

        <button
          onClick={clearSelection}
          className="text-xs px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label="取消所有选择"
        >
          取消选择
        </button>
      </div>
    </div>

    {showDeleteConfirm && (
      <ConfirmDialog
        title="删除任务"
        message={`确定要删除选中的 ${selectedIds.size} 个任务吗？此操作不可撤销。`}
        confirmText="删除"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    )}
    </>
  );
}
