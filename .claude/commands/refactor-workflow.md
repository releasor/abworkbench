---
description: "One-stop entry point for code refactoring. Brainstorms refactoring goals with the user until fully clarified, then orchestrates refactor-planner → refactor-pipeline-launcher → execution. Handles multi-refactor batch development from a single request. Use this skill whenever the user wants to restructure, clean up, or optimize code without changing behavior. Trigger on: 'refactor', 'clean up code', 'restructure', 'optimize code structure', 'extract module', 'code refactoring', 'batch refactor'."
---

# Refactor Workflow

One-stop entry point for code refactoring. Covers the complete journey from a rough refactoring idea to verified, behavior-preserving code changes: deep goal clarification → structured planning → autonomous pipeline execution.

## When to Use

User says:
- "Refactor the auth module", "Clean up this code", "Restructure the payment service"
- "Extract shared logic into a separate module", "Optimize code structure"
- "Batch refactor these modules", "Code refactoring across multiple files"
- Code has accumulated tech debt that needs structural improvement
- Module needs to be split, merged, or reorganized

**Do NOT use this skill when:**
- User only wants to plan refactoring (use `refactor-planner` directly)
- User only wants to launch pipeline for existing .prizmkit/plans/refactor-list.json (use `refactor-pipeline-launcher`)
- User wants to add features (use `feature-workflow`)
- User wants to fix bugs (use `bug-planner` + `bugfix-pipeline-launcher`)

---

## Overview

```
refactor-workflow <target / goals>
   │
   ├── Phase 1: Brainstorm → clarify type → collect materials → parallel deep read → discuss plan
   │
   ├── Phase 2: Plan → refactor-planner → .prizmkit/plans/refactor-list.json
   │
   ├── Phase 3: Launch → refactor-pipeline-launcher → pipeline execution
   │
   └── Phase 4: Monitor → track progress → report results
```

### What This Skill Does

| Phase | Action | Result |
|-------|--------|--------|
| 1 | **Brainstorm** — clarify type, collect reference materials, parallel deep read code & docs, discuss plan grounded in real code | Fully clarified refactoring goals |
| 2 | Call `refactor-planner` with clarified goals | `.prizmkit/plans/refactor-list.json` with N refactor items |
| 3 | Call `refactor-pipeline-launcher` | Pipeline started (execution mode chosen by user via launcher) |
| 4 | Monitor progress | Status updates, completion report |

### Why This Skill Exists

Without this skill, users must:
1. Figure out all refactoring goals and scope themselves
2. Invoke `refactor-planner` → wait for .prizmkit/plans/refactor-list.json
3. Invoke `refactor-pipeline-launcher` → wait for pipeline start
4. Manually check progress

With this skill, users can:
1. Say "Refactor the auth module to extract shared middleware" with a rough idea
2. The skill brainstorms to fill in all gaps (scope, risks, behavior contracts)
3. All planning + execution happens automatically

### Branch Management

The dev-pipeline handles branch management per-refactor automatically:
- Each refactor item is implemented on its own branch by the pipeline
- Branches are created, committed, and managed by the pipeline session
- This workflow does NOT create a top-level branch — the pipeline manages granular per-refactor branches

---

## Input Modes

**Mode A: From natural language description** (default)

Natural language description of the refactoring goals. Can be:
- A module target: "Refactor the auth module — extract shared middleware, simplify the token flow"
- A batch of refactors: "Clean up the payment service, decouple the notification module, and extract common utilities"
- An incremental request: "Also refactor the logging layer to use structured logging"

Flow: brainstorm → refactor-planner → refactor-pipeline-launcher → monitor

**Mode B: From existing .prizmkit/plans/refactor-list.json**

When user says "run pipeline from existing file" or .prizmkit/plans/refactor-list.json already exists:
- Skip brainstorm and `refactor-planner` (file already exists)
- Invoke `refactor-pipeline-launcher` directly
- Monitor and report progress

**Mode C: Incremental (add to existing refactor plan)**

