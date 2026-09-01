import fs from 'node:fs'
import path from 'node:path'

export function getWorkbenchLocalPath(userDataDir: string): string {
  return path.join(userDataDir, 'workbench-local.json')
}

/** Read `workbench-local.json`; missing or corrupt → null. */
export function loadWorkbenchLocal(userDataDir: string): unknown | null {
  const file = getWorkbenchLocalPath(userDataDir)
  try {
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown
  } catch {
    return null
  }
}

/** Persist JSON pretty-printed (tmp + rename). Best-effort on I/O errors. */
export function saveWorkbenchLocal(userDataDir: string, data: unknown): void {
  const file = getWorkbenchLocalPath(userDataDir)
  const tmp = `${file}.tmp`
  try {
    fs.mkdirSync(userDataDir, { recursive: true })
    fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
    try {
      fs.renameSync(tmp, file)
    } catch {
      // Windows: rename fails if destination exists
      fs.copyFileSync(tmp, file)
      fs.unlinkSync(tmp)
    }
  } catch {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
    } catch {
      // ignore cleanup errors
    }
  }
}
