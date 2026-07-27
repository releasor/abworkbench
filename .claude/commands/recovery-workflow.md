---
description: "Recover and resume interrupted interactive workflow sessions. Auto-detects which workflow (feature-workflow, bug-fix-workflow, refactor-workflow) was interrupted and what phase it reached by inspecting git branch names, characteristic artifacts, and pipeline state — then resumes from the breakpoint. Use this skill whenever an AI CLI session is interrupted mid-workflow, times out, or hits token limits. Trigger on: 'recover', 'resume', 'continue where I left off', 'session interrupted', 'session timed out', 'pick up where it left off', 'token limit exceeded', 'salvage partial work'."
---

# Recovery Workflow

Auto-detect and resume interrupted interactive workflow sessions. When a user's AI CLI session is interrupted mid-workflow (timeout, token limit, crash, manual stop), this skill inspects the workspace to determine which workflow was running and what phase it reached, then continues from the breakpoint.

## When to Use

User says:
- "Recover", "Resume", "Continue where I left off"
- "Session interrupted / timed out / token limit exceeded"
- "Pick up where it left off"
- "Don't want to restart from scratch"

**Do NOT use when:**
- Pipeline interrupted → use `reset-feature.ps1 <F-XXX> --clean --run` / `reset-bug.ps1 <B-XXX> --clean --run` for a fresh retry
- User wants a clean restart → use the original workflow skill directly (`/feature-workflow`, `/bug-fix-workflow`, `/refactor-workflow`)
- Nothing was ever started → use the original workflow skill

## Pipeline Recovery (Recommended)

**IMPORTANT**: In Phase 1.3, you MUST present the user with a choice between pipeline recovery (`run-recovery.ps1`) and interactive recovery. **NEVER skip this choice. NEVER decide for the user.** The pipeline approach is recommended because it generates a comprehensive bootstrap prompt that explicitly lists every remaining phase with full instructions, ensuring the AI completes the full workflow — not just the implementation part.

Pipeline commands (for reference — Phase 1.3 will present these as a selectable option):

```powershell
.\.prizmkit\dev-pipeline\run-recovery.ps1                    # Auto-detect and recover
.\.prizmkit\dev-pipeline\run-recovery.ps1 detect              # Detection report only
.\.prizmkit\dev-pipeline\run-recovery.ps1 run --dry-run       # Generate prompt, don't execute
.\.prizmkit\dev-pipeline\run-recovery.ps1 run --yes           # Skip confirmation
.\.prizmkit\dev-pipeline\run-recovery.ps1 run --model <model> # Override AI model
```

### When to use pipeline vs interactive recovery

| Scenario | Approach |
|----------|----------|
| Pipeline session timed out / crashed | `.\run-recovery.ps1` — autonomous, completes all phases reliably |
| Interactive session interrupted | This skill (`/recovery-workflow`) — for in-session interactive use |
| Want to inspect before recovering | `.\run-recovery.ps1 detect` or `.\run-recovery.ps1 run --dry-run` |
| Daemon/scripted use | `.\run-recovery.ps1 run --yes` — no user confirmation needed |

## Supported Workflows

| Workflow | Branch Pattern | Key Artifacts |
|----------|---------------|---------------|
| bug-fix-workflow | `fix/<BUG_ID>-*` | `.prizmkit/bugfix/<BUG_ID>/fix-plan.md`, `fix-report.md` |
| feature-workflow | `feat/*` | `.prizmkit/plans/feature-list.json`, `.prizmkit/state/features/features/` |
| refactor-workflow | `refactor/*` | `.prizmkit/plans/refactor-list.json`, `.prizmkit/state/refactor/refactors/` |

---

## Overview

