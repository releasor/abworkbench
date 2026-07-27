---
description: "Interactive single-bug fix in current session. Guides through deep diagnosis Q&A → triage → reproduce → fix → review → commit without the background pipeline. Use this skill when the user wants to fix one specific bug right now, interactively. Trigger on: 'fix this bug', 'debug this', 'fix B-001', 'help me fix', 'let me fix this bug myself', 'fix this bug', 'interactive fix', 'manually fix bug'."
---

# Bug Fix Workflow

Fix a single bug interactively within the current AI CLI session. This is the in-session counterpart to `bugfix-pipeline-launcher` (which runs multiple bugs in the background).

## When to Use

- User wants to fix **one specific bug** right now, with full visibility
- User says "fix this bug", "debug this error", "help me fix B-001", "fix this bug"
- User has a stack trace or error and wants interactive debugging
- User prefers hands-on fixing over background pipeline

**Do NOT use when:**
- User has multiple bugs to fix in batch → `bug-planner` + `bugfix-pipeline-launcher`
- User wants to plan/collect bugs without fixing → `bug-planner`
- User wants background autonomous fixing → `bugfix-pipeline-launcher`
- User wants to build features → `feature-workflow`

## Input

**PRECONDITION:**

| Input Source | Detection | Example |
|---|---|---|
| Bug-fix-list.json entry | User says "fix B-001" → read entry from `.prizmkit/plans/bug-fix-list.json` | `fix B-001` |
| Stack trace / error message | User pastes error directly | `TypeError: Cannot read property...` |
| Natural language description | User describes the problem | "login page crashes on submit" |
| Failed test | User references a failing test file | `src/auth/__tests__/login.test.ts` |

At least one input source must be provided. If none is clear, ask the user to describe the bug.

## Fast Path

For trivial bugs with clear root cause and minimal scope:

### Eligibility Criteria (ALL must be true)
- Root cause is immediately obvious (typo, missing null check, wrong variable name, off-by-one)
- Fix is ≤10 lines of code in a single file
- No cross-module impact
- Existing tests cover the affected path (or bug is in untested utility)
- No data model or API changes

### Fast Path Workflow
1. Branch Setup → `fix/<BUG_ID>-<short-desc>`
2. Write reproduction test → confirm failing
3. Apply fix → confirm test passes + full suite green
4. Run `/prizmkit-code-review` for quality check
5. Ask user: "Quick fix applied. Verify before commit? (Y/skip)"
6. Commit with `fix(<scope>):` prefix
7. Ask merge preference

**Fast Path still requires**: fix branch, reproduction test, full test suite pass, code review, user merge decision.

---

## Execution

### Phase 0: Branch Setup

**Goal**: Create an isolated working branch to keep main clean.

1. **Check current branch**:
   ```powershell
   git branch --show-current
   ```
2. **If on `main` or a shared branch**: Create and switch to fix branch:
   ```powershell
   git checkout -b fix/<BUG_ID>-<short-description>
   ```
   Example: `git checkout -b fix/B-001-login-null-crash`
3. **If already on a fix branch**: Confirm with user: "Continue on current branch `<branch-name>`, or create a new one?"
4. **Record the original branch name** for later merge.

**CHECKPOINT CP-BFW-0**: On a dedicated fix branch, not main/shared branch.

---

### Phase 1: Deep Bug Diagnosis — Interactive Q&A

**Goal**: Fully understand the bug before touching any code. Vague bug reports lead to incorrect fixes that mask the real issue or introduce new bugs.

**Fast Path Decision Point**: After initial information gathering (Step 1.1), evaluate the Fast Path Eligibility Criteria in Step 1.4. If ALL simple bug criteria are met, use `AskUserQuestion` to let the user choose the execution approach. Only proceed with fast path implementation if the user explicitly selects "Fix now". Never guess the user's intent from text — always present the interactive selection.

