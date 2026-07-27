---
description: "Full-stack test generation and orchestration. Detects architecture, discovers/runs existing tests, analyzes coverage gaps, generates missing tests (unit/integration/E2E), outputs unified report. Use after completing development to verify quality before deploy. Trigger on: 'test', 'run tests', 'check quality', 'verify code', 'generate tests', 'test coverage', 'fill test gaps', 'quality check', '测试', '验证', '跑测试', '补测试'. (project)"
---

# PrizmKit Test

A comprehensive test generation and orchestration skill. Discovers existing tests, runs them, compares coverage against spec acceptance criteria and module interfaces, generates missing tests at three levels (unit → integration → E2E), and produces a unified report.

### When to Use
- After completing one or more features/refactors/bugfixes
- As a quality gate before deploy
- Project has a test framework installed but zero tests written (first-time test generation)
- User says "test", "run tests", "verify", "check quality", "补测试"

### When NOT to Use
- Project has no test framework AND no code to test
- Trivial single-line config changes

## Precondition

| Required State | Check | If Missing |
|---|---|---|
| `.prizmkit/prizm-docs/root.prizm` exists | File exists | Run `/prizmkit-init` first |
| Test framework installed | Dependency in package.json or equivalent | Offer to skip or let user install one manually |

If `.prizmkit/prizm-docs/` exists but may be stale (no retrospective run after recent changes), warn user: "Prizm docs may be out of date. Gap analysis accuracy depends on current docs. Continue anyway?"

## Context Loading

Before execution, load context once:

1. **Architecture context**: Read `.prizmkit/prizm-docs/root.prizm` (L0 — project overview, module index, tech stack, conventions) and relevant L1 docs for modules in scope. If scope includes specific modules, also load relevant L2 docs for INTERFACES, DATA_FLOW, TRAPS, and DECISIONS.
2. **Project config**: Read `.prizmkit/config.json` (tech stack, AI CLI config).
3. **Dependencies**: Read `package.json` or equivalent to detect test framework and project type.

## Input

| Parameter | Required | Description |
|-----------|----------|-------------|
| `scope` | No | User selects interactively in Phase 1. In headless mode, defaults to full project. |

## Execution

### Phase 0: Architecture Detection

1. From context already loaded, classify project type:

| Signal | Classification |
|--------|---------------|
| react/vue/angular/next in deps, no backend framework | Frontend |
| express/fastify/django/flask in deps, no frontend framework | Backend |
| Both present | Fullstack |
| Neither clear | Ask user (headless: mark as "unknown", skip E2E) |

2. Detect test framework by scanning dependencies:
   - Jest → `npx jest` or `npm test`
   - Vitest → `npx vitest run`
   - pytest → `python -m pytest`
   - Go testing → `go test ./...`
   - Multiple frameworks found → use the one with the most test files; list all in report
   - Custom `npm test` script → use `npm test`

3. **Interactive mode**: Show "Detected: {type}, test framework: {name}. Correct?"
   **Headless mode**: Auto-proceed with detected values, note assumptions in report.

### Phase 1: Scope Selection

**Interactive mode** — present three options:

1. **Full project** — all modules, all specs in `.prizmkit/specs/`
2. **Single module** — pick from L1 doc module names (e.g., "auth", "payment")
3. **Single feature** — pick from `.prizmkit/specs/###-*/` directories

**Headless mode** — default to full project. If `artifact_dir` or `scope` was passed by the caller, use that.

### Phase 2: Run Existing Tests

1. Find test directories matching common patterns: `tests/`, `__tests__/`, `*.test.*`, `*.spec.*`. If no test files exist at all, note this and skip to Phase 3 (all coverage is "missing").

2. Run the detected test command in scope. Capture:
   - Pass/fail counts and failed test details
   - Which test files exist (for gap analysis)
   - Raw output (saved to report directory)

3. If existing tests fail: record failures but continue — this is coverage data. Do not attempt to fix pre-existing test failures (they predate this session).

### Phase 3: Coverage Gap Analysis

