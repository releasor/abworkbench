---
description: Interactive refactoring planner. Understands refactoring intent through dialogue, analyzes current code structure, produces validated .prizmkit/plans/refactor-list.json for dev-pipeline execution. Use whenever users discuss refactoring planning, code restructuring scope, or preparing .prizmkit/plans/refactor-list.json.
---

# refactor planner

Plan executable refactoring items for dev-pipeline:
- **Scope Assessment**: analyze current code structure and identify refactoring targets
- **Item Decomposition**: break refactoring goals into well-ordered, behavior-preserving items

Always produce a validated `.prizmkit/plans/refactor-list.json` that conforms to `dev-pipeline-refactor-list-v1`.

## Invocation Commitment (Hard Rule)

**When the user invokes `/refactor-planner`, you MUST execute the refactor-planner workflow.** You must NEVER:
- Decide on the user's behalf that the task "doesn't need refactor-planner"
- Skip refactor-planner to jump directly to refactor-workflow or any other skill
- Bypass the interactive phases because you judge the task to be "simple" or "obvious"

If you believe the task is better suited for a different workflow (e.g., single-file refactor via `/refactor-workflow`), you MUST:
1. **Explain why** you think a different path is more appropriate
2. **Ask the user explicitly** whether they want to switch or continue with refactor-planner
3. **Only switch if the user confirms** — otherwise proceed with refactor-planner as invoked

The user chose this skill intentionally. Respect that choice.

## Scope Boundary (Hard Rule)

**This skill is PLANNING ONLY.** You must NEVER:
- Create, modify, or delete source code files (*.js, *.ts, *.py, *.go, *.html, *.css, etc.)
- Execute refactoring operations (rename, move, extract, etc.)
- Run build/install/test commands
- Execute any implementation action beyond writing `.prizmkit/plans/refactor-list.json`

**Your ONLY writable outputs are:**
1. `.prizmkit/plans/refactor-list.json` (`.prizmkit/plans/`)
2. Draft backups in `.prizmkit/plans/` (e.g., `refactor-list.draft.json`)

**After planning is complete**, you MUST:
1. Present the summary and recommended next step
2. **Ask the user explicitly** whether they want to proceed to execution
3. If the user agrees → recommend invoking `refactor-pipeline-launcher` (do NOT execute it yourself)
4. If the user wants to adjust → continue refining `.prizmkit/plans/refactor-list.json`
5. **NEVER auto-execute** the pipeline, launcher, or any implementation step

## User-Provided Content Priority (Hard Rule)

When the user provides detailed specifications, rules, or implementation requirements:

1. **Verbatim preservation**: The user's exact wording MUST be preserved in `description` and `acceptance_criteria` fields. Do NOT paraphrase, summarize, abstract, or simplify.
2. **No autonomous simplification**: A 200-word user specification must NOT become a 30-word description. Match the detail level of the user's input.
3. **Clarify, don't assume**: If any user-provided rule is ambiguous or potentially conflicts with another, ASK the user to clarify. No limit on clarification rounds. Do NOT proceed with unresolved ambiguities.
4. **Populate `user_context`**: ALL user-provided materials (supplementary content, rules, file path references) MUST be written into the `user_context` array of each refactor item in the generated `.prizmkit/plans/refactor-list.json`. Format:
   - Supplementary content or rules → store as-is (verbatim text)
   - File references → store as path string, e.g. `src/auth/login.ts:42-78` or `src/utils/validate.ts — focus on validateEmail function`

## When to Use
- "Plan refactoring", "Scope a restructuring"
- "Prepare .prizmkit/plans/refactor-list.json", "Prepare dev-pipeline input for refactoring"
- "Assess code for refactoring", "Identify refactoring targets"
- "Plan a code migration", "Decompose a large refactor"

Do NOT use this skill when the user wants to:
- Execute a single refactor directly (use `refactor-workflow`)
- Plan new features (use `feature-planner`)
- Fix bugs (use `bug-planner`)

## Resource Loading Rules (Mandatory)

1. **Read decomposition guide**:
   - Read `.claude/command-assets/refactor-planner/assets/planning-guide.md` for decomposition patterns and description guidelines

