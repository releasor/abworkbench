import { useState, useCallback, useRef } from 'react';
import type { ToastAction } from '../components/Toast';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  action?: ToastAction;
  duration?: number;
  id: number;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counterRef = useRef(0);

  const show = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', action?: ToastAction, duration?: number) => {
    counterRef.current += 1;
    setToast({ message, type, action, duration, id: counterRef.current });
  }, []);

  const success = useCallback((message: string, action?: ToastAction) => show(message, 'success', action), [show]);
  const error = useCallback((message: string) => show(message, 'error'), [show]);
  const info = useCallback((message: string, action?: ToastAction) => show(message, 'info', action), [show]);

  const clear = useCallback(() => setToast(null), []);

  return { toast, show, success, error, info, clear };
}
