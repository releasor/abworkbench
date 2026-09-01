export type HotlistItem = {
  rank: number
  title: string
  url: string
  hot?: string
}

export type HotlistBoard = {
  id: string
  title: string
  subtitle?: string
  link?: string
  updateTime: string
  fromCache: boolean
  items: HotlistItem[]
  error?: string
  loading?: boolean
}

export type HotlistPlatform = {
  id: string
  title: string
  subtitle?: string
}
