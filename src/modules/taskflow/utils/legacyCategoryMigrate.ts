/** Map pre-cat-* category ids (QuickAdd/templates used to emit these). */
export const LEGACY_CATEGORY_IDS: Record<string, string> = {
  work: 'cat-work',
  personal: 'cat-personal',
  study: 'cat-study',
  health: 'cat-health',
}

/** Rewrite legacy category ids; returns same array reference when unchanged. */
export function migrateLegacyTaskCategories<T extends { category: string }>(tasks: T[]): T[] {
  let changed = false
  const next = tasks.map((task) => {
    const mapped = LEGACY_CATEGORY_IDS[task.category]
    if (!mapped) return task
    changed = true
    return { ...task, category: mapped }
  })
  return changed ? next : tasks
}
