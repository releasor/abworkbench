import { Keyboard, Search, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { acceleratorToKeys, useShortcutStore } from '../../../shortcuts';

interface KeyboardHelpProps {
  onClose: () => void;
}

const HELP_ITEMS: Array<{ id: string; group: string; fallbackLabel: string }> = [
  { id: 'tfNewTask', group: '任务操作', fallbackLabel: '新建任务' },
  { id: 'tfSelectAll', group: '任务操作', fallbackLabel: '选择全部任务' },
  { id: 'tfDelete', group: '任务操作', fallbackLabel: '删除选中任务' },
  { id: 'tfUndo', group: '任务操作', fallbackLabel: '撤销删除' },
  { id: 'tfTogglePin', group: '任务操作', fallbackLabel: '置顶 / 取消置顶' },
  { id: 'tfSnooze', group: '任务操作', fallbackLabel: '推迟 1 天' },
  { id: 'tfViewBoard', group: '视图切换', fallbackLabel: '看板视图' },
  { id: 'tfViewList', group: '视图切换', fallbackLabel: '列表视图' },
  { id: 'tfViewCalendar', group: '视图切换', fallbackLabel: '日历视图' },
  { id: 'tfStats', group: '视图切换', fallbackLabel: '统计面板' },
  { id: 'tfCompleted', group: '视图切换', fallbackLabel: '已完成任务' },
  { id: 'tfHelp', group: '视图切换', fallbackLabel: '快捷键帮助' },
  { id: 'tfFocusMode', group: '效率工具', fallbackLabel: '专注模式' },
  { id: 'tfTimeline', group: '效率工具', fallbackLabel: '时间线' },
  { id: 'tfPomodoro', group: '效率工具', fallbackLabel: '番茄钟' },
  { id: 'tfDailyReview', group: '效率工具', fallbackLabel: '每日回顾' },
  { id: 'tfWeeklyReport', group: '效率工具', fallbackLabel: '每周报告' },
  { id: 'tfSearch', group: '效率工具', fallbackLabel: '聚焦搜索框' },
];

const queryTips = [
  ['#标签', '按标签搜索'],
  ['p:high', '按优先级筛选'],
  ['s:done', '按状态筛选'],
  ['c:工作', '按分类筛选'],
  ['"精确匹配"', '搜索完整短语'],
];

export function KeyboardHelp({ onClose }: KeyboardHelpProps) {
  const trapRef = useFocusTrap<HTMLDivElement>();
  useEscapeKey(onClose);
  const getAccelerator = useShortcutStore((s) => s.getAccelerator);
  const overrides = useShortcutStore((s) => s.overrides);
  void overrides;

  const groups = ['任务操作', '视图切换', '效率工具'].map((title) => ({
    title,
    items: HELP_ITEMS.filter((item) => item.group === title).map((item) => ({
      keys: acceleratorToKeys(getAccelerator(item.id)),
      description: item.fallbackLabel,
    })),
  }));

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-help-title"
    >
      <button className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fade-in" onClick={onClose} aria-label="关闭快捷键帮助" />
      <div className="relative max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/60 animate-bounce-in">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent" />
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/15 p-3 text-blue-300">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white" id="keyboard-help-title">快捷键中心</h2>
              <p className="text-sm text-zinc-500">更快地管理任务、切换视图和调用效率工具。可在设置中修改。</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(86vh-88px)] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-3">
            {groups.map((group) => (
              <div key={group.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{group.title}</div>
                <div className="space-y-2.5">
                  {group.items.map((shortcut) => (
                    <div key={`${group.title}-${shortcut.description}`} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-zinc-400">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, index) => (
                          <span key={`${key}-${index}`} className="flex items-center gap-1">
                            <kbd className="min-w-[1.5rem] rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 text-center font-mono text-[11px] text-zinc-200">
                              {key}
                            </kbd>
                            {index < shortcut.keys.length - 1 && <span className="text-zinc-600">+</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Search className="h-3.5 w-3.5" />
              搜索语法
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {queryTips.map(([syntax, tip]) => (
                <div key={syntax} className="flex items-center justify-between gap-3 text-sm">
                  <code className="rounded bg-black/40 px-2 py-1 font-mono text-xs text-blue-300">{syntax}</code>
                  <span className="text-zinc-500">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
