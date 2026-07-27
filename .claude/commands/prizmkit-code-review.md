---
description: "Iterative review-fix loop against spec and plan. Spawns a read-only Reviewer agent, filters findings, then a Dev agent applies fixes. Loops until PASS (max 3 rounds). Use after /prizmkit-implement as quality gate. Trigger on: 'review', 'check code', 'code review', 'is it ready to commit'. (project)"
---

# PrizmKit Code Review

An iterative review-fix loop that reviews code changes against the spec and plan, then automatically fixes issues. Uses three separated roles:

- **Reviewer Agent** (read-only): analyzes git diff against spec goals and plan decisions, produces structured findings
- **Main Agent** (orchestrator): filters Reviewer findings for reasonableness, coordinates the loop
- **Dev Agent** (read-write): applies fixes for accepted findings

The loop repeats until the Reviewer finds no issues or the max round limit is reached.

### When to Use
- After `/prizmkit-implement` to verify code quality before commit
- User says "review", "check code", "review my implementation"
- As a quality gate before `/prizmkit-committer`

### When NOT to Use
- Trivial changes (typo, single-line config) → commit directly
- No spec.md or plan.md exists → nothing to review against

## Input

| Parameter | Required | Description |
|-----------|----------|-------------|
| `artifact_dir` | No | Directory containing spec.md + plan.md. If omitted, scan `.prizmkit/` subdirectories for the most recently modified directory with a `plan.md` whose tasks are all completed. |

## Phase 0: Context Loading

1. **Read spec.md** from the artifact directory — extract goals and acceptance criteria.
2. **Read plan.md** from the artifact directory — extract architecture decisions and completed tasks.
3. **Read dev rules** (if configured): Read `.prizmkit/prizm-docs/root.prizm` and check for a `RULES:` line. If present, read all referenced `.prizmkit/rules/<layer>-rules.md` files. If a referenced file does not exist, skip it silently and continue. These define per-layer conventions that the code should follow.
4. **Capture workspace diff**: run `git diff` (unstaged) + `git diff --cached` (staged) + `git status` to understand the full scope of changes. For new files in git status, note their paths for the Reviewer to read.
   - If no changes are detected, output PASS and stop.

## Phase 1: Review-Fix Loop

```
┌─── Loop (max 3 rounds) ──────────────────────────────┐
│                                                        │
│  Step 1: Spawn Reviewer Agent (read-only)              │
│    → Input: git diff + spec goals + plan decisions + dev rules│
│    → Output: structured findings or PASS               │
│                                                        │
│  Step 2: Check result                                  │
│    → If PASS (no findings): exit loop                  │
│                                                        │
│  Step 3: Main Agent filters findings                   │
│    → For each finding: accept (reasonable) or reject   │
│    → If all rejected: exit loop                        │
│                                                        │
│  Step 4: Spawn Dev Agent (read-write)                  │
│    → Input: accepted findings + spec/plan context      │
│    → Output: fix report                                │
│                                                        │
│  Step 5: Back to Step 1                                │
│                                                        │
│  Hard limit: exit after 3 rounds regardless            │
│  → On max-round exhaustion: output a summary of all    │
│    unresolved findings to the conversation, then write  │
│    review-report.md with NEEDS_FIXES verdict.           │
└────────────────────────────────────────────────────────┘
```

### Step 1: Spawn Reviewer Agent

Include the dev rules read in Phase 0 step 3 in the `## Dev Rules` section of the prompt below. Spawn a **read-only** agent (subagent_type: `Explore`) with the following prompt:

