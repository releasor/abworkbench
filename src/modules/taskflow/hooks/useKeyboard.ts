import { useEffect, useRef } from 'react';
import type { ViewMode } from '../types';
import { eventMatchesShortcut, useShortcutStore } from '../../../shortcuts';

interface KeyboardShortcuts {
  onNewTask?: () => void;
  onCloseModal?: () => void;
  onToggleStats?: () => void;
  onToggleDarkMode?: () => void;
  onChangeViewMode?: (mode: ViewMode) => void;
  onToggleHelp?: () => void;
  onToggleSearch?: () => void;
  onToggleCompleted?: () => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onUndo?: () => void;
  onTogglePomodoro?: () => void;
  onDeleteSelected?: () => void;
  onToggleTimeline?: () => void;
  onFocusMode?: () => void;
  onTogglePin?: () => void;
  onSnoozeSelected?: () => void;
  onToggleSound?: () => void;
  onToggleDailyReview?: () => void;
  onToggleWeeklyReport?: () => void;
  onMoveStatusForward?: () => void;
  onMoveStatusBackward?: () => void;
}

export function useKeyboard(shortcuts: KeyboardShortcuts) {
  const ref = useRef(shortcuts);
  const overrides = useShortcutStore((s) => s.overrides);

  useEffect(() => {
    ref.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const {
        onCloseModal, onClearSelection, onToggleHelp, onToggleSearch, onNewTask, onToggleStats,
        onToggleDarkMode, onToggleCompleted, onSelectAll, onUndo, onTogglePomodoro, onToggleTimeline,
        onDeleteSelected, onFocusMode, onChangeViewMode, onTogglePin, onSnoozeSelected, onToggleSound,
        onToggleDailyReview, onToggleWeeklyReport, onMoveStatusForward, onMoveStatusBackward,
      } = ref.current;
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      if (e.key === 'Escape') {
        onCloseModal?.();
        onClearSelection?.();
        return;
      }

      if (isInput) return;

      if (eventMatchesShortcut('tfHelp', e)) {
        e.preventDefault();
        onToggleHelp?.();
        return;
      }
      if (eventMatchesShortcut('tfNewTask', e)) {
        e.preventDefault();
        onNewTask?.();
        return;
      }
      if (eventMatchesShortcut('tfStats', e)) {
        e.preventDefault();
        onToggleStats?.();
        return;
      }
      if (eventMatchesShortcut('tfSearch', e)) {
        e.preventDefault();
        onToggleSearch?.();
        return;
      }
      if (eventMatchesShortcut('tfDarkMode', e)) {
        e.preventDefault();
        onToggleDarkMode?.();
        return;
      }
      if (eventMatchesShortcut('tfCompleted', e)) {
        e.preventDefault();
        onToggleCompleted?.();
        return;
      }
      if (eventMatchesShortcut('tfSelectAll', e)) {
        e.preventDefault();
        onSelectAll?.();
        return;
      }
      if (eventMatchesShortcut('tfUndo', e)) {
        e.preventDefault();
        onUndo?.();
        return;
      }
      if (eventMatchesShortcut('tfPomodoro', e)) {
        e.preventDefault();
        onTogglePomodoro?.();
        return;
      }
      if (eventMatchesShortcut('tfTimeline', e)) {
        e.preventDefault();
        onToggleTimeline?.();
        return;
      }
      if (eventMatchesShortcut('tfSound', e)) {
        e.preventDefault();
        onToggleSound?.();
        return;
      }
      if (eventMatchesShortcut('tfDailyReview', e)) {
        e.preventDefault();
        onToggleDailyReview?.();
        return;
      }
      if (eventMatchesShortcut('tfWeeklyReport', e)) {
        e.preventDefault();
        onToggleWeeklyReport?.();
        return;
      }
      if (eventMatchesShortcut('tfStatusForward', e)) {
        e.preventDefault();
        onMoveStatusForward?.();
        return;
      }
      if (eventMatchesShortcut('tfStatusBackward', e)) {
        e.preventDefault();
        onMoveStatusBackward?.();
        return;
      }
      if (eventMatchesShortcut('tfDelete', e)) {
        e.preventDefault();
        onDeleteSelected?.();
        return;
      }
      if (eventMatchesShortcut('tfFocusMode', e)) {
        e.preventDefault();
        onFocusMode?.();
        return;
      }
      if (eventMatchesShortcut('tfTogglePin', e)) {
        e.preventDefault();
        onTogglePin?.();
        return;
      }
      if (eventMatchesShortcut('tfSnooze', e)) {
        e.preventDefault();
        onSnoozeSelected?.();
        return;
      }
      if (eventMatchesShortcut('tfViewBoard', e)) {
        onChangeViewMode?.('board');
        return;
      }
      if (eventMatchesShortcut('tfViewList', e)) {
        onChangeViewMode?.('list');
        return;
      }
      if (eventMatchesShortcut('tfViewCalendar', e)) {
        onChangeViewMode?.('calendar');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [overrides]);
}