2. **Read scope assessment reference**:
   - Read `.claude/command-assets/refactor-planner/references/refactor-scoping-guide.md` for scope classification and risk assessment

3. **Read behavior preservation reference**:
   - Read `.claude/command-assets/refactor-planner/references/behavior-preservation.md` for preservation strategy selection

4. **Load on-demand references when triggered**:
   - Validation errors or interrupted session -> read error recovery patterns (similar to feature-planner)

5. **Define the PowerShell Python helper before running validation scripts**:
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
   ```

6. **Always validate output via script**:
   - Run:
     ```powershell
     Invoke-PrizmPython .claude/command-assets/refactor-planner/scripts/validate-and-generate-refactor.py validate --input <output-path>
     ```

7. **Use script output as source of truth**:
   - If validation fails, **MUST** fix and re-run until pass

## Prerequisites

Before questions, check optional context files (never block if absent):
- `.prizmkit/prizm-docs/root.prizm` (architecture/project context)
- `.prizmkit/config.json` (existing stack preferences and detected tech stack)
- Existing test suite (critical for behavior preservation assessment)
- Existing `.prizmkit/plans/refactor-list.json` (if appending additional items)
- If `.prizmkit/prizm-docs/root.prizm` is absent and the project has existing source code, scan the directory structure:
  ```powershell
  Get-ChildItem -Path . -Directory -Recurse -Depth 2 -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\(node_modules|\.git|dist|build|__pycache__|vendor)(\\|$)' } |
    Select-Object -ExpandProperty FullName
  ```

**Test suite detection:**
- Scan for test runner config files (`jest.config.*`, `vitest.config.*`, `pytest.ini`, `.mocharc.*`, `karma.conf.*`)
- If no test suite detected, WARN: "No test suite found. Behavior preservation will rely on manual verification. Consider writing tests before refactoring."
- Record test suite status in planning context for downstream use

## Operation Modes

### Mode A: Interactive (default)
Full Q&A -> code analysis -> item generation. Useful when starting from scratch or exploring refactoring scope.

### Mode B: From Analysis
When an existing analysis report (e.g., `refactor-analysis.md`) is available, skip the analysis phase and proceed directly to item decomposition.

### Mode C: Validate
Validate an existing `.prizmkit/plans/refactor-list.json` without regenerating it:
```powershell
Invoke-PrizmPython .claude/command-assets/refactor-planner/scripts/validate-and-generate-refactor.py validate --input .prizmkit/plans/refactor-list.json
```

### Mode D: Summary
Display a human-readable summary of an existing `.prizmkit/plans/refactor-list.json`:
- Item count, dependency graph, complexity distribution, behavior preservation strategies

## Interactive Mode — Core Workflow

Execute the planning workflow in conversation mode with mandatory checkpoints:

### Phase 1: Project Context

**Goal**: Understand the current codebase structure and tech stack.

1. Read `.prizmkit/prizm-docs/root.prizm` and relevant L1 docs
2. Read `.prizmkit/config.json` for tech stack info
3. Identify existing test suite and coverage
4. Summarize project context to the user: "Here's what I found about your project..."
5. **Collect reference materials** — **Upfront Material Detection (Hard Rule)**: If the user has already provided materials (file paths, URLs, rules, specifications, code snippets) in the same message that invoked this skill: (a) Acknowledge what was received: "I received the following materials: [list]"; (b) Read/fetch all provided materials immediately; (c) You MUST still ask: "Are there any additional materials you'd like to provide?"; (d) NEVER skip this collection step just because the user already provided some materials.

   If the user has NOT provided any materials upfront, explicitly ask whether they have any supplementary materials for you to review before planning the refactoring:
   > "Do you have any reference materials I should review before planning the refactoring? This can include:
   > - **Code paths** — specific files or directories that are refactoring targets or dependencies
   > - **Documents** — design docs, architecture proposals, refactoring RFCs, or technical debt analyses
   > - **Knowledge docs** — `.prizmkit/prizm-docs/` files, README files, or internal wiki pages for the affected area
   > - **Images** — architecture diagrams, dependency graphs, or whiteboard photos
   > - **Web links** — reference implementations, design pattern articles, or migration guides
   >
   > If none, we'll proceed with what's available in the codebase."

   If the user provides materials, read/fetch them all before proceeding to Phase 2. For web links, use web fetch to retrieve and analyze the content. For images, read and analyze them visually. This context is critical for refactoring — understanding the target architecture and constraints prevents risky structural changes.

**CHECKPOINT CP-RP-0**: Project context loaded, tech stack and test suite status known.

### Phase 2: Refactor Goal Collection

**Goal**: Through interactive dialogue, understand what the user wants to refactor and why.

Support 4 input formats (users may mix formats):

**Format A — Natural language**:
> "This module is too large and hard to maintain"
> "The auth logic is scattered across too many files"

**Format B — Code smell pointer**:
> "src/api/handler.js is 800 lines"
> "There are 5 files that all implement similar validation logic"

**Format C — Architecture migration**:
> "Convert callbacks to async/await"
> "Migrate from class components to hooks"
> "Move from monolith to modular architecture"

**Format D — Dependency decoupling**:
> "There's a circular dependency between auth and user modules"
> "The database layer is tightly coupled to the HTTP layer"

For each input, ask clarifying questions:
- What is the specific target (files, modules, patterns)?
- What is the desired end state?
- Are there constraints (must preserve API, must not touch certain files)?
- What is the motivation (maintainability, performance, testability)?

Continue collecting goals until the user says they're done. There is no limit on rounds.

**CHECKPOINT CP-RP-1**: All refactoring goals collected and understood.

### Phase 3: Code Analysis

**Goal**: Analyze the target code to inform item decomposition.

Dispatch **parallel Agent reads** of target files:
- **Agent A (Structure)**: File inventory, dependency graph, module boundaries, public API surface
- **Agent B (Quality)**: Code smells, complexity hotspots, duplication, coupling metrics
- **Agent C (Tests)**: Test coverage of target areas, existing test patterns, behavior contracts

Present consolidated findings:
```
## Code Analysis Results

