/**
 * Generate a unique ID string.
 * Uses timestamp + random for collision resistance.
 * Format: base36(timestamp) + base36(random), ~13 chars.
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