```
recovery-workflow
  │
  ├── Phase 0: Auto-detect
  │   ├── Read current branch name
  │   ├── Scan characteristic artifacts
  │   ├── Match workflow signature → determine workflow type
  │   ├── Based on artifact presence → infer current phase
  │   └── No match → reject and guide user
  │
  ├── Phase 1: Diagnose + report + user choice
  │   ├── Check branch and working tree state
  │   ├── Scan all pipelines for failed/in-progress tasks
  │   ├── Find residual dev branches from failed tasks
  │   ├── Display diagnosis + detection results
  │   ├── If code changes exist → run test suite
  │   ├── If multiple failed tasks → ask user which to recover
  │   └── User chooses: run-recovery.ps1 (recommended) | interactive | start fresh
  │
  └── Phase 2: Execute remaining steps
      ├── Read target workflow's SKILL.md
      ├── Read existing artifacts to restore context
      └── Execute from inferred phase through completion
```

---

## Phase 0: Auto-detect

**Goal**: Identify which workflow was interrupted and what phase it reached.

Run the detection script:

```powershell
function Invoke-PrizmPython {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  $python = Get-Command python -ErrorAction SilentlyContinue
  if ($python) {
    & $python.Source -c 'import sys; raise SystemExit(0 if sys.version_info[0] == 3 else 1)' *> $null
    if ($LASTEXITCODE -eq 0) {
      & $python.Source @Arguments
      return
    }
  }
  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) {
    & $py.Source -3 -c 'import sys; raise SystemExit(0 if sys.version_info[0] == 3 else 1)' *> $null
    if ($LASTEXITCODE -eq 0) {
      & $py.Source -3 @Arguments
      return
    }
  }
  throw "Python 3 is required. Install Python and ensure python or py is in PATH."
}
Invoke-PrizmPython .claude/command-assets/recovery-workflow/scripts/detect-recovery-state.py
```

The script uses **priority-ordered signature matching**:

```
1. Current branch matches fix/*           → bug-fix-workflow
2. .prizmkit/bugfix/ directory has content → bug-fix-workflow
3. Current branch matches refactor/*       → refactor-workflow
4. .prizmkit/plans/refactor-list.json exists               → refactor-workflow
5. Current branch matches feat/*           → feature-workflow
6. .prizmkit/plans/feature-list.json exists                → feature-workflow
7. None of the above                       → no workflow detected
```

Bug-fix-workflow has highest priority because it is purely interactive and benefits most from recovery (no pipeline retry fallback).

### If no workflow detected

Show guidance and exit:

```
No interrupted workflow detected in this workspace.

To start a new workflow:
  • /feature-workflow   — build features from idea to code
  • /bug-fix-workflow   — fix a specific bug interactively
  • /refactor-workflow  — behavior-preserving code restructuring
```

**CHECKPOINT CP-REC-0**: Workflow type and phase identified.

---

## Phase 1: Diagnose + Report + User Confirmation

**Goal**: Assess workspace health, identify failed tasks across all pipelines, and present recovery options.

### 1.0 Workspace & Failure Diagnosis

Before showing the recovery report, run a comprehensive diagnosis:

1. **Check current branch and working tree**:
   ```powershell
   git branch --show-current
   git status --porcelain | Select-Object -First 10
   ```
   Report: which branch is active, whether there are uncommitted changes.

2. **Scan all pipelines for failed/in-progress tasks**:
   ```powershell
   # Feature pipeline
   Invoke-PrizmPython .prizmkit/dev-pipeline/scripts/update-feature-status.py `
     --feature-list .prizmkit/plans/feature-list.json `
     --state-dir .prizmkit/state/features `
     --action status

   # Bugfix pipeline
   Invoke-PrizmPython .prizmkit/dev-pipeline/scripts/update-bug-status.py `
     --bug-list .prizmkit/plans/bug-fix-list.json `
     --state-dir .prizmkit/state/bugfix `
     --action status

   # Refactor pipeline
   Invoke-PrizmPython .prizmkit/dev-pipeline/scripts/update-refactor-status.py `
     --refactor-list .prizmkit/plans/refactor-list.json `
     --state-dir .prizmkit/state/refactor `
     --action status
   ```
   For each pipeline that has state, extract: total tasks, completed, failed, in-progress, pending.

3. **Find residual dev branches** from failed/interrupted tasks:
   ```powershell
   git branch --list 'dev/*' 'feat/*' 'fix/*' 'bugfix/*' 'refactor/*'
   ```
   Cross-reference with failed task IDs to identify which branches belong to which failed tasks.

4. **Present diagnosis summary** — show all findings before the recovery report:
   ```
   ═══════════════════════════════════════════════════
     Workspace Diagnosis
   ═══════════════════════════════════════════════════

     Branch:       fix/B-001-login-crash
     Working tree: 3 uncommitted changes

     Feature pipeline:  2 completed, 1 failed (F-003), 2 pending
     Bugfix pipeline:   1 completed, 1 failed (B-002), 0 pending
     Refactor pipeline: (no state found)

     Residual branches:
       dev/F-003-payment-integration-202604201030
       fix/B-002-encoding-bug

     Failed tasks:
       F-003: Payment integration    [FAILED] → branch: dev/F-003-...
       B-002: CSV encoding bug       [FAILED] → branch: fix/B-002-...
   ═══════════════════════════════════════════════════
   ```

   If no pipelines have state and no failed tasks are found, skip to 1.1 (standard recovery report).

### 1.1 Display Detection Report

Read the script output and present a formatted summary:

```
═══════════════════════════════════════════════════
  Recovery Report
