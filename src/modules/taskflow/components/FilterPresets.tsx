import { useState } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import type { FilterState } from '../types';
import { playClickSound } from '../utils/sound';
import { hasActiveFilters as checkActiveFilters } from '../utils/searchMatch';
import { Icon } from './Icon';
import { safeGet, safeSet } from '../../../utils/safeLocalStorage';

interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
}

const STORAGE_KEY = 'taskflow-filter-presets';

export function FilterPresets() {
  const filters = useTaskStore((state) => state.filters);
  const setFilters = useTaskStore((state) => state.setFilters);
  const [presets, setPresets] = useState<FilterPreset[]>(() => safeGet<FilterPreset[]>(STORAGE_KEY, []));
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const trapRef = useFocusTrap<HTMLDivElement>();

  useEscapeKey(() => setShowSaveDialog(false), showSaveDialog);

  const savePresets = (newPresets: FilterPreset[]) => {
    setPresets(newPresets);
    safeSet(STORAGE_KEY, newPresets);
  };

  const handleSave = () => {
    if (!presetName.trim()) return;
    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      filters: { ...filters },
    };
    savePresets([...presets, newPreset]);
    setPresetName('');
    setShowSaveDialog(false);
    playClickSound();
  };

  const handleLoad = (preset: FilterPreset) => {
    setFilters(preset.filters);
    playClickSound();
  };

  const handleDelete = (id: string) => {
    savePresets(presets.filter((preset) => preset.id !== id));
    playClickSound();
  };

  const hasActiveFilters = checkActiveFilters(filters);

  return (
    <div className="flex items-center gap-2" role="toolbar" aria-label="筛选预设">
      {presets.map((preset) => (
        <div key={preset.id} className="group flex items-center rounded-2xl border border-border bg-white/70 p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <button
            onClick={() => handleLoad(preset)}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
            aria-label={`加载筛选预设 ${preset.name}`}
          >
            <Icon name="filter" className="h-3.5 w-3.5" />
            {preset.name}
          </button>
          <button
            onClick={() => handleDelete(preset.id)}
            className="grid h-7 w-7 place-items-center rounded-xl text-text-muted opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-500/10"
            title="删除预设"
            aria-label={`删除筛选预设 ${preset.name}`}
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {hasActiveFilters && (
        <button
          onClick={() => setShowSaveDialog(true)}
          className="flex items-center gap-1.5 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
          aria-label="保存当前筛选为预设"
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
          保存筛选
        </button>
      )}

      {showSaveDialog && (
        <div
          ref={trapRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="保存筛选预设"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowSaveDialog(false)} aria-hidden="true" />
          <div className="relative w-full max-w-sm rounded-3xl border border-border glass-card p-5 shadow-2xl animate-bounce-in">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500/10 text-blue-500">
                <Icon name="filter" className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-black text-text dark:text-white" id="save-preset-title">保存筛选预设</h3>
                <p className="text-xs text-text-muted">下次一键恢复这组筛选条件。</p>
              </div>
            </div>
            <label htmlFor="preset-name" className="sr-only">预设名称</label>
            <input
              id="preset-name"
              type="text"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSave();
              }}
              className="mb-4 w-full rounded-2xl border border-blue-400/60 bg-white px-4 py-3 text-sm text-text outline-none ring-4 ring-blue-500/10 placeholder:text-text-muted bg-surface dark:text-white"
              placeholder="输入预设名称..."
              autoFocus
              aria-required="true"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSaveDialog(false)} className="rounded-2xl px-4 py-2 text-sm font-semibold text-text-muted transition hover:bg-surface-lighter dark:hover:bg-white/10">
                取消
              </button>
              <button onClick={handleSave} className="rounded-2xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50" disabled={!presetName.trim()}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