### Structure
- [file inventory, dependency graph]

### Quality Issues
- [code smells, complexity hotspots, duplication]

### Test Coverage
- [test status for target areas]
- [behavior contracts that must be preserved]

### Recommended Decomposition
- [suggested refactoring order based on findings]
```

Ask: "Based on this analysis, here's how I'd recommend decomposing the refactoring. Does this align with your expectations?"

**CHECKPOINT CP-RP-2**: Code analysis complete, user agrees with recommended approach.

### Phase 4: Item Decomposition

**Goal**: Split refactoring goals into executable, well-ordered items.

Read `.claude/command-assets/refactor-planner/assets/planning-guide.md` for decomposition patterns and dependency ordering rules.

For each refactoring goal:
1. Identify atomic refactoring operations
2. Determine inter-item dependencies (safe renames first, structural changes later)
3. Assess complexity per item (file count, cross-module scope, test coverage)
4. Assign behavior preservation strategy per item (read `.claude/command-assets/refactor-planner/references/behavior-preservation.md`)

**CHECKPOINT CP-RP-3**: All items decomposed with dependencies and preservation strategies.

### Phase 5: Per-Item Confirmation

**Goal**: Present each item to the user for confirmation, modification, or rejection.

For each item, display:

```
Refactor Item R-001:
  Title: [title]
  Type: [extract/rename/restructure/simplify/decouple/migrate]
  Scope: [files list]
  Priority: [critical/high/medium/low]
  Complexity: [low/medium/high]
  Behavior Preservation: [test-gate/snapshot/manual]
  Acceptance Criteria:
    - [criterion 1]
    - [criterion 2]
  Dependencies: [none / R-002, R-003]
  
  Confirm? (Y/modify/skip)