═══════════════════════════════════════════════════

  Workflow:     bug-fix-workflow
  Branch:       fix/B-001-login-crash
  Phase:        5 — Review

  Artifacts Found:
    ✓ fix-plan.md (fix approach documented)
    ✗ fix-report.md (not yet created)
    ✓ Code changes (4 files — 3 modified, 1 new)
    ✓ Test files (1 touched)

  Reason:   fix-plan.md exists + code changes present
  Remaining: code review → user verification → commit & merge
═══════════════════════════════════════════════════
```

### 1.2 Run Tests (if code changes exist)

If the detection report shows code changes (`code.has_changes == true`), run the project's test suite:

```powershell
# detect test command from package.json or .prizmkit/config.json
npm test   # or the appropriate test command
```

Include test results in the report:
- How many tests pass/fail
- If failures exist — which tests and why

### 1.3 Select Recovery Target (if multiple failed tasks)

If the diagnosis in 1.0 found **multiple failed/interrupted tasks** across pipelines, ask the user which one to recover first before proceeding:

```
AskUserQuestion:
  question: "Multiple failed/interrupted tasks found. Which would you like to recover?"
  header: "Target"
  options:
    - label: "F-003: Payment integration"
      description: "Feature pipeline — FAILED — branch: dev/F-003-payment-integration-202604201030"
    - label: "B-002: CSV encoding bug"
      description: "Bugfix pipeline — FAILED — branch: fix/B-002-encoding-bug"
    - label: "Recover all sequentially"
      description: "Recover each failed task one by one in priority order"
```

Generate the options dynamically from the diagnosis results. Include task ID, title, pipeline type, status, and branch name.

If only one failed/interrupted task is found, skip this step — proceed directly to 1.4 with that task as the recovery target.

### 1.4 Ask User to Choose Recovery Approach

**User choice required (mandatory)** — Use `AskUserQuestion` to present interactive selectable options. **NEVER skip this step. NEVER choose for the user.**

```
AskUserQuestion:
  question: "Interrupted {workflow_type} detected at Phase {N} ({phase_name}). How would you like to recover?"
  header: "Recovery"
  options:
    - label: "Run recovery script (Recommended)"
      description: "Execute .\.prizmkit\dev-pipeline\run-recovery.ps1 — autonomously completes ALL remaining phases (review, commit, merge, etc.) via a dedicated AI session with explicit phase instructions"
    - label: "Copy command and run manually"
      description: "I'll give you the exact shell command to paste into your terminal — you run it yourself outside this session"
    - label: "Resume interactively in this session"
      description: "Continue from Phase {N} within this conversation — more control, but may not complete all phases if session is interrupted again"
    - label: "Start fresh"
      description: "Discard interrupted work and restart the original workflow from scratch"
```

**If "Run recovery script"** → Execute the pipeline recovery:
```powershell
.\.prizmkit\dev-pipeline\run-recovery.ps1
```
The script handles everything: detection, confirmation, prompt generation, session spawn, and post-session validation. **End this skill after launching the script** — do not proceed to Phase 2.

**If "Copy command and run manually"** → Output the command for the user to copy and run in their own terminal:
```
To recover, run this command in your project root:

  .\.prizmkit\dev-pipeline\run-recovery.ps1

