import { useState, useCallback } from 'react';
import { safeGet, safeSet } from '../../../utils/safeLocalStorage';

const MAX_HISTORY = 5;
const STORAGE_KEY = 'taskflow-search-history';

function loadHistory(): string[] {
  return safeGet<string[]>(STORAGE_KEY, []);
}

function saveHistory(history: string[]): void {
  safeSet(STORAGE_KEY, history);
}

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(loadHistory);

  const addToHistory = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setHistory((prev) => {
      const filtered = prev.filter((h) => h !== trimmed);
      const newHistory = [trimmed, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(newHistory);
      return newHistory;
    });
  }, []);

  const removeFromHistory = useCallback((query: string) => {
    setHistory((prev) => {
      const newHistory = prev.filter((h) => h !== query);
      saveHistory(newHistory);
      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  return { history, addToHistory, removeFromHistory, clearHistory };
}
