import path from 'node:path'

export function getIsolatedCachePaths(userDataPath: string) {
  return {
    cacheDir: path.join(userDataPath, 'Cache'),
    sessionDataDir: path.join(userDataPath, 'SessionData'),
  }
}
