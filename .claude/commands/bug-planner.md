---
description: "Interactive bug planning that produces .prizmkit/plans/bug-fix-list.json for the Bug Fix Pipeline. Supports multiple input formats: error logs, stack traces, user reports, failed tests, monitoring alerts. Use this skill whenever the user has bugs to report, errors to parse, or test failures to organize. Trigger on: 'plan bug fixes', 'report bugs', 'I have some bugs', 'these tests are failing', 'here is an error log', 'parse these errors', 'generate bug list'."
---

# Bug Planner

Interactive skill that collects bug information from various input formats and generates a standardized `.prizmkit/plans/bug-fix-list.json` for the Bug Fix Pipeline.

## Invocation Commitment (Hard Rule)

When the user invokes `/bug-planner`, you MUST execute the bug-planner workflow. You must NEVER:
- Decide on the user's behalf that the task "doesn't need bug-planner"
- Skip bug-planner to jump directly to implementation or any other skill
- Bypass the interactive phases because you judge the task to be "simple"

If you believe the task is better suited for a different workflow, you MUST:
1. Explain why you think a different path is more appropriate
2. Ask the user explicitly whether they want to switch or continue with bug-planner
3. Only switch if the user confirms

The user chose this skill intentionally. Respect that choice.

## Scope Boundary (Hard Rule)

This skill is PLANNING ONLY. You must NEVER:
- Create, modify, or delete source code files (*.js, *.ts, *.py, *.go, *.html, *.css, etc.)
- Run build/install/test commands
- Execute any bug fix action
- Execute any implementation action beyond writing `.prizmkit/plans/bug-fix-list.json`

Your ONLY writable outputs are:
1. `.prizmkit/plans/bug-fix-list.json`
2. Draft backups in `.prizmkit/plans/` (e.g., `bug-fix-list.draft.json`)

After planning is complete, you MUST:
1. Present the summary and recommended next step (invoking `bugfix-pipeline-launcher`)
2. Ask the user explicitly whether they want to proceed to execution
3. If the user wants to adjust → continue refining the bug list
4. NEVER auto-execute the pipeline, launcher, or any fix step

## User-Provided Content Priority (Hard Rule)

When the user provides detailed specifications, rules, or implementation requirements:

1. **Verbatim preservation**: The user's exact wording MUST be preserved in `description` and `acceptance_criteria` fields. Do NOT paraphrase, summarize, abstract, or simplify.
2. **No autonomous simplification**: A 200-word user specification must NOT become a 30-word description. Match the detail level of the user's input.
3. **Clarify, don't assume**: If any user-provided rule is ambiguous or potentially conflicts with another, ASK the user to clarify. No limit on clarification rounds. Do NOT proceed with unresolved ambiguities.
4. **Populate `user_context`**: ALL user-provided materials (supplementary content, rules, file path references) MUST be written into the `user_context` array of each bug in the generated `.prizmkit/plans/bug-fix-list.json`. Format:
   - Supplementary content or rules → store as-is (verbatim text)
   - File references → store as path string, e.g. `src/auth/login.ts:42-78` or `src/utils/validate.ts — focus on validateEmail function`

## When to Use
- "plan bug fixes", "report bugs", "create bug list"
- "generate bug list", "I have some bugs to fix"
- "these tests are failing", "here's an error log", "parse these errors"
- After receiving bug reports, error logs, or failed test output

**Do NOT use when:**
- User wants to start fixing bugs now → use `bugfix-pipeline-launcher`
- User wants to fix a single bug interactively → use `bug-fix-workflow`
- User wants to plan features → use `feature-planner`

## Intent Routing

This skill handles multiple operations. Determine the user's intent and execute the matching operation:

| User Intent | Operation | Trigger Phrases |
|---|---|---|
| Plan bugs interactively | **Interactive Planning** | "plan bug fixes", "report bugs" |
| Parse error logs into bugs | **From Log** | "parse this error log", "here's a stack trace", "parse these errors" |
| Parse test failures into bugs | **From Tests** | "these tests are failing", "parse test output" |
| Validate existing bug list | **Validate** | "validate bug list", "check .prizmkit/plans/bug-fix-list.json" |
| Summarize bug list | **Summary** | "bug summary", "show bug list", "list bugs" |

