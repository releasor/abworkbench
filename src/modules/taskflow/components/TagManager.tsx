import { useState, useMemo } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { playClickSound } from '../utils/sound';
import { Icon } from './Icon';

interface TagManagerProps {
  onClose: () => void;
}

export function TagManager({ onClose }: TagManagerProps) {
  const tasks = useTaskStore((state) => state.tasks);
  const filters = useTaskStore((state) => state.filters);
  const setFilters = useTaskStore((state) => state.setFilters);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>();
  useEscapeKey(onClose);

  // Get all unique tags with counts
  const tagStats = useMemo(() => {
    const tagMap = new Map<string, number>();
    for (let i = 0; i < tasks.length; i++) {
      const tags = tasks[i].tags;
      for (let j = 0; j < tags.length; j++) {
        tagMap.set(tags[j], (tagMap.get(tags[j]) || 0) + 1);
      }
    }
    return Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [tasks]);

  const handleTagClick = (tagName: string) => {
    if (filters.search === `#${tagName}`) {
      setFilters({ search: '' });
      setSelectedTag(null);
    } else {
      setFilters({ search: `#${tagName}` });
      setSelectedTag(tagName);
    }
    playClickSound();
  };

  return (
    <div ref={trapRef} className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="标签管理">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md card p-6 animate-bounce-in max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" id="tag-manager-title">标签管理</h2>
          <button onClick={onClose} className="btn btn-ghost p-1.5" aria-label="关闭标签管理">
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-text-muted">
            共 {tagStats.length} 个标签，点击标签筛选任务
          </p>
        </div>

        {tagStats.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">暂无标签</p>
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="标签列表">
            {tagStats.map(({ name, count }) => (
              <button
                key={name}
                onClick={() => handleTagClick(name)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${ selectedTag === name ? 'bg-blue-500 text-white' : 'bg-surface-lighter text-text hover:bg-surface-lighter ' }`}
                aria-pressed={selectedTag === name}
                aria-label={`标签 ${name}，${count}个任务`}
              >
                <span>#{name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${ selectedTag === name ? 'bg-blue-400 text-white' : 'bg-surface-lighter text-text-muted' }`} aria-hidden="true">
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}

        {selectedTag && (
          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={() => {
                setFilters({ search: '' });
                setSelectedTag(null);
                playClickSound();
              }}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              清除筛选
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