When user says "add more refactors" or the project already has a .prizmkit/plans/refactor-list.json:
- Brainstorm new refactoring goals with the user
- Invoke `refactor-planner` in incremental mode (reads existing .prizmkit/plans/refactor-list.json)
- Append new refactor items to existing list
- Invoke `refactor-pipeline-launcher`
- Monitor and report progress

---

## Phase 1: Brainstorm — Deep Refactoring Goal Clarification

**Goal**: Through interactive Q&A and deep code reading, transform the user's rough refactoring idea into fully clarified, implementation-ready refactoring goals. This phase is the foundation for safe, behavior-preserving code changes — vague goals produce risky refactors.

**CRITICAL RULE**: The number of questions is **unlimited**. Do NOT rush through this phase. Ask as many rounds as needed until every aspect is clear. Refactoring is inherently risky — thorough understanding prevents broken behavior.

### Step 1.1: Clarify Refactoring Type

**First question** — ask the user to classify the refactoring approach:

| Type | Description | Example |
|------|-------------|---------|
| **Incremental** | Piece-by-piece restructuring, each step independently safe | "Gradually extract shared utilities over several PRs" |
| **Comprehensive** | Full rewrite of a module/area in one pass | "Rewrite the auth module with new architecture" |
| **Targeted** | Specific, focused change to a particular part | "Extract the validation logic from the controller" |

Then ask:
- **What** code needs restructuring (modules, files, patterns)
- **Why** it needs refactoring (tech debt, coupling, complexity, readability, performance structure)
- **What outcome** they want (target architecture, desired structure, quality goals)

### Step 1.2: Collect Reference Materials

**Upfront Material Detection (Hard Rule)**: If the user has already provided materials (file paths, URLs, rules, specifications, code snippets) in the same message that invoked this skill:
1. Acknowledge what was received: "I received the following materials: [list]"
2. Read/fetch all provided materials immediately
3. You MUST still ask: "Are there any additional materials you'd like to provide?"
4. NEVER skip this collection step just because the user already provided some materials

**If the user has NOT provided any materials upfront**, ask the user explicitly what resources they have. Do NOT skip this step — user-provided materials are far more valuable than blind directory scanning.

Ask:
1. **Code paths** — "Which files or directories are the main targets? Any specific files I should look at?"
2. **Design documents** — "Do you have any design docs, architecture diagrams, or refactoring proposals I should read?"
3. **Knowledge docs** — "Are there related `.prizmkit/prizm-docs/`, README files, or internal wiki pages for the target area?"
4. **Related issues/PRs** — "Any related issues, PRs, or previous refactoring attempts I should be aware of?"

Record everything the user provides — these become inputs for Step 1.3.

### Step 1.3: Parallel Deep Reading

**Goal**: Build comprehensive understanding of the target code and context before discussing plans. Spawn multiple agents in parallel to read all relevant materials simultaneously.

**Parallel reading tasks** (launch concurrently):

| Agent | What to read | Purpose |
|-------|-------------|---------|
| Agent A | User-provided code paths — read full source files | Understand current structure, interfaces, dependencies |
| Agent B | User-provided documents — design docs, proposals, wiki pages | Understand intended direction and constraints |
| Agent C | `.prizmkit/prizm-docs/` for affected modules — L1/L2 docs, TRAPS, RULES | Understand existing architecture knowledge and known pitfalls |
| Agent D | Test files for the target area — find and read existing tests | Understand current test coverage and behavior contracts |

