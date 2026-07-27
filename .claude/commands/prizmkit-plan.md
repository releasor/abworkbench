---
description: "Specify and plan tasks: natural language → spec.md & plan.md with architecture and executable tasks. Use before /prizmkit-implement. Trigger on: 'specify', 'plan', 'new task', 'I want to add/build...', 'architect', 'design', 'break it down', 'create tasks'. (project)"
---

# PrizmKit Plan

A universal spec + plan generator. Takes a natural-language description of ANY development task (new feature, refactoring, bug fix, migration, etc.) and produces `spec.md` (WHAT/WHY) and `plan.md` (HOW) with executable tasks.

### When to Use
- Any non-trivial development task that benefits from written specification and planning
- Before `/prizmkit-implement` — to create the spec + task breakdown
- User says "specify", "plan", "new task", "I want to add...", "architect", "design", "break it down"

### When NOT to Use
- Config tweaks, typo fixes, trivial one-line changes → edit directly
- Simple changes where the developer already knows exactly what to do and the scope is ≤10 lines in a single file

## Input

| Parameter | Required | Description |
|-----------|----------|-------------|
| `description` | Yes | Natural-language description of the task |
| `artifact_dir` | No | Directory to write spec.md + plan.md into. If omitted, auto-generates under `.prizmkit/specs/` (see Phase 0 Step 2). |

## Execution

### Phase 0: Specify (→ spec.md)

**Skip condition**: If `spec.md` already exists in the artifact directory, skip to Phase 1.

**Steps:**

1. Gather input: read the task description. If no description is provided and interactive session is available, ask the user; otherwise abort with an error.
2. Determine artifact directory:
   - If `artifact_dir` is provided → use it directly
   - If not provided → scan `.prizmkit/specs/` for existing `###-*` directories, find highest numeric prefix, next = highest + 1 (zero-padded to 3 digits; start at `001` if empty). Create `.prizmkit/specs/###-task-slug/`
   - Auto-generate 2-10 word task slug from description
3. Load project context: read `.prizmkit/prizm-docs/root.prizm` and relevant L1/L2 docs
4. Generate `spec.md` from template (`.claude/command-assets/prizmkit-plan/assets/spec-template.md`):
   - Fill sections based on the task description — all sections are optional, include only what is relevant
   - `[NEEDS CLARIFICATION]` markers for all ambiguous items
5. **Database design detection**: If changes involve data persistence (new entities, fields, schema changes), add `## Data Model` section — scan existing schema files to extract naming conventions, ID strategy, constraint patterns. Mark uncertain decisions with `[NEEDS CLARIFICATION]`.
6. Run quality validation : all goals have criteria? scope defined? DB conventions documented (if applicable)?
7. **Auto-clarification**: If any `[NEEDS CLARIFICATION]` markers remain and interactive session is available, enter interactive clarification.
   → Read `.claude/command-assets/prizmkit-plan/references/clarify-guide.md` for question strategy and update rules.
   If non-interactive, resolve ambiguities by choosing the most conservative option and annotating the decision.
   Resolve all markers before proceeding to Phase 1.

**Writing principles**: Focus on WHAT and WHY, never HOW. Every goal needs acceptance criteria. Scope boundaries must be explicit. Mark all genuine ambiguities — the clarification phase resolves them.

**Internal ID hygiene**: PrizmKit IDs (`F-001`, `B-001`, `R-001`), task IDs (`T-100`), session IDs, run IDs, branch names, absolute worktree paths, and `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths are internal tracking metadata. They may appear in specs, plans, commit messages, and non-memory pipeline artifacts, but must never be written to `.prizmkit/prizm-docs/`, user-visible product copy, UI text, API responses, or expected UI strings in tests. If a behavior is scoped to the current feature, describe the product behavior without the ID.

### Phase 1: Design (spec.md → plan.md)

**Precondition**: `spec.md` exists in the artifact directory.

**Steps:**

1. Read `spec.md` from the artifact directory
2. Load project context if not already loaded in Phase 0: read `.prizmkit/prizm-docs/root.prizm` and relevant L1/L2 docs
3. Resolve any remaining `[NEEDS CLARIFICATION]` by proposing solutions
4. Generate `plan.md` from template (`.claude/command-assets/prizmkit-plan/assets/plan-template.md`):
   - Change approach (how the changes integrate with existing system)
   - Component / file changes
   - Data model changes (with **database design gate** — read ALL existing schema files, ensure new schema follows existing patterns, resolve all DB ambiguities inline before proceeding)
   - Interface design (API endpoints, request/response formats)
   - Testing strategy
   - Risk assessment
   - Behavior preservation strategy (if the task modifies existing behavior — include what must remain unchanged and how to verify)
5. Cross-check: every goal in spec.md maps to plan components — unmapped goals = coverage gaps
6. Check alignment with `.prizmkit/prizm-docs/root.prizm` RULES section

### Phase 2: Task Generation (plan.md → Tasks section)

1. If interactive session is available, ask user for strategy; otherwise infer automatically: MVP-first / Incremental / Parallel
2. Append `## Tasks` section to `plan.md` using template in `.claude/command-assets/prizmkit-plan/assets/plan-template.md`:
   - Phases: Setup (T-001~T-009) → Foundation (T-010~T-099) → Core (T-100+) → Polish (T-900+)
   - Each task: `- [ ] [T-NNN] [P?] [G-N?] Description — file: path/to/file`
   - Checkpoint tasks between phases for validation
   - Organize Core tasks by goals (G-1, G-2, ...) or by logical grouping appropriate to the task