Staleness of `.prizmkit/prizm-docs/` was already checked during Context Loading (see Precondition). Gap analysis proceeds with the available data.

Compare what exists against what should exist, across three levels:

**Unit test gaps** — for each module in scope:
- Read the corresponding L2 `.prizm` doc INTERFACES section to get exported functions/classes. If no L2 doc exists for a module, analyze source files directly to identify exported functions/classes.
- Check if each has a corresponding test file (match project's test naming: `foo.test.ts`, `foo.spec.ts`, `test_foo.py`)
- Flag uncovered interfaces

**Integration test gaps** (skip if project has no API/DB layer — pure library/CLI tool):
- Read L1 doc DEPENDENCIES section for cross-module interactions
- Check if tests exist covering module boundaries, API endpoints, DB operations
- Flag missing integration coverage

**E2E test gaps** (skip if project has no UI):
- Collect acceptance criteria from all spec.md files in scope
- Check existing E2E test files against these criteria
- Flag uncovered criteria

### Phase 4: Generate Missing Tests

Generate tests in priority order: unit → integration → E2E. After each batch, run immediately.

When generated tests fail, distinguish two cases:
- **Test bug** (syntax error, wrong import, wrong mock, wrong framework API usage) → fix the test and re-run
- **Assertion failure** (test is valid but code returns unexpected result) → mark as "needs review" in report; do NOT modify production code. This is a potential bug discovered by the generated test.

If a test fails repeatedly after 2 fix attempts, skip it and mark as "unresolved" in the report.

**4a. Unit Tests (always applicable)**

For each uncovered interface:
- Read the source file to understand function signature and logic
- Generate test file matching project conventions (framework, naming, directory, import style, mock/fixture patterns)
- Common naming patterns to match:
  - `src/foo.ts` → `src/__tests__/foo.test.ts` or `src/foo.spec.ts` or `tests/foo_test.py`
  - Mirror the existing pattern; if no tests exist, use the framework's default convention
- Cover: happy path, edge cases (null/undefined/empty), error conditions, boundary values
- Do NOT test framework internals or third-party library behavior
- Run tests immediately after generating

**4b. Integration Tests**

For each module with dependencies:
- Generate tests for the module's primary interface exercising its real dependencies
- If API endpoints exist: request/response tests (valid input, invalid input, missing params, auth)
- If database operations exist: CRUD tests using the project's existing test database config
- Run tests immediately after generating

**4c. E2E Tests (conditional)**

Preconditions (ALL must be met):
- Playwright is available (`@playwright/test` or `playwright` in package.json dependencies, or `npx playwright --version` succeeds as fallback)
- Playwright browsers are installed (check `npx playwright install --dry-run 2>/dev/null` exits cleanly, or `node_modules/.cache/ms-playwright/` directory exists; if missing, warn in report and skip E2E)
- Project has a UI layer
- Project can be started (start/dev script in package.json)
- Acceptance criteria exist in spec.md files

If ALL met:
- **Before starting dev server**: detect whether it's already running: (1) check `package.json` scripts for port flags (`--port`, `-p`, `PORT=`), (2) fall back to framework defaults (3000 for React/Next/Express, 5173 for Vite, 8000 for Django, 5000 for Flask), (3) if still unknown, ask the user. Use the detected port in `lsof -i :<port>` to check. If running, tell user: "Dev server appears to be already running on port {N}. Use this running instance for E2E tests?" If user confirms, use existing instance. If user declines, skip E2E.
- Start the project dev server (only if not already running). Wait for it to be ready.
- For each uncovered acceptance criterion, generate a Playwright test script
- Run generated E2E tests, capture screenshots of failures
- **Only stop dev server if you started it.** Never stop a server that was already running.

If NOT met:
- Note what was skipped and why in the report
- If only the server wasn't startable: still generate E2E script files but mark as "not run — manual execution needed"

### Phase 5: Unified Report

Create `.prizmkit/test/{YYYY_MM_DD_HH_MM_SS}_testresult/` directory.

**test-report.md** format:

```markdown
# Test Report — {timestamp}

## Summary
- Scope: {full / module: name / feature: ###-name}
- Architecture: {frontend / backend / fullstack}
- Test framework: {name}
- Mode: {interactive / headless}

## Existing Tests
- Total: {N} | Passed: {N} | Failed: {N}
{failed test details or "All passing"}
{or "No existing tests found — generated first batch"}

## Coverage Gaps Found
| Module | Interface | Type | Status |
|--------|-----------|------|--------|
| ... | ... | unit/integration/e2e | covered / generated / needs-review / unresolved / skipped |

## Generated Tests
- Unit: {N} generated, {N} needs-review, {N} unresolved
- Integration: {N} generated, {N} needs-review, {N} unresolved
- E2E: {N} generated, {N} skipped ({reason})

## Final Status
- All tests passing: {yes / no}
- Needs human review: {list of tests marked needs-review}
{remaining failures if any}
```

Also save:
- `existing-test-output.txt` — raw output from Phase 2
- `generated-tests/` — copies of all generated test files
- `e2e-output/` — E2E logs and failure screenshots (if applicable)

## Output

- Test report: `.prizmkit/test/{timestamp}_testresult/test-report.md`
- Generated test files written to project test directories
- Existing test output, generated test copies, and E2E artifacts in the report directory

## Recovery

If the session is interrupted:
- Check `.prizmkit/test/` for the most recent report directory — it contains what was completed before interruption
- Re-run `/prizmkit-test` — it starts fresh, but Phase 2 will skip tests that already pass, and Phase 3 will re-evaluate gaps

## Examples

### Example 1: Full-Project Quality Check with Test Generation

**User**: `/prizmkit-test`

**Phase 0 — Architecture Detection**:
```
Detected: Fullstack (React + Express)
Test framework: Vitest (7 existing test files)
```

**Phase 1 — Scope Selection** (user selects option 1):
```
Scope: Full project (all modules, all specs)
```

**Phase 2 — Existing Tests**: 7 test files found, 20 tests run, 18 passed, 2 pre-existing failures (recorded, not fixed).

**Phase 3 — Gap Analysis** (excerpt):
| Module | Interface | Type | Status |
|--------|-----------|------|--------|
| auth | login() | unit | missing |
| auth | register() | unit | missing |
| payment | processPayment() | unit | missing |
| payment | api/checkout | integration | missing |
| — | Checkout flow | e2e | missing |

**Phase 4**: Generated 5 unit tests (3 passing, 2 assertion failures marked "needs-review"), 1 integration test (passing), 1 E2E test (passing).

**Phase 5 — Report Summary**:
```
Generated: 5 unit (2 needs-review), 1 integration, 1 E2E
Report: .prizmkit/test/2026_05_23_14_30_00_testresult/test-report.md
Needs human review: processPayment (returns 400 for negative amounts, expected 422), refund (missing authorization header causes 500 instead of 401)
```

### Example 2: Single-Feature Targeted Test

**User**: `/prizmkit-test`

**Phase 0 — Architecture Detection**:
```
Detected: Backend (Express)
Test framework: Vitest
```

**Phase 1 — Scope Selection** (user selects option 3, then picks "042-payment-gateway"):
```
Scope: Single feature — 042-payment-gateway
Test files in scope: 2

**Phase 2 — Existing Tests**: 2 test files, 8 tests, all passing.

**Phase 3 — Gap Analysis** (excerpt):
| Module | Interface | Type | Status |
|--------|-----------|------|--------|
| payment | processPayment() | unit | missing |
| payment | refund() | unit | missing |

**Phase 4**: Generated 2 unit tests (both passing). No integration/E2E applicable for this scope.

**Phase 5 — Report Summary**:
```
Generated: 2 unit tests (all passing)
Report: .prizmkit/test/2026_05_23_15_00_00_testresult/test-report.md
All tests passing. Ready for commit.
```

**HANDOFF:** Independent skill — no handoff. User may proceed to `/prizmkit-committer` if all tests pass, or fix issues manually if tests are marked "needs-review".
