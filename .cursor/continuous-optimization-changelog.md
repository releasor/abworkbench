# Abworkbench 持续优化变更说明

> 工作区未提交改动的有效优化 / 新功能清单。  
> 仅记录已落地且可感知的改动；未完成项单独列出，避免把「计划」当成「已交付」。  
> 验证基线：`npm run lint` / `npm run typecheck` / `npm test`（136 通过）。

---

## 〇、Mineradio 嵌入 Tab（最新）

**落地**：
- 侧栏新增 **Mineradio** 页（快捷键 Ctrl+8；设置改为 Ctrl+9）
- Electron 把 Mineradio **打进** `vendor/mineradio`（`npm run vendor:mineradio`），安装包 extraResources 一并带上；登录 cookie 写到 userData，不依赖旁边的 `Mineradio-main` 源码目录
- 嵌入模式关闭登录彩蛋拦截；登录账号写入 `userData/mineradio/accounts.json`
- 嵌入 UI 圆角对齐 Abworkbench（panel 24 / card 16）
- 页面用全屏 iframe 加载 `http://127.0.0.1:<port>/?embedded=1`，并隐藏 Mineradio 自带标题栏
- 启动器 / 命令面板可跳转该页

**如何确认**：桌面端打开侧栏「Mineradio」。删掉 `Mineradio-main` 后只要还留着 `vendor/mineradio`（或已安装的 extraResources），Tab 仍可用；扫码登录不再要求彩蛋。

---

## 一、日期正确性修复（高价值）

### 1. 日期按日历日切分（避免 UTC 字符串切日前缀）

**问题**：多处曾用 `toISOString().slice(0,10)` 取日期前缀，与「北京时间日历日」不一致。

**落地**：
- `dateUtils.todayStr` / `formatLocalYMD` / `dayKeyFromMs` / `dayKeyFromIso` / `formatLocalDateTimeMinute`
- `useToday`、日历、统计、离线适配、快速创建、报表等改为按机器本地日历字段取值（本项目约定使用北京时间）
- 统计图 / 热力图 / 完成列表等对 ISO 时间戳用 `dayKeyFromIso` 切桶

**说明**：产品心智是「一律北京时间」，不是泛化「修东八区时区 bug」。若系统时区不是上海，后续可再钉死 `Asia/Shanghai`。

**如何确认**：北京时间早晨看「今日完成 / 今日番茄 / 习惯」是否与日历日一致。

### 2. 提醒默认到期时间不再写 UTC 时钟串

**问题**：`toISOString().slice(0,16)` 写入 `dueAt` 后按本地解析，默认「+1 小时」会偏数小时。

**落地**：`CommandPalette` / `QuickCaptureModal` 回落改用 `formatLocalDateTimeMinute`。

---

## 二、新功能 / 可感知能力

### 1. 仪表盘待办提醒卡片（新文件）

- 路径：`src/components/dashboard/DashboardReminders.tsx`
- 展示未完成提醒；完成 / +30 分；toast 可撤销；超过 5 条可「展开全部」
- 角标显示全部未完成数量（不是切片后的 5）

### 2. 启动器 / 命令面板 / 托盘：迷你窗 & 快速捕获

- 启动器命令：`open-mini`、`quick-capture`
- 命令面板同名动作；托盘增加「迷你窗」
- IPC：`desktop:open-quick-capture`（preload / `env.d.ts` 已暴露）
- 嵌入式启动器通过 `onOpenQuickCapture` 直接开主窗模态

### 3. Header 通知可点击跳转 + 可操作提醒

- 自定义提醒 → 提醒页；逾期/今日任务 → 任务流；番茄 → 番茄页；习惯 → 打卡
- **本轮**：到期提醒条目内联「完成 / +30分」，无需切页即可处理

### 4. 摸鱼阅读增强

- 查找高亮 + Enter 首击 / F3（`readingFind.ts` + 测试）
- 隐藏 / 切页时落盘进度（不只 unmount）
- 章节浏览历史 + 滚动恢复 + 工具栏撤销入口
- 选区摘录到笔记 / 复制；书架删除确认

### 5. Mini 窗提醒操作 + 主题对齐

- 下一提醒：完成 / +30 分；完成与延后均可 toast 撤销
- 番茄倒计时暂停 / 继续（`activePomodoro`）
- **本轮**：视觉改用语义 token（`bg-surface` / `text-text`），跟随主应用明暗主题

### 6. 番茄会话对齐（互斥）

- 主番茄：今日完成数从今日 session 水合；运行中 timer 可用 sessionStorage 恢复
- TaskFlow 浮动番茄 / Focus Mode：完成工作段写入主 store `addPomodoroSession`
- TaskFlow 时长设置会同步主 store 番茄时长
- Header / Mini 显示全局进行中番茄倒计时，可暂停 / 继续（真正同步到所有者计时器）
- **本轮**：`claimActivePomodoro` + 事件互斥；任一入口开始时其它入口自动暂停并提示「其它入口进行中」
- `usePomodoro` 支持 `source: taskflow | focus`；主番茄监听 foreign claim

