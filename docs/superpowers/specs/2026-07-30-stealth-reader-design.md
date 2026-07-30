# 摸鱼阅读（Stealth Reader）设计

**Goal:** 在启动器中提供「摸鱼阅读」：透明无边框悬浮窗阅读本地小说或通用网页抓取正文；可调样式；老板键默认隐藏，可选伪装。

## 决策摘要

| 项 | 选择 |
|----|------|
| 内容来源 | 首版同时支持本地目录 + 通用 URL 抓取 |
| 网上策略 | 粘贴目录/章节 URL，主进程启发式抽取（无站点适配器） |
| 入口 | 启动器命令「摸鱼阅读」（主窗口不新增侧栏页） |
| 左键 | `auto`：有进度则接着读；无进度则进书架 |
| 右键 | 「进入书架」→ `library` |
| 窗口 | 同一 `?reader=1` 悬浮窗，模式 `reading` / `library` |
| 老板键 | 默认立刻隐藏；设置可开伪装（同窗假工作界面） |
| 设置 | 设置页新增「阅读」：透明度、字号、颜色、老板键、伪装、默认目录 |

## 架构

### 窗口与入口

- `electron/readerWindow.ts`：创建/显示/隐藏/置顶/透明/拖动 bounds；`skipTaskbar`；加载 `index.html?reader=1`
- 启动器：`LAUNCHER_COMMANDS` 增加摸鱼阅读；左键 IPC `desktop:open-reader` `{ mode: 'auto' }`；右键菜单「进入书架」`{ mode: 'library' }`
- `src/App.tsx`：`reader=1` 时渲染 `StealthReaderApp`，不走主壳
- 设置「阅读」页读写 `reader-settings.json`（主进程），与 `launcher-settings` 同风格；老板键走 `globalShortcut` + shortcuts catalog（`electron: true`）

### 模块划分

| 模块 | 职责 |
|------|------|
| `electron/readerWindow.ts` | 窗体生命周期、老板键注册、拖动/opacity 相关 IPC |
| `electron/readerLibrary.ts` | 书架与进度 JSON；选目录；列 `.txt`；分章；读章节文本 |
| `electron/readerScrape.ts` | `fetch` HTML；抽目录链接、正文、下一章；可选章节缓存 |
| `electron/readerSettings.ts` | 阅读样式与老板键/伪装持久化 |
| `src/modules/stealthReader/` | 书架 UI、阅读 UI、伪装面板、窗内快捷调节 |
| `src/components/settings/ReaderSettings.tsx` | 设置页「阅读」 |

### 数据模型

持久化文件：`%userData%/reader-library.json`（书架 + 进度）、`%userData%/reader-settings.json`（样式与热键）。章节网页缓存目录：`%userData%/reader-cache/`。

```
Book {
  id, title,
  source: 'local' | 'web',
  path?: string,           // local .txt
  catalogUrl?: string,
  chapterUrl?: string,     // 当前/入口章节
  updatedAt
}

Progress {
  bookId, chapterIndex, offset, updatedAt
}

ReaderSettings {
  opacity, fontSize, fontColor,
  bossKey, disguiseEnabled,
  novelDir?, windowBounds?
}
```

- `auto` 模式：若存在有效 `Progress` 且对应 `Book` 仍可读 → `reading`；否则 `library`
- 阅读中节流写回 `Progress`

### 本地小说

1. 书架「选择目录」→ 主进程文件夹对话框；可写入 `novelDir`
2. 扫描深度有限的 `.txt`（可复用/扩展现有 `scanDirectory` 思路）
3. 分章：匹配常见标题行（`第…章`、`Chapter N`、全角数字章名等）；若无任何章标题匹配，则整文件作为单章
4. IPC：`list-books` / `get-chapter(bookId, index)`；按章切片返回，大文件不全量进渲染进程

### 通用 URL 抓取

1. 书架粘贴目录页或章节页 URL
2. 主进程请求；启发式：
   - 正文：常见容器 id/class（`content`、`chapter`、`article`）或最大文本块
   - 目录：同域章节链接列表
   - 下一章：文内「下一章」类链接
3. 成功入库；章节可落盘缓存便于续读
4. 失败：明确错误（超时、空正文、非 HTML），保留 URL 可重试；**不做**站点专用适配器（后续可选）

### 阅读交互

- 无边框、透明底、alwaysOnTop；顶部窄拖动区（可 hover 显隐）
- 窗内或设置：透明度、字号、字体颜色
- 滚轮滚动；←/→ 或空格翻章；Esc → 等同老板键当前策略
- 位置写入 `windowBounds`

### 老板键与伪装

- 默认：热键 → `readerWin.hide()`（不销毁；进度已存）
- `disguiseEnabled`：热键切换伪装面板 ↔ 正文（假文档/代码静态 UI）；再按恢复
- 热键冲突：注册失败时设置页提示改键

## 数据流（摘要）

```
启动器左键 auto
  → main openReader(auto)
  → 读 Progress+Book
  → show readerWin (reading | library)
  → renderer 拉章节 / 渲染书架

粘贴 URL
  → scrape IPC
  → 写 Book (+ cache)
  → 进入 reading
```

## 错误处理

| 情况 | 行为 |
|------|------|
| 本地文件缺失/读失败 | Toast，回书架 |
| 抓取超时/空正文/非 HTML | 提示原因，可改 URL 重试 |
| 老板键注册失败 | 设置页错误提示 |
| 进度指向失效书籍 | 视为无进度，进书架 |

## 测试范围（首版）

- 单元：分章规则；抽取逻辑用 HTML fixture
- 单元：`auto` vs `library` 入口判定（有/无进度、失效进度）
- 手动：透明窗、拖动、样式、老板键隐藏、伪装开关、启动器左键/右键

## 非目标（首版不做）

- EPUB / 多格式精排
- 站点专用适配器与批量搜索爬站
- 云同步、多开阅读窗
- 主窗口侧栏「摸鱼阅读」页面

## IPC 草案（命名可微调）

- `desktop:open-reader` `{ mode: 'auto' | 'library' | 'reading', bookId? }`
- `desktop:reader-window-control`（hide / set-bounds / set-opacity）
- `desktop:reader-list-books` / `desktop:reader-upsert-book` / `desktop:reader-get-chapter`
- `desktop:reader-pick-directory` / `desktop:reader-scrape-url`
- `desktop:get/set-reader-settings`
- 主→渲染：`reader-shown`（带 mode）
