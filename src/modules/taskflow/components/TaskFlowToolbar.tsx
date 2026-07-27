import clsx from 'clsx'
import {
  BarChart3,
  BookOpen,
  Calendar,
  Clock,
  FileText,
  LayoutGrid,
  List,
  Plus,
} from 'lucide-react'
import type { ViewMode } from '../types'
import { useTranslation } from '../../../i18n'
import type { TranslationKey } from '../../../i18n'

interface TaskFlowToolbarProps {
  viewMode: ViewMode
  showStats: boolean
  showTimeline: boolean
  showDailyReview: boolean
  showWeeklyReport: boolean
  onViewModeChange: (viewMode: ViewMode) => void
  onToggleStats: () => void
  onToggleTimeline: () => void
  onToggleDailyReview: () => void
  onToggleWeeklyReport: () => void
  onCreateTask: () => void
}

const viewModeOptions = [
  { id: 'board' as ViewMode, labelKey: 'taskflow.view.board' as TranslationKey, icon: LayoutGrid },
  { id: 'list' as ViewMode, labelKey: 'taskflow.view.list' as TranslationKey, icon: List },
  { id: 'calendar' as ViewMode, labelKey: 'taskflow.view.calendar' as TranslationKey, icon: Calendar },
]

export function TaskFlowToolbar({
  viewMode,
  showStats,
  showTimeline,
  showDailyReview,
  showWeeklyReport,
  onViewModeChange,
  onToggleStats,
  onToggleTimeline,
  onToggleDailyReview,
  onToggleWeeklyReport,
  onCreateTask,
}: TaskFlowToolbarProps) {
  const { t } = useTranslation()
  const utilityActions = [
    { active: showStats, onClick: onToggleStats, icon: BarChart3, label: t('taskflow.statsPanel') },
    { active: showTimeline, onClick: onToggleTimeline, icon: Clock, label: t('taskflow.activityTimeline') },
    { active: showDailyReview, onClick: onToggleDailyReview, icon: BookOpen, label: t('taskflow.dailyReview') },
    { active: showWeeklyReport, onClick: onToggleWeeklyReport, icon: FileText, label: t('taskflow.weeklyReport') },
  ]

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-border bg-background/55 p-2 shadow-inner shadow-black/5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-2xl border border-border bg-surface/80 p-1 shadow-lg shadow-black/5" role="tablist" aria-label="视图模式">
          {viewModeOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => onViewModeChange(option.id)}
              role="tab"
              aria-selected={viewMode === option.id}
              aria-label={t(option.labelKey)}
              className={clsx(
                'flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-all',
                viewMode === option.id
                  ? 'bg-primary text-white shadow-lg shadow-primary/25'
                  : 'text-text-muted hover:bg-surface-lighter hover:text-text'
              )}
            >
              <option.icon size={14} />
              {t(option.labelKey)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface/60 p-1">
          {utilityActions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              aria-pressed={action.active}
              className={clsx(
                'grid h-10 w-10 place-items-center rounded-xl text-text-muted transition-all hover:bg-surface-lighter hover:text-text',
                action.active && 'bg-primary/15 text-primary ring-1 ring-primary/25'
              )}
              title={action.label}
              aria-label={action.label}
            >
              <action.icon size={17} />
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onCreateTask}
        className="flex h-12 items-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-white shadow-xl shadow-primary/25 transition-all hover:-translate-y-0.5 hover:bg-primary-dark"
      >
        <Plus size={18} />
        {t('taskflow.newTask')}
      </button>
    </div>
  )
}