**CRITICAL RULE**: Ask as many questions as needed until the bug is fully understood. Do NOT rush into code. A misdiagnosed bug leads to a wrong fix, which is worse than no fix.

#### Step 1.1: Initial Bug Information Gathering

- If bug ID given (e.g. B-001): read entry from `.prizmkit/plans/bug-fix-list.json` — but DO NOT assume the description is complete
- If raw error/stack trace: extract error message, affected files, line numbers
- If natural language description: start the deep-dive Q&A below

#### Step 1.2: Systematic Bug Clarification

Ask questions across these dimensions until every aspect is clear. **Adapt to what the user has already provided** — skip questions that are already answered.

**Reproduction Conditions:**
- What exact steps trigger the bug? (step-by-step)
- Which environment/browser/OS/version?
- Is it reproducible every time, or intermittent?
- When did it first appear? (after a specific change/deploy?)
- Does it happen for all users or only specific accounts/roles/data?

**Expected vs Actual Behavior:**
- What should happen? (the correct behavior)
- What actually happens? (the buggy behavior)
- Is there partial functionality (e.g., works for some inputs but not others)?

**Scope and Impact:**
- Which features/pages/modules are affected?
- Are there workarounds users are currently using?
- Is this blocking other work?
- Are there related symptoms elsewhere?

**Data and State:**
- What data/state triggers the issue? (specific input values, DB state, user session state)
- Does the bug involve data corruption or just incorrect display/behavior?
- If database-related: which tables/records are affected?

**Error Details** (if not already provided):
- Full error message and stack trace?
- Browser console errors?
- Server-side logs?
- Network request/response details?

#### Step 1.3: Confirmation Before Triage

Summarize the bug understanding:

```
Bug Summary:
- Symptom: [what happens]
- Reproduction: [exact steps]
- Environment: [where it occurs]
- Expected: [correct behavior]
- Impact: [who/what is affected]
- Data trigger: [what data/state causes it]
```

Ask the user: "Is this summary accurate? Any details to add?"

**CHECKPOINT CP-BFW-1**: Bug fully understood and confirmed by user.

---

#### Step 1.4: Complexity Assessment

After confirming bug understanding, assess whether this bug needs structured planning:

**Simple bug → Fast Path candidate** (ALL must be true):
- Root cause is immediately obvious (typo, missing null check, wrong variable name, off-by-one)
- Fix is ≤10 lines of code in a single file
- No cross-module impact
- Existing tests cover the affected path (or bug is in untested utility)
- No data model or API changes

**User choice required (mandatory)** — Use `AskUserQuestion` to present interactive selectable options:

```
AskUserQuestion:
  question: "This bug appears straightforward. How would you like to proceed?"
  header: "Approach"
  options:
    - label: "Fix now (fast path)"
      description: "Implement the fix directly in this session — branch → test → fix → review → commit"
    - label: "Add to bug-fix-list.json (pipeline)"
      description: "Add this bug to .prizmkit/plans/bug-fix-list.json via bug-planner, then use bugfix-pipeline-launcher to launch autonomous pipeline execution"
    - label: "Full diagnosis"
      description: "Continue with in-depth analysis before deciding"
```

- **Fix now** → Proceed with Fast Path Workflow (Phase 0 branch already set up)
- **Add to bug-fix-list.json** → Invoke `bug-planner` to add this bug to `.prizmkit/plans/bug-fix-list.json`, then suggest user run `bugfix-pipeline-launcher` to start the pipeline. End this workflow.
- **Full diagnosis** → Continue with full diagnosis (Phase 2 Triage)

**Complex bug → Planning Path** (ANY is true):
- Cross-module impact (>2 files affected)
- Data model or API changes required
- Root cause is uncertain or multi-layered
- Fix requires structural changes
- Multiple interrelated symptoms

**User choice required (mandatory)** — Use `AskUserQuestion` to present interactive selectable options:

