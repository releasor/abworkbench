# Workbench Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use inline execution with TDD checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next staged Abworkbench application layer: smart inbox, weekly planning/review, goals, automation rules, time ledger, templates, file workflow, and knowledge graph.

**Architecture:** Keep everything local-first and dependency-free. Put reusable behavior in `src/utils/workbenchHub.ts` with Node tests, then expose it through a new `workflow` page and lightweight navigation/command entry points. Store new user data in `abworkbench-*` local collections.

**Tech Stack:** React 19, TypeScript, Vite, Electron, Zustand, localStorage helpers, Node built-in test runner.

---

## Phase 1: Smart Inbox
- [x] Add inbox classification and local item model.
- [x] Add page controls to capture and process inbox items.
- [x] Keep quick capture compatible with the new inbox model.

## Phase 2: Weekly Plan and Review
- [x] Summarize weekly goals, delayed tasks, habit completion, and focus time.
- [x] Surface next-week suggestions in the workbench page.

## Phase 3: Goal System
- [x] Add local goal model for quarter, month, and week.
- [x] Compute progress from linked tasks and projects.

## Phase 4: Automation Rules
- [x] Add local rule model and evaluator.
- [x] Show rule suggestions for overdue, stale, tag, backup, and review scenarios.

## Phase 5: Time Ledger
- [x] Aggregate task time entries and pomodoro sessions by project.
- [x] Show estimate variance and weekly distribution.

## Phase 6: Template Center
- [x] Add built-in templates for projects, meetings, reading notes, reviews, and task breakdowns.
- [x] Support one-click template preview/copy into inbox.

## Phase 7: File Workflow
- [x] Summarize indexed files by project and recent use.
- [x] Show orphan files and file-task linkage hints.

## Phase 8: Knowledge Graph
- [x] Parse wiki links, hashtags, project references, and task references.
- [x] Render a lightweight relation list without adding a graph dependency.

## Verification
- [x] Run workbench utility tests.
- [x] Run all Node tests.
- [x] Run TypeScript.
- [x] Run ESLint.
- [x] Run production build.
