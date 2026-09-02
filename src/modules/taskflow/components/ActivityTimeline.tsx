import { useMemo } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { formatRelativeTime } from '../utils/relativeTime';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { dayOfWeek, WEEKDAYS } from '../dateUtils';
import { Icon } from './Icon';

const ACTION_ICONS: Record<string, string> = {
  created: '➕',
  status_changed: '🔄',
  priority_changed: '🎯',
  category_changed: '📁',
  tags_changed: '🏷️',
  title_changed: '✏️',
  note_added: '📝',
  note_updated: '📝',
  note_deleted: '📝',
  subtask_added: '☑️',
  subtask_toggled: '✅',
  subtask_deleted: '❌',
  dependency_added: '🔗',
  dependency_removed: '🔗',
  dueDate_changed: '📅',
  archived: '📦',
  unarchived: '📤',
  pinned: '📌',
  unpinned: '📌',
};

function formatDateHeader(dateStr: string): string {
  const m = +dateStr.slice(5, 7);
  const d = +dateStr.slice(8, 10);
  const dow = dayOfWeek(+dateStr.slice(0, 4), m, d);
  return `${m}月${d}日 周${WEEKDAYS[dow]}`;
}

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  status_changed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  priority_changed: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  category_changed: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  tags_changed: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  title_changed: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
  dueDate_changed: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  archived: 'bg-surface-lighter /30 text-text-muted ',
  unarchived: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  pinned: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  unpinned: 'bg-surface-lighter /30 text-text-muted ',
};

interface ActivityTimelineProps {
  onClose: () => void;
  onEditTask: (task: import('../types').Task) => void;
}

export function ActivityTimeline({ onClose, onEditTask }: ActivityTimelineProps) {
  const tasks = useTaskStore((state) => state.tasks);
  const trapRef = useFocusTrap<HTMLDivElement>();
  useEscapeKey(onClose);

  const activities = useMemo(() => {
    type Activity = {
      taskId: string;
      taskTitle: string;
      logId: string;
      timestamp: string;
      action: string;
      details: string;
      relative: string;
    };
    const all: Activity[] = [];
    for (const task of tasks) {
      for (const log of task.activityLog || []) {
        all.push({
          taskId: task.id,
          taskTitle: task.title,
          logId: log.id,
          timestamp: log.timestamp,
          action: log.action,
          details: log.details,
          relative: formatRelativeTime(log.timestamp),
        });
      }
    }
    // Sort by timestamp descending, limit to 50 most recent
    all.sort((a, b) => (b.timestamp < a.timestamp ? -1 : b.timestamp > a.timestamp ? 1 : 0));
    return all.slice(0, 50);
  }, [tasks]);

  // Group activities by date (yyyy-MM-dd) with precomputed formatted headers
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof activities>();
    for (const act of activities) {
      const date = act.timestamp.slice(0, 10);
      let group = groups.get(date);
      if (!group) {
        group = [];
        groups.set(date, group);
      }
      group.push(act);
    }
    return Array.from(groups.entries()).map(([date, acts]) => [date, acts, formatDateHeader(date)] as [string, typeof activities, string]);
  }, [activities]);

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="活动时间线"
    >
      <div
        className="absolute inset-0 modal-veil liquid-glass-veil animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="liquid-glass-panel modal-panel-cinematic relative w-full max-w-2xl p-6 animate-bounce-in max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">活动时间线</h2>
            <p className="text-sm text-text-muted">最近 {activities.length} 条活动记录</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost p-1.5" aria-label="关闭">
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        {activities.length === 0 ? (
          <div className="text-center py-12">
            <Icon name="clock" className="w-16 h-16 mx-auto text-text-muted mb-4" />
            <p className="text-text-muted">暂无活动记录</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([date, dateActivities, header]) => (
              <div key={date}>
                <h3 className="text-xs font-medium text-text-muted mb-3 sticky top-0 bg-white py-1">
                  {header}
                </h3>
                <div className="relative pl-6">
                  {/* Timeline line */}
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-surface-lighter" aria-hidden="true" />

                  <div className="space-y-3">
                    {dateActivities.map((act) => {
                      const icon = ACTION_ICONS[act.action] || '📋';
                      const colorClass = ACTION_COLORS[act.action] || 'bg-surface-lighter  text-text-muted';

                      return (
                        <div key={act.logId} className="relative flex items-start gap-3">
                          {/* Timeline dot */}
                          <div
                            className={`absolute -left-4 w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${colorClass}`}
                            aria-hidden="true"
                          >
                            {icon}
                          </div>

                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => {
                                const t = taskMap.get(act.taskId);
                                if (t) {
                                  onEditTask(t);
                                  onClose();
                                }
                              }}
                              className="text-left w-full group"
                            >
                              <p className="text-sm text-text group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {act.details}
                              </p>
                              <p className="text-xs text-text-muted mt-0.5">
                                <span className="font-medium">{act.taskTitle}</span>
                                {' · '}
                                {act.relative}
                              </p>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
