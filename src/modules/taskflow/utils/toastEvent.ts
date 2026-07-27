type ToastType = 'success' | 'error' | 'info';
interface ToastAction { label: string; onClick: () => void }
type Listener = (message: string, type: ToastType, action?: ToastAction) => void;

let listener: Listener | null = null;

export function onToast(fn: Listener) {
  listener = fn;
  return () => { listener = null; };
}

export function showToast(message: string, type: ToastType = 'info', action?: ToastAction) {
  if (listener) listener(message, type, action);
}