**Also gather** (can be included in any agent's task):
- `.prizmkit/config.json` → tech stack preferences
- Directory structure of the target area
- Dependency relationships (imports/exports between target and other modules)

**After all agents complete**: Synthesize findings into a coherent understanding before proceeding to discussion.

### Step 1.4: Discuss Refactoring Plan

**Now** — with deep knowledge of the actual code and documents — discuss the refactoring plan with the user. This discussion is grounded in real code, not abstract questions.

Present what you learned from the parallel reading:
- Current code structure and its problems (with specific file/function references)
- Existing test coverage status (which areas are safe, which are risky)
- Known TRAPS and pitfalls from `.prizmkit/prizm-docs/`
- Dependencies and potential impact on other modules

Then ask targeted questions based on what you read. **Adapt question depth to the refactoring complexity** — a simple extract-method refactor needs fewer questions than a full module decomposition.

**Code Structure:**
- "I see the current structure does X — is the target state Y, or something different?"
- What's the target state? What should the code look like after refactoring?
- Are there specific code smells you've noticed? (duplication, deep nesting, god classes, tight coupling)

**Scope:**
- Based on the code I read, these modules are affected: [list]. Anything else in/out of scope?
- For incremental refactoring: what's the order of priority?

**Behavior Preservation:**
- "These public APIs/interfaces exist: [list]. Which must remain unchanged?"
- "I found these tests: [list]. Are they passing currently?"
- Any undocumented behavior that callers depend on?

**Risk Assessment:**
- "I found these TRAPS in .prizmkit/prizm-docs/: [list]. Any other known gotchas?"
- Does this code have external consumers (other teams, published APIs)?
- Any concurrent development happening in the target area?

**Constraints:**
- Timeline or urgency? (affects whether to do incremental vs comprehensive)
- Team coordination needed? (other developers working in the same area)
- Deployment concerns? (feature flags, backward compatibility, migration)

### Step 1.5: Confirm and Supplement

After the discussion:

1. **Summarize** the refactoring plan — present it back to the user
2. **Ask explicitly**: "Is there anything else you'd like to discuss or supplement before we proceed to formal planning?"
3. **Identify gaps** — if any areas are still unclear, list them explicitly and ask follow-up questions
4. **Repeat** until the user confirms: "That covers everything" or "Let's proceed"

**Signs that brainstorming is complete:**
- All refactoring goals have concrete target state descriptions
- Scope boundaries are clearly defined (in/out)
- Behavior preservation contracts are identified
- Risk areas are acknowledged and mitigation is discussed
- The user has confirmed the summary is accurate

**Signs that more questions are needed:**
- User's answers contain vague terms ("clean it up", "make it better", "fix the structure")
- Scope is undefined ("refactor everything" without specifics)
- No awareness of test coverage for the target area
- Risk areas are handwaved ("it should be fine")
- User says "I'm not sure" — help them think through it with concrete options

### Step 1.6: Requirements Summary

Once brainstorming is complete, produce a structured goals summary:

```markdown
## Refactoring Goals Summary

### Target: [Module/area name]

### Refactoring Type: [Incremental / Comprehensive / Targeted]

### Refactoring Objectives
- [Bullet list of what structural changes are needed and why]

### Current Problems
- [What's wrong with the current structure — with specific code references]

### Target State
- [What the code should look like after refactoring]

### Scope
- **In scope**: [files, modules, directories]
- **Out of scope**: [explicitly excluded areas]

### Behavior Preservation Contracts
- [What behavior must remain unchanged]
- [Key APIs/interfaces that must be preserved]
- [Existing test coverage status]

### Risk Assessment
- [Risk]: [Mitigation strategy]

### Reference Materials Reviewed
- [List of code paths, documents, .prizmkit/prizm-docs/ files that were read]

### Constraints
- [Timeline, coordination, deployment concerns]

### Confirmed by user: ✓
```

Present this summary to the user and get explicit confirmation before proceeding.

**CHECKPOINT CP-RW-0**: Refactoring goals fully clarified and confirmed by user.

---

### Step 1.7: Complexity Assessment & Approach Selection

After confirming refactoring goals, assess whether this refactor needs the full pipeline or can be done directly in the current session.

**Simple refactor → Fast Path candidate** (ALL must be true):
- Single module, no cross-module impact
- ≤3 files affected
- No public API or interface changes
- Straightforward transformation (extract method, rename, move file, simplify logic)
- Existing tests fully cover the affected code paths
- No risk of behavior change

**User choice required (mandatory)** — Use `AskUserQuestion` to present interactive selectable options:

```
AskUserQuestion:
  question: "This refactoring appears straightforward. How would you like to proceed?"
  header: "Approach"
  options:
    - label: "Refactor now (fast path)"
      description: "Plan and refactor directly in this session using /prizmkit-plan + /prizmkit-implement"
    - label: "Add to refactor list (pipeline)"
      description: "Generate .prizmkit/plans/refactor-list.json via refactor-planner, then launch pipeline for autonomous execution"
```

- **Refactor now** → Fast Path Workflow:
  1. Invoke `/prizmkit-plan` with the refactoring goals → generates `spec.md` + `plan.md`
  2. Invoke `/prizmkit-implement` to execute the plan (behavior preservation verified by tests)
  3. After implementation, run `/prizmkit-code-review` for quality check
  4. Commit via `/prizmkit-committer` with `refactor(<scope>):` prefix
  5. Run `/prizmkit-retrospective` to sync `.prizmkit/prizm-docs/`
  6. **End workflow** — skip Phase 2/3/4
- **Add to refactor list** → Continue to Phase 2 (Plan via pipeline)

**Complex refactor → Planning Path** (ANY is true):
- Cross-module impact (>2 modules affected)
- Public API or interface changes required
- Multiple interrelated refactoring steps with dependency ordering
- Comprehensive rewrite of a module
- Insufficient test coverage in target area (risk of hidden behavior changes)
- Requires coordination with other ongoing work

**User choice required (mandatory)** — Use `AskUserQuestion` to present interactive selectable options:

```
AskUserQuestion:
  question: "This refactoring is complex and will benefit from structured planning. How would you like to proceed?"
  header: "Approach"
  options:
    - label: "Plan and refactor now"
      description: "Create a plan and refactor in this session using /prizmkit-plan + /prizmkit-implement"
    - label: "Add to refactor list (pipeline)"
      description: "Generate .prizmkit/plans/refactor-list.json via refactor-planner, then launch pipeline for autonomous execution"
```

- **Plan and refactor now** → Invoke `/prizmkit-plan` with goals → `/prizmkit-implement` → `/prizmkit-code-review` → `/prizmkit-committer` → `/prizmkit-retrospective`. **End workflow** — skip Phase 2/3/4.
- **Add to refactor list** → Continue to Phase 2 (Plan via pipeline)

**NEVER proceed without explicit user confirmation via `AskUserQuestion`. Do NOT render options as plain text — the user must be able to click/select.**

**CHECKPOINT CP-RW-0.5**: Approach selected by user (fast path or pipeline).

---

## Phase 2: Plan

**Goal**: Generate structured .prizmkit/plans/refactor-list.json from the clarified refactoring goals.

**STEPS**:

1. **run the `/refactor-planner` command** with the full goals summary from Phase 1:
   - Pass the structured goals summary as input — NOT the raw user conversation
   - For new refactoring: standard planning mode
   - For existing projects with `--incremental`: incremental planning mode
   - **Input**: Markdown goals summary (refactor targets, scope, behavior preservation strategy)
   - **Output**: `.prizmkit/plans/refactor-list.json` (schema: `dev-pipeline-refactor-list-v1`) containing `project_name`, `refactors[]` with id (R-NNN), title, description, scope, type, priority, complexity, behavior_preservation, acceptance_criteria, dependencies, status

2. **Interactive planning** (if refactor-planner requires clarification):
   - Because Phase 1 was thorough, refactor-planner should need minimal clarification
   - If questions arise, answer from the Phase 1 context or pass through to user

3. **Validate output**:
   - Confirm `.prizmkit/plans/refactor-list.json` exists
   - Show summary: total refactor items, complexity distribution, dependencies

**CHECKPOINT CP-RW-1**: `.prizmkit/plans/refactor-list.json` generated and validated.

**If user says `--from <file>`**: Skip Phase 1 and Phase 2 entirely.

---

## Phase 3: Launch

**Goal**: Start the refactoring pipeline.

**STEPS**:

1. **Show refactor summary** before launching:
   ```
   Ready to launch pipeline with N refactor items:
     R-001: Extract auth middleware (medium complexity)
     R-002: Decouple notification service (high complexity)
     R-003: Simplify token flow (low complexity)

   Proceed? (Y/n)
   ```

2. **run the `/refactor-pipeline-launcher` command**:
   - **Input**: Path to validated `.prizmkit/plans/refactor-list.json`
   - The launcher handles all prerequisites checks
   - The launcher presents execution mode choices to the user (foreground/background/manual)
   - Do NOT duplicate execution mode selection here — let the launcher handle it
   - **Output**: PID/status, log file path, execution mode selected
   - Returns PID/status and log file location

3. **Verify launch success**:
   - Confirm pipeline is running
   - Record PID and log path for Phase 4

**CHECKPOINT CP-RW-2**: Pipeline launched successfully.

---

## Phase 4: Monitor

**Goal**: Track pipeline progress and report to user.

**STEPS**:

1. **Initial status check**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-refactor-daemon.ps1 status
   ```

2. **Offer monitoring options**:
   - "I'll check progress periodically. Say 'status' anytime for an update."
   - "Say 'logs' to see recent activity."
   - "Say 'stop' to pause the pipeline."

3. **Periodic progress reports** (when user asks):
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
   Invoke-PrizmPython .prizmkit/dev-pipeline/scripts/update-refactor-status.py `
     --refactor-list .prizmkit/plans/refactor-list.json `
     --state-dir .prizmkit/state/refactor `
     --action status
   ```

4. **Completion report** (when pipeline finishes all refactor items):
   ```
   Pipeline completed: 3/3 refactor items

   Summary:
   - R-001: Extract auth middleware → COMMITTED (refactor(auth): extract shared middleware)
   - R-002: Decouple notification service → COMMITTED (refactor(notifications): decouple from core)
   - R-003: Simplify token flow → COMMITTED (refactor(auth): simplify token refresh)

   Next steps:
   - Review changes: git log --oneline -5
   - Run tests: npm test
   - Push when ready: git push
   ```

**CHECKPOINT CP-RW-3**: All refactor items completed or user stopped pipeline.

---

## Resume — Interruption Recovery

The workflow supports resuming by detecting existing state:

| State Found | Resume From |
|-------------|------------|
| No `.prizmkit/plans/refactor-list.json` | Phase 1: Brainstorm |
| `.prizmkit/plans/refactor-list.json` exists, no pipeline state | Phase 3: Launch |
| `.prizmkit/plans/refactor-list.json` + pipeline state exists | Phase 4: Monitor (check status) |
| All refactors completed | Report completion, suggest next steps |

**Resume**: If `.prizmkit/plans/refactor-list.json` exists, ask user: "Existing refactor plan found with N items. Resume pipeline or re-plan?"

---

## Interaction During Pipeline

While the pipeline runs, the user can continue the conversation:

| User says | Action |
|-----------|--------|
| "status" / "progress" | Show current progress |
| "logs" | Show recent log activity |
| "stop" | Stop the pipeline (state preserved) |
| "show R-002 logs" | Show specific refactor item's session log |

---

## Error Handling

| Error | Action |
|-------|--------|
| User's refactoring goal is too vague | Ask for more context: "Can you describe what's wrong with the current code structure?" |
| Brainstorming stalls | Offer concrete options: "Would you prefer incremental or comprehensive refactoring?" |
| No tests exist for target module | WARN user, recommend writing tests first before refactoring |
| `refactor-planner` cannot parse goals | Refine the goals summary and retry |
| `.prizmkit/plans/refactor-list.json` generation failed | Show error, retry with refined input |
| Pipeline launch failed | Show daemon log, suggest manual start |
| All refactor items blocked/failed | Show status, suggest retrying specific items |
| User wants to cancel mid-brainstorming | Save conversation context, offer to resume later |
| Behavior regression detected during pipeline | Pipeline handles per-item — failed items are retried or reported |



## Output

- Structured refactoring goals summary (Phase 1 artifact)
- `.prizmkit/plans/refactor-list.json` (Phase 2 artifact)
- Pipeline execution (Phase 3)
- Progress updates (Phase 4)
- Multiple git commits with `refactor(<scope>):` prefix
- Updated `.prizmkit/prizm-docs/` (via prizmkit-retrospective per refactor item)
