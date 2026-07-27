# Abworkbench Upgrade Implementation Plan

> **For agentic workers:** Implement phase by phase with TDD checkpoints. Each phase must leave the app buildable.

**Goal:** Upgrade Abworkbench after removing the obsolete workspace page, focusing on TaskFlow, Projects, Search, Quick Capture, Mini Window, Data Health, and Desktop reliability.

**Architecture:** Keep features local-first. Put reusable scheduling, dependency, search, and health logic in pure utility modules with Node tests, then connect UI in the owning page/component. Avoid adding services or dependencies.

**Tech Stack:** React 19, TypeScript, Vite, Electron, Zustand, Node built-in test runner.

---

## Phase 1: TaskFlow Core
- [x] Add task dependency and blocker model helpers.
- [x] Generate a concise completion review sentence.
- [x] Connect blockers, dependencies, and completion review to TaskFlow UI.
- [x] Verify with Node tests, TypeScript, lint, and build.

## Phase 2: Smart Task Planning
- [x] Improve one-click task splitting.
- [x] Add today auto-scheduling.
- [x] Surface today execution order in Dashboard and TaskFlow.

## Phase 3: Project Spaces
- [x] Add project detail view.
- [x] Connect related tasks, notes, and indexed files.
- [x] Show progress, risk, next action, and weekly summary.

## Phase 4: Global Search
- [x] Strengthen `type:` and `project:` filters.
- [x] Include tasks, notes, projects, and files.
- [x] Add recent and frequent command ranking.

## Phase 5: Quick Capture
- [x] Parse one-line task, note, reminder, and project input.
- [x] Auto-fill dates, priority, project, tags, duration, and subtasks.

## Phase 6: Mini Window
- [x] Show current pomodoro, today top three, quick capture, and next reminder.
- [x] Tune compact layout for always-on-corner usage.

## Phase 7: Data Health and Backup
- [x] Show local data size and latest backup time.
- [x] Detect duplicate tasks and empty notes.
- [x] Add one-click export and restore entry points.

## Phase 8: Desktop Reliability
- [x] Improve old process detection.
- [x] Isolate Electron cache directory.
- [x] Reduce stale dynamic chunk errors.
- [x] Normalize console encoding where feasible.