## PowerShell Python Helper

Define this helper once in the active PowerShell session before running PrizmKit validation scripts:

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

## Scenario Routing

Classify user intent first:

### Route A: New Bug List (No Existing Plan)

Use when no `.prizmkit/plans/bug-fix-list.json` exists.

Actions:
1. Run full Interactive Planning (Phase 1-5)
2. Generate initial `.prizmkit/plans/bug-fix-list.json`

### Route B: Append to Existing Bug List

Use when `.prizmkit/plans/bug-fix-list.json` already exists and user wants to add more bugs.

Actions:
1. Read existing `.prizmkit/plans/bug-fix-list.json` first (if missing, ask whether to start new plan)
2. Continue with next sequential `B-NNN` IDs
3. Preserve existing entries, append new bugs
4. Re-run validation on the merged list

---

## Operation: Interactive Planning

Launch the interactive bug planning process through 5 phases.

### Phase 1: Project Context

Gather project metadata from the project's own configuration and documentation — bug-planner is independent of feature-planner, so it reads project-level sources directly rather than depending on feature-list.json.

1. **Identify project**: Read project name and description from these sources (first match wins):
   - `.prizmkit/config.json` (`project_name`, `description` fields)
   - `.prizmkit/prizm-docs/root.prizm` (project overview section)
   - `CLAUDE.md` or `CODEBUDDY.md` (project instructions)
   - `package.json` / `pyproject.toml` / `Cargo.toml` (name + description fields)
   - If none found, ask the user
2. **Identify tech stack**: Read from these sources (first match wins):
   - `.prizmkit/config.json` `tech_stack` (preferred — contains language, frameworks, DB, etc.)
   - `.prizmkit/prizm-docs/root.prizm` (architecture section)
   - Auto-detect from project files (`package.json`, `requirements.txt`, `go.mod`, etc.)
   - If none found, ask the user
3. **Identify testing framework**: Read from `.prizmkit/config.json` `tech_stack.testing`, or auto-detect from package.json/requirements.txt/etc., or ask user
4. **Clarify context** — if the project context, affected systems, or bug scope is unclear, ask questions one at a time (cite the unclear point, give a recommended answer with rationale) until you fully understand the environment. No limit on rounds or number of questions.
5. **Collect reference materials** — **Upfront Material Detection (Hard Rule)**: If the user has already provided materials (file paths, URLs, rules, specifications, code snippets) in the same message that invoked this skill: (a) Acknowledge what was received: "I received the following materials: [list]"; (b) Read/fetch all provided materials immediately; (c) You MUST still ask: "Are there any additional materials you'd like to provide?"; (d) NEVER skip this collection step just because the user already provided some materials.

   If the user has NOT provided any materials upfront, explicitly ask whether they have any supplementary materials for you to review before proceeding to bug collection:
   > "Do you have any reference materials I should review to better understand these bugs? This can include:
   > - **Code paths** — files or directories where the bugs likely originate
   > - **Documents** — related design docs, API specs, or architecture docs for the affected area
   > - **Error screenshots** — UI screenshots, console output images, or monitoring dashboards
   > - **Web links** — related issue tracker links, Stack Overflow threads, or documentation pages
   > - **Log files** — error log paths or monitoring tool URLs
   >
   > If none, we'll proceed with bug collection."

   If the user provides materials, read/fetch them all before proceeding to Phase 2. For web links, use web fetch to retrieve and analyze the content. For images, read and analyze them visually. This context significantly improves bug diagnosis accuracy and description quality.

Output: `project_name`, `project_description`, `global_context` fields populated.

**Gate → CP-BP-1**: Tech stack and project info confirmed before proceeding.

### Phase 2: Bug Collection

