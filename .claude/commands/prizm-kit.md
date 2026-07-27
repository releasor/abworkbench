---
description: "Full-lifecycle dev toolkit index. Routes to the right PrizmKit skill for spec-driven development, Prizm docs, code quality, deployment, and knowledge management. Use when the user asks 'which command?', 'help', 'how do I start a feature', 'get started', 'what tools', 'dev workflow', 'lifecycle', or '/prizmkit'. Use this as the entry point for the full PrizmKit development lifecycle."
---

# PrizmKit — Full-Lifecycle Development Toolkit

## Task Execution Model

PrizmKit uses **headless mode** — each task runs as an independent AI CLI session with NO context carryover between tasks. Every session starts by reading docs and ends by maintaining docs.

**Per-task flow**:
```
read docs → plan → implement → code-review → retrospective → committer
```

Each task begins by reading context at two levels:

**Application level** (read every session):
- `.prizmkit/prizm-docs/root.prizm` — L0 project architecture index (modules, tech stack, conventions)
- `.prizmkit/plans/project-brief.md` — user's product vision checklist (generated during project initialization)
- `.prizmkit/config.json` — tech stack config, deploy strategy

**Task level** (read for the specific task):
- `spec.md` / `plan.md` — task specification and implementation plan
- `.prizmkit/prizm-docs/<module>.prizm` (L1/L2) — architecture docs for affected modules (TRAPS, DECISIONS, INTERFACES)

Each cycle produces spec, plan, and task artifacts that create a traceable record of what was built and why. `.prizmkit/prizm-docs/` stays in sync through retrospective, so the next session starts with up-to-date context.

**Fast path** — for small, well-scoped changes, always ask user whether to use fast path:
```
/prizmkit-plan → /prizmkit-implement → /prizmkit-committer
```

### Development Scenarios

PrizmKit supports any development scenario through the same skill chain. `/prizmkit-plan` produces `spec.md` + `plan.md` regardless of the task type:

| Scenario | Artifacts | When to Use |
|----------|-----------|-------------|
| **Feature** | `spec.md` → `plan.md` → code | New functionality, UI, API, data model changes |
| **Bug Fix** | `spec.md` → `plan.md` → code | Complex defects, regressions, crash fixes. Simple bugs can use fast path directly. |
| **Refactor** | `spec.md` → `plan.md` → code | Restructure, extract, rename, performance. No behavior change. |

All three follow the same per-task flow. Detailed documentation policies (when to update `.prizmkit/prizm-docs/`, when to skip steps) are defined within each skill — not here.

### Best Practices for AI-Driven Development

**Monorepo structure recommended**: Keep frontend, backend, and shared libraries in one repository. AI needs visibility into the full call chain — cross-repo references are invisible to it. If you have a multi-repo setup, add all related repos to the AI workspace so module boundaries and API contracts are discoverable.

**Module organization**: Ensure every meaningful module has a `.prizmkit/prizm-docs/` L1 doc. AI reads TRAPS and DECISIONS before modifying files — undocumented modules get no guardrails.

**Small, focused tasks**: Break large features into tasks that can each be completed in one AI session. The pipeline handles this automatically via `/prizmkit-plan` task decomposition.

## Core Skill Reference

| Skill | Purpose | Trigger Phrases |
|-------|---------|-----------------|
| `/prizmkit-plan` | Specify + plan: natural language → spec.md → plan.md + tasks | "specify", "plan", "new feature", "I want to add...", "architect", "break it down" |
| `/prizmkit-implement` | Execute plan.md tasks, write code (TDD) | "implement", "build", "code it", "start coding" |
| `/prizmkit-code-review` | Diagnose issues + produce Fix Instructions | "review", "check code", "is it ready to commit" |
| `/prizmkit-retrospective` | Sync .prizmkit/prizm-docs/ with code changes | "retrospective", "retro", "sync docs", "wrap up" |
| `/prizmkit-committer` | Safe git commit with Conventional Commits | "commit", "submit", "finish", "ship it" |
| `/prizmkit-deploy` | Generate/update deployment documentation | "deploy docs", "deployment guide", "how to deploy" |
| `/prizmkit-init` | Project bootstrap + .prizmkit/prizm-docs/ setup | "init", "initialize", "take over this project" |
| `/prizmkit-prizm-docs` | Doc management (init/status/rebuild/validate) | "check docs", "rebuild docs", "validate docs" |

**Reading guide**:
- Need code structure/modules/interfaces/traps/decisions? → `.prizmkit/prizm-docs/`

## Quick Start (First-Time Setup)

1. `npx prizmkit install .` → installs skills, rules (`prizm-documentation.md`, `prizm-commit-workflow.md`), hooks, platform scaffolding
2. `/prizmkit-init` → scans project code, generates `.prizmkit/prizm-docs/`, detects tech stack, populates `.prizmkit/config.json`
3. `/prizmkit-plan` → specify your first feature → produces spec.md + plan.md
4. `/prizmkit-implement` → TDD implementation following the plan
5. `/prizmkit-code-review` → review before commit
6. `/prizmkit-retrospective` → sync `.prizmkit/prizm-docs/` with changes
7. `/prizmkit-committer` → safe Conventional Commit

> **Note**: Rules and hooks are installed by `npx prizmkit install`, not by `/prizmkit-init`.