Or with options:
  .\.prizmkit\dev-pipeline\run-recovery.ps1 run --dry-run    # Preview the recovery prompt first
  .\.prizmkit\dev-pipeline\run-recovery.ps1 run --yes         # Skip confirmation
  .\.prizmkit\dev-pipeline\run-recovery.ps1 run --model <model>  # Specify AI model
```
**End this skill** — do not proceed to Phase 2. The user will run the command themselves.

**If "Resume interactively"** → Continue to Phase 2 below (execute remaining steps in this session).

**If "Start fresh"** → Suggest the appropriate original workflow skill:
- bug-fix-workflow → `/bug-fix-workflow`
- feature-workflow → `/feature-workflow`
- refactor-workflow → `/refactor-workflow`
End this skill.

**NEVER proceed to Phase 2 without explicit user selection via `AskUserQuestion`. Do NOT render options as plain text — the user must be able to click/select.**

**CHECKPOINT CP-REC-1**: User chose recovery target and approach.

---

## Phase 2: Execute Remaining Steps

**Goal**: Read the target workflow's SKILL.md and execute from the inferred phase.

### 2.0 Read Target Workflow

1. **Read the workflow's installed skill file** for `{workflow-type}`:
   - Codex: `.agents/skills/{workflow-type}/SKILL.md`
   - Claude: `.claude/commands/{workflow-type}.md`
   - CodeBuddy: `.codebuddy/skills/{workflow-type}/SKILL.md`
2. **Read existing artifacts** to restore context — check in this order for the most efficient recovery:
   - If `context-snapshot.md` exists in the artifact directory → read it first. It provides a snapshot of completed tasks, key decisions, and remaining work from the interrupted session.
   - If `session-summary.md` exists → read it for a lightweight summary of the previous session.
   - Then read remaining artifacts: spec.md, plan.md, review-report.md, code diffs, bug descriptions, etc.
3. **Read relevant `.prizmkit/prizm-docs/`** — load project context (L0 root, relevant L1/L2 for affected modules).

This step replaces the context that was lost when the AI session was interrupted.

---

### 2.1 Bug-Fix-Workflow Recovery

Phase inference table:

| Detected State | Resume From | Actions |
|---------------|------------|---------|
| On `fix/<BUG_ID>-*` branch, no artifacts | Phase 1: Deep Bug Diagnosis | Read bug description from `.prizmkit/plans/bug-fix-list.json`. Start interactive diagnosis Q&A |
| `fix-plan.md` exists, no code changes | Phase 4: Fix | Read fix-plan.md. Implement the fix following the plan |
| `fix-plan.md` + code changes exist | Phase 5: Review | Invoke `/prizmkit-code-review` on all changes |
| All docs + review passed | Phase 6: User Verification | Ask user to verify the fix works |
| All docs + committed | Phase 7: Merge Decision | Ask merge vs keep branch |

**Note**: Bug-fix Phases 1-3 (Diagnosis, Triage, Reproduce) collapse to Phase 1 for detection purposes because these phases don't produce persistent artifacts. If interrupted during these phases, recovery restarts from Phase 1 (diagnosis), which re-derives understanding from available inputs (bug description, code) without interactive Q&A.

**Execution for each remaining phase**: Follow the bug-fix-workflow SKILL.md instructions exactly. Call the same prizmkit sub-commands (`/prizmkit-code-review`, `/prizmkit-committer`) at the same points.

**Special handling**:
- If resuming from Phase 5 (Review) and tests are failing, fix test failures first (max 3 attempts). If unfixable, ask user whether to continue or restart.
- If resuming from Phase 4 (Fix), read fix-plan.md to understand the planned approach before writing code.

---

### 2.2 Feature-Workflow Recovery

Phase inference table:

| Detected State | Resume From | Actions |
|---------------|------------|---------|
| No `.prizmkit/plans/feature-list.json` | Phase 1: Brainstorm | Cannot recover conversation context. Start requirement clarification, but leverage any workspace content (README, existing code) for context |
| `.prizmkit/plans/feature-list.json` exists, no pipeline state | Phase 3: Launch | Invoke `feature-pipeline-launcher` to start the pipeline |
| `.prizmkit/plans/feature-list.json` + pipeline state exists | Phase 4: Monitor | Check pipeline status via `feature-pipeline-launcher` (Intent B: Check Status) |

**Note**: Feature-workflow recovery is simpler because Phases 3-4 are pipeline-driven. The main recovery value is avoiding re-brainstorming (Phase 1) when `.prizmkit/plans/feature-list.json` already exists.

---

### 2.3 Refactor-Workflow Recovery

Phase inference table (mirrors feature-workflow):

| Detected State | Resume From | Actions |
|---------------|------------|---------|
| No `.prizmkit/plans/refactor-list.json` | Phase 1: Brainstorm | Start refactoring goal clarification |
| `.prizmkit/plans/refactor-list.json` exists, no pipeline state | Phase 3: Launch | Invoke `refactor-pipeline-launcher` to start the pipeline |
| `.prizmkit/plans/refactor-list.json` + pipeline state exists | Phase 4: Monitor | Check pipeline status |

---

### 2.4 Post-Recovery Report

After all remaining phases complete, output a summary:

```
Recovery complete.

  Workflow:     bug-fix-workflow
  Recovered from: Phase 5 (Review)
  Completed:    code review → user verification → commit & merge
  Preserved:    fix-plan.md, 4 code files, 1 test file

  Next steps:
    • Check for other interrupted workflows
    • Or start a new workflow
