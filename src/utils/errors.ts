/**
 * Safely extract an error message from an unknown thrown value.
 * Handles Error objects, strings, and other types without crashing.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return String(err)
}