Accept bug information in ANY of these formats (auto-detect):

#### Severity & Input Format References

When classifying severity, read `.claude/command-assets/bug-planner/references/severity-rules.md` for the auto-classification table (critical/high/medium/low indicators and special cases).

When parsing user input, auto-detect the format and read `.claude/command-assets/bug-planner/references/input-formats.md` for extraction patterns. Supported formats: stack traces, user reports, failed tests, log patterns, monitoring alerts.

**For each bug collected**, interactively confirm or fill in:
- Title (auto-suggest from error message, user can edit)
- Description (auto-generate expected vs actual, user can edit)
- Severity (auto-suggest based on error type, user can override)
- Environment (ask or auto-detect from logs)
- Verification type (suggest `automated` by default, ask user)
- Acceptance criteria (auto-suggest based on description, user can edit)
- Model override (optional; if specified, overrides $MODEL env var for this bug fix)

**Per-bug clarification** — if the bug's root cause, reproduction steps, expected behavior, or scope is unclear from the provided information, ask focused questions one at a time (cite the unclear point, give a recommended answer with rationale) until the bug is fully understood. Do not finalize a bug entry with ambiguous details. No limit on the number of questions per bug.

**Per-bug confirmation (mandatory)** — after extracting and clarifying each bug, present a structured summary using the template in `.claude/command-assets/bug-planner/assets/bug-confirmation-template.md`, then ask the three confirmation questions defined there.

The acceptance criteria are critical — they directly determine how the bugfix pipeline judges success or failure. Vague criteria like "login works" lead to shallow fixes; prefer specific, verifiable conditions like "POST /api/login with valid credentials returns 200 and a JWT token in the response body."

Only finalize the bug entry after user confirms all three points.

**Multiple bugs per session**: After each bug, ask "Any more bugs to add? (yes/no)"

**Gate → CP-BP-2**: All bugs extracted and confirmed by user.

### Phase 3: Prioritization & Review

1. **Auto-assign priorities**: Based on severity, adjustable by user

   **Severity → Priority Mapping**:
   - `critical` severity → `high` priority (treated with highest urgency)
   - `high` severity → `high` priority
   - `medium` severity → `medium` priority
   - `low` severity → `low` priority

   Note: Severity has 4 levels (critical, high, medium, low) but Priority has 3 levels (high, medium, low). Both critical and high severity bugs map to high priority.
2. **Display summary table**:
   ```
   ID    | Title                        | Severity | Priority | Verification
   B-001 | Login null reference crash    | critical | high     | automated
   B-002 | CSV export Chinese encoding   | medium   | medium   | hybrid
   B-003 | Slow dashboard loading        | low      | low      | manual
   ```
3. **Ask for adjustments**: "Want to reorder priorities, change severity, or remove any bugs?"
4. **Detect potential duplicates**: If two bugs have similar error messages or affected modules, warn user

**Gate → CP-BP-3**: Severity/priority assigned, duplicates resolved.

### Phase 4: Pre-Generation Completeness Review

Before generating `.prizmkit/plans/bug-fix-list.json`, perform a holistic scan across all collected bugs. The bugfix pipeline runs autonomously — any ambiguity left here becomes a wrong assumption later.

**Step 1 — Description adequacy scan (Headless Execution Readiness)**: The bugfix pipeline runs each bug through an autonomous AI session with NO human interaction. Every description must be unambiguous enough for headless execution. For each bug, check:
- Description clearly states **expected** vs **actual** behavior (not just "X doesn't work")
- Reproduction path is specific enough for the pipeline AI to locate the relevant code
- If the bug involves user interaction, the trigger action is described (not just the symptom)
- **Code location hints**: Where in the codebase should the AI look? (file paths, module names, function names)
- **Verification method**: How should the AI verify the fix? (run specific test, check specific behavior)
- Bad: "Login is broken" — too vague, AI will search the entire codebase
- Good: "Login form at /login returns 500 when password field is empty. Expected: validation error 400. Root cause likely in src/api/auth.ts POST /api/auth/login handler — missing null check on password field."