3. Verify consistency and coverage → read `.claude/command-assets/prizmkit-plan/references/verification-checklist.md` and run all checks. Fix any issues inline before output.
4. Output: `plan.md` path, summary of design decisions, task count.

**HANDOFF:** `/prizmkit-implement`

## Examples

### Example 1: New Feature

**Input:** "I want users to upload avatars"

**Phase 0 output:** `.prizmkit/specs/003-user-avatar/spec.md`
```markdown
# User Avatar Upload
## Overview
Allow registered users to upload and manage profile pictures.
## Goals
### G-1: Upload Avatar
As a registered user, I want to upload a profile picture,
so that other users can visually identify me.
**Acceptance Criteria:**
- Given I am on my profile page
- When I select an image file and click upload
- Then my avatar is updated and visible across the platform
## Scope
- **In scope:** Upload, display, remove avatar; image format validation
- **Out of scope:** Image cropping/editing, avatar history
```

**Phase 1-2 output:** `plan.md` excerpt:
```markdown
## Tasks
### Phase: Foundation (T-010~T-019)
- [ ] [T-010] [G-1] Add avatar_url field to User model — file: src/models/user.ts
- [ ] [T-011] [G-1] Create S3 upload utility — file: src/lib/s3.ts
### Phase: Core [P] (T-100~T-109)
- [ ] [T-100] [P] [G-1] POST /api/avatar upload endpoint — file: src/routes/avatar.ts
```

### Example 2: Refactoring

**Input:** "Extract shared auth middleware from the API routes"

**Phase 0 output:** `.prizmkit/specs/004-extract-auth-middleware/spec.md`
```markdown
# Extract Auth Middleware
## Overview
Consolidate duplicated authentication logic scattered across route files into a single shared middleware.
## Goals
### G-1: Extract Shared Authentication Logic
Consolidate duplicated auth checks from 5 route files into a single middleware module.
**Acceptance Criteria:**
- All existing auth-related tests pass without modification
- Auth logic exists in exactly one file (src/middleware/auth.ts)
- No route file contains inline token verification
## Scope
- **In scope:** src/routes/users.ts, orders.ts, admin.ts, payments.ts, profile.ts
- **Out of scope:** Authorization (role-based access), rate limiting
## Behavior Preservation
- All 23 existing API tests must pass unchanged
- Response formats and HTTP status codes must not change
- Error message strings must remain identical
```

### Example 3: Bug Fix

**Input:** "Login page crashes when API returns 401"

**Phase 0 output:** `.prizmkit/specs/005-login-401-crash/spec.md`
```markdown
# Fix: Login Crash on 401 Response
## Overview
Login page throws unhandled exception when auth API returns 401, causing a white screen.
## Goals
### G-1: Handle 401 Response Gracefully
When the auth API returns 401, display an error message instead of crashing.
**Acceptance Criteria:**
- Given user submits invalid credentials, When API returns 401, Then error message "Invalid credentials" is displayed
- Given user submits invalid credentials, When API returns 401, Then no unhandled exception is thrown
## Root Cause
- Error classification: Runtime
- Root cause: `AuthService.handleLogin()` at src/services/auth.ts:42 does not handle null token
- Affected files: src/services/auth.ts (L42), src/pages/login.tsx (L28)
## Scope
- **In scope:** Null handling in auth service, error display in login page
- **Out of scope:** Other HTTP error codes (403, 500), auth flow redesign
## Behavior Preservation
- All existing login success tests must pass unchanged
- Auth token flow for valid credentials must not change
```

## References

- Spec template: `.claude/command-assets/prizmkit-plan/assets/spec-template.md`
- Plan template: `.claude/command-assets/prizmkit-plan/assets/plan-template.md`
- Clarification guide: `.claude/command-assets/prizmkit-plan/references/clarify-guide.md`
- Verification checklist: `.claude/command-assets/prizmkit-plan/references/verification-checklist.md`

## Output

| Directory | Files |
|---|---|
| `artifact_dir` (provided or auto-generated `.prizmkit/specs/###-slug/`) | `spec.md` + `plan.md` |