### 7. 通知策略

- App 轮询：任务到期 + 自定义提醒到期的浏览器通知
- 习惯催促：仅 18:00 后，避免全天刷屏
- Header 同步展示到期自定义提醒摘要

### 8. 命令与宏 / TaskFlow UX

- 死宏修复；批量导入真正打开 UI；宏持久化标志补全
- 项目扫描 / 清空收件箱 toast 可「清除筛选」
- 列表 / 看板 / 矩阵 / 日历空态「新建」CTA
- 仪表盘挂载始终 `fetchTasks`；快速添加走智能解析

### 9. 撤销与数据安全

- 习惯删除 / 取消今日打卡：Ctrl+Z 或 toast 撤销
- 笔记删除可撤销；导出/复制前 flush 未保存内容
- 空笔记清理可撤销
- 桌面备份 / 清空数据纳入 `abworkbench-reminders`
- Toast API 支持可选 `duration`

### 10. 命令面板「清除已完成」

- 不再只清已废弃的 zustand `todos`
- 改为归档 TaskFlow 中 `done && !archived` 任务（并顺带清 legacy todos）
- 「快速添加」优先打开快速捕获

### 11. 提醒中心页面

- `RemindersPage`：筛选、重复滚动、批量延后、转任务、EmptyState
- 侧栏角标：逾期 / 今日数量
- 琥珀色强调卡片；逾期左边框

### 12. 今日作战板（Daily Brief）

- `DailyBriefModal`：早间 / 晚间复盘
- **本轮**：每日首次启动自动弹出一次（按北京日历日记忆）

### 13. 快速捕获多模式 Inbox

- 模式 Tab：任务 / 笔记 / 提醒 / 支出 / 健康
- 剪贴板预填；捕获历史

---

## 三、本轮前端界面专项（2026-08-17）

### A. 导航与快捷键对齐

| 改动 | 说明 |
|------|------|
| `pageReminders` = Ctrl+6 | 写入 `shortcuts/catalog.ts` |
| 天气 Ctrl+7 / 设置 Ctrl+8 | 与侧栏数字一致 |
| `App.tsx` 处理 `pageReminders` | 按键可切到提醒页 |
| 侧栏 `data-nav-page` | 支持 Focus 模式隐藏天气/笔记入口 |

### B. 设计系统

| 改动 | 说明 |
|------|------|
| `--color-background` | 明暗主题均有定义；`.bg-background` 工具类 |
| `--radius-card/panel/shell` | 16 / 24 / 32；`.rounded-card/panel/shell` |
| `drag-over` | 改用 `var(--color-primary)`，去掉旧紫色 |
| Toast | 语义色 `bg-success` / `bg-danger` / `bg-primary` |
| TaskFlow `SortDropdown` / `ProductivityTrends` | `gray-*` → `text-text` / `bg-surface-*` |

### C. 数据可信 UI

| 改动 | 说明 |
|------|------|
| 生产力趋势 | `offlineAdapter` 已接 `buildProductivityTrends`；空态说明「完成任务后显示」 |
| Stats `urgent` | 优先级卡片含紧急；不再把 urgent 折叠进 high |
| 仪表盘统计 | 默认折叠，可展开；记忆 `abworkbench-dashboard-stats-open`；dashboard 模式默认展开 |

### D. 工作区模式可见差异

- Focus：隐藏侧栏天气 / 笔记导航
- Minimal：压缩侧栏圆角 / 去掉玻璃阴影
- Dashboard：强化统计区展开

### E. 共用组件

- 新增 `EmptyState.tsx`
- 笔记可视化编辑器：`data-placeholder` + CSS `attr(data-placeholder)`

---

## 四、支撑性改动（有效但用户不一定直接点到）

| 项 | 说明 |
|----|------|
| `readingFind.ts` | 阅读查找逻辑抽出，可单测 |
| `dateUtils.test.mjs` | 本地日 / ISO 切日 / 本地 `YYYY-MM-DDTHH:mm` |
| `toastEvent` duration | 长时撤销提示不会秒关 |
| `dataHealth` / backup 测试 | 提醒键纳入健康检查与清空 |
| `productivityTrends.ts` | 离线按日聚合 completed / created / timeSpent / score |
| `activePomodoro.ts` | 跨入口共享番茄状态 |

---

## 五、明确未完成 / 勿当作已交付

以下仍是缺口，**本轮文档不宣称已修好**：

1. **包 E 剩余**：能量自动排程、项目仪表盘（时间块拖拽已落地）。
2. **命令面板 #5**：`start-pomodoro` 名实、宏打开笔记等仍可增强。

---