```
AskUserQuestion:
  question: "This bug appears complex and will need structured planning. How would you like to proceed?"
  header: "Approach"
  options:
    - label: "Plan and fix now"
      description: "Create a plan and fix it in this session using /prizmkit-plan + /prizmkit-implement"
    - label: "Add to bug-fix-list.json (pipeline)"
      description: "Add this bug to .prizmkit/plans/bug-fix-list.json via bug-planner, then use bugfix-pipeline-launcher to launch autonomous pipeline execution"
```

- **Plan and fix now** → Invoke `/prizmkit-plan` with `artifact_dir=.prizmkit/bugfix/<BUG_ID>/`:
  1. `/prizmkit-plan` generates `spec.md` (bug description + acceptance criteria) + `plan.md` (fix strategy + test specifications) under `.prizmkit/bugfix/<BUG_ID>/`
  2. Invoke `/prizmkit-implement` to execute the plan (TDD: write failing reproduction test → implement fix → tests pass)
  3. Run `/prizmkit-code-review` for quality check
  4. Commit via `/prizmkit-committer` with `fix(<scope>):` prefix
  5. **End workflow** — skip Phase 2-7. No `/prizmkit-retrospective` (bug fixes are incomplete features, not new architecture)
- **Add to bug-fix-list.json** → Invoke `bug-planner` to add this bug to `.prizmkit/plans/bug-fix-list.json`, then suggest user run `bugfix-pipeline-launcher` to start the pipeline. End this workflow.

**NEVER proceed with direct code changes without explicit user confirmation via `AskUserQuestion`. Do NOT render options as plain text — the user must be able to click/select.**

---

### Phase 2: Triage

**Goal**: Locate affected code, identify root cause, classify severity.

> **Triage**: Classify error into: Runtime / Network / Auth / Data / Resource / Logic / Config / External. Check `.prizmkit/prizm-docs/` TRAPS for known patterns first. If a TRAPS match is found, use documented solution and reference the specific `.prizmkit/prizm-docs/` entry. If no match, trace the call chain from the stack frame to identify root cause from first principles.

1. **Read project context**: `.prizmkit/prizm-docs/root.prizm` → relevant L1/L2 docs for affected modules
2. **Locate affected code**: read the files mentioned in the error/stack trace or identified during diagnosis
3. **Check known issues**: search `.prizmkit/prizm-docs/` TRAPS sections for matching patterns
4. **If database-related**: read existing schema/model files to understand the data layer
   ```powershell
	   Get-ChildItem -Path . -File -Recurse -Depth 4 -Include *.prisma,*.sql,schema.*,*.entity.* -ErrorAction SilentlyContinue |
	     Where-Object { $_.FullName -match '\\(migrations|models)\\|schema\.|\.prisma$|\.sql$|\.entity\.' } |
	     Where-Object { $_.FullName -notmatch '\\(node_modules|\.git)(\\|$)' } |
	     Select-Object -First 20 -ExpandProperty FullName
   ```
5. **Classify**: root cause (confirmed/suspected), blast radius, fix complexity
6. **Present diagnosis to user**:
   ```
   Bug: Login page crash on submit
   Root Cause: AuthService.handleLogin() receives null token when API returns 401
   Affected Files: src/services/auth.ts (L42), src/pages/login.tsx (L28)
   Fix Complexity: Low (null check + error handling)
   ```
   Ask: "Does this diagnosis look right? Should I proceed with the fix?"

**CHECKPOINT CP-BFW-2**: Root cause identified and diagnosis confirmed by user.

### Phase 3: Reproduce

**Goal**: Create a failing test that proves the bug exists.

> **Reproduce**: For API bugs: generate curl/HTTP request sequence with assertions. For UI bugs: generate step-by-step interaction guide. For logic bugs: generate unit test (arrange/act/assert). For data bugs: generate seed data + query sequence. The reproduction must FAIL with current behavior and be designed to PASS after the fix is applied — making it a regression guard.

1. **Write a reproduction test** that demonstrates the bug:
   - Name: `<module>.test.ts` → add a test case named `should handle <bug scenario>`
   - The test captures the exact failure condition