**Step 2 — Acceptance criteria specificity check**: For each bug, verify each acceptance criterion passes the "pipeline autonomy test" — could an AI session, without asking a human, determine whether this criterion is met? Flag criteria that are subjective ("works correctly"), lack measurable conditions ("performs better"), or don't specify the verification method.

**Step 3 — Cross-bug analysis**: Check for:
- **Root cause overlap**: Multiple bugs in the same module may share a root cause — flag for user to confirm whether they should be merged or kept separate
- **Missing dependencies**: If fixing B-002 requires B-001 to be fixed first, flag the dependency
- **Scope gaps**: If bugs describe symptoms but the underlying cause likely affects more areas, suggest additional bugs

**Step 4 — Present review table**: Display the completeness assessment using the template in `.claude/command-assets/bug-planner/assets/bug-confirmation-template.md` (§Completeness Review Template).

For any items that need attention, ask targeted questions to fill gaps. Iterate until the user confirms all bugs are adequately described. Present bilingual prompt:

> "以上是完整性审查结果。需要补充的项目是否逐一补充？还是先跳过，之后再完善？"
> "Above is the completeness review. Items needing more detail — address them now, or proceed and refine later?"

Only proceed to Phase 5 after user confirms.

**Gate → CP-BP-4**: All bugs pass headless execution readiness check.

### Phase 5: Generate & Validate

1. **Write draft JSON**: Write a draft `.prizmkit/plans/bug-fix-list.draft.json` with all collected bug data. Conform to `.prizmkit/dev-pipeline/templates/bug-fix-list-schema.json`.
2. **Generate and validate**: Run the generate script to validate and produce the final file:
   ```powershell
   Invoke-PrizmPython .claude/command-assets/bug-planner/scripts/validate-bug-list.py generate --input .prizmkit/plans/bug-fix-list.draft.json --output .prizmkit/plans/bug-fix-list.json
   ```
   The script fills in defaults (`$schema`, `created_at`, `created_by`), validates all fields, and writes the final file only if validation passes.
3. **If validation fails**: Fix the draft and retry (max 3 attempts). If the script is unavailable, use the checklist in `.claude/command-assets/bug-planner/references/schema-validation.md`.
4. **Output**: File path, summary, and next steps

**Gate → CP-BP-5**: `bug-fix-list.json` passes validation script with zero errors.

#### Success Output

```
.prizmkit/plans/bug-fix-list.json generated with 3 bugs (1 critical, 1 medium, 1 low)

Next steps:
- Review: Get-Content .prizmkit/plans/bug-fix-list.json
- Start fixing: say "start fixing" to launch the bugfix pipeline via bugfix-pipeline-launcher
```

### Checkpoints (Mandatory Gates)

Checkpoints catch cascading errors early — skipping one means the next phase builds on unvalidated assumptions.

| Checkpoint | Artifact/State | Criteria | Phase |
|-----------|----------------|----------|-------|
| **CP-BP-1** | Project Context | Tech stack and project info confirmed | 1 |
| **CP-BP-2** | Bugs Collected | All bugs extracted and confirmed by user | 2 |
| **CP-BP-3** | Priorities Set | Severity/priority assigned, duplicates resolved | 3 |
| **CP-BP-4** | Completeness Passed | All bugs pass headless execution readiness check | 4 |
| **CP-BP-5** | File Generated | `bug-fix-list.json` passes validation script | 5 |

**Resume Detection**: If existing `.prizmkit/plans/bug-fix-list.json` or draft found, read `.claude/command-assets/bug-planner/references/error-recovery.md` §Resume Support for checkpoint-based resumption.

---

## Operation: From Log

Batch-parse error logs to generate bug entries without interactive prompts:

1. Accept log file path or piped content
2. Parse all unique errors (deduplicate by error message pattern)
3. Auto-generate bug entries with:
   - Title: first line of error message
   - Description: full error context
   - Severity: use `.claude/command-assets/bug-planner/references/severity-rules.md`
   - error_source: populated from log content
   - verification_type: default to `automated`
   - acceptance_criteria: auto-generate "Error no longer occurs in [scenario]"