```
You are a code reviewer. Review workspace changes against the spec goals, plan decisions, and per-layer dev rules.

## Spec Goals
{goals and acceptance criteria from spec.md}

## Plan Decisions
{architecture decisions and task list from plan.md}

## Dev Rules (per-layer conventions)
{rules from .prizmkit/rules/<layer>-rules.md, or "No custom dev rules configured — use general best practices."}

## Review Round
Round {N}. {round_context}

## What to Review
Run these commands to see the current workspace changes:
- `git diff` (unstaged changes)
- `git diff --cached` (staged changes)
- `git status` (new/deleted files)

For new files shown in git status, read their full content.
For modified files, read enough surrounding context to understand the change.

## Review Dimensions
Evaluate the changes across these dimensions (focus on what's relevant):

1. **Goal alignment**: Do the changes accomplish all goals from spec.md? Anything missing or off-target?
2. **Defects**: Logic bugs, missing error handling, boundary condition issues, incorrect behavior.
3. **Completeness**: Files that should have been changed but weren't? Missing tests, types, imports, exports?
4. **Consistency**: Do changes follow the project's existing patterns, naming conventions, and code style?
5. **Security**: Hardcoded secrets, injection vulnerabilities, unsafe operations.
6. **Rules compliance**: (Skip this dimension if no dev rules were provided.) Do changes follow the per-layer dev rules? Flag violations of framework conventions, naming patterns, state management, or other rules defined for that layer.

## Output Format
Respond with EXACTLY this format:

### Result: PASS | NEEDS_FIXES

### Findings
(If PASS, write "No issues found.")

#### Finding N
- **Severity**: high | medium | low
- **Dimension**: goal-alignment | defect | completeness | consistency | security | rules-compliance
- **Location**: filepath:line (or "project-level")
- **Problem**: What is wrong and why it matters
- **Suggestion**: Recommended fix approach
- **Verification**: How to confirm the fix is correct

### Summary
One to two sentences about the overall state of the changes.
```

**Round context** varies by round:
- Round 1: "This is the first review. Examine all changes comprehensively."
- Round 2+: "Previous round found issues that were fixed. Focus on: (1) whether previous fixes are correct, (2) whether fixes introduced new problems, (3) any remaining issues. Do not re-report issues that have already been fixed."

### Step 2: Check Result

Parse the Reviewer Agent's output:
- If `Result: PASS` → exit loop, proceed to Phase 2.
- If `Result: NEEDS_FIXES` → extract findings and continue to Step 3.

### Step 3: Main Agent Filters Findings

Review each finding and decide whether it's reasonable. This prevents unnecessary or harmful changes.

**For each finding, evaluate:**
- Is this relevant to the current changes? (Reject findings about unmodified, unrelated code.)
- Is this a real problem or a subjective style preference? (Reject pure style preferences unless they violate clear project conventions.)
- Would fixing this improve the code without introducing risk? (Reject fixes that require large refactors outside scope.)

**Output per finding:**
- **Accepted**: The finding is reasonable — include it in the Dev Agent's task.
- **Rejected** (with reason): Brief explanation (e.g., "Out of scope", "Style preference, not a defect").

If all findings are rejected → exit loop, proceed to Phase 2.

### Step 4: Spawn Dev Agent

Spawn a **general-purpose** agent (read-write) with the following prompt:

```
You are a developer fixing code review findings. Apply each fix carefully without breaking existing functionality.

## Spec Context
{goals from spec.md for reference}

## Findings to Fix
{accepted findings list — each with Severity, Location, Problem, Suggestion, Verification}

## Instructions
1. Read each finding carefully.
2. For each finding:
   a. Read the relevant code and understand the context.
   b. Implement the fix based on the suggestion.
   c. If a suggestion is not feasible (would break other functionality, technically impossible), explain why.
3. After all fixes, report what you did.

## Output Format
For each finding, report:
- **Finding N**: [fixed | unable-to-fix]
- **What was done**: Brief description
- **Files modified**: List of changed files
(If unable-to-fix, explain why)
```

After the Dev Agent returns, record results and return to Step 1 for the next round.

## Phase 2: Output

Write `review-report.md` to the artifact directory:

```markdown
# Review Report

## Verdict: PASS
## Rounds: 2
## Total findings: 3 → Fixed: 2, Rejected: 1

## Round 1
Findings: 3 | Accepted: 2, Rejected: 1

### Finding 1: Missing null check in parseConfig
- Severity: high
- Dimension: defect
- Location: src/config.ts:42
- Problem: parseConfig crashes when input is undefined
- Status: fixed (round 1)

### Finding 2: Export missing from index.ts
- Severity: medium
- Dimension: completeness
- Location: src/index.ts
- Problem: New parseConfig function not exported
- Status: fixed (round 1)

### Finding 3: Consider renaming variable
- Severity: low
- Dimension: consistency
- Location: src/config.ts:15
- Problem: Variable `d` should be more descriptive
- Status: rejected — Style preference; existing code uses short names in this module

## Round 2: PASS — no new findings
```

- `PASS`: Reviewer returned no findings (or all remaining findings were rejected as unreasonable)
- `NEEDS_FIXES`: 3 rounds completed but unresolved findings remain

Also output a completion summary to conversation.

**HANDOFF:** `/prizmkit-retrospective` (if PASS) or inform the caller of remaining issues (if NEEDS_FIXES after max rounds)
