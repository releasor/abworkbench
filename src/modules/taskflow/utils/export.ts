import type { Task, Category, Status, Priority } from '../types'
import { STATUS_CONFIG, PRIORITY_CONFIG, ALL_STATUSES } from '../types'
import { todayStr } from '../dateUtils';
import { countCompleted } from './subtaskUtils';
import { errorMessage } from '../../../utils/errors';

export function exportToJSON(tasks: Task[], categories: Category[]): void {
  const data = { tasks, categories, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `taskflow-export-${formatDate()}.json`);
}

export function exportToCSV(tasks: Task[], categories: Category[]): void {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const headers = ['ID', '标题', '描述', '状态', '优先级', '分类', '标签', '截止日期', '创建时间', '完成时间'];
  const rows = tasks.map((t) => {
    const cat = categoryMap.get(t.category);
    return [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.description.replace(/"/g, '""')}"`,
      STATUS_CONFIG[t.status].label,
      PRIORITY_CONFIG[t.priority].label,
      cat?.name || t.category,
      t.tags.join(';'),
      t.dueDate ? t.dueDate.slice(0, 10) : '',
      t.createdAt.slice(0, 10),
      t.completedAt ? t.completedAt.slice(0, 10) : '',
    ].join(',');
  });

  const csv = '﻿' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `taskflow-export-${formatDate()}.csv`);
}

export function importFromJSON(file: File): Promise<{ tasks: Task[]; categories: Category[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.tasks || !Array.isArray(data.tasks)) {
          throw new Error('Invalid format: missing tasks array');
        }
        resolve({ tasks: data.tasks, categories: data.categories || [] });
      } catch (err) {
        reject(new Error('无法解析JSON文件: ' + errorMessage(err)));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}

export function importFromCSV(file: File): Promise<{ tasks: Partial<Task>[]; categories: Category[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter((line) => line.trim());
        if (lines.length < 2) {
          throw new Error('CSV文件为空或格式不正确');
        }

        const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
        const tasks: Partial<Task>[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const task: Partial<Task> = {};

          for (let h = 0; h < headers.length; h++) {
            const header = headers[h];
            const value = values[h]?.trim().replace(/"/g, '') || '';
            switch (header) {
              case 'ID':
                task.id = value;
                break;
              case '标题':
                task.title = value;
                break;
              case '描述':
                task.description = value;
                break;
              case '状态':
                task.status = STATUS_FROM_LABEL[value] || 'todo';
                break;
              case '优先级':
                task.priority = PRIORITY_FROM_LABEL[value] || 'medium';
                break;
              case '分类':
                task.category = value || undefined;
                break;
              case '标签':
                task.tags = value ? value.split(';').filter(Boolean) : [];
                break;
              case '截止日期':
                task.dueDate = value ? new Date(value).toISOString() : null;
                break;
              case '创建时间':
                task.createdAt = value ? new Date(value).toISOString() : undefined;
                break;
              case '完成时间':
                task.completedAt = value ? new Date(value).toISOString() : null;
                break;
            }
          }

          if (task.title) {
            tasks.push(task);
          }
        }

        resolve({ tasks, categories: [] });
      } catch (err) {
        reject(new Error('无法解析CSV文件: ' + errorMessage(err)));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file, 'utf-8');
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

const STATUS_FROM_LABEL: Record<string, Status> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([key, cfg]) => [cfg.label, key as Status])
);

const PRIORITY_FROM_LABEL: Record<string, Priority> = Object.fromEntries(
  Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => [cfg.label, key as Priority])
);

interface TrelloList {
  id: string;
  name: string;
}

interface TrelloCard {
  name: string;
  desc?: string;
  idList: string;
  labels?: Array<{ name?: string }>;
  due?: string | null;
}

interface TrelloExport {
  lists?: TrelloList[];
  cards?: TrelloCard[];
}

export function importFromTrello(file: File): Promise<{ tasks: Partial<Task>[]; categories: Category[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as TrelloExport;
        const tasks: Partial<Task>[] = [];

        // Trello export format
        if (data.cards && Array.isArray(data.cards)) {
          const lists = data.lists || [];
          const listMap = new Map<string, string>(lists.map((list) => [list.id, list.name]));

          for (let c = 0; c < data.cards.length; c++) {
            const card = data.cards[c];
            const listName = listMap.get(card.idList) || '';
            tasks.push({
              title: card.name,
              description: card.desc || '',
              status: getTrelloStatus(listName),
              tags: card.labels?.flatMap((label) => label.name ? [label.name] : []) || [],
              dueDate: card.due ? new Date(card.due).toISOString() : null,
            });
          }
        }

        resolve({ tasks, categories: [] });
      } catch (err) {
        reject(new Error('无法解析Trello文件: ' + errorMessage(err)));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}

function getTrelloStatus(listName: string): Status {
  const name = listName.toLowerCase();
  if (name.includes('done') || name.includes('完成') || name.includes('已完成')) return 'done';
  if (name.includes('progress') || name.includes('进行') || name.includes('处理中')) return 'in-progress';
  if (name.includes('review') || name.includes('审核') || name.includes('待审核')) return 'review';
  return 'todo';
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDate(): string {
  return todayStr();
}

function formatDateTimeCN(): string {
  const iso = new Date().toISOString();
  const y = iso.slice(0, 4);
  const m = iso.slice(5, 7);
  const d = iso.slice(8, 10);
  const t = iso.slice(11, 19);
  return `${y}年${m}月${d}日 ${t}`;
}

export function exportToHTML(tasks: Task[], categories: Category[]): void {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>TaskFlow 导出</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #3b82f6; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .status { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; }
    .priority { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; }
    .tag { display: inline-block; padding: 1px 6px; background: #e5e7eb; border-radius: 4px; font-size: 11px; margin-right: 4px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>TaskFlow 任务导出</h1>
  <p>导出时间: ${formatDateTimeCN()}</p>
  <p>共 ${tasks.length} 个任务</p>
  <table>
    <thead>
      <tr>
        <th>标题</th>
        <th>状态</th>
        <th>优先级</th>
        <th>分类</th>
        <th>截止日期</th>
      </tr>
    </thead>
    <tbody>
      ${tasks.map((task) => {
        const cat = categoryMap.get(task.category);
        return `
        <tr>
          <td>
            <strong>${escapeHTML(task.title)}</strong>
            ${task.description ? `<br><small style="color: #6b7280">${escapeHTML(task.description)}</small>` : ''}
            ${task.tags.length > 0 ? `<br>${task.tags.map((t) => `<span class="tag">#${escapeHTML(t)}</span>`).join('')}` : ''}
          </td>
          <td><span class="status">${STATUS_CONFIG[task.status].label}</span></td>
          <td><span class="priority">${PRIORITY_CONFIG[task.priority].label}</span></td>
          <td>${escapeHTML(cat?.name || task.category)}</td>
          <td>${task.dueDate ? task.dueDate.slice(0, 10) : '-'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  <div class="no-print" style="margin-top: 20px; text-align: center;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
      打印 / 导出 PDF
    </button>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, `taskflow-export-${formatDate()}.html`);
}

export function exportToMarkdown(tasks: Task[], categories: Category[]): void {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  let md = `# TaskFlow 任务导出\n\n`;
  md += `导出时间: ${formatDateTimeCN()}\n`;
  md += `共 ${tasks.length} 个任务\n\n`;

  // Group by status
  const grouped = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, [] as Task[]])
  ) as Record<Status, Task[]>;

  for (let i = 0; i < tasks.length; i++) {
    grouped[tasks[i].status].push(tasks[i]);
  }

  for (const [status, statusTasks] of Object.entries(grouped)) {
    if (statusTasks.length === 0) continue;
    md += `## ${STATUS_CONFIG[status as Status].label} (${statusTasks.length})\n\n`;

    for (let t = 0; t < statusTasks.length; t++) {
      const task = statusTasks[t];
      const cat = categoryMap.get(task.category);
      const checkbox = task.status === 'done' ? '[x]' : '[ ]';
      md += `- ${checkbox} **${task.title}**\n`;
      if (task.description) {
        md += `  ${task.description}\n`;
      }
      if (task.dueDate) {
        md += `  📅 截止: ${task.dueDate.slice(0, 10)}\n`;
      }
      if (cat) {
        md += `  📁 分类: ${cat.name}\n`;
      }
      if (task.priority !== 'medium') {
        md += `  🎯 优先级: ${PRIORITY_CONFIG[task.priority].label}\n`;
      }
      if (task.tags.length > 0) {
        md += `  🏷️ 标签: ${task.tags.map((t) => `#${t}`).join(' ')}\n`;
      }
      if (task.subtasks && task.subtasks.length > 0) {
        const completedSubtasks = countCompleted(task.subtasks);
        md += `  📋 子任务 (${completedSubtasks}/${task.subtasks.length}):\n`;
        for (let s = 0; s < task.subtasks.length; s++) {
          const sub = task.subtasks[s];
          md += `    - [${sub.completed ? 'x' : ' '}] ${sub.title}\n`;
        }
      }
      if (task.dependencies && task.dependencies.length > 0) {
        md += `  🔗 依赖关系: ${task.dependencies.length}个\n`;
      }
      if (task.recurring) {
        md += `  🔄 重复: ${task.recurring.frequency} (每${task.recurring.interval}${task.recurring.frequency === 'daily' ? '天' : task.recurring.frequency === 'weekly' ? '周' : task.recurring.frequency === 'monthly' ? '月' : '年'})\n`;
      }
      md += `\n`;
    }
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, `taskflow-export-${formatDate()}.md`);
}

export function exportToDetailedCSV(tasks: Task[], categories: Category[]): void {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const headers = ['ID', '标题', '描述', '状态', '优先级', '分类', '标签', '截止日期', '创建时间', '完成时间', '预计时长(分钟)', '子任务数', '备注数'];
  const rows = tasks.map((t) => {
    const cat = categoryMap.get(t.category);
    return [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.description.replace(/"/g, '""')}"`,
      STATUS_CONFIG[t.status].label,
      PRIORITY_CONFIG[t.priority].label,
      cat?.name || t.category,
      t.tags.join(';'),
      t.dueDate ? t.dueDate.slice(0, 10) : '',
      t.createdAt.slice(0, 10),
      t.completedAt ? t.completedAt.slice(0, 10) : '',
      t.estimatedMinutes || '',
      t.subtasks?.length || 0,
      t.notes?.length || 0,
    ].join(',');
  });

  // Add BOM for Excel compatibility
  const csv = '﻿' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `taskflow-export-${formatDate()}.csv`);
}

export function exportToICS(tasks: Task[]): void {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaskFlow//TaskFlow Export//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task.dueDate) continue;

    const dateStr = task.dueDate.replace(/[-:]/g, '').split('.')[0] + 'Z';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${task.id}@taskflow`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${dateStr}`);
    lines.push(`DTEND:${dateStr}`);
    lines.push(`SUMMARY:${escapeICS(task.title)}`);
    if (task.description) {
      lines.push(`DESCRIPTION:${escapeICS(task.description)}`);
    }
    lines.push(`STATUS:${task.status === 'done' ? 'COMPLETED' : 'TENTATIVE'}`);
    if (task.tags.length > 0) {
      lines.push(`CATEGORIES:${task.tags.join(',')}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  downloadBlob(blob, `taskflow-export-${formatDate()}.ics`);
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