2. **Run the test** → confirm it **fails** (red)
3. **Show result to user**: "Reproduction test written and confirmed failing."

If the bug is hard to reproduce automatically (e.g. environment-specific):
- Ask the user for reproduction steps
- Write a manual reproduction checklist instead
- Proceed to Phase 4 with the manual checklist

**CHECKPOINT CP-BFW-3**: Bug reproduction test written and confirmed failing.

### Phase 4: Fix

**Goal**: Implement the minimal fix. Red test → green.

1. **Implement the fix**:
   - Change the minimum amount of code to fix the root cause
   - Do NOT refactor or add unrelated improvements — fix the bug only
   - Follow existing code conventions (read from `.prizmkit/prizm-docs/` RULES/PATTERNS)
   - If the fix involves database changes: read existing schema first, follow existing naming/constraint conventions
2. **Run the reproduction test** → must **pass** (green)
3. **Run the full module test suite** → must pass (no regressions)
4. **Show the fix to user**:
   - Summary of changes made
   - Test results (reproduction + regression)
   - Ask: "Fix looks good? Any concerns?"

**CHECKPOINT CP-BFW-4**: Fix implemented and all tests passing (reproduction + regression).

If the fix causes test regressions:
- Show which tests broke and why
- Revise the fix (max 3 attempts)
- If still failing after 3 attempts, escalate to user with analysis

### Phase 5: Review

**Goal**: Verify fix quality before committing.

1. **Run `/prizmkit-code-review`** to review the fix:
   - Reviews git diff against the bug context (root cause, fix approach, affected areas)
   - Iterative Reviewer Agent + Dev Agent loop (max 3 rounds)
   - Checks: root cause addressed (not just symptom), edge cases covered, reproduction test thoroughness, project conventions
2. **If PASS**: Proceed to Phase 6
3. **If NEEDS_FIXES after max rounds**: Present unresolved findings to user, ask whether to proceed or revise

**CHECKPOINT CP-BFW-5**: Code review completed and quality verified.

### Phase 6: User Verification

**Goal**: Let the user verify the fix works as expected before committing.

1. **Ask user**: "Fix passes all tests. Would you like to verify before committing?"
   - **(a) Run the app** — Start the dev server so you can manually test the fix scenario
   - **(b) Run a specific command** — Specify a test or script to run
   - **(c) Skip verification** — Proceed directly to commit (automated tests already pass)
2. **If (a)**: Detect and suggest dev server command (e.g. `npm run dev`, `python manage.py runserver`), start it, wait for user confirmation: "Fix verified? (yes/no)"
3. **If (b)**: Run the specified command, show results, ask confirmation
4. **If (c)**: Proceed to Phase 7

If user reports the fix is NOT working:
- Return to Phase 4 (max 2 more attempts)
- If still failing: escalate with analysis

**CHECKPOINT CP-BFW-6**: Fix manually verified by user and working as expected.

---

### Phase 7: Commit & Merge

**Goal**: Commit the fix and offer to merge back to the original branch.

1. **Run `/prizmkit-committer`**:
   - Commit message: `fix(<scope>): <description>`
   - Include both fix code and reproduction test
   - Do NOT push (user decides when to push)
   - `/prizmkit-committer` is a pure commit tool — it does NOT modify `.prizmkit/prizm-docs/` or any project files
   - No `/prizmkit-retrospective` — bug fixes are incomplete features, not new architecture worth documenting
2. **Ask merge preference**:
   ```
   Fix committed on branch `fix/<BUG_ID>-<short-desc>`.
   What would you like to do?
   (a) Merge to <original-branch> and delete fix branch
   (b) Keep fix branch (for PR review workflow)
   (c) Decide later
   ```
3. **If (a)**:
   ```powershell
   git checkout <original-branch>
   git merge fix/<BUG_ID>-<short-description>
   git branch -d fix/<BUG_ID>-<short-description>
   ```
