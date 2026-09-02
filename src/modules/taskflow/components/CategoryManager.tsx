import { useEffect, useMemo, useRef, useState } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { playClickSound } from '../utils/sound';
import { Icon } from './Icon';
import { CategoryIcon, CategoryPill } from './CategoryPill';

interface CategoryManagerProps {
  onClose: () => void;
}

const PRESET_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];

export function CategoryManager({ onClose }: CategoryManagerProps) {
  const categories = useTaskStore((state) => state.categories);
  const tasks = useTaskStore((state) => state.tasks);
  const createCategory = useTaskStore((state) => state.createCategory);
  const updateCategory = useTaskStore((state) => state.updateCategory);
  const deleteCategory = useTaskStore((state) => state.deleteCategory);
  const setFilters = useTaskStore((state) => state.setFilters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [showAdd, setShowAdd] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>();
  const addInputRef = useRef<HTMLInputElement>(null);
  useEscapeKey(onClose);

  useEffect(() => {
    if (showAdd) addInputRef.current?.focus();
  }, [showAdd]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) counts.set(task.category, (counts.get(task.category) || 0) + 1);
    return counts;
  }, [tasks]);

  const startEdit = (id: string, name: string, color: string) => {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateCategory(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
    playClickSound();
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await createCategory({ name: newName.trim(), color: newColor, icon: 'folder' });
    setNewName('');
    setNewColor('#3b82f6');
    setShowAdd(false);
    playClickSound();
  };

  const handleDelete = async (id: string) => {
    await deleteCategory(id);
    playClickSound();
  };

  return (
    <div ref={trapRef} className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="分类管理">
      <div className="absolute inset-0 modal-veil liquid-glass-veil animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div className="liquid-glass-panel modal-panel-cinematic relative w-full max-w-2xl overflow-hidden shadow-2xl animate-bounce-in">
        <div className="flex items-center justify-between border-b border-border px-6 py-5 dark:border-white/10">
          <div>
            <h2 className="text-xl font-black text-text dark:text-white">分类管理</h2>
            <p className="mt-1 text-sm text-text-muted">用颜色和分组让任务空间更清晰。</p>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl text-text-muted transition hover:bg-surface-lighter hover:text-text dark:hover:bg-white/10 dark:hover:text-white" aria-label="关闭分类管理">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="grid gap-3">
            {categories.map((category) => (
              <div key={category.id} className="rounded-3xl border border-border bg-surface-lighter/70 p-4 transition hover:border-blue-300 hover:bg-white hover:shadow-lg hover:shadow-black/5 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-500/50 dark:hover:bg-white/[0.05]">
                {editingId === category.id ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <input type="color" value={editColor} onChange={(event) => setEditColor(event.target.value)} className="h-11 w-11 cursor-pointer rounded-2xl border-0 bg-transparent" aria-label="选择颜色" />
                    <input
                      type="text"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') void saveEdit(); if (event.key === 'Escape') setEditingId(null); }}
                      className="min-w-0 flex-1 rounded-2xl border border-blue-400/60 bg-white px-4 py-3 text-sm text-text outline-none ring-4 ring-blue-500/10 bg-surface dark:text-white"
                      aria-label="分类名称"
                    />
                    <button onClick={saveEdit} className="rounded-2xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-600" aria-label="保存">保存</button>
                    <button onClick={() => setEditingId(null)} className="rounded-2xl px-4 py-2 text-sm font-semibold text-text-muted transition hover:bg-surface-lighter dark:hover:bg-white/10" aria-label="取消">取消</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <CategoryIcon category={category} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CategoryPill category={category} count={categoryCounts.get(category.id) || 0} />
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-lighter dark:bg-white/10">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(((categoryCounts.get(category.id) || 0) / Math.max(tasks.length, 1)) * 100, 100)}%`,
                            backgroundColor: category.color,
                          }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => { setFilters({ category: category.id }); onClose(); }}
                      className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                      aria-label={`筛选 ${category.name} 分类`}
                    >
                      筛选
                    </button>
                    <button onClick={() => startEdit(category.id, category.name, category.color)} className="grid h-9 w-9 place-items-center rounded-xl text-text-muted transition hover:bg-surface-lighter hover:text-blue-500 dark:hover:bg-white/10" aria-label={`编辑 ${category.name}`}>
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(category.id)} className="grid h-9 w-9 place-items-center rounded-xl text-text-muted transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" aria-label={`删除 ${category.name}`}>
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {showAdd ? (
            <div className="mt-5 rounded-3xl border border-blue-300/50 bg-blue-50/70 p-4 shadow-lg shadow-blue-500/10 dark:border-blue-500/30 dark:bg-blue-500/10">
              <div className="flex items-center gap-3">
                <input type="color" value={newColor} onChange={(event) => setNewColor(event.target.value)} className="h-11 w-11 cursor-pointer rounded-2xl border-0 bg-transparent" aria-label="新分类颜色" />
                <input
                  ref={addInputRef}
                  type="text"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void handleAdd(); if (event.key === 'Escape') setShowAdd(false); }}
                  placeholder="分类名称"
                  className="min-w-0 flex-1 rounded-2xl border border-blue-400/60 bg-white px-4 py-3 text-sm text-text outline-none ring-4 ring-blue-500/10 bg-surface dark:text-white"
                  aria-label="新分类名称"
                />
                <button onClick={handleAdd} className="rounded-2xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-600" aria-label="添加分类">添加</button>
                <button onClick={() => setShowAdd(false)} className="rounded-2xl px-4 py-2 text-sm font-semibold text-text-muted transition hover:bg-white/70 dark:hover:bg-white/10" aria-label="取消添加">取消</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`h-7 w-7 rounded-full border-2 transition ${newColor === color ? 'scale-110 border-border dark:border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    aria-label={`选择颜色 ${color}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-border bg-surface-lighter/70 px-4 py-4 text-sm font-semibold text-text-muted transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-500/60 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
              aria-label="添加新分类"
            >
              <Icon name="plus" className="h-4 w-4" />
              添加新分类
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
