import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export type MineradioAccountRecord = {
  id: string
  provider: 'netease' | 'qq' | 'kugou' | 'qishui' | 'spotify' | string
  userId?: string
  nickname?: string
  avatarUrl?: string
  vipLevel?: string | number | null
  product?: string
  loggedIn: boolean
  playbackReady?: boolean
  updatedAt: number
  raw?: Record<string, unknown>
}

type AccountsDb = {
  version: 1
  accounts: MineradioAccountRecord[]
}

function accountsFile(): string {
  const dir = path.join(app.getPath('userData'), 'mineradio')
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'accounts.json')
}

function readDb(): AccountsDb {
  try {
    const raw = fs.readFileSync(accountsFile(), 'utf8')
    const parsed = JSON.parse(raw) as AccountsDb
    if (!parsed || !Array.isArray(parsed.accounts)) return { version: 1, accounts: [] }
    return { version: 1, accounts: parsed.accounts }
  } catch {
    return { version: 1, accounts: [] }
  }
}

function writeDb(db: AccountsDb): AccountsDb {
  fs.writeFileSync(accountsFile(), JSON.stringify(db, null, 2), 'utf8')
  return db
}

function accountId(provider: string, userId?: string): string {
  return `${provider}:${userId || 'default'}`
}

export function listMineradioAccounts(): MineradioAccountRecord[] {
  return readDb().accounts.slice().sort((a, b) => b.updatedAt - a.updatedAt)
}

export function upsertMineradioAccount(input: Record<string, unknown>): MineradioAccountRecord {
  const provider = String(input.provider || 'unknown')
  const userId = input.userId != null ? String(input.userId) : undefined
  const nickname = input.nickname != null ? String(input.nickname) : undefined
  const avatarUrl = input.avatarUrl != null ? String(input.avatarUrl) : (input.avatar != null ? String(input.avatar) : undefined)
  const id = accountId(provider, userId)
  const next: MineradioAccountRecord = {
    id,
    provider,
    userId,
    nickname,
    avatarUrl,
    vipLevel: (input.vipLevel as string | number | null | undefined) ?? null,
    product: input.product != null ? String(input.product) : undefined,
    loggedIn: input.loggedIn !== false,
    playbackReady: input.playbackReady === true || input.playbackKeyReady === true,
    updatedAt: Date.now(),
    raw: input,
  }

  const db = readDb()
  const idx = db.accounts.findIndex((item) => item.id === id || (item.provider === provider && !userId))
  if (idx >= 0) db.accounts[idx] = { ...db.accounts[idx], ...next, id }
  else db.accounts.push(next)
  writeDb(db)
  return next
}

export function removeMineradioAccount(provider: string, userId?: string): MineradioAccountRecord[] {
  const db = readDb()
  const id = accountId(provider, userId)
  db.accounts = db.accounts.filter((item) => item.id !== id && !(item.provider === provider && !userId))
  writeDb(db)
  return db.accounts
}
