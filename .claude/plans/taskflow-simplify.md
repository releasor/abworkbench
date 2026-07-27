# 任务流功能精简重设计

## 目标
把当前过度复杂的任务流改造成简单实用的任务管理工具。核心问题：状态切换按钮不直观、功能臃肿。

## 设计原则
- **3 个状态**：待办 → 进行中 → 已完成（去掉"审核中"）
- **状态切换一步到位**：卡片左侧直接显示状态色条，点击色条/图标即可推进
- **只保留看板 + 列表**两种视图
- **去掉复杂功能**：依赖、重复任务、时间跟踪、专注模式、每日回顾、周报、批量导入、矩阵视图、日历视图、归档视图
- **精简筛选栏**：只保留搜索 + 状态筛选 + 优先级筛选 + 清除筛选
- **精简工具栏**：只保留视图切换 + 新建任务

## 改动清单

### 1. types.ts — 简化数据模型
- `Status`: `'todo' | 'doing' | 'done'`（3 状态）
- `STATUS_CYCLE`: `todo → doing → done → todo`
- `STATUS_CONFIG`: 3 个状态的配置
- `ALL_STATUSES`: 3 个
- `STATUS_HEX_COLORS`: 3 个
- `Task` 接口：移除 `dependencies`, `recurring`, `timeEntries`, `estimatedMinutes`, `energyLevel`, `blockerReason`, `nextAction`, `linkedNoteIds` 字段
- 移除 `TaskDependency`, `RecurringPattern`, `TimeEntry` 类型
- `ViewMode`: `'board' | 'list'`（去掉 calendar/archive/matrix）
- `FilterState`: 精简，去掉 `tracking`, `noDueDate`, `quickWin`, `stale`, `energyLevel`, `tags`

### 2. TaskCard.tsx — 重做状态切换
- 左侧色条改为**可点击**，点击直接推进状态
- 移除：时间跟踪指示器、依赖指示器、精力等级、下一步行动、阻止原因、snooze 按钮、计时器按钮
- 保留：优先级标签、分类、标题、描述、截止日期、子任务进度、置顶、删除
- hover 工具栏精简为：置顶 + 删除

### 3. KanbanBoard.tsx — 3 列看板
- 从 4 列改为 3 列（待办/进行中/已完成）
- 移除：预估时间统计、跟踪时间统计、置顶计数
- 保留：拖拽、快速添加、折叠

### 4. ListView.tsx — 精简列表
- 状态列改为 3 个选项
- 移除：预计时长列、已用时长列、分组功能、紧凑模式
- 保留：排序、全选、批量操作、内联编辑

### 5. TaskFlowPage.tsx — 精简页面
- 移除：今日排程区块、统计面板、进度条区块、FocusMode、DailyReview、WeeklyReport、BulkTextImport、PomodoroTimer、Celebration、ActivityTimeline、KeyboardHelp
- 保留：hero 统计卡片（简化为 3 个）、工具栏、搜索+筛选、快速添加、主视图、TaskModal、Toast、BatchToolbar
- `REVERSE_CYCLE` 更新为 3 状态

### 6. TaskFlowToolbar.tsx — 精简工具栏
- 视图切换只保留：看板 + 列表
- 移除所有 utility 按钮（统计、时间线、日回顾、周报）
- 保留新建任务按钮

### 7. TaskFlowView.tsx — 精简视图路由
- 只保留 KanbanBoard 和 ListView
- 移除 CalendarView、ArchiveView、MatrixView 的 lazy import

### 8. FilterBar.tsx — 精简筛选
- 保留：搜索输入、状态筛选、优先级筛选、分类筛选、清除筛选按钮
- 移除：今日/本周/逾期/到期快捷按钮、无截止日期筛选、精力筛选、标签筛选、日期范围选择器、跟踪筛选、置顶筛选、归档筛选、快速胜利筛选、过期筛选、筛选预设

### 9. TaskContextMenu.tsx — 精简右键菜单
- 状态切换只显示 3 个选项
- 移除：snooze 子菜单

### 10. TaskModal.tsx — 精简编辑弹窗
- 移除：依赖管理、重复任务编辑器、时间跟踪、精力等级选择器、下一步行动输入
- 保留：标题、描述、状态、优先级、分类、标签、截止日期、子任务、备注

### 11. useTaskStore.ts — 精简 store
- 移除：`batchSnooze`, `batchDuplicate`, `batchPin`, `batchUnpin`, `batchArchive`, `batchUnarchive`, `archiveTask`, `unarchiveTask`, `duplicateTask` 中与归档相关的逻辑
- `getFilteredTasks` 精简筛选逻辑
- `moveTask` 简化（移除时间跟踪停止逻辑）

### 12. hooks/useKeyboard.ts — 精简快捷键
- 移除：focus mode、pomodoro、sound toggle、daily review、weekly report 相关快捷键

### 13. 移除/不引用的组件（不删除文件，仅不再引用）
- CalendarView, MatrixView, ArchiveView
- FocusMode, DailyReview, WeeklyReport, BulkTextImport
- PomodoroTimer, Celebration
- ActivityTimeline, KeyboardHelp
- StatsPanel, StatsChart
- ProgressBar, SortControl
- RecurringTaskEditor, TimeTracker
- FilterPresets, DateRangePicker

### 14. utils/ 精简
- `offlineAdapter.ts`: 移除 `startTime/stopTime`, `archive/unarchive`, `addDependency` 等 API
- `taskWorkflow.ts`: 精简，移除 `calculateNextDueDate`, `shouldCreateNextRecurrence`
- `summaryStats.ts`: 精简统计字段

## 不改动的文件
- `QuickAdd.tsx` — 保持不变，快速添加功能本身已经够简单
- `CategoryPill.tsx`, `CategorySelect.tsx`, `CategoryManager.tsx` — 保留
- `TagManager.tsx` — 保留
- `SubtaskList.tsx` — 保留
- `ConfirmDialog.tsx` — 保留
- `ExportImportMenu.tsx` — 保留
- `Icon.tsx`, `Toast.tsx`, `Tooltip.tsx`, `ErrorBoundary.tsx`, `Skeleton.tsx` — 保留

## 实施顺序
1. `types.ts` — 先改数据模型
2. `useTaskStore.ts` — 更新 store
3. `TaskCard.tsx` — 重做卡片
4. `KanbanBoard.tsx` — 3 列看板
5. `ListView.tsx` — 精简列表
6. `FilterBar.tsx` — 精简筛选
7. `TaskFlowToolbar.tsx` — 精简工具栏
8. `TaskFlowView.tsx` — 精简视图路由
9. `TaskFlowPage.tsx` — 精简页面
10. `TaskContextMenu.tsx` — 精简右键菜单
11. `TaskModal.tsx` — 精简弹窗
12. `offlineAdapter.ts` — 精简 API
13. `hooks/useKeyboard.ts` — 精简快捷键
14. `i18n.ts` — 清理不再使用的翻译 key

## 验证
- 看板视图：3 列正常显示，拖拽切换状态工作
- 列表视图：状态下拉只有 3 个选项
- 点击卡片左侧色条可推进状态
- 快速添加正常创建任务
- 筛选功能正常
- 编辑弹窗正常保存
