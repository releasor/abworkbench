import { useMemo, useCallback } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { FilterPresets } from './FilterPresets';
import { DateRangePicker } from './DateRangePicker';
import { CategorySelect } from './CategorySelect';
import type { Status, Priority } from '../types'
import { ALL_STATUSES, ALL_PRIORITIES } from '../types'
import { playClickSound } from '../utils/sound';
import { todayStr as getTodayStr, nextDateStr, nextDateStrN, prevDateStrN, dayOfWeek } from '../dateUtils';
import { hasActiveFilters as checkActiveFilters, countActiveFilters } from '../utils/searchMatch';
import { Icon } from './Icon';
import { useTranslation } from '../../../i18n';
import { PRIORITY_LABEL_KEYS, STATUS_LABEL_KEYS } from '../i18n';

export function FilterBar() {
  const { t, tWith } = useTranslation();
  const filters = useTaskStore((state) => state.filters);
  const setFilters = useTaskStore((state) => state.setFilters);
  const categories = useTaskStore((state) => state.categories);
  const tasks = useTaskStore((state) => state.tasks);

  const { todayCount, overdueCount, dueSoonCount, weekCount, pinnedCount, archivedCount, noDueDateCount, quickWinCount, staleCount, todayStr, tomorrowStr, weekEndStr, statusCounts, priorityCounts, categoryCounts, energyCounts, allTags } = useMemo(() => {
    const todayStr = getTodayStr();
    const tomorrowStr = nextDateStr(todayStr);
    // End of week (Sunday) — pure string arithmetic via Sakamoto's day-of-week
    const curDow = dayOfWeek(+todayStr.slice(0, 4), +todayStr.slice(5, 7), +todayStr.slice(8, 10));
    const daysToSunday = (7 - curDow) % 7;
    const weekEndStr = daysToSunday === 0 ? todayStr : nextDateStrN(todayStr, daysToSunday);
    const staleThreshold = prevDateStrN(todayStr, 7);
    let today = 0;
    let overdue = 0;
    let dueSoon = 0;
    let week = 0;
    let pinned = 0;
    let archived = 0;
    let noDueDate = 0;
    let quickWin = 0;
    let stale = 0;
    const statusCounts: Record<Status, number> = { todo: 0, 'in-progress': 0, review: 0, done: 0 };
    const priorityCounts: Record<Priority, number> = { low: 0, medium: 0, high: 0, urgent: 0 };
    const categoryCounts = new Map<string, number>();
    const energyCounts: Record<'low' | 'medium' | 'high', number> = { low: 0, medium: 0, high: 0 };
    const tagSet = new Set<string>();
    for (const t of tasks) {
      statusCounts[t.status]++;
      priorityCounts[t.priority]++;
      categoryCounts.set(t.category, (categoryCounts.get(t.category) || 0) + 1);
      if (t.energyLevel) energyCounts[t.energyLevel]++;
      for (const tag of t.tags || []) tagSet.add(tag);
      if (t.pinned) pinned++;
      if (t.archived) archived++;
      if (t.status !== 'done' && (t.priority === 'high' || t.priority === 'urgent') && t.estimatedMinutes !== null && t.estimatedMinutes <= 30) quickWin++;
      if (t.status !== 'done' && t.updatedAt.slice(0, 10) < staleThreshold) stale++;
      if (!t.dueDate) { noDueDate++; continue; }
      if (t.status === 'done') continue;
      const dueDateStr = t.dueDate.slice(0, 10);
      if (dueDateStr === todayStr) today++;
      if (dueDateStr < todayStr) overdue++;
      if (dueDateStr >= todayStr && dueDateStr <= tomorrowStr) dueSoon++;
      if (dueDateStr <= weekEndStr) week++;
    }
    const allTags = [...tagSet].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    return { todayCount: today, overdueCount: overdue, dueSoonCount: dueSoon, weekCount: week, pinnedCount: pinned, archivedCount: archived, noDueDateCount: noDueDate, quickWinCount: quickWin, staleCount: stale, todayStr, tomorrowStr, weekEndStr, statusCounts, priorityCounts, categoryCounts, energyCounts, allTags };
  }, [tasks]);

  const activeFilterCount = countActiveFilters(filters);
  const hasActiveFilters = checkActiveFilters(filters);

  const setTodayFilter = useCallback(() => {
    setFilters({ dueDateFrom: todayStr, dueDateTo: todayStr });
    playClickSound();
  }, [setFilters, todayStr]);

  const setWeekFilter = useCallback(() => {
    setFilters({ dueDateFrom: todayStr, dueDateTo: weekEndStr });
    playClickSound();
  }, [setFilters, todayStr, weekEndStr]);

  const setOverdueFilter = useCallback(() => {
    setFilters({ dueDateFrom: '', dueDateTo: todayStr, status: 'all' });
    playClickSound();
  }, [setFilters, todayStr]);

  const setDueSoonFilter = useCallback(() => {
    setFilters({ dueDateFrom: todayStr, dueDateTo: tomorrowStr });
    playClickSound();
  }, [setFilters, todayStr, tomorrowStr]);

  return (
    <div className="flex flex-wrap items-center gap-3 py-3" role="toolbar" aria-label={t('taskflow.filter.toolbar')}>
      {/* Quick Filters */}
      <div className="flex items-center gap-2" role="group" aria-label={t('taskflow.filter.quick')}>
        <button
          onClick={setTodayFilter}
          className="flex items-center gap-1 rounded-2xl bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-500/15 dark:text-blue-300"
          aria-label={`${t('taskflow.filter.today')} ${todayCount}`}
        >
          {t('taskflow.filter.today')}
          {todayCount > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-200 dark:bg-blue-800 rounded-full text-[10px]">{todayCount}</span>
          )}
        </button>
        <button
          onClick={setWeekFilter}
          className="flex items-center gap-1 rounded-2xl bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-500/15 dark:text-indigo-300"
          aria-label={`${t('taskflow.filter.thisWeek')} ${weekCount}`}
        >
          {t('taskflow.filter.thisWeek')}
          {weekCount > 0 && (
            <span className="px-1.5 py-0.5 bg-indigo-200 dark:bg-indigo-800 rounded-full text-[10px]">{weekCount}</span>
          )}
        </button>
        <button
          onClick={setOverdueFilter}
          className="flex items-center gap-1 rounded-2xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-500/15 dark:text-red-300"
          aria-label={`${t('taskflow.filter.overdue')} ${overdueCount}`}
        >
          {t('taskflow.filter.overdue')}
          {overdueCount > 0 && (
            <span className="px-1.5 py-0.5 bg-red-200 dark:bg-red-800 rounded-full text-[10px]">{overdueCount}</span>
          )}
        </button>
        <button
          onClick={setDueSoonFilter}
          className="flex items-center gap-1 rounded-2xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 shadow-sm transition hover:bg-amber-500/15 dark:text-amber-300"
          aria-label={`${t('taskflow.filter.dueSoon')} ${dueSoonCount}`}
        >
          {t('taskflow.filter.dueSoon')}
          {dueSoonCount > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800 rounded-full text-[10px]">{dueSoonCount}</span>
          )}
        </button>
      </div>

      {/* No Due Date Filter */}
      <button
        onClick={() => { setFilters({ noDueDate: !filters.noDueDate }); playClickSound(); }}
        className={`flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${
          filters.noDueDate
            ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
        aria-label={t('taskflow.filter.noDueDate')}
        aria-pressed={filters.noDueDate}
      >
        <Icon name="calendar" className="w-3 h-3" />
        {t('taskflow.filter.noDueDate')}
        {noDueDateCount > 0 && (
          <span className="px-1.5 py-0.5 bg-gray-300 dark:bg-gray-700 rounded-full text-[10px]">{noDueDateCount}</span>
        )}
      </button>

      {/* Status Filter */}
      <select
        value={filters.status}
        onChange={(e) => setFilters({ status: e.target.value as Status | 'all' })}
        className="rounded-2xl border border-gray-200 bg-white/70 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm outline-none transition hover:border-blue-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200"
        aria-label={tWith('taskflow.filter.allStatus', tasks.length)}
      >
        <option value="all">{tWith('taskflow.filter.allStatus', tasks.length)}</option>
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>{t(STATUS_LABEL_KEYS[s])} ({statusCounts[s]})</option>
        ))}
      </select>

      {/* Priority Filter */}
      <select
        value={filters.priority}
        onChange={(e) => setFilters({ priority: e.target.value as Priority | 'all' })}
        className="rounded-2xl border border-gray-200 bg-white/70 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm outline-none transition hover:border-blue-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200"
        aria-label={tWith('taskflow.filter.allPriority', tasks.length)}
      >
        <option value="all">{tWith('taskflow.filter.allPriority', tasks.length)}</option>
        {ALL_PRIORITIES.map((p) => (
          <option key={p} value={p}>{t(PRIORITY_LABEL_KEYS[p])} ({priorityCounts[p]})</option>
        ))}
      </select>

      <CategorySelect
        categories={categories}
        value={filters.category}
        onChange={(category) => setFilters({ category })}
        counts={categoryCounts}
        allLabel={tWith('taskflow.filter.allCategory', tasks.length)}
        allowAll
        label={tWith('taskflow.filter.allCategory', tasks.length)}
      />

      {/* Energy Level Filter */}
      <select
        value={filters.energyLevel}
        onChange={(e) => setFilters({ energyLevel: e.target.value as 'all' | 'low' | 'medium' | 'high' })}
        className="rounded-2xl border border-gray-200 bg-white/70 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm outline-none transition hover:border-blue-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200"
        aria-label={t('taskflow.filter.energyLevel')}
      >
        <option value="all">{t('taskflow.filter.allEnergy')}</option>
        <option value="high">{t('taskflow.filter.highEnergy')} ({energyCounts.high})</option>
        <option value="medium">{t('taskflow.filter.mediumEnergy')} ({energyCounts.medium})</option>
        <option value="low">{t('taskflow.filter.lowEnergy')} ({energyCounts.low})</option>
      </select>

      {/* Tags Filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('taskflow.filter.tags')}:</span>
          <div className="flex flex-wrap gap-1">
            {allTags.slice(0, 8).map((tag) => {
              const active = filters.tags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => {
                    const next = active
                      ? filters.tags.filter((t) => t !== tag)
                      : [...filters.tags, tag];
                    setFilters({ tags: next });
                    playClickSound();
                  }}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                  }`}
                  aria-pressed={active}
                  aria-label={`${active ? '取消筛选' : '筛选'}标签: ${tag}`}
                >
                  #{tag}
                </button>
              );
            })}
            {allTags.length > 8 && (
              <span className="text-[11px] text-gray-400">+{allTags.length - 8}</span>
            )}
          </div>
        </div>
      )}

      <DateRangePicker
        from={filters.dueDateFrom}
        to={filters.dueDateTo}
        onChange={setFilters}
      />

      {/* Tracking Filter */}
      <button
        onClick={() => { setFilters({ tracking: filters.tracking === 'active' ? 'all' : 'active' }); playClickSound(); }}
        className={`flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${
          filters.tracking === 'active'
            ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-purple-50 dark:hover:bg-purple-900/30'
        }`}
        aria-label={t('taskflow.filter.tracking')}
        aria-pressed={filters.tracking === 'active'}
      >
        <Icon name="clock" className="w-3 h-3" />
        {t('taskflow.filter.tracking')}
      </button>

      {/* Pinned Filter */}
      <button
        onClick={() => { setFilters({ pinned: !filters.pinned }); playClickSound(); }}
        className={`flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${
          filters.pinned
            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-amber-900/30'
        }`}
        aria-label={t('taskflow.filter.pinned')}
        aria-pressed={filters.pinned}
      >
        <Icon name="pin" className="w-3 h-3" filled />
        {t('taskflow.filter.pinned')}
        {pinnedCount > 0 && (
          <span className="px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800 rounded-full text-[10px]">{pinnedCount}</span>
        )}
      </button>

      {/* Archived Filter */}
      <button
        onClick={() => { setFilters({ archived: !filters.archived }); playClickSound(); }}
        className={`flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${
          filters.archived
            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-amber-900/30'
        }`}
        aria-label={t('taskflow.filter.archived')}
        aria-pressed={filters.archived}
      >
        <Icon name="archive" className="w-3 h-3" />
        {t('taskflow.filter.archived')}
        {archivedCount > 0 && (
          <span className="px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800 rounded-full text-[10px]">{archivedCount}</span>
        )}
      </button>

      {/* Quick Win Filter */}
      <button
        onClick={() => { setFilters({ quickWin: !filters.quickWin }); playClickSound(); }}
        className={`flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${
          filters.quickWin
            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/30'
        }`}
        aria-label={t('taskflow.filter.quickWin')}
        aria-pressed={filters.quickWin}
      >
        <Icon name="lightning" className="w-3 h-3" />
        {t('taskflow.filter.quickWin')}
        {quickWinCount > 0 && (
          <span className="px-1.5 py-0.5 bg-green-200 dark:bg-green-800 rounded-full text-[10px]">{quickWinCount}</span>
        )}
      </button>

      {/* Stale Filter */}
      <button
        onClick={() => { setFilters({ stale: !filters.stale }); playClickSound(); }}
        className={`flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${
          filters.stale
            ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-900/30'
        }`}
        aria-label={t('taskflow.filter.stale')}
        aria-pressed={filters.stale}
      >
        <Icon name="hourglass-bottom" className="w-3 h-3" />
        {t('taskflow.filter.stale')}
        {staleCount > 0 && (
          <span className="px-1.5 py-0.5 bg-orange-200 dark:bg-orange-800 rounded-full text-[10px]">{staleCount}</span>
        )}
      </button>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={() => {
            setFilters({
              status: 'all',
              priority: 'all',
              category: 'all',
              dueDateFrom: '',
              dueDateTo: '',
              tracking: 'all',
              pinned: false,
              archived: false,
              noDueDate: false,
              quickWin: false,
              stale: false,
              energyLevel: 'all',
              tags: [],
            });
            playClickSound();
          }}
          className="flex items-center gap-1 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-600 shadow-sm transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
          aria-label={t('taskflow.filter.clear')}
        >
          {t('taskflow.filter.clear')}
          <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 rounded-full">{activeFilterCount}</span>
        </button>
      )}

      {/* Filter Presets */}
      <div className="ml-auto">
        <FilterPresets />
      </div>
    </div>
  );
}
