import { useMemo } from 'react';
import { useTaskStore } from './useTaskStore';
import type { Category } from '../types';

/**
 * Shared hook that provides a memoized category ID → Category map.
 * Eliminates duplicate `useMemo(() => new Map(categories.map(...)), [categories])` patterns.
 */
export function useCategoryMap(): Map<string, Category> {
  const categories = useTaskStore((state) => state.categories);
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
}
