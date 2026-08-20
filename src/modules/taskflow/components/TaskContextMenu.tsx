import { useEffect, useRef, useState } from 'react';
import type { Task, Status, Priority } from '../types'
import { STATUS_CONFIG, PRIORITY_CONFIG, STATUS_CYCLE, PRIORITY_CYCLE } from '../types'
import { SNOOZE_PRESETS } from '../utils/snoozePresets';
import { Icon } from './Icon';

interface TaskContextMenuProps {
  task: Task;
  x: number;
  y: number;
  onClose: () => void;
  onEdit: () => void;
  onFocus: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onCycleStatus: (status: Status) => void;
  onCyclePriority: (priority: Priority) => void;
  onSnooze: (days: number) => void;
}

export function TaskContextMenu({
  task, x, y, onClose, onEdit, onFocus, onDuplicate, onDelete,
  onTogglePin, onCycleStatus, onCyclePriority, onSnooze,
}: TaskContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = x;
    let ny = y;
    if (x + rect.width > vw - 8) nx = vw - rect.width - 8;
    if (y + rect.height > vh - 8) ny = vh - rect.height - 8;
    if (nx < 8) nx = 8;
    if (ny < 8) ny = 8;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  // Close on outside click or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    // Delay to avoid catching the same right-click
    setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKey);
    }, 0);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const nextStatus = STATUS_CYCLE[task.status];
  const nextPriority = PRIORITY_CYCLE[task.priority];

  return (
    <div
      ref={ref}
      className="fixed z-[60] bg-white rounded-lg shadow-xl border border-border py-1.5 min-w-[180px] animate-fade-in"
      style={{ left: pos.x, top: pos.y }}
      role="menu"
      aria-label="任务操作菜单"
    >
      {/* Edit */}
      <MenuItem
        iconName="edit"
        label="编辑任务"
        shortcut="Enter"
        onClick={() => { onEdit(); onClose(); }}
      />

      {/* Focus mode */}
      <MenuItem
        iconName="eye"
        label="专注模式"
        shortcut="F"
        onClick={() => { onFocus(); onClose(); }}
      />

      <Divider />

      {/* Cycle status */}
      <MenuItem
        iconName="refresh"
        label={`状态: ${STATUS_CONFIG[nextStatus].label}`}
        shortcut="Space"
        onClick={() => { onCycleStatus(nextStatus); onClose(); }}
      />

      {/* Cycle priority */}
      <MenuItem
        iconName="lightning"
        label={`优先级: ${PRIORITY_CONFIG[nextPriority].label}`}
        onClick={() => { onCyclePriority(nextPriority); onClose(); }}
      />

      <Divider />

      {/* Toggle pin */}
      <MenuItem
        iconName="pin"
        label={task.pinned ? '取消置顶' : '置顶任务'}
        shortcut="P"
        filled={task.pinned}
        onClick={() => { onTogglePin(); onClose(); }}
      />

      {/* Duplicate */}
      <MenuItem
        iconName="duplicate"
        label="复制任务"
        onClick={() => { onDuplicate(); onClose(); }}
      />

      {/* Snooze submenu */}
      <SnoozeSubmenu onSnooze={(days) => { onSnooze(days); onClose(); }} />

      <Divider />

      {/* Delete */}
      <MenuItem
        iconName="trash"
        label="删除任务"
        shortcut="Del"
        danger
        onClick={() => { onDelete(); onClose(); }}
      />
    </div>
  );
}

function MenuItem({ iconName, label, shortcut, danger, filled, onClick }: {
  iconName: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
  filled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors ${ danger ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-text hover:bg-surface-lighter ' }`}
      role="menuitem"
    >
      <Icon name={iconName} className="w-4 h-4 flex-shrink-0" filled={filled} />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <kbd className="text-[10px] px-1.5 py-0.5 bg-surface-lighter text-text-muted rounded font-mono">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

function SnoozeSubmenu({ onSnooze }: { onSnooze: (days: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-surface-lighter transition-colors"
        role="menuitem"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Icon name="clock" className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">推迟</span>
        <Icon name="chevron-right" className="w-3 h-3 text-text-muted" />
      </button>
      {open && (
        <div className="absolute left-full top-0 ml-0.5 bg-white rounded-lg shadow-xl border border-border py-1 min-w-[120px]">
          {SNOOZE_PRESETS.map((p) => (
            <SnoozeOption key={p.days} label={p.label} onClick={() => onSnooze(p.days)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SnoozeOption({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-sm text-text hover:bg-surface-lighter transition-colors"
      role="menuitem"
    >
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-border" role="separator" />;
}
