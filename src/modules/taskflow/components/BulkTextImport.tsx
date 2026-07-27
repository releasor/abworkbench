import { useState, useRef, useMemo } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { parseSmartInput } from '../utils/smartParse';
import { api } from '../utils/api';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { playClickSound } from '../utils/sound';

interface BulkTextImportProps {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export function BulkTextImport({ onClose, onSuccess }: BulkTextImportProps) {
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const fetchStats = useTaskStore((state) => state.fetchStats);
  const [text, setText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>();
  useEscapeKey(onClose);

  // Count lines for the button label — only the count is needed during render
  const count = useMemo(() => {
    let n = 0;
    for (const line of text.split('\n')) {
      if (line.trim().length > 0) n++;
    }
    return n;
  }, [text]);

  const handleCreate = async () => {
    if (count === 0) return;
    setIsCreating(true);
    try {
      const taskInputs: Partial<import('../types').Task>[] = [];
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const { title, priority, tags, dueDate } = parseSmartInput(trimmed);
        if (title) {
          taskInputs.push({ title, priority, tags, dueDate: dueDate ? dueDate + 'T00:00:00.000Z' : null });
        }
      }

      if (taskInputs.length > 0) {
        await api.tasks.batchCreate(taskInputs);
        await fetchTasks();
        fetchStats();
      }
      onSuccess(`已创建 ${taskInputs.length} 个任务`);
      onClose();
      playClickSound();
    } catch {
      setIsCreating(false);
    }
  };

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="批量文本导入"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 animate-slide-in">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          批量文本导入
        </h2>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          每行将创建一个任务。支持 <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">#标签</code>、优先级关键词（紧急/高/低）和日期关键词（明天/后天/下周）。
        </p>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-48 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={'买菜 #个人 低\n完成报告 #工作 紧急 明天\n学习 TypeScript #学习 下周'}
          autoFocus
          aria-label="批量任务文本"
        />

        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {count > 0 ? `将创建 ${count} 个任务` : '输入内容开始创建'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={count === 0 || isCreating}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? '创建中...' : `创建 ${count} 个任务`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
