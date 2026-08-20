import { useState, useEffect, useMemo } from 'react';
import type { Task, TaskDependency as TaskDependencyType } from '../types'
import { api } from '../utils/api';
import { useTaskStore } from '../hooks/useTaskStore';
import { showToast } from '../utils/toastEvent';
import { playClickSound } from '../utils/sound';

interface TaskDependencyProps {
  taskId: string;
  dependencies: TaskDependencyType[];
  onUpdate: () => void;
}

export function TaskDependency({ taskId, dependencies, onUpdate }: TaskDependencyProps) {
  const tasks = useTaskStore((state) => state.tasks);
  const [blocking, setBlocking] = useState<Task[]>([]);
  const [blockedBy, setBlockedBy] = useState<Task[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTask, setSelectedTask] = useState('');
  const [depType, setDepType] = useState<'blocks' | 'blocked-by'>('blocks');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.tasks.getDependencies(taskId).then((result) => {
      if (!cancelled) {
        setBlocking(result.blocking);
        setBlockedBy(result.blockedBy);
      }
    }).catch(() => {
      if (!cancelled) showToast('加载依赖关系失败', 'error');
    });
    return () => { cancelled = true; };
  }, [taskId, dependencies]);

  const handleAdd = async () => {
    if (!selectedTask) return;
    setLoading(true);
    try {
      await api.tasks.addDependency(taskId, selectedTask, depType);
      setSelectedTask('');
      setShowAdd(false);
      onUpdate();
      playClickSound();
    } catch {
      showToast('添加依赖失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (dependencyId: string) => {
    try {
      await api.tasks.removeDependency(taskId, dependencyId);
      onUpdate();
      playClickSound();
    } catch {
      showToast('移除依赖失败', 'error');
    }
  };

  // O(1) dependency lookups — single pass over dependencies
  const { depIdSet, depMap } = useMemo(() => {
    const ids = new Set<string>();
    const map = new Map<string, TaskDependencyType>();
    for (const d of dependencies) {
      ids.add(d.dependsOnId);
      map.set(d.dependsOnId, d);
    }
    return { depIdSet: ids, depMap: map };
  }, [dependencies]);

  const availableTasks = useMemo(
    () => tasks.filter((t) => t.id !== taskId && !depIdSet.has(t.id)),
    [tasks, taskId, depIdSet]
  );

  return (
    <div role="group" aria-label="任务依赖关系">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-text">依赖关系</h4>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
          aria-label={showAdd ? '取消添加依赖' : '添加依赖关系'}
          aria-expanded={showAdd}
        >
          {showAdd ? '取消' : '+ 添加依赖'}
        </button>
      </div>

      {/* Add dependency form */}
      {showAdd && (
        <div className="mb-3 p-3 bg-surface-lighter rounded-lg" role="form" aria-label="添加依赖关系">
          <div className="flex gap-2 mb-2">
            <label htmlFor="dep-type" className="sr-only">依赖类型</label>
            <select
              id="dep-type"
              value={depType}
              onChange={(e) => setDepType(e.target.value as 'blocks' | 'blocked-by')}
              className="input text-xs py-1"
              aria-label="选择依赖类型"
            >
              <option value="blocks">阻塞</option>
              <option value="blocked-by">被阻塞</option>
            </select>
            <label htmlFor="dep-task" className="sr-only">选择任务</label>
            <select
              id="dep-task"
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
              className="input text-xs py-1 flex-1"
              aria-label="选择要关联的任务"
              aria-required="true"
            >
              <option value="">选择任务...</option>
              {availableTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={!selectedTask || loading}
            className="btn btn-primary text-xs py-1 w-full"
            aria-label="确认添加依赖"
          >
            {loading ? '添加中...' : '添加'}
          </button>
        </div>
      )}

      {/* Blocking tasks */}
      {blocking.length > 0 && (
        <div className="mb-2" role="group" aria-label="阻塞的任务">
          <p className="text-xs text-text-muted mb-1">阻塞以下任务:</p>
          {blocking.map((task) => {
            const dep = depMap.get(task.id);
            return (
              <div
                key={task.id}
                className="flex items-center justify-between py-1 px-2 bg-red-50 dark:bg-red-900/20 rounded mb-1"
                role="listitem"
                aria-label={`阻塞任务: ${task.title}`}
              >
                <span className="text-xs text-red-700 dark:text-red-300 truncate">
                  {task.title}
                </span>
                {dep && (
                  <button
                    onClick={() => handleRemove(dep.id)}
                    className="text-xs text-red-500 hover:text-red-700 ml-2"
                    aria-label={`移除对 ${task.title} 的阻塞`}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Blocked by tasks */}
      {blockedBy.length > 0 && (
        <div role="group" aria-label="被阻塞的任务">
          <p className="text-xs text-text-muted mb-1">被以下任务阻塞:</p>
          {blockedBy.map((task) => {
            const dep = depMap.get(task.id);
            return (
              <div
                key={task.id}
                className="flex items-center justify-between py-1 px-2 bg-yellow-50 dark:bg-yellow-900/20 rounded mb-1"
                role="listitem"
                aria-label={`被 ${task.title} 阻塞`}
              >
                <span className="text-xs text-yellow-700 dark:text-yellow-300 truncate">
                  {task.title}
                </span>
                {dep && (
                  <button
                    onClick={() => handleRemove(dep.id)}
                    className="text-xs text-yellow-500 hover:text-yellow-700 ml-2"
                    aria-label={`移除 ${task.title} 的阻塞`}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {blocking.length === 0 && blockedBy.length === 0 && !showAdd && (
        <p className="text-xs text-text-muted italic">暂无依赖关系</p>
      )}
    </div>
  );
}
