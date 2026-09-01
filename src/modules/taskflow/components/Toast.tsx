import { useEffect, useState, useRef } from 'react';
import { Icon } from './Icon';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  action?: ToastAction;
  onClose: () => void;
  duration?: number;
}

const BG_COLORS: Record<string, string> = {
  success: 'bg-success text-white',
  error: 'bg-danger text-white',
  info: 'bg-surface-lighter border border-primary/35 text-text',
};

const ICON_NAMES: Record<string, string> = {
  success: 'check',
  error: 'close',
  info: 'info',
};

export function Toast({ message, type = 'info', action, onClose, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(true);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout>;
    const timer = setTimeout(() => {
      setVisible(false);
      fadeTimer = setTimeout(() => onCloseRef.current(), 300);
    }, duration);
    return () => {
      clearTimeout(timer);
      clearTimeout(fadeTimer);
    };
  }, [duration]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${BG_COLORS[type]} transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <Icon name={ICON_NAMES[type]} className="w-4 h-4" />
      <span className="text-sm font-medium">{message}</span>
      {action && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setVisible(false);
            setTimeout(() => {
              action.onClick();
              onCloseRef.current();
            }, 100);
          }}
          className="ml-1 px-2.5 py-1 rounded-md text-xs font-bold bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
        >
          {action.label}
        </button>
      )}
      <button
        onClick={() => { setVisible(false); setTimeout(() => onCloseRef.current(), 300); }}
        className={`ml-0.5 p-0.5 rounded transition-colors ${type === 'info' ? 'hover:bg-primary/10' : 'hover:bg-white/20'}`}
        aria-label="关闭"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}