```

**CHECKPOINT CP-REC-2**: Workflow recovered and completed.

---

## Error Handling

| Scenario | Action |
|----------|--------|
| No workflow signature matches | Show guidance message, suggest original workflow skills |
| Branch exists but artifacts are inconsistent | Trust git as ground truth, report discrepancy in detection report |
| Test failures in existing code | Report in detection summary; user decides whether to continue |
| Multiple workflows could match (e.g., on main but both .prizmkit/plans/feature-list.json and bug-fix artifacts exist) | Pick highest priority (bug-fix > refactor > feature), mention others in report |
| Detection script fails | Fall back to manual detection (run individual git/file checks in PowerShell) |
| Bug ID not found in .prizmkit/plans/bug-fix-list.json | Continue with branch-only context; note that full bug description is unavailable |

---

## Relationship to Other Skills

| Skill | Relationship |
|-------|-------------|
| `feature-workflow` | **Recovery target** — this skill can resume interrupted feature-workflow sessions |
| `bug-fix-workflow` | **Recovery target** — this skill can resume interrupted bug-fix-workflow sessions |
| `refactor-workflow` | **Recovery target** — this skill can resume interrupted refactor-workflow sessions |
| `feature-pipeline-launcher` | **Called in Phase 2.2** — launches or checks pipeline status for feature recovery |
| `reset-feature.ps1 <F-XXX> --clean --run` | **Alternative** — clean retry for one feature; this skill is the smart interactive alternative |
| `reset-bug.ps1 <B-XXX> --clean --run` | **Alternative** — clean retry for one bugfix item |
| `run-recovery.ps1` | **Pipeline counterpart** — shell-driven recovery that generates bootstrap prompt and spawns AI CLI session for autonomous completion |
| `/prizmkit-code-review` | **Called in Phase 2.1** — reviews recovered bug-fix code |
| `/prizmkit-committer` | **Called in Phase 2.1** — commits the recovered result |

---

## Comparison with Previous Version

| Dimension | Previous | Current |
|-----------|----------|---------|
| Scope | Feature pipeline only | All 3 interactive workflows |
| Input | Required `F-XXX` feature ID | No input — fully auto-detect |
| Detection | Feature-specific (spec/plan/git) | Signature-based (branch + artifacts) |
| Strategy | Multi-option (5 scenarios × 2-4 options each) | Single path: report → confirm → execute |
| Intrusion | None | None (zero changes to target workflows) |

## Output

- Resumed and completed workflow from the breakpoint
- Same outputs as the original workflow would produce (commits, artifacts, state updates)
- Recovery summary showing what was preserved vs what was re-done
