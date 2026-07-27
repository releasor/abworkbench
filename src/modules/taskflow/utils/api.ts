import { offlineApi } from './offlineAdapter'

/**
 * Desktop-only TaskFlow data gateway.
 *
 * The app no longer starts a localhost REST service. Keeping this single export
 * preserves existing component imports while routing every operation to the
 * local desktop adapter.
 */
export const api = offlineApi
export const autoApi = offlineApi

export function isOfflineMode(): boolean {
  return false
}

export async function checkOffline(): Promise<boolean> {
  return false
}
