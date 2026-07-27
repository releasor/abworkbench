import { useEffect, useState } from 'react';
import { Clock3, DatabaseBackup, RefreshCw, RotateCcw } from 'lucide-react';
import { api } from '../../modules/taskflow/utils/api';
import { showToast } from '../../modules/taskflow/utils/toastEvent';

interface BackupItem {
  index: number;
  file: string;
  modified: string;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BackupCenter() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);

  const loadBackups = async () => {
    setLoading(true);
    try {
      setBackups(await api.backups());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void loadBackups());
  }, []);

  const restore = async (index: number) => {
    setRestoring(index);
    try {
      const result = await api.restore(index);
      if (result.status !== 'ok') throw new Error(result.message);
      showToast(result.message || '已恢复备份', 'success');
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      showToast((error as Error).message || '恢复失败', 'error');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <section className="mt-4 rounded-[26px] border border-blue-500/20 bg-blue-500/5 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-500/15 p-2 text-blue-300">
            <DatabaseBackup size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text">自动备份中心</h3>
            <p className="text-xs text-text-muted">任务流写入前会自动保留最近 8 次快照。</p>
          </div>
        </div>
        <button
          onClick={() => void loadBackups()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-text-muted transition hover:bg-surface-lighter disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      {backups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/40 p-4 text-center text-xs text-text-muted">
          暂无自动快照。创建、编辑或删除任务后会自动生成。
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map((backup) => (
            <div key={backup.index} className="flex items-center gap-3 rounded-2xl border border-border bg-background/55 p-3">
              <div className="rounded-xl bg-surface-lighter p-2 text-text-muted">
                <Clock3 size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">{backup.index === 0 ? '最近快照' : `快照 #${backup.index}`}</p>
                <p className="text-xs text-text-muted">{formatDate(backup.modified)}</p>
              </div>
              <button
                onClick={() => void restore(backup.index)}
                disabled={restoring !== null}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:opacity-50"
              >
                <RotateCcw size={14} />
                {restoring === backup.index ? '恢复中' : '恢复'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
