import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let cached: HTMLElement[] | null = null;

    const getFocusable = () => {
      if (!cached) cached = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      return cached;
    };

    // Invalidate cache when DOM structure changes
    const observer = new MutationObserver(() => { cached = null; });
    observer.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'tabindex'] });

    // Auto-focus first element (slight delay to let children render)
    const frame = requestAnimationFrame(() => {
      const items = getFocusable();
      if (items.length > 0) items[0].focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return ref;
}
