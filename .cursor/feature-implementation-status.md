# 功能落地进度（相对 feature-suggestions.md）

> 本轮已实现的主路径。P3 探索项以轻量可用切片为主，未做完整云同步/插件市场。

## 已交付

### 时间约定
- `beijingTime.ts`：一律按 **Asia/Shanghai** 切日 / 写 `dueAt`
- `dateUtils` / `useToday` 切日与今日午夜基于北京时间

### P0
1. **提醒中心**页（侧边栏「提醒」）— 筛选、创建、重复、批量延后、转任务、完成滚动 `repeat`
2. **StatsPage** 对齐 TaskFlow 任务映射
3. **生产力趋势** `offlineAdapter` 真实聚合
4. **活跃番茄共享** `activePomodoro` + 主番茄写入；Mini 显示剩余/暂停
5. **命令** start-pomodoro 派发开始事件；今日作战板 / 晚间复盘命令

### P1（主切片）
6. **今日作战板 / 晚间复盘** `DailyBriefModal`
7. **全能 Inbox** QuickCapture：任务/笔记/提醒/支出/健康 + 剪贴板预填 + 历史
8. **Mini 番茄倒计时**
9. Header 到期提醒跳转「提醒中心」
10. 启动器：`nav-reminders` / `daily-brief`

### 支撑
- `reminders.ts` + 测试、`productivityTrends.ts`、`captureHistory.ts`、`templates.ts`、`taskNoteLinks.ts`（链接 API 已备）

## 未做满 / 后续
- 时间块拖拽日历、完整 WebDAV、剪贴板历史启动器、摸鱼阅读 2.0 全套、插件化
- TaskFlow/Focus 番茄与主番茄「互斥接管」仍可加深（主番茄 + Mini 已通）
- `templates.ts` / `taskNoteLinks` UI 入口未全部挂满命令面板

验证：`lint` / `typecheck` / `npm test`（约 136+）
