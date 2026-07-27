import { useState, useMemo } from 'react';
import type { TaskTemplate } from '../utils/templates';
import { getAllTemplates } from '../utils/templates';
import type { Task } from '../types'
import { Icon } from './Icon';

interface TemplateSelectorProps {
  onSelect: (task: Partial<Task>) => void;
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const templates = useMemo(() => getAllTemplates(), []);

  const handleSelect = (template: TaskTemplate) => {
    onSelect(template.task);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="使用任务模板"
      >
        <Icon name="template" className="w-4 h-4" />
        使用模板
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 card p-2 shadow-lg animate-slide-in z-50 max-h-64 overflow-y-auto" role="listbox" aria-label="任务模板列表">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleSelect(template)}
              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              role="option"
              aria-selected={false}
            >
              <span aria-hidden="true">{template.icon}</span>
              <span>{template.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
