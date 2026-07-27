import { showToast } from './toastEvent';

/**
 * Execute an async function with automatic error handling via toast.
 * Eliminates duplicated try/catch + showToast patterns across components.
 *
 * @param fn - The async function to execute
 * @param errorMsg - The user-facing error message to show on failure
 * @returns The result of fn(), or undefined if it threw
 */
export async function withErrorToast<T>(fn: () => Promise<T>, errorMsg: string): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    console.error(`${errorMsg}:`, err);
    showToast(errorMsg, 'error');
    return undefined;
  }
}