4. Write draft to `.prizmkit/plans/bug-fix-list.draft.json` for user review
5. Ask: "Review and confirm? You can edit individual entries."
6. After user confirms, call the generate script:
   ```powershell
   Invoke-PrizmPython .claude/command-assets/bug-planner/scripts/validate-bug-list.py generate --input .prizmkit/plans/bug-fix-list.draft.json --output .prizmkit/plans/bug-fix-list.json
   ```

## Operation: From Tests

Batch-parse failed test output:

1. Accept test runner output (Jest, pytest, Go test, etc.)
2. Parse each failed test case as a separate bug entry
3. Auto-populate `failed_test_path`, `error_message`
4. Set verification_type to `automated` (test already exists)
5. Write draft to `.prizmkit/plans/bug-fix-list.draft.json`
6. After user confirms, call the generate script:
   ```powershell
   Invoke-PrizmPython .claude/command-assets/bug-planner/scripts/validate-bug-list.py generate --input .prizmkit/plans/bug-fix-list.draft.json --output .prizmkit/plans/bug-fix-list.json
   ```

## Operation: Validate

Validate existing `.prizmkit/plans/bug-fix-list.json`:

1. Check JSON syntax
2. Validate against `.prizmkit/dev-pipeline/templates/bug-fix-list-schema.json`
3. Check for:
   - Duplicate IDs
   - Missing required fields
   - Invalid status values
   - Invalid priority values (must be 'high', 'medium', or 'low')
4. Output: validation result with specific errors/warnings

## Operation: Summary

Print human-readable summary:

```
Bug Fix List Summary: my-web-app

Total: 3 bugs
By Severity: critical=1, high=0, medium=1, low=1
By Status:   pending=3

Bug List (by priority):
  1. [B-001] Login null reference crash (CRITICAL) — automated
  2. [B-002] CSV export Chinese encoding (MEDIUM) — hybrid
  3. [B-003] Slow dashboard loading (LOW) — manual
```

---

## Adversarial Critic & Browser Verification

When configuring critic settings or browser verification for bugs, read `.claude/command-assets/bug-planner/references/critic-and-verification.md` for default behavior tables and verification type guidance.

Key points:
- Critic is enabled by default for critical/high severity, disabled for medium/low
- Users can override critic settings per-bug during Phase 2 or Phase 3
- Browser verification is feature-pipeline only — bug fixes use `verification_type` field (automated/manual/hybrid)

---

## Next-Step Execution Policy

Recommend invoking `bugfix-pipeline-launcher` to configure and launch the pipeline. Do NOT recommend running shell scripts directly — that is the launcher's responsibility.

After `.prizmkit/plans/bug-fix-list.json` is generated, present:
1. Summary of generated bugs (count, severity breakdown)
2. Recommend: "Say 'start fixing' to launch the bugfix pipeline via `bugfix-pipeline-launcher`"
3. Alternative: fix a single bug interactively via `bug-fix-workflow`

## Error Handling

If validation fails or a session is interrupted, read `.claude/command-assets/bug-planner/references/error-recovery.md` for the full error type table, retry logic, and checkpoint-based resume support.

Common errors handled inline:

| Error | Action |
|-------|--------|
| Cannot parse error log format | Ask user to specify format or provide raw text |
| Ambiguous severity classification | Present options, ask user to choose |
| Duplicate bug detected | Warn user, suggest merging or keeping separate |
| No bugs provided | Prompt with examples of supported input formats |
| Invalid feature reference | Warn and ask user to correct or remove reference |
| Schema validation failure | Show specific errors, offer to fix interactively |

## Output

- `.prizmkit/plans/bug-fix-list.json` conforming to `.prizmkit/dev-pipeline/templates/bug-fix-list-schema.json`
- Validation report (if validation run)
- Summary report (if summary run)
