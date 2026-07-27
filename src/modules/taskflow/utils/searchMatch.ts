import { matchesSearchQuery as sharedMatchesSearchQuery } from '../fuzzySearch';
import type { FilterState } from '../types'

interface SearchableTask {
  title: string;
  description: string;
  tags: string[];
  category: string;
  status?: string;
  priority?: string;
  notes?: { content: string }[];
  subtasks?: { title: string }[];
}

interface CategoryNameMap {
  get(id: string): string | undefined;
}

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.search !== '' ||
    filters.status !== 'all' ||
    filters.priority !== 'all' ||
    filters.category !== 'all' ||
    filters.dueDateFrom !== '' ||
    filters.dueDateTo !== '' ||
    filters.tracking !== 'all' ||
    filters.pinned ||
    filters.archived ||
    filters.noDueDate ||
    filters.quickWin ||
    filters.stale ||
    filters.energyLevel !== 'all' ||
    (filters.tags?.length ?? 0) > 0
  );
}

/** Count active non-search filters (search has its own separate UI). */
export function countActiveFilters(filters: FilterState): number {
  let count = 0;
  if (filters.status !== 'all') count++;
  if (filters.priority !== 'all') count++;
  if (filters.category !== 'all') count++;
  if (filters.dueDateFrom !== '') count++;
  if (filters.dueDateTo !== '') count++;
  if (filters.tracking !== 'all') count++;
  if (filters.pinned) count++;
  if (filters.archived) count++;
  if (filters.noDueDate) count++;
  if (filters.quickWin) count++;
  if (filters.stale) count++;
  if (filters.energyLevel !== 'all') count++;
  if ((filters.tags?.length ?? 0) > 0) count++;
  return count;
}

/**
 * Check if a task matches a search query.
 * Delegates to shared matchesSearchQuery for the actual matching logic.
 */
export function matchesSearchQuery(
  task: SearchableTask,
  query: string,
  categoryNameMap: CategoryNameMap
): boolean {
  return sharedMatchesSearchQuery(task, query, categoryNameMap);
}

/**
 * Build a category ID -> lowercase name map for search lookups.
 */
export function buildCategoryNameMap(categories: { id: string; name: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < categories.length; i++) {
    map.set(categories[i].id, categories[i].name.toLowerCase());
  }
  return map;
}
