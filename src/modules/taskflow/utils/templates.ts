import type { Task } from '../types'
import { safeGet, safeSet } from '../../../utils/safeLocalStorage'

export interface TaskTemplate {
  id: string;
  name: string;
  icon: string;
  task: Partial<Task>;
}

// Placeholder for template subtask timestamps — replaced with actual timestamp when template is applied
const TEMPLATE_TIMESTAMP = '2024-01-01T00:00:00.000Z'

export const DEFAULT_TEMPLATES: TaskTemplate[] = [
  {
    id: 'bug-fix',
    name: 'Bug 修复',
    icon: '🐛',
    task: {
      title: '修复: ',
      description: '问题描述:\n\n重现步骤:\n1. \n2. \n3. \n\n预期行为:\n\n实际行为:',
      priority: 'high',
      category: 'work',
      tags: ['Bug'],
      estimatedMinutes: 45,
      energyLevel: 'high',
      subtasks: [
        { id: 'sf-1', title: '复现问题', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-2', title: '定位根因', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-3', title: '编写修复', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-4', title: '验证修复', completed: false, createdAt: TEMPLATE_TIMESTAMP },
      ],
    },
  },
  {
    id: 'feature',
    name: '新功能',
    icon: '✨',
    task: {
      title: '功能: ',
      description: '功能描述:\n\n需求:\n- \n\n技术方案:\n\n验收标准:',
      priority: 'medium',
      category: 'work',
      tags: ['功能'],
      estimatedMinutes: 120,
      energyLevel: 'high',
      subtasks: [
        { id: 'sf-1', title: '需求分析', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-2', title: '技术方案', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-3', title: '编码实现', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-4', title: '自测验证', completed: false, createdAt: TEMPLATE_TIMESTAMP },
      ],
    },
  },
  {
    id: 'meeting',
    name: '会议',
    icon: '📅',
    task: {
      title: '会议: ',
      description: '会议主题:\n\n参会人员:\n\n议题:\n1. \n2. \n\n会议纪要:',
      priority: 'medium',
      category: 'work',
      tags: ['会议'],
      estimatedMinutes: 30,
      energyLevel: 'medium',
    },
  },
  {
    id: 'learning',
    name: '学习笔记',
    icon: '📚',
    task: {
      title: '学习: ',
      description: '学习目标:\n\n学习资源:\n\n笔记:\n\n总结:',
      priority: 'low',
      category: 'study',
      tags: ['学习'],
      estimatedMinutes: 60,
      energyLevel: 'medium',
    },
  },
  {
    id: 'daily',
    name: '每日任务',
    icon: '🔄',
    task: {
      title: '',
      description: '',
      priority: 'low',
      tags: ['日常'],
      estimatedMinutes: 15,
      energyLevel: 'low',
    },
  },
  {
    id: 'review',
    name: '代码审查',
    icon: '👀',
    task: {
      title: '审查: ',
      description: '审查内容:\n\n审查要点:\n- 代码质量\n- 性能\n- 安全性\n- 测试覆盖\n\n备注:',
      priority: 'medium',
      category: 'work',
      tags: ['Code Review'],
      estimatedMinutes: 30,
      energyLevel: 'medium',
    },
  },
  {
    id: 'research',
    name: '调研任务',
    icon: '🔍',
    task: {
      title: '调研: ',
      description: '调研目标:\n\n调研范围:\n\n参考资源:\n\n结论:',
      priority: 'medium',
      category: 'work',
      tags: ['调研'],
      estimatedMinutes: 90,
      energyLevel: 'medium',
    },
  },
  {
    id: 'design',
    name: '设计任务',
    icon: '🎨',
    task: {
      title: '设计: ',
      description: '设计目标:\n\n设计要求:\n\n参考案例:\n\n设计稿:',
      priority: 'medium',
      category: 'work',
      tags: ['设计'],
      estimatedMinutes: 60,
      energyLevel: 'high',
    },
  },
  {
    id: 'testing',
    name: '测试任务',
    icon: '🧪',
    task: {
      title: '测试: ',
      description: '测试目标:\n\n测试用例:\n1. \n2. \n3. \n\n测试结果:',
      priority: 'medium',
      category: 'work',
      tags: ['测试'],
      estimatedMinutes: 45,
      energyLevel: 'medium',
    },
  },
  {
    id: 'documentation',
    name: '文档编写',
    icon: '📝',
    task: {
      title: '文档: ',
      description: '文档类型:\n\n文档大纲:\n\n参考资料:\n\n完成标准:',
      priority: 'low',
      category: 'work',
      tags: ['文档'],
      estimatedMinutes: 60,
      energyLevel: 'low',
    },
  },
  {
    id: 'exercise',
    name: '运动计划',
    icon: '🏃',
    task: {
      title: '运动: ',
      description: '运动类型:\n\n运动时长:\n\n运动目标:\n\n完成情况:',
      priority: 'medium',
      category: 'health',
      tags: ['运动', '健康'],
      estimatedMinutes: 45,
      energyLevel: 'high',
    },
  },
  {
    id: 'reading',
    name: '阅读计划',
    icon: '📖',
    task: {
      title: '阅读: ',
      description: '书名:\n\n作者:\n\n阅读目标:\n\n笔记:',
      priority: 'low',
      category: 'study',
      tags: ['阅读', '学习'],
      estimatedMinutes: 30,
      energyLevel: 'low',
    },
  },
  {
    id: 'deployment',
    name: '部署任务',
    icon: '🚀',
    task: {
      title: '部署: ',
      description: '部署环境:\n\n部署步骤:\n1. \n2. \n3. \n\n回滚方案:\n\n验证清单:',
      priority: 'high',
      category: 'work',
      tags: ['部署', '运维'],
      estimatedMinutes: 30,
      energyLevel: 'high',
      subtasks: [
        { id: 'sf-1', title: '准备部署包', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-2', title: '执行部署', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-3', title: '验证服务', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-4', title: '监控告警', completed: false, createdAt: TEMPLATE_TIMESTAMP },
      ],
    },
  },
  {
    id: 'bug-report',
    name: 'Bug 报告',
    icon: '🐛',
    task: {
      title: 'Bug: ',
      description: '环境信息:\n- 浏览器:\n- 操作系统:\n- 版本:\n\n问题描述:\n\n重现步骤:\n1. \n2. \n3. \n\n预期结果:\n\n实际结果:\n\n截图/日志:',
      priority: 'high',
      category: 'work',
      tags: ['Bug', '报告'],
      estimatedMinutes: 15,
      energyLevel: 'low',
    },
  },
  {
    id: 'performance',
    name: '性能优化',
    icon: '⚡',
    task: {
      title: '优化: ',
      description: '优化目标:\n\n当前性能指标:\n\n优化方案:\n\n预期提升:\n\n验证方法:',
      priority: 'medium',
      category: 'work',
      tags: ['性能', '优化'],
      estimatedMinutes: 90,
      energyLevel: 'high',
      subtasks: [
        { id: 'sf-1', title: '性能分析', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-2', title: '瓶颈定位', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-3', title: '实施优化', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-4', title: '效果验证', completed: false, createdAt: TEMPLATE_TIMESTAMP },
      ],
    },
  },
  {
    id: 'security',
    name: '安全任务',
    icon: '🔒',
    task: {
      title: '安全: ',
      description: '安全问题:\n\n影响范围:\n\n修复方案:\n\n验证步骤:\n\n相关CVE:',
      priority: 'urgent',
      category: 'work',
      tags: ['安全'],
      estimatedMinutes: 60,
      energyLevel: 'high',
    },
  },
  {
    id: 'onboarding',
    name: '入职任务',
    icon: '👋',
    task: {
      title: '入职: ',
      description: '新员工:\n\n入职事项:\n- [ ] 开通账号\n- [ ] 配置权限\n- [ ] 熟悉文档\n- [ ] 介绍团队\n\n备注:',
      priority: 'high',
      category: 'work',
      tags: ['入职', 'HR'],
      estimatedMinutes: 120,
      energyLevel: 'medium',
    },
  },
  {
    id: 'interview',
    name: '面试准备',
    icon: '💼',
    task: {
      title: '面试: ',
      description: '候选人:\n职位:\n\n面试问题:\n1. \n2. \n3. \n\n评估要点:\n\n面试结果:',
      priority: 'medium',
      category: 'work',
      tags: ['面试', '招聘'],
      estimatedMinutes: 45,
      energyLevel: 'medium',
    },
  },
  {
    id: 'weekly-report',
    name: '周报',
    icon: '📊',
    task: {
      title: '周报',
      description: '本周完成:\n- \n\n下周计划:\n- \n\n遇到的问题:\n\n需要的支持:',
      priority: 'medium',
      category: 'work',
      tags: ['周报', '汇报'],
      estimatedMinutes: 20,
      energyLevel: 'low',
      recurring: { frequency: 'weekly', interval: 1, daysOfWeek: [5] },
    },
  },
  {
    id: 'code-review',
    name: 'PR 审查',
    icon: '🔍',
    task: {
      title: '审查 PR: ',
      description: 'PR 链接:\n\n变更内容:\n\n审查要点:\n- [ ] 代码质量\n- [ ] 测试覆盖\n- [ ] 文档更新\n- [ ] 性能影响\n\n审查意见:',
      priority: 'medium',
      category: 'work',
      tags: ['Code Review', 'PR'],
      estimatedMinutes: 25,
      energyLevel: 'medium',
    },
  },
  {
    id: 'learning-goal',
    name: '学习目标',
    icon: '🎯',
    task: {
      title: '学习: ',
      description: '学习主题:\n\n学习资源:\n- \n\n学习计划:\n- 第1周:\n- 第2周:\n- 第3周:\n\n实践项目:\n\n完成标准:',
      priority: 'medium',
      category: 'study',
      tags: ['学习', '目标'],
      estimatedMinutes: 60,
      energyLevel: 'medium',
    },
  },
  {
    id: 'shopping',
    name: '购物清单',
    icon: '🛒',
    task: {
      title: '购物: ',
      description: '购物清单:\n- [ ] \n- [ ] \n- [ ] \n\n预算:\n\n备注:',
      priority: 'low',
      category: 'personal',
      tags: ['购物'],
      estimatedMinutes: 15,
      energyLevel: 'low',
    },
  },
  {
    id: 'travel',
    name: '旅行计划',
    icon: '✈️',
    task: {
      title: '旅行: ',
      description: '目的地:\n出发日期:\n返回日期:\n\n行程安排:\n- Day 1:\n- Day 2:\n- Day 3:\n\n准备清单:\n- [ ] 机票\n- [ ] 酒店\n- [ ] 签证\n\n预算:',
      priority: 'medium',
      category: 'personal',
      tags: ['旅行'],
      estimatedMinutes: 60,
      energyLevel: 'low',
    },
  },
  {
    id: 'project-plan',
    name: '项目计划',
    icon: '📋',
    task: {
      title: '项目: ',
      description: '项目目标:\n\n项目范围:\n\n里程碑:\n- [ ] 阶段1:\n- [ ] 阶段2:\n- [ ] 阶段3:\n\n风险评估:\n\n资源需求:',
      priority: 'high',
      category: 'work',
      tags: ['项目', '计划'],
      estimatedMinutes: 90,
      energyLevel: 'high',
      subtasks: [
        { id: 'sf-1', title: '需求梳理', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-2', title: '范围界定', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-3', title: '里程碑规划', completed: false, createdAt: TEMPLATE_TIMESTAMP },
        { id: 'sf-4', title: '风险评估', completed: false, createdAt: TEMPLATE_TIMESTAMP },
      ],
    },
  },
  {
    id: 'retrospective',
    name: '回顾总结',
    icon: '🔄',
    task: {
      title: '回顾: ',
      description: '回顾周期:\n\n做得好的:\n- \n\n需要改进的:\n- \n\n行动项:\n- [ ] \n- [ ] ',
      priority: 'medium',
      category: 'work',
      tags: ['回顾', '总结'],
      estimatedMinutes: 30,
      energyLevel: 'low',
    },
  },
];

const STORAGE_KEY = 'taskflow-templates';

export function getCustomTemplates(): TaskTemplate[] {
  return safeGet<TaskTemplate[]>(STORAGE_KEY, []);
}

export function saveCustomTemplate(template: TaskTemplate): void {
  const templates = getCustomTemplates();
  templates.push(template);
  safeSet(STORAGE_KEY, templates);
}

export function deleteCustomTemplate(id: string): void {
  const templates = getCustomTemplates().filter((t) => t.id !== id);
  safeSet(STORAGE_KEY, templates);
}

export function getAllTemplates(): TaskTemplate[] {
  return [...DEFAULT_TEMPLATES, ...getCustomTemplates()];
}
