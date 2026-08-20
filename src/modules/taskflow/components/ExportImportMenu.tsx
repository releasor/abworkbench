import { useState, useRef, useMemo } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { useClickOutside } from '../hooks/useClickOutside';
import { exportToJSON, exportToCSV, exportToHTML, exportToMarkdown, exportToDetailedCSV, exportToICS, importFromJSON, importFromCSV, importFromTrello } from '../utils/export';
import { api } from '../utils/api';
import { BulkTextImport } from './BulkTextImport';
import { playClickSound } from '../utils/sound';
import type { Task, Category } from '../types'
import { hasActiveFilters as checkActiveFilters } from '../utils/searchMatch';
import { Icon } from './Icon';
import { errorMessage } from '../../../utils/errors';

interface ExportImportMenuProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ExportImportMenu({ onSuccess, onError }: ExportImportMenuProps) {
  const tasks = useTaskStore((state) => state.tasks);
  const categories = useTaskStore((state) => state.categories);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const selectedIds = useTaskStore((state) => state.selectedIds);
  const getFilteredTasks = useTaskStore((state) => state.getFilteredTasks);
  const filters = useTaskStore((state) => state.filters);
  const [open, setOpen] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const hasSelection = selectedIds.size > 0;
  const selectedTasks = useMemo(() => tasks.filter((t) => selectedIds.has(t.id)), [tasks, selectedIds]);
  const hasActiveFilters = checkActiveFilters(filters);
  // Only compute filtered tasks when menu is open and filters are active
  const filteredTasks = open && hasActiveFilters ? getFilteredTasks() : [];
  const isFilteredSubset = hasActiveFilters && filteredTasks.length > 0 && filteredTasks.length < tasks.length;
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);
  const trelloFileRef = useRef<HTMLInputElement>(null);

  useClickOutside(menuRef, () => setOpen(false), open);

  const makeExportHandler = (exportFn: () => void, msg: string) => () => {
    exportFn();
    onSuccess(msg);
    setOpen(false);
  };

  const handleExportJSON = makeExportHandler(() => exportToJSON(tasks, categories), '已导出JSON文件');
  const handleExportCSV = makeExportHandler(() => exportToCSV(tasks, categories), '已导出CSV文件');
  const handleExportHTML = makeExportHandler(() => exportToHTML(tasks, categories), '已导出HTML文件（可用浏览器打印为PDF）');
  const handleExportMarkdown = makeExportHandler(() => exportToMarkdown(tasks, categories), '已导出Markdown文件');
  const handleExportExcel = makeExportHandler(() => exportToDetailedCSV(tasks, categories), '已导出详细CSV文件（含子任务、备注等列）');
  const handleExportICS = makeExportHandler(() => exportToICS(tasks), '已导出iCalendar文件（可导入日历应用）');

  const importFile = async (
    file: File,
    parseFn: (file: File) => Promise<{ tasks: Partial<Task>[] | Task[]; categories: Category[] }>,
  ) => {
    try {
      const data = await parseFn(file);
      await api.tasks.import(data.tasks);
      await fetchTasks();
      onSuccess(`已导入 ${data.tasks.length} 个任务`);
      playClickSound();
    } catch (err) {
      onError(errorMessage(err));
    }
    setOpen(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    await importFile(file, importFromJSON);
    e.currentTarget.value = '';
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    await importFile(file, importFromCSV);
    e.currentTarget.value = '';
  };

  const handleTrelloImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    await importFile(file, importFromTrello);
    e.currentTarget.value = '';
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="btn btn-ghost p-2"
        title="导出/导入"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="导出或导入任务"
      >
        <Icon name="download" className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 card p-1 shadow-lg animate-slide-in z-50" role="menu" aria-label="导出导入选项">
          {hasSelection && (
            <>
              <div className="px-3 py-1.5 text-xs text-text-muted font-medium">
                导出选中 ({selectedIds.size})
              </div>
              {([
                ['JSON', () => exportToJSON(selectedTasks, categories), 'JSON'],
                ['CSV', () => exportToCSV(selectedTasks, categories), 'CSV'],
                ['Markdown', () => exportToMarkdown(selectedTasks, categories), 'Markdown'],
                ['HTML', () => exportToHTML(selectedTasks, categories), 'HTML'],
              ] as const).map(([label, fn, fmt]) => (
                <button
                  key={label}
                  onClick={makeExportHandler(fn, `已导出 ${selectedIds.size} 个任务为 ${fmt}`)}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors"
                  role="menuitem"
                >
                  选中 → {label}
                </button>
              ))}
              <div className="border-t border-border my-1" aria-hidden="true" />
            </>
          )}
          {isFilteredSubset && (
            <>
              <div className="px-3 py-1.5 text-xs text-text-muted font-medium">
                导出筛选结果 ({filteredTasks.length})
              </div>
              {([
                ['JSON', () => exportToJSON(filteredTasks, categories), 'JSON'],
                ['CSV', () => exportToCSV(filteredTasks, categories), 'CSV'],
                ['Markdown', () => exportToMarkdown(filteredTasks, categories), 'Markdown'],
              ] as const).map(([label, fn, fmt]) => (
                <button
                  key={label}
                  onClick={makeExportHandler(fn, `已导出 ${filteredTasks.length} 个筛选任务为 ${fmt}`)}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 transition-colors"
                  role="menuitem"
                >
                  筛选 → {label}
                </button>
              ))}
              <div className="border-t border-border my-1" aria-hidden="true" />
            </>
          )}
          <div className="px-3 py-1.5 text-xs text-text-muted font-medium">
            导出全部
          </div>
          <button
            onClick={handleExportJSON}
            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-lighter transition-colors"
            role="menuitem"
          >
            导出为 JSON
          </button>
          <button
            onClick={handleExportCSV}
            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-lighter transition-colors"
            role="menuitem"
          >
            导出为 CSV
          </button>
          <button
            onClick={handleExportHTML}
            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-lighter transition-colors"
            role="menuitem"
          >
            导出为 HTML/PDF
          </button>
          <button
            onClick={handleExportMarkdown}
            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-lighter transition-colors"
            role="menuitem"
          >
            导出为 Markdown
          </button>
          <button
            onClick={handleExportExcel}
            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-lighter transition-colors"
            role="menuitem"
          >
            导出为 Excel
          </button>
          <button
            onClick={handleExportICS}
            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-lighter transition-colors"
            role="menuitem"
          >
            导出为 iCalendar
          </button>
          <div className="border-t border-border my-1" aria-hidden="true" />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-lighter transition-colors"
            role="menuitem"
          >
            从 JSON 导入
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            aria-label="选择JSON文件导入"
          />
          <button
            onClick={() => csvFileRef.current?.click()}
            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-lighter transition-colors"
            role="menuitem"
          >
            从 CSV 导入
          </button>
          <input
            ref={csvFileRef}
            type="file"
            accept=".csv"
            onChange={handleCSVImport}
            className="hidden"
            aria-label="选择CSV文件导入"
          />
          <button
            onClick={() => trelloFileRef.current?.click()}
            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-lighter transition-colors"
            role="menuitem"
          >
            从 Trello 导入
          </button>
          <input
            ref={trelloFileRef}
            type="file"
            accept=".json"
            onChange={handleTrelloImport}
            className="hidden"
            aria-label="选择Trello JSON文件导入"
          />
          <div className="border-t border-border my-1" aria-hidden="true" />
          <button
            onClick={() => { setShowBulkImport(true); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-lighter transition-colors flex items-center gap-2"
            role="menuitem"
          >
            <Icon name="document-text" className="w-4 h-4 text-text-muted" />
            批量文本导入
          </button>
        </div>
      )}
      {showBulkImport && (
        <BulkTextImport
          onClose={() => setShowBulkImport(false)}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
}