4. **If (b)**: Inform user: "Branch `fix/<BUG_ID>-<short-desc>` retained. Create a PR when ready."
5. **If bug came from .prizmkit/plans/bug-fix-list.json**: inform user to update bug status
   ```
   Bug B-001 fixed and committed.
   To update the bug list: manually set B-001 status to "fixed" in .prizmkit/plans/bug-fix-list.json
   Or retry the pipeline to pick up remaining bugs.
   ```

**CHECKPOINT CP-BFW-7**: Fix committed and merge decision made.

## Resume — Interruption Recovery

The workflow supports resuming from the last completed phase by detecting existing artifacts.

**Detection logic**: Check `.prizmkit/bugfix/<BUG_ID>/` and git branch state:

| Artifact Found | Resume From |
|---------------|------------|
| (nothing) | Phase 0: Branch Setup |
| On `fix/<BUG_ID>-*` branch, no artifacts | Phase 1: Deep Bug Diagnosis |
| `fix-plan.md` only | Phase 4: Fix |
| `fix-plan.md` + code changes exist | Phase 5: Review |
| All docs + review passed | Phase 6: User Verification |
| All docs + committed | Phase 7: Merge decision |

**Resume**: If `<BUG_ID>` matches an existing `.prizmkit/bugfix/<BUG_ID>/` directory, resume instead of starting fresh.

---

## Artifacts

Bug fix artifacts are stored at `.prizmkit/bugfix/<BUG_ID>/`:
- `fix-plan.md` — Triage output (diagnosis, root cause, fix approach)
- `fix-report.md` — Post-fix summary (what changed, test results, TRAPS added)

Only 2 artifact files per bug, consistent with the pipeline convention.

## Comparison with Pipeline Bug Fix

| Dimension | bug-fix-workflow (this skill) | bugfix-pipeline-launcher |
|-----------|-------------------------------|-----------------------------|
| Scope | One bug at a time | All bugs in batch |
| Execution | Interactive, in-session | Foreground or background daemon |
| Diagnosis | Deep interactive Q&A with user | Automated from bug description |
| Branch | Creates `fix/<BUG_ID>-*` branch | Pipeline manages branches |
| Visibility | Full user interaction at each phase | Async, check status periodically |
| User verification | Yes (Phase 6) | No (automated) |
| Best for | Complex bugs needing user input | Batch of well-defined bugs |
| Artifacts | Same (fix-plan.md + fix-report.md) | Same |
| Commit prefix | `fix(<scope>):` | `fix(<scope>):` |

## Error Handling

| Scenario | Action |
|----------|--------|
| Bug ID not found in .prizmkit/plans/bug-fix-list.json | Ask user to provide bug details directly |
| User's bug description is too vague | Ask systematic clarification questions (Phase 1) |
| Cannot reproduce the bug | Ask for more context, try alternative reproduction |
| Fix causes regressions | Revert, analyze, retry (max 3 rounds) |
| Root cause unclear after investigation | Present findings, ask user for guidance |
| Affected files are in unfamiliar module | Read `.prizmkit/prizm-docs/` L1/L2 for that module first |
| Branch conflict during merge | Show conflict, ask user to resolve or keep branch |

## HANDOFF

| From | To | Condition |
|------|----|-----------|
| `bug-planner` | **this skill** | User picks one bug to fix interactively |
| `bugfix-pipeline-launcher` | **this skill** | User wants to fix a stuck/complex bug manually |
| **this skill** | `bugfix-pipeline-launcher` | After fixing, user wants to continue with remaining bugs |
| **this skill** | `prizmkit-committer` | Built into Phase 7 (pure commit, no doc sync) |

## Output

- Fixed code with reproduction test
- `.prizmkit/bugfix/<BUG_ID>/fix-plan.md`
- `.prizmkit/bugfix/<BUG_ID>/fix-report.md`
- Git commit with `fix(<scope>):` prefix on dedicated fix branch
