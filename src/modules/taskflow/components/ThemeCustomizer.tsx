import { useCallback, useEffect, useState } from 'react';
import { Check, Palette, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import { isSoundEnabled, playCompletionSound, setSoundEnabled } from '../utils/sound';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { api } from '../utils/api';
import { useStore } from '../../../store';
import { errorMessage } from '../../../utils/errors';

const ACCENT_COLORS = [
  { name: '蓝色', value: '#3b82f6' },
  { name: '紫色', value: '#8b5cf6' },
  { name: '绿色', value: '#10b981' },
  { name: '橙色', value: '#f97316' },
  { name: '红色', value: '#ef4444' },
  { name: '粉色', value: '#ec4899' },
];

interface BackupOption {
  index: number;
  modified: string;
  file?: string;
}

interface ThemeCustomizerProps {
  onClose: () => void;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
  onRestore?: () => void;
}

function formatBackupTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ThemeCustomizer({ onClose, onSuccess, onError, onRestore }: ThemeCustomizerProps) {
  const accentColor = useStore((s) => s.accentColor);
  const setAccentColor = useStore((s) => s.setAccentColor);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [restoring, setRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<number | undefined>(undefined);
  const [backups, setBackups] = useState<BackupOption[]>([]);
  const trapRef = useFocusTrap<HTMLDivElement>();
  useEscapeKey(onClose);

  useEffect(() => {
    if (!showRestoreConfirm) return;
    api.backups()
      .then((items) => {
        setBackups(items);
        setSelectedBackup(items[0]?.index);
      })
      .catch(() => setBackups([]));
  }, [showRestoreConfirm]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', accentColor);
  }, [accentColor]);

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playCompletionSound();
  };

  const handleRestore = useCallback(async () => {
    if (selectedBackup === undefined) return;
    setShowRestoreConfirm(false);
    setRestoring(true);
    try {
      const result = await api.restore(selectedBackup);
      if (result.status !== 'ok') throw new Error(result.message);
      onSuccess?.(result.message || '已从备份恢复');
      onRestore?.();
    } catch (err) {
      onError?.(errorMessage(err) || '恢复失败');
    } finally {
      setRestoring(false);
      setSelectedBackup(undefined);
    }
  }, [onSuccess, onError, onRestore, selectedBackup]);

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-customizer-title"
    >
      <button className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fade-in" onClick={onClose} aria-label="关闭主题设置" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/95 p-6 shadow-2xl shadow-black/60 animate-bounce-in">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent" />
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/15 p-3 text-blue-300">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white" id="theme-customizer-title">任务流偏好</h2>
              <p className="text-sm text-zinc-500">调整强调色、音效和本地快照恢复。</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">强调色</h3>
              <p className="text-xs text-zinc-500">用于按钮、高亮和关键进度条。</p>
            </div>
            <span className="h-8 w-8 rounded-full border border-white/20" style={{ backgroundColor: accentColor }} />
          </div>
          <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="强调色">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => setAccentColor(color.value)}
                className={`group flex items-center gap-3 rounded-2xl border p-3 text-left transition ${ accentColor === color.value ? 'border-blue-400/70 bg-blue-500/10' : 'border-white/10 bg-black/20 hover:bg-white/[0.06]' }`}
                role="radio"
                aria-checked={accentColor === color.value}
                aria-label={color.name}
              >
                <span className="h-8 w-8 rounded-full" style={{ backgroundColor: color.value }} />
                <span className="flex-1 text-sm text-zinc-300">{color.name}</span>
                {accentColor === color.value && <Check className="h-4 w-4 text-blue-300" />}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 grid gap-3 md:grid-cols-2">
          <button
            onClick={handleToggleSound}
            className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.06]"
            role="switch"
            aria-checked={soundOn}
          >
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                {soundOn ? <Volume2 className="h-4 w-4 text-blue-300" /> : <VolumeX className="h-4 w-4 text-zinc-500" />}
                完成音效
              </span>
              <span className="mt-1 block text-xs text-zinc-500">{soundOn ? '任务完成时播放提示音' : '已静音'}</span>
            </span>
            <span className={`relative h-7 w-12 rounded-full transition ${soundOn ? 'bg-blue-500' : 'bg-zinc-700'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${soundOn ? 'left-6' : 'left-1'}`} />
            </span>
          </button>

          <button
            onClick={() => setShowRestoreConfirm(true)}
            disabled={restoring}
            className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.06] disabled:opacity-50"
          >
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <RotateCcw className="h-4 w-4 text-orange-300" />
                数据恢复
              </span>
              <span className="mt-1 block text-xs text-zinc-500">{restoring ? '正在恢复...' : '从最近 8 次快照中恢复'}</span>
            </span>
            <span className="rounded-full border border-orange-300/30 bg-orange-500/10 px-3 py-1 text-xs text-orange-200">快照</span>
          </button>
        </section>

        <p className="mt-5 text-center text-xs text-zinc-600">设置会自动保存到本机。</p>
      </div>

      {showRestoreConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="restore-title">
          <button className="absolute inset-0 bg-black/70" onClick={() => { setShowRestoreConfirm(false); setSelectedBackup(undefined); }} aria-label="关闭恢复确认" />
          <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black/60 animate-bounce-in">
            <h3 className="text-lg font-semibold text-white" id="restore-title">恢复 TaskFlow 快照</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">恢复会覆盖当前任务流数据。建议先在设置页导出完整备份。</p>

            <div className="mt-4 max-h-56 space-y-2 overflow-y-auto">
              {backups.length > 0 ? backups.map((backup) => (
                <label
                  key={backup.index}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${ selectedBackup === backup.index ? 'border-blue-400/70 bg-blue-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]' }`}
                >
                  <input
                    type="radio"
                    name="backup"
                    checked={selectedBackup === backup.index}
                    onChange={() => setSelectedBackup(backup.index)}
                    className="accent-blue-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-zinc-200">{backup.index === 0 ? '最近快照' : `快照 #${backup.index}`}</span>
                    <span className="text-xs text-zinc-500">{formatBackupTime(backup.modified)}</span>
                  </span>
                </label>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-zinc-500">暂无可恢复快照</div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowRestoreConfirm(false); setSelectedBackup(undefined); }}
                className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10"
              >
                取消
              </button>
              <button
                onClick={handleRestore}
                disabled={backups.length === 0 || selectedBackup === undefined}
                className="rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                确认恢复
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
