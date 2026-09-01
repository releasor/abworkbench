import { useState, useMemo, useRef } from 'react';
import { useTaskStore } from '../hooks/useTaskStore';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { useClickOutside } from '../hooks/useClickOutside';
import { ExportImportMenu } from './ExportImportMenu';
import { TagManager } from './TagManager';
import { CategoryManager } from './CategoryManager';
import { SortDropdown } from './SortDropdown';
import { CompletedTasks } from './CompletedTasks';
import { ThemeCustomizer } from './ThemeCustomizer';
import type { ViewMode, Task } from '../types'
import { matchesSearchQuery, buildCategoryNameMap, countActiveFilters } from '../utils/searchMatch';
import { Icon } from './Icon';

interface HeaderProps {
  darkMode: boolean;
  viewMode: ViewMode;
  showCompleted: boolean;
  onToggleDarkMode: () => void;
  onToggleStats: () => void;
  onToggleTimeline: () => void;
  onToggleDailyReview?: () => void;
  onToggleWeeklyReport?: () => void;
  onCreateTask: () => void;
  onChangeViewMode: (mode: ViewMode) => void;
  onToggleCompleted: (show: boolean) => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onEditTask?: (task: Task) => void;
}

export function Header({ darkMode, viewMode, showCompleted, onToggleDarkMode, onToggleStats, onToggleTimeline, onToggleDailyReview, onToggleWeeklyReport, onCreateTask, onChangeViewMode, onToggleCompleted, onSuccess, onError, onEditTask }: HeaderProps) {
  const filters = useTaskStore((state) => state.filters);
  const setFilters = useTaskStore((state) => state.setFilters);
  const tasks = useTaskStore((state) => state.tasks);
  const categories = useTaskStore((state) => state.categories);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const fetchStats = useTaskStore((state) => state.fetchStats);
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();
  const [searchFocused, setSearchFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Get all unique tags from tasks
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const task of tasks) {
      for (const tag of task.tags) {
        tagSet.add(tag);
      }
    }
    return [...tagSet];
  }, [tasks]);

  // Filter suggestions based on search query
  const suggestions = useMemo(() => {
    const query = filters.search.trim();
    if (!query) return { recent: history.slice(0, 3), tags: [], categories: [] };

    const lower = query.toLowerCase();
    const matchingTags = allTags
      .filter((tag) => tag.toLowerCase().includes(lower))
      .slice(0, 3);
    const matchingCategories = categories
      .filter((cat) => cat.name.toLowerCase().includes(lower))
      .slice(0, 2);

    return { recent: [], tags: matchingTags, categories: matchingCategories };
  }, [filters.search, history, allTags, categories]);

  const hasSuggestions = suggestions.recent.length > 0 || suggestions.tags.length > 0 || suggestions.categories.length > 0;
  const allSuggestions = useMemo(() => {
    const items: { type: 'recent' | 'tag' | 'category'; value: string }[] = [];
    for (const r of suggestions.recent) items.push({ type: 'recent', value: r });
    for (const t of suggestions.tags) items.push({ type: 'tag', value: t });
    for (const c of suggestions.categories) items.push({ type: 'category', value: c.name });
    return items;
  }, [suggestions]);

  // Close suggestions when clicking outside
  useClickOutside(searchRef, () => setShowSuggestions(false), showSuggestions);
  const pendingCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].status !== 'done') count++;
    }
    return count;
  }, [tasks]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const clearAllFilters = () => {
    setFilters({
      search: '',
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
    });
  };

  const categoryNameMap = useMemo(() => buildCategoryNameMap(categories), [categories]);
  const searchResultCount = useMemo(() => {
    const raw = filters.search.trim();
    if (!raw) return 0;
    let count = 0;
    for (const t of tasks) {
      if (matchesSearchQuery(t, raw, categoryNameMap)) count++;
    }
    return count;
  }, [filters.search, tasks, categoryNameMap]);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-lg bg-white/80 /80 border-b border-border" role="banner">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center" aria-hidden="true">
              <Icon name="clipboard" className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                TaskFlow
              </h1>
              {pendingCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full" aria-label={`${pendingCount}个待办任务`}>
                  {pendingCount}
                </span>
              )}
            </div>
          </div>

          {/* Search */}
          <div ref={searchRef} className={`relative flex-1 max-w-md transition-all duration-300 ${searchFocused ? 'max-w-lg' : ''}`} role="search" aria-label="任务搜索">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <label htmlFor="task-search" className="sr-only">搜索任务</label>
            <input
              id="task-search"
              type="text"
              placeholder="搜索... p:高 s:待办 #标签 c:分类 (Ctrl+N 新建)"
              value={filters.search}
              onChange={(e) => {
                setFilters({ search: e.target.value });
                setShowSuggestions(true);
                setSelectedSuggestionIndex(-1);
              }}
              onFocus={() => {
                setSearchFocused(true);
                setShowSuggestions(true);
              }}
              onBlur={() => {
                setSearchFocused(false);
                // Delay to allow clicking suggestions
                setTimeout(() => setShowSuggestions(false), 200);
                if (filters.search.trim()) {
                  addToHistory(filters.search);
                }
              }}
              onKeyDown={(e) => {
                if (!showSuggestions || !hasSuggestions) {
                  if (e.key === 'Enter' && filters.search.trim()) {
                    addToHistory(filters.search);
                    setShowSuggestions(false);
                  }
                  return;
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedSuggestionIndex((prev) => (prev + 1) % allSuggestions.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedSuggestionIndex((prev) => (prev <= 0 ? allSuggestions.length - 1 : prev - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < allSuggestions.length) {
                    const item = allSuggestions[selectedSuggestionIndex];
                    const searchValue = item.type === 'tag' ? `#${item.value}` : item.value;
                    setFilters({ search: searchValue });
                    addToHistory(searchValue);
                  } else if (filters.search.trim()) {
                    addToHistory(filters.search);
                  }
                  setShowSuggestions(false);
                  setSelectedSuggestionIndex(-1);
                } else if (e.key === 'Escape') {
                  setShowSuggestions(false);
                  setSelectedSuggestionIndex(-1);
                }
              }}
              className="w-full pl-10 pr-4 py-2 bg-surface-lighter border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              aria-label="搜索任务"
              aria-expanded={showSuggestions && hasSuggestions}
              aria-controls="search-suggestions"
              aria-autocomplete="list"
            />
            {filters.search && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <span className="text-[10px] px-1.5 py-0.5 bg-surface-lighter text-text-muted rounded-full" aria-live="polite">
                  {searchResultCount}
                </span>
                <button
                  onClick={() => {
                    setFilters({ search: '' });
                    setShowSuggestions(false);
                    setSelectedSuggestionIndex(-1);
                  }}
                  className="p-0.5 rounded-full hover:bg-surface-lighter transition-colors text-text-muted hover:text-text"
                  aria-label="清除搜索"
                >
                  <Icon name="close" className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Search Suggestions */}
            {showSuggestions && hasSuggestions && (
              <div
                id="search-suggestions"
                className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-border z-50 overflow-hidden"
                role="listbox"
                aria-label="搜索建议"
              >
                {suggestions.recent.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs text-text-muted flex items-center justify-between">
                      <span>最近搜索</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          clearHistory();
                        }}
                        className="text-xs text-text-muted hover:text-text"
                        aria-label="清除搜索历史"
                      >
                        清除
                      </button>
                    </div>
                    {suggestions.recent.map((item, i) => (
                      <button
                        key={item}
                        className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 group ${selectedSuggestionIndex === i ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-surface-lighter '}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFilters({ search: item });
                          addToHistory(item);
                          setShowSuggestions(false);
                        }}
                        role="option"
                        aria-selected={false}
                      >
                        <Icon name="clock" className="w-4 h-4 text-text-muted flex-shrink-0" />
                        <span className="flex-1 truncate">{item}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromHistory(item);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-lighter rounded"
                          aria-label={`移除搜索记录: ${item}`}
                        >
                          <Icon name="close" className="w-3 h-3 text-text-muted" />
                        </button>
                      </button>
                    ))}
                  </div>
                )}

                {suggestions.tags.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs text-text-muted">
                      标签
                    </div>
                    {suggestions.tags.map((tag, i) => (
                      <button
                        key={tag}
                        className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 ${selectedSuggestionIndex === suggestions.recent.length + i ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-surface-lighter '}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFilters({ search: `#${tag}` });
                          setShowSuggestions(false);
                        }}
                        role="option"
                        aria-selected={false}
                      >
                        <span className="text-xs px-1.5 py-0.5 bg-surface-lighter text-text-muted rounded">
                          #{tag}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {suggestions.categories.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs text-text-muted">
                      分类
                    </div>
                    {suggestions.categories.map((cat, i) => (
                      <button
                        key={cat.id}
                        className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 ${selectedSuggestionIndex === suggestions.recent.length + suggestions.tags.length + i ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-surface-lighter '}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFilters({ search: cat.name });
                          setShowSuggestions(false);
                        }}
                        role="option"
                        aria-selected={false}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} aria-hidden="true" />
                        <span className="text-sm text-text-muted">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="hidden sm:flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors flex-shrink-0"
              title="点击清除所有筛选条件"
              aria-label={`当前有${activeFilterCount}个筛选条件生效，点击清除`}
            >
              <Icon name="filter" className="w-3 h-3" />
              {activeFilterCount}个筛选
              <Icon name="close" className="w-3 h-3" />
            </button>
          )}

          {/* Actions */}
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0" role="toolbar" aria-label="视图和操作">
            {/* View Mode Toggle - Hidden on mobile */}
            <div className="hidden sm:flex items-center bg-surface-lighter rounded-lg p-0.5" role="group" aria-label="视图切换">
              <button
                onClick={() => onChangeViewMode('board')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'board' ? 'bg-primary/15 text-primary shadow-sm' : 'hover:bg-surface-lighter '}`}
                title="看板视图"
                aria-label="切换到看板视图"
                aria-pressed={viewMode === 'board'}
              >
                <Icon name="board" className="w-4 h-4" />
              </button>
              <button
                onClick={() => onChangeViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-primary/15 text-primary shadow-sm' : 'hover:bg-surface-lighter '}`}
                title="列表视图"
                aria-label="切换到列表视图"
                aria-pressed={viewMode === 'list'}
              >
                <Icon name="list-lines" className="w-4 h-4" />
              </button>
              <button
                onClick={() => onChangeViewMode('calendar')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-primary/15 text-primary shadow-sm' : 'hover:bg-surface-lighter '}`}
                title="日历视图"
                aria-label="切换到日历视图"
                aria-pressed={viewMode === 'calendar'}
              >
                <Icon name="calendar" className="w-4 h-4" />
              </button>
              <button
                onClick={() => onChangeViewMode('archive')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'archive' ? 'bg-primary/15 text-primary shadow-sm' : 'hover:bg-surface-lighter '}`}
                title="归档视图"
                aria-label="切换到归档视图"
                aria-pressed={viewMode === 'archive'}
              >
                <Icon name="archive" className="w-4 h-4" />
              </button>
              <button
                onClick={() => onChangeViewMode('matrix')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'matrix' ? 'bg-primary/15 text-primary shadow-sm' : 'hover:bg-surface-lighter '}`}
                title="四象限视图"
                aria-label="切换到四象限视图"
                aria-pressed={viewMode === 'matrix'}
              >
                <Icon name="grid" className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onCreateTask}
              className="btn btn-primary flex items-center gap-1 sm:gap-2 ml-1 sm:ml-2"
              aria-label="新建任务"
            >
              <Icon name="plus" className="w-4 h-4" />
              <span className="hidden sm:inline">新建任务</span>
            </button>

            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-0.5">
              <ExportImportMenu onSuccess={onSuccess} onError={onError} />
              <SortDropdown />
              <button
                onClick={() => setShowTagManager(true)}
                className="btn btn-ghost p-2"
                title="标签管理"
                aria-label="打开标签管理"
              >
                <Icon name="tag" className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowCategoryManager(true)}
                className="btn btn-ghost p-2"
                title="分类管理"
                aria-label="打开分类管理"
              >
                <Icon name="folder" className="w-5 h-5" />
              </button>
              <button
                onClick={onToggleTimeline}
                className="btn btn-ghost p-2"
                title="活动时间线"
                aria-label="查看活动时间线"
              >
                <Icon name="clock" className="w-5 h-5" />
              </button>
              {onToggleDailyReview && (
                <button
                  onClick={onToggleDailyReview}
                  className="btn btn-ghost p-2"
                  title="每日回顾 (Ctrl+R)"
                  aria-label="查看每日回顾"
                >
                  <Icon name="shield" className="w-5 h-5" />
                </button>
              )}
              {onToggleWeeklyReport && (
                <button
                  onClick={onToggleWeeklyReport}
                  className="btn btn-ghost p-2"
                  title="周报"
                  aria-label="查看周报"
                >
                  <Icon name="document-report" className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => onToggleCompleted(true)}
                className="btn btn-ghost p-2"
                title="已完成任务 (Ctrl+E)"
                aria-label="查看已完成任务"
              >
                <Icon name="check-circle" className="w-5 h-5" />
              </button>
              <button
                onClick={onToggleStats}
                className="btn btn-ghost p-2"
                title="统计面板 (Ctrl+/)"
                aria-label="切换统计面板"
              >
                <Icon name="chart" className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowThemeCustomizer(true)}
                className="btn btn-ghost p-2"
                title="主题设置"
                aria-label="打开主题设置"
              >
                <Icon name="paint-brush" className="w-5 h-5" />
              </button>
              <button
                onClick={onToggleDarkMode}
                className="btn btn-ghost p-2"
                title={darkMode ? '亮色模式 (Ctrl+D)' : '暗色模式 (Ctrl+D)'}
                aria-label={darkMode ? '切换到亮色模式' : '切换到暗色模式'}
              >
                {darkMode ? (
                  <Icon name="sun" className="w-5 h-5" />
                ) : (
                  <Icon name="moon" className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden btn btn-ghost p-2"
              title="菜单"
              aria-label="打开移动菜单"
              aria-expanded={showMobileMenu}
            >
              <Icon name="menu" className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      {showTagManager && <TagManager onClose={() => setShowTagManager(false)} />}
      {showCategoryManager && <CategoryManager onClose={() => setShowCategoryManager(false)} />}
      {showCompleted && (
        <CompletedTasks
          onClose={() => onToggleCompleted(false)}
          onEditTask={onEditTask || (() => {})}
        />
      )}
      {showThemeCustomizer && (
        <ThemeCustomizer
          onClose={() => setShowThemeCustomizer(false)}
          onSuccess={onSuccess}
          onError={onError}
          onRestore={() => { fetchTasks(); fetchStats(); }}
        />
      )}

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="md:hidden border-t border-border py-2" role="navigation" aria-label="移动菜单">
          <div className="flex flex-wrap gap-2 px-4">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-surface-lighter rounded-lg p-0.5 w-full" role="group" aria-label="视图切换">
              <button
                onClick={() => { onChangeViewMode('board'); setShowMobileMenu(false); }}
                className={`flex-1 p-2 rounded-md transition-colors ${viewMode === 'board' ? 'bg-primary/15 text-primary shadow-sm' : 'hover:bg-surface-lighter '}`}
                aria-label="看板视图"
                aria-pressed={viewMode === 'board'}
              >
                看板
              </button>
              <button
                onClick={() => { onChangeViewMode('list'); setShowMobileMenu(false); }}
                className={`flex-1 p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-primary/15 text-primary shadow-sm' : 'hover:bg-surface-lighter '}`}
                aria-label="列表视图"
                aria-pressed={viewMode === 'list'}
              >
                列表
              </button>
              <button
                onClick={() => { onChangeViewMode('calendar'); setShowMobileMenu(false); }}
                className={`flex-1 p-2 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-primary/15 text-primary shadow-sm' : 'hover:bg-surface-lighter '}`}
                aria-label="日历视图"
                aria-pressed={viewMode === 'calendar'}
              >
                日历
              </button>
              <button
                onClick={() => { onChangeViewMode('archive'); setShowMobileMenu(false); }}
                className={`flex-1 p-2 rounded-md transition-colors ${viewMode === 'archive' ? 'bg-primary/15 text-primary shadow-sm' : 'hover:bg-surface-lighter '}`}
                aria-label="归档视图"
                aria-pressed={viewMode === 'archive'}
              >
                归档
              </button>
              <button
                onClick={() => { onChangeViewMode('matrix'); setShowMobileMenu(false); }}
                className={`flex-1 p-2 rounded-md transition-colors ${viewMode === 'matrix' ? 'bg-primary/15 text-primary shadow-sm' : 'hover:bg-surface-lighter '}`}
                aria-label="四象限视图"
                aria-pressed={viewMode === 'matrix'}
              >
                四象限
              </button>
            </div>

            {/* Actions */}
            <button
              onClick={() => { setShowTagManager(true); setShowMobileMenu(false); }}
              className="btn btn-secondary flex-1 text-sm"
              aria-label="打开标签管理"
            >
              标签管理
            </button>
            <button
              onClick={() => { setShowCategoryManager(true); setShowMobileMenu(false); }}
              className="btn btn-secondary flex-1 text-sm"
              aria-label="打开分类管理"
            >
              分类管理
            </button>
            <button
              onClick={() => { onToggleCompleted(true); setShowMobileMenu(false); }}
              className="btn btn-secondary flex-1 text-sm"
              aria-label="查看已完成任务"
            >
              已完成
            </button>
            <button
              onClick={() => { onToggleTimeline(); setShowMobileMenu(false); }}
              className="btn btn-secondary flex-1 text-sm"
              aria-label="查看活动时间线"
            >
              时间线
            </button>
            {onToggleDailyReview && (
              <button
                onClick={() => { onToggleDailyReview(); setShowMobileMenu(false); }}
                className="btn btn-secondary flex-1 text-sm"
                aria-label="查看每日回顾"
              >
                每日回顾
              </button>
            )}
            {onToggleWeeklyReport && (
              <button
                onClick={() => { onToggleWeeklyReport(); setShowMobileMenu(false); }}
                className="btn btn-secondary flex-1 text-sm"
                aria-label="查看周报"
              >
                周报
              </button>
            )}
            <button
              onClick={() => { onToggleStats(); setShowMobileMenu(false); }}
              className="btn btn-secondary flex-1 text-sm"
              aria-label="切换统计面板"
            >
              统计
            </button>
            <button
              onClick={() => { setShowThemeCustomizer(true); setShowMobileMenu(false); }}
              className="btn btn-secondary flex-1 text-sm"
              aria-label="打开主题设置"
            >
              主题
            </button>
            <button
              onClick={() => { onToggleDarkMode(); setShowMobileMenu(false); }}
              className="btn btn-secondary flex-1 text-sm"
              aria-label={darkMode ? '切换到亮色模式' : '切换到暗色模式'}
            >
              {darkMode ? '亮色' : '暗色'}
            </button>
          </div>
          <div className="px-4 mt-2">
            <ExportImportMenu onSuccess={onSuccess} onError={onError} />
            <SortDropdown />
          </div>
        </div>
      )}
    </header>
  );
}
