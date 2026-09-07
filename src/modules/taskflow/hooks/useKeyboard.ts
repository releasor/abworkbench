import { useEffect, useRef } from 'react';

interface KeyboardShortcuts {
  onCloseModal?: () => void;
  onClearSelection?: () => void;
}

/** Escape-only modal/selection cleanup for TaskFlow (page shortcuts removed). */
export function useKeyboard(shortcuts: KeyboardShortcuts) {
  const ref = useRef(shortcuts);

  useEffect(() => {
    ref.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const { onCloseModal, onClearSelection } = ref.current;
      onCloseModal?.();
      onClearSelection?.();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