```

- **Y**: Accept item as-is
- **modify**: User provides changes, update item, re-display for confirmation
- **skip**: Remove item from the list

Continue until all items are confirmed or skipped.

**CHECKPOINT CP-RP-4**: All items confirmed by user.

### Phase 6: Completeness Review

**Goal**: Check the full item set for consistency, gaps, and headless execution readiness.

1. **Dependency ordering check**: Verify items form a valid DAG (no cycles). Items should be ordered: safe renames -> extract/inline -> structural changes -> migrations
2. **Behavior preservation check**: Every item must have a declared preservation strategy. Flag any item with `manual` strategy and no test coverage.
3. **Gap detection**: Are there intermediate steps needed between items? Does item A's output match item B's input assumption?
4. **Cross-module impact**: Do any items affect modules outside the declared scope?
5. **Headless Execution Readiness**: The refactor pipeline runs each item through an autonomous AI session with NO human interaction. For each item, verify:
   - **Scope clarity**: Are all affected files explicitly listed? The AI must know exactly where to look.
   - **Refactoring instructions**: Is the description specific enough to execute without ambiguity?
     - ❌ "Clean up the utils module" — what exactly should change?
     - ✅ "Extract validation functions (validateEmail, validatePhone, validateUrl) from src/utils/helpers.ts into src/utils/validation.ts. Update all 12 import sites. Preserve existing function signatures."
   - **Behavior preservation**: Is it clear what tests to run and what behavior must be preserved?
   - **Dependency context**: If item depends on earlier refactors, does the description reference what changed?

Present review summary:
```
Item       | Deps Valid | Preservation | Gaps           | Status
R-001      | OK         | test-gate    | -              | Ready
R-002      | OK         | test-gate    | -              | Ready
R-003      | OK         | manual       | No test coverage| Needs attention
R-004      | OK         | snapshot     | -              | Ready
```

If issues found, discuss with user and resolve before proceeding.

**CHECKPOINT CP-RP-5**: Completeness review passed, all issues resolved.

### Phase 7: Generate & Validate

**Goal**: Produce `.prizmkit/plans/refactor-list.json` and validate it.

**IMPORTANT: Do NOT hand-write the final JSON file.** Instead:
1. Write a draft JSON to `.prizmkit/plans/refactor-list.draft.json` with all collected refactor data.
2. Call the generate script to validate and produce the final file:
   ```powershell
   Invoke-PrizmPython .claude/command-assets/refactor-planner/scripts/validate-and-generate-refactor.py generate --input .prizmkit/plans/refactor-list.draft.json --output .prizmkit/plans/refactor-list.json
   ```
   The script fills in defaults (`$schema`, `created_at`, `created_by`), validates all fields, and writes the final file only if validation passes.
3. If validation fails -> fix the draft and retry (max 3 attempts)
4. If validation passes -> present final summary

**CHECKPOINT CP-RP-6**: `.prizmkit/plans/refactor-list.json` generated and validated.

## Checkpoints (Mandatory Gates)

| Checkpoint | Artifact/State | Criteria | Phase |
|-----------|----------------|----------|-------|
| **CP-RP-0** | Project Context | Tech stack, test suite status, .prizmkit/prizm-docs loaded | 1 |
| **CP-RP-1** | Goals Collected | All refactoring goals understood, no open ambiguities | 2 |
| **CP-RP-2** | Code Analyzed | Analysis complete, user agrees with approach | 3 |
| **CP-RP-3** | Items Decomposed | All items have deps, complexity, preservation strategy | 4 |
| **CP-RP-4** | Items Confirmed | User confirmed/modified/skipped each item | 5 |
| **CP-RP-5** | Completeness OK | DAG valid, preservation strategies declared, no gaps | 6 |
| **CP-RP-6** | Output Valid | `.prizmkit/plans/refactor-list.json` passes validation script | 7 |

**Resume Detection**: If existing artifacts found (partial `.prizmkit/plans/refactor-list.json`, draft `refactor-list.draft.json` in `.prizmkit/plans/`), offer to resume from the appropriate checkpoint.

## Output Rules

`.prizmkit/plans/refactor-list.json` must satisfy:
- `$schema` = `dev-pipeline-refactor-list-v1`
- Non-empty `refactors` array
- Sequential IDs: `R-001`, `R-002`, ...
- Valid dependency DAG (no cycles)
- Each item has a declared `behavior_preservation` object with `strategy` field: `"test-gate"`, `"snapshot"`, or `"manual"`. Optional fields: `existing_tests` (boolean), `new_tests_needed` (string array). See `.prizmkit/dev-pipeline/templates/refactor-list-schema.json` for the full schema.
- `priority` must be a string: `"critical"`, `"high"`, `"medium"`, or `"low"`
- New items default `status: "pending"`
- English titles for stable slug generation
- `type` field must be one of: `extract`, `rename`, `restructure`, `simplify`, `decouple`, `migrate`
- Descriptions minimum 15 words (error). Recommended: 30/50/80 words for low/medium/high complexity (warning).
- `model` field is optional — omitting it means the pipeline uses $MODEL env or CLI default
- `scope` object with nested structure: `files` array (target file paths) and `modules` array (module names)

## Adversarial Critic Defaults

Set default critic fields for each refactor item. The user can override per-item.

| Priority | Complexity | `critic` | `critic_count` |
|----------|-----------|----------|----------------|
| critical | high | `true` | `3` |
| critical | medium/low | `true` | `1` |
| high | high | `true` | `1` |
| other combinations | any | `false` | (omitted) |

---

## Fast Path

For simple refactoring with minimal scope:

### Eligibility Criteria (ALL must apply)
- 1-2 refactor items only
- Complexity: `low` or `medium` for all items
- No cross-module impact (all items within same module)
- Well-known refactoring pattern (rename, extract method/class, inline)
- Existing test coverage for target area

### Fast Path Workflow
1. Confirm refactoring scope with user
2. **User confirmation (mandatory)** — Use `AskUserQuestion` to present interactive selectable options:

   ```
   AskUserQuestion:
     question: "This qualifies for fast-path (simple refactoring). How would you like to proceed?"
     header: "Approach"
     options:
       - label: "Fast-path"
         description: "Skip detailed analysis, draft refactor items directly and add to refactor-list.json"
       - label: "Full workflow"
         description: "Use the complete planning workflow with detailed code analysis"
       - label: "Implement directly"
         description: "Skip the task list entirely and implement the refactoring right now using /prizmkit-plan + /prizmkit-implement"
   ```

   - **Fast-path** → Continue with fast-path workflow below
   - **Full workflow** → Exit fast path, use full workflow from Phase 2
   - **Implement directly** → Invoke `/prizmkit-plan` directly to create spec + plan, then `/prizmkit-implement` to execute. Do NOT add to `.prizmkit/plans/refactor-list.json`
   
   **NEVER proceed without explicit user selection via `AskUserQuestion`. Do NOT render options as plain text — the user must be able to click/select.**
3. Draft items (title + type + scope + description + acceptance_criteria + behavior_preservation + dependencies)
4. Write draft to `.prizmkit/plans/refactor-list.draft.json`, then call the generate script:
   ```powershell
   Invoke-PrizmPython .claude/command-assets/refactor-planner/scripts/validate-and-generate-refactor.py generate --input .prizmkit/plans/refactor-list.draft.json --output .prizmkit/plans/refactor-list.json
   ```
5. If valid -> summarize and recommend next step
6. If invalid -> apply fixes to the draft, re-run generate (max 2 attempts, then escalate to full workflow)

### When NOT to Use Fast Path
- More than 2 refactor items
- Any item with `high` complexity
- Cross-module impact
- Architecture migration patterns (Format C goals)
- No existing test coverage for target area

### Example Fast Path Session
```
User: "Rename the auth middleware function from checkAuth to requireAuth everywhere."
AI: [Detects simple rename, single module]
AI: [Qualifies for fast path: 1 item, low complexity, no cross-module impact]
AI: [Uses AskUserQuestion with options: "Fast-path", "Full workflow", "Implement directly"]
User: [Selects "Fast-path"]
AI: "Drafting R-001..."
AI: [Validates immediately]
AI: "Ready to proceed to dev-pipeline."
```

## Browser Verification

**Browser verification is a feature-pipeline capability only.** Refactors use `behavior_preservation` strategy instead to ensure no external behavior changes:

- `strategy: test-gate` — Rely on existing test suite. Pipeline runs tests before and after refactoring.
- `strategy: snapshot` — Compare behavior before/after refactoring using executable snapshots (outputs, API responses, side effects)
- `strategy: manual` — Require human verification that behavior is preserved

For refactors that modify UI code (e.g., component restructuring), the test-gate or snapshot strategy ensures visual appearance is preserved. You can optionally note browser verification needs in your description or acceptance criteria:

Example:
```
Refactor Title: Extract UserProfile component from AccountSettings
Type: extract
Strategy: snapshot
Acceptance Criteria:
  1. UserProfile component renders identically to inline version (compare snapshots)
  2. All props are correctly forwarded (unit tests pass)
  3. No visual regression (screenshot comparison)
  4. Component is reusable in other views
