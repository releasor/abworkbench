import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const trapRef = useFocusTrap<HTMLDivElement>();
  useEscapeKey(onCancel);

  const isDanger = variant === 'danger';
  const VariantIcon = isDanger ? AlertTriangle : CheckCircle2;

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      <button className="absolute inset-0 modal-veil liquid-glass-veil" onClick={onCancel} aria-label="关闭确认弹窗" />
      <div className="liquid-glass-panel modal-panel-cinematic relative w-full max-w-md overflow-hidden p-6 animate-bounce-in">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="flex items-start gap-4">
          <div className={`rounded-2xl p-3 ${isDanger ? 'bg-danger/15 text-danger' : 'bg-primary/15 text-primary'}`}>
            <VariantIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-text" id="confirm-title">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted" id="confirm-message">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-full p-2 text-text-muted transition hover:bg-white/10 hover:text-text"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-7 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition ${ isDanger ? 'bg-red-500 shadow-red-500/20 hover:bg-red-400' : 'bg-blue-500 shadow-blue-500/20 hover:bg-blue-400' }`}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
