---
description: "Incremental .prizmkit/prizm-docs/ maintainer. Performs two jobs: (1) structural sync — update .prizmkit/prizm-docs/ KEY_FILES/INTERFACES/DEPENDENCIES, (2) architecture knowledge — inject TRAPS/RULES/DECISIONS into .prizmkit/prizm-docs/. All project knowledge lives in .prizmkit/prizm-docs/ . Run after code review passes and before committing. Trigger on: 'retrospective', 'retro', 'update docs', 'sync docs', 'wrap up', 'done with feature', 'feature complete'. (project)"
---

# PrizmKit Retrospective

| Store | Location | Content | Purpose |
|-------|----------|---------|---------|
| **Architecture Index** | `.prizmkit/prizm-docs/` | MODULE, FILES, INTERFACES, DEPENDENCIES, TRAPS, RULES, DECISIONS | AI quickly locates code structure, interfaces, known pitfalls, and key design decisions |

**This skill handles both structural sync and knowledge injection in one pass:**

1. **Structural Sync** — reflect what changed in code → `.prizmkit/prizm-docs/` (KEY_FILES, INTERFACES, DEPENDENCIES, file counts)
2. **Architecture Knowledge** — inject TRAPS, RULES, and DECISIONS → `.prizmkit/prizm-docs/`

For initial doc setup, validation, or migration, use `/prizmkit-prizm-docs` instead.

## When to Use

- **Before every commit** (mandatory in pipeline) — ensures docs and code are in sync
- After completing a feature, refactoring, or bug fix
- After code review passes
- User says "retrospective", "retro", "update docs", "sync docs", "wrap up"

## Input

| Parameter | Required | Description |
|-----------|----------|-------------|
| `artifact_dir` | No | Directory containing spec.md, plan.md, review-report.md. If omitted, scan `.prizmkit/` subdirectories for the most recently modified directory with a `plan.md`. If no artifact directory found, run in standalone mode (structural sync only from `git diff`). |

## When NOT to Use

- Only comments, whitespace, or formatting changed — no structural/knowledge change
- Only test files changed — no module-level impact
- Only .prizm files changed — avoid circular updates

---

### Job 1: Structural Sync (always runs)
Synchronize `.prizmkit/prizm-docs/` structure with actual codebase changes from this session.
→ Read `.claude/command-assets/prizmkit-retrospective/references/structural-sync-steps.md` for the detailed procedure.

**Key outputs**: Synced L1 file counts, L2 INTERFACES/DATA_FLOW, DEPENDENCIES, and stale TRAPS cleanup.

**Memory hygiene**: `.prizmkit/prizm-docs/` must not contain CHANGELOG sections/files, UPDATED/date metadata, feature/bug/refactor/task/session/run/pipeline/workflow IDs, branch names, absolute worktree paths, or `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths. Convert artifact-scoped wording into durable product/domain language before writing.

---

### Job 2: Knowledge Injection (conditional)
Inject newly discovered project knowledge (TRAPS, RULES, DECISIONS) into architecture docs.
→ Read `.claude/command-assets/prizmkit-retrospective/references/knowledge-injection-steps.md` for the detailed procedure.

**Review gate**: Before running Job 2, check `review-report.md` in the artifact directory for the `## Verdict:` line:
- Verdict is `PASS` → proceed
- Verdict is `NEEDS_FIXES` → **skip Job 2** — do not inject knowledge for code that hasn't passed review. Output warning: "Review report has unresolved findings. Skipping knowledge injection."
- No `review-report.md` found → proceed with warning
- No artifact directory (standalone mode) → skip Job 2, only Job 1 runs

**Skip for**: pure refactors (no behavioral change).

**Bug Fix Documentation Policy**:
- DEFAULT for bug fixes: Run Job 1 (structural sync) only. Skip Job 2 (knowledge injection).
- RUN Job 2 when the bug fix causes any of:
  • Interface signature changes
  • Dependency additions/removals
  • Observable behavior changes to existing features
  • Newly discovered TRAPs (gotchas/pitfalls)
- When any of the above apply, run full retrospective (Job 1 + Job 2).

**Key outputs**: New TRAPS entries, RULES updates, DECISIONS records in relevant L1/L2 docs and root.prizm.

---

## Final: Stage

**3a.** Stage all doc changes:
```bash
git add .prizmkit/prizm-docs/
```

**HANDOFF:** `/prizmkit-committer`

## Output

- `.prizmkit/prizm-docs/*.prizm` — Structurally synced + TRAPS/RULES/DECISIONS enriched
- All `.prizmkit/prizm-docs/` changes staged via `git add`