## 九、续作（Deep Work + 时间块拖拽，2026-08-17）

| 项 | 落地 |
|----|------|
| WorkspaceMode `deep` | 设置页可选；CSS 隐藏天气/笔记 |
| 进入 Deep Work | 开免打扰、跳转番茄、`pomodoro-start`、toast |
| 退出 Deep Work | 关免打扰 |
| 启动器/命令面板锁摸鱼 | deep 模式下过滤 stealth 命令 |
| Header「防打扰」角标 | 静默非关键提醒 |
| 时间块拖拽排程 | `timeBlockSchedule` 按日持久化；仪表盘拖拽改小时 |

验证：`typecheck` / `lint` / `test`（148 通过）。

---

## 十、视觉动效（Mineradio 借鉴 · A+B+C，2026-08-17）

| 层 | 落地 |
|----|------|
| A 底座 | `cinematic-motion.css`：弹簧缓动、多层玻璃、氛围光、Outfit 字体、页面进入 |
| A 交互 | 侧栏 `nav-item-spring`、按钮抬升光晕 |
| B 场景 | 仪表盘 stagger、命令面板 pop、Deep Work 帷幕、番茄完成 burst |
| C 特效 | 噪点 + 轻粒子；设置「电影感视觉」可关；`prefers-reduced-motion` 全停 |

主要文件：`src/styles/cinematic-motion.css`、`AmbientEffects.tsx`、`DeepWorkTransition.tsx`

---

## 六、建议自测清单（最短路径）

| 项 | 落地 |
|----|------|
| `claimActivePomodoro` / pause / resume | `activePomodoro.ts` + 单测 |
| `usePomodoro(source)` | TaskFlow / Focus 发布与监听共享状态 |
| 主番茄监听 foreign claim | 被接管时暂停并 toast |
| Header / Mini 暂停继续 | 写入共享状态，所有者计时器真正同步 |
| TaskFlow gray → 语义 token | 安全脚本 + 手工清扫；`taskflow` 内已无 `gray-*` |
| `productivityTrends` 真实数据 | `offlineAdapter` 接 `buildProductivityTrends` |
| `dateUtils` 北京日历 | todayStr / dayKeyFromIso / formatLocalDateTimeMinute |

验证：`typecheck` / `lint` / `test`（140 通过）。

---

## 六、建议自测清单（最短路径）

1. Ctrl+6 / 7 / 8 → 提醒 / 天气 / 设置。  
2. 侧栏提醒角标：有逾期时显示红色「逾期 N」。  
3. Header 通知：到期提醒点「完成」「+30分」。  
4. 有活跃番茄时 Header 显示倒计时并可暂停。  
5. 仪表盘底部「统计总览」可折叠；设置切换到「数据仪表盘模式」后默认展开。  
6. 提醒页空态 + 逾期左边框；浅色主题下输入框背景正常。  
7. TaskFlow 统计里生产力趋势：有任务完成数据时出图，无数据时「暂无数据」。  
8. Mini 窗在浅色主题下是否跟主应用一致。  
9. 每日首次打开是否弹出作战板（清 `localStorage.abworkbench-daily-brief-shown` 可复测）。  
10. 设置切到「深度工作」：应跳番茄并开始、Header 显示「防打扰」、启动器搜不到摸鱼阅读。  
11. 仪表盘时间块：拖拽任务到其它小时后刷新仍保留。

---

## 七、主要新增 / 改动文件索引

**新增**
- `src/components/dashboard/DashboardReminders.tsx`
- `src/components/dashboard/DailyBriefModal.tsx`
- `src/components/reminders/RemindersPage.tsx`
- `src/components/common/EmptyState.tsx`
- `src/modules/stealthReader/readingFind.ts` (+ test)
- `src/modules/taskflow/dateUtils.test.mjs`
- `src/utils/productivityTrends.ts`
- `src/utils/activePomodoro.ts`
- `src/utils/beijingTime.ts`
- `src/utils/reminders.ts`
- `src/utils/workspaceModeEffects.ts`
- `src/utils/timeBlockSchedule.ts`

**本轮高频改动**
- `src/index.css`、`src/App.tsx`、`src/shortcuts/catalog.ts`
- `src/components/layout/Header.tsx`、`Sidebar.tsx`
- `src/components/dashboard/DashboardPage.tsx`、`timeBlocks.ts`
- `src/components/settings/SettingsPage.tsx`
- `src/utils/workspaceModes.ts`、`src/store/index.ts`
- `src/launcher/LauncherApp.tsx`、`src/components/common/CommandPalette.tsx`
- `src/components/stats/StatsPage.tsx`
- `src/components/common/MiniWindow.tsx`
- `src/modules/taskflow/components/Toast.tsx`、`ProductivityTrends.tsx`、`SortDropdown.tsx`
- `src/i18n/locales/zh.ts`、`en.ts`
