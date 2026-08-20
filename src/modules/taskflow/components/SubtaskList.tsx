import { useState, useMemo } from 'react';
import type { Subtask } from '../types'
import { api } from '../utils/api';
import { playTickSound, playClickSound } from '../utils/sound';
import { showToast } from '../utils/toastEvent';
import { countCompleted } from '../utils/subtaskUtils';
import { Icon } from './Icon';

interface SubtaskListProps {
  taskId: string;
  subtasks: Subtask[];
  onUpdate: () => void;
}

export function SubtaskList({ taskId, subtasks, onUpdate }: SubtaskListProps) {
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const { completedCount, progress } = useMemo(() => {
    const completed = countCompleted(subtasks);
    return {
      completedCount: completed,
      progress: subtasks.length > 0 ? Math.round((completed / subtasks.length) * 100) : 0,
    };
  }, [subtasks]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      await api.tasks.addSubtask(taskId, newTitle.trim());
      setNewTitle('');
      setIsAdding(false);
      onUpdate();
      playClickSound();
    } catch {
      showToast('添加子任务失败', 'error');
    }
  };

  const handleToggle = async (subtaskId: string) => {
    try {
      const sub = subtasks.find(s => s.id === subtaskId);
      await api.tasks.toggleSubtask(taskId, subtaskId);
      if (sub && !sub.completed) playTickSound();
      onUpdate();
    } catch {
      showToast('更新子任务失败', 'error');
    }
  };

  const handleDelete = async (subtaskId: string) => {
    try {
      await api.tasks.deleteSubtask(taskId, subtaskId);
      onUpdate();
      playClickSound();
    } catch {
      showToast('删除子任务失败', 'error');
    }
  };

  return (
    <div role="group" aria-label="子任务管理">
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">子任务</span>
          {subtasks.length > 0 && (
            <span className="text-xs text-text-muted">
              {completedCount}/{subtasks.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          aria-label={isAdding ? '取消添加子任务' : '添加子任务'}
          aria-expanded={isAdding}
        >
          {isAdding ? '取消' : '+ 添加'}
        </button>
      </div>

      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div className="w-full h-1.5 bg-surface-lighter rounded-full mb-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`子任务完成进度 ${progress}%`}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              backgroundColor: progress === 100 ? '#10b981' : '#3b82f6',
            }}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Add input */}
      {isAdding && (
        <div className="flex gap-2 mb-3">
          <label htmlFor="new-subtask-input" className="sr-only">新子任务标题</label>
          <input
            id="new-subtask-input"
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="input flex-1 text-sm"
            placeholder="输入子任务..."
            autoFocus
            aria-required="true"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="btn btn-primary text-sm px-3"
          >
            添加
          </button>
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-1" role="list" aria-label="子任务列表">
        {subtasks.map((subtask) => (
          <div
            key={subtask.id}
            className="flex items-center gap-2 group py-1.5 px-2 rounded hover:bg-surface-lighter /50 transition-colors"
            role="listitem"
          >
            <button
              type="button"
              onClick={() => handleToggle(subtask.id)}
              className="flex-shrink-0"
              role="checkbox"
              aria-checked={subtask.completed}
              aria-label={`${subtask.completed ? '已完成' : '未完成'}: ${subtask.title}`}
            >
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${ subtask.completed ? 'bg-green-500 border-green-500' : 'border-border hover:border-blue-500' }`}
                aria-hidden="true"
              >
                {subtask.completed && (
                  <Icon name="check" className="w-3 h-3 text-white" />
                )}
              </div>
            </button>
            <span
              className={`flex-1 text-sm ${ subtask.completed ? 'line-through text-text-muted ' : 'text-text ' }`}
            >
              {subtask.title}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(subtask.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-red-500"
              aria-label={`删除子任务: ${subtask.title}`}
            >
              <Icon name="close" className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {subtasks.length === 0 && !isAdding && (
        <p className="text-xs text-text-muted text-center py-2">暂无子任务</p>
      )}
    </div>
  );
}
