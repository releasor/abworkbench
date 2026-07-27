# 精简项目空间 + 工作台增强

> 去掉两个"硬塞"的独立页面，把有价值的功能归入已有的 TaskFlow 和 Dashboard。

## 核心判断

- **ProjectSpacesPage** = Category 换了马甲，用一整个页面做了一个本该是侧边面板的事
- **WorkbenchHubPage** = 8 个只读仪表盘卡片堆在一起，没有一个能深入操作
- 两者都不配占 sidebar 一个独立入口

## 变更清单

### 1. 删除独立页面

删除以下文件：
- `src/components/projects/ProjectSpacesPage.tsx`
- `src/components/projects/projectWorkspace.ts`
- `src/components/projects/projectWorkspace.test.mjs`
- `src/components/workflow/WorkbenchHubPage.tsx`
- `src/utils/workbenchHub.ts`
- `src/utils/workbenchHub.test.mjs`

### 2. 清理导航

- `src/navigation/pages.ts`: 从 `APP_PAGES` 移除 `'projects'` 和 `'workflow'`，从 `PAGE_TITLE_KEYS` 移除对应条目
- `src/components/layout/Sidebar.tsx`: 从 `menuItems` 移除 projects 和 workflow
- `src/App.tsx`: 移除 ProjectSpacesPage 和 WorkbenchHubPage 的 lazy import 和渲染
- `src/i18n/locales/zh.ts`: 移除 `'page.projects'` 和 `'page.workflow'`
- `src/i18n/locales/en.ts`: 同上

### 3. 清理 QuickCaptureModal 对 workbenchHub 的依赖

`src/components/common/QuickCaptureModal.tsx`:
- 移除 `import { buildSmartInboxItem } from '../../utils/workbenchHub'`
- 移除 submit 里写 inbox 的那行：`appendLocalCollection('abworkbench-inbox-items', ...)`

### 4. Dashboard 添加项目概览卡片

`src/components/dashboard/DashboardPage.tsx` 添加一个紧凑的"项目概览"区域：
- 取 top 4 个 category（按活跃任务数排序）
- 每个显示：名称、活跃任务数、完成进度条、下一步任务标题
- 底部"查看全部"按钮跳转 TaskFlow（list view + groupBy:category）

数据源：已有的 `taskFlowTasks` + `useTaskStore` 的 `categories`。

### 5. TaskFlow ListView 的 groupBy:category 已经存在

ListView 已有 `groupBy: 'category'` 支持（`src/modules/taskflow/components/ListView.tsx`），无需额外开发。用户在 TaskFlow 的列表视图里就能按项目分组查看。

## 不做的事

- 不给 KanbanBoard 加 groupBy:category（看板按状态分列是核心交互，按项目分会破坏）
- 不在 Dashboard 加周复盘/时间账本/知识图谱（这些数据 Dashboard 已经通过其他形式展示）
- 不新建任何工具函数或 store slice

## 验证

- TypeScript 编译通过
- ESLint 通过
- 生产构建通过
- 侧边栏不再显示"项目空间"和"工作台增强"
- Dashboard 显示项目概览卡片
- QuickCaptureModal 正常工作（不再写 inbox）