```

The refactor pipeline AI will use the snapshot strategy to verify external behavior is preserved during refactoring.

---

## Refactoring-Specific Features

### Behavior Preservation Check
Every item MUST declare a behavior preservation strategy. Read `.claude/command-assets/refactor-planner/references/behavior-preservation.md` for strategy details.

| Strategy | When to Use |
|----------|-------------|
| `test-gate` | Target area has good test coverage. Run full test suite after each change. |
| `snapshot` | Compare output/state before and after. Useful when tests are insufficient but behavior is observable. |
| `manual` | Human verification required. Last resort when neither tests nor snapshots are feasible. |

Flag items using `manual` strategy prominently — they carry the highest risk of behavior regression.

### Dependency Ordering
Auto-detect inter-item dependencies and enforce safe ordering:
1. **Safe renames** first (lowest risk, no structural change)
2. **Extract/inline** operations (moderate risk, changes module boundaries)
3. **Structural changes** (higher risk, reorganizes architecture)
4. **Migrations** last (highest risk, changes patterns/paradigms)

### Complexity Assessment
Assess each item's complexity based on:
- **File count**: 1-2 files = low, 3-5 files = medium, 6+ files = high
- **Cross-module scope**: same module = low, 2 modules = medium, 3+ modules = high
- **Test coverage**: high coverage = reduces complexity, low coverage = increases complexity
- **Pattern familiarity**: well-known pattern = low, novel restructuring = high

Take the highest of these individual assessments as the item's complexity.

## Next-Step Execution Policy (after planning)

Recommend invoking `refactor-pipeline-launcher` to configure and launch the dev-pipeline. Do NOT recommend running shell scripts directly — that is the launcher's responsibility.

## Error Recovery & Resume

Key behaviors:
- Warnings only -> proceed with user approval
- Critical errors -> group by type, auto-fix where possible, max 3 total attempts
- Interrupted session -> detect checkpoint from existing artifacts, offer resume or restart
- `.prizmkit/plans/refactor-list.json` MUST be written to `.prizmkit/plans/` (project root level: `./{root}/.prizmkit/plans/refactor-list.json`)

### Resume Detection

| Artifact Found | Resume From |
|---------------|------------|
| Nothing | Phase 1: Project Context |
| Draft in `.prizmkit/plans/` | Phase matching draft state |
| Partial `.prizmkit/plans/refactor-list.json` | Phase 6: Completeness Review |
| Valid `.prizmkit/plans/refactor-list.json` | Mode D: Summary |

## Session Exit Gate

Prevent accidental session exit without deliverable completion.

### Trigger Conditions
Activate exit gate when ALL are true:
- User invoked `/refactor-planner` (not just mentioned refactoring)
- Current phase < Phase 7 (validation not yet passed)
- No valid `.prizmkit/plans/refactor-list.json` has been written in this session

### Gate Behavior
When the session appears to be ending:
1. **Remind**: "You set out to produce `.prizmkit/plans/refactor-list.json` but we haven't completed it yet."
2. **Offer 3 options**:
   - **(a) Continue to completion** — resume from current phase
   - **(b) Save draft & exit** — write current progress as draft, exit session
   - **(c) Abandon** — exit without saving
3. **If (b)**: Write draft and remind: "This is a draft, not validated. Run `/refactor-planner` again to resume."
4. **If (c)**: Accept without further prompting.

## Handoff Message Template

After successful validation, report:
1. Output file path
2. Total refactor items
3. Dependency ordering highlights (which items must run first)
4. Behavior preservation strategy distribution (N items with test-gate, M with snapshot, etc.)
5. Recommended next action: `refactor-pipeline-launcher`
