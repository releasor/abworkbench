---
description: "Execute plan.md tasks with TDD approach. Respects task ordering and dependencies. Use after /prizmkit-plan. Trigger on: 'implement', 'build', 'code it', 'start coding', 'execute', 'write the code'. (project)"
---

# PrizmKit Implement

### When to Use
- After `/prizmkit-plan` when ready to write code
- User says "implement", "build", "code it", "start coding", "develop"
- For fast-path: user describes a simple change directly (fast-path skips specify, but still requires a simplified plan.md with Tasks section)

**PRECONDITION:**

| Required Artifact | Check | If Missing |
|---|---|---|
| `plan.md` with Tasks section | File exists + unchecked tasks | Run `/prizmkit-plan` |
| `spec.md` | File exists in same directory as plan.md | Run `/prizmkit-plan` |

**Artifact directory**: Accept `artifact_dir` from caller. If not provided, scan `.prizmkit/` subdirectories for the most recently modified `plan.md` with unchecked tasks.

## Input

| Parameter | Required | Description |
|-----------|----------|-------------|
| `artifact_dir` | No | Directory containing spec.md + plan.md. If omitted, auto-detect per precondition above. |

## Context Loading

Before implementation, load context once:

1. **Task context**: Read `plan.md` (including Tasks section) and `spec.md` from the artifact directory. If other companion documents exist in the directory (e.g., `refactor-analysis.md`), read them for additional context.
2. **Architecture context**: Read `.prizmkit/prizm-docs/root.prizm` (L0 — project overview, module index, tech stack, conventions) and relevant L1/L2 docs for affected modules. Pay special attention to TRAPS (known pitfalls) and DECISIONS (architectural choices).
3. **Dev rules** (if configured): Check `.prizmkit/prizm-docs/root.prizm` for a `RULES:` line — if present, read all referenced `.prizmkit/rules/<layer>-rules.md` files. If a referenced file does not exist, skip it silently and continue. These define per-layer conventions (frameworks, naming, patterns, state management, etc.) that AI must follow when generating code for that layer. Apply these rules during implementation — if a rule conflicts with what plan.md describes, call it out and ask the user.

> `.prizmkit/prizm-docs/` uses a 3-level hierarchy: L0 (`root.prizm`) is the project-wide index. L1 (e.g., `auth.prizm`) covers a module — its key files, interfaces, dependencies, traps, and decisions. L2 is for sub-modules with their own complexity. Implement reads these docs to avoid repeating known mistakes; `/prizmkit-retrospective` is responsible for updating them after implementation.

## Execution

For each unchecked task in plan.md, in order:

1. Read L1/L2 doc for the target file's module — check TRAPS and DECISIONS before modifying files
2. Apply TDD where applicable: write a failing test first, then implement until it passes. For UI components or configuration changes where unit tests don't apply, skip the test-first step.
   - **Internal ID hygiene**: Do not place PrizmKit feature/bug/refactor IDs (`F-001`, `B-001`, `R-001`), task IDs, session IDs, run IDs, branch names, absolute worktree paths, or `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths in `.prizmkit/prizm-docs/`, user-visible UI text, API responses, emails, notifications, or tests that assert visible product copy. Translate internal references into durable product/domain language before writing memory docs, tests, or UI copy.
   - **Cover three paths for each function**: happy path (valid inputs producing expected behavior), edge cases (boundary values specific to the parameter type and domain — e.g., zero/min/max for numeric, empty collection, boundary index), and error conditions (inputs that should trigger error handling). Determine edge cases from the function's parameter types and domain logic, not from a fixed checklist. If a function has no edge or error paths, don't force them.
   - **No redundant tests**: Check if a test for this behavior already exists before writing. Each test must verify a uniquely different code path — don't write multiple tests that exercise the same logic.
   - **Test your own code only**: Don't test framework behavior, third-party library internals, or language built-ins. For library calls, test the integration point (correct parameters passed, return value correctly handled), not the library itself.
3. Mark task as `[x]` in `plan.md` immediately after completion — not batched at the end. Immediate marking means plan.md always reflects true progress, even if the session is interrupted.
4. **Parallel tasks**: If task has `[P]` marker, it can run in parallel with other `[P]` tasks in the same group. Sequential tasks stop on failure (later tasks may depend on this one). Parallel `[P]` tasks continue — report all failures at the end.
5. **Checkpoint tasks** (`CP:` prefix in plan.md): When a checkpoint task is reached, verify build passes and tests pass before continuing. Checkpoints catch integration errors early — skipping them means cascading failures in later phases.
6. After all tasks complete: run full test suite.

## Recovery

If a session is interrupted mid-implementation:
- Completed tasks are already marked `[x]` in plan.md (because we mark immediately)
- Resume by re-running `/prizmkit-implement` — it picks up from the first unchecked `[ ]` task

**HANDOFF:** `/prizmkit-code-review`

## Output

- Code files created/modified as specified in plan.md Tasks section
- `plan.md` Tasks section updated with completion markers `[x]`
- Implementation summary output to conversation
