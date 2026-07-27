/**
 * Type-safe localStorage access with automatic error handling.
 *
 * All reads return a default value on any failure (missing key, corrupted JSON,
 * quota exceeded, SSR without localStorage). All writes silently ignore failures.
 */

/** Read a JSON-parsed value from localStorage. Returns `defaultValue` on any failure. */
export function safeGet<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return defaultValue
    return JSON.parse(raw) as T
  } catch {
    return defaultValue
  }
}

/** Write a value to localStorage as JSON. Silently ignores failures. */
export function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage failures (quota exceeded, private browsing, SSR)
  }
}

/** Read a raw string from localStorage. Returns `defaultValue` when key is missing. */
export function safeGetString(key: string, defaultValue: string): string {
  try {
    const stored = localStorage.getItem(key)
    return stored ?? defaultValue
  } catch {
    return defaultValue
  }
}

/** Write a raw string to localStorage (no JSON serialization). Silently ignores failures. */
export function safeSetString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore storage failures
  }
}

/** Read a boolean stored as `'true'`/`'false'` string. Returns `defaultValue` when key is missing. */
export function getBool(key: string, defaultValue: boolean): boolean {
  try {
    const stored = localStorage.getItem(key)
    if (stored === null) return defaultValue
    return stored === 'true'
  } catch {
    return defaultValue
  }
}

/** Write a boolean as `'true'`/`'false'` string. */
export function setBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Ignore storage failures
  }
}
