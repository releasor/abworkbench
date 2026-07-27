# Refactor Planning Reference Guide

This guide provides structured patterns, decision matrices, and templates for decomposing refactoring goals into well-scoped, executable items. It is intended as a practical reference for the AI during interactive refactor planning sessions.

---

## 1. Identifying Refactoring Boundaries

Refactoring boundaries define where one refactor item ends and another begins. Good boundaries produce items that are independently executable and independently verifiable.

### Boundary Heuristics

| Signal | Boundary Type | Example |
|--------|--------------|---------|
| Different files/modules | Module boundary | "Extract auth logic" vs "Extract validation logic" |
| Different refactoring operations | Operation boundary | "Rename function" vs "Extract class" |
| Different risk levels | Risk boundary | "Safe rename" vs "Restructure module internals" |
| Different test suites affected | Test boundary | "Changes unit tests only" vs "Changes integration tests" |
| Sequential dependency | Dependency boundary | "Rename X" must complete before "Move X to new module" |

### Rules for Setting Boundaries

1. **One operation type per item.** Don't mix a rename with a structural extraction in the same item.
2. **One module scope per item** (unless the refactoring specifically targets cross-module concerns like decoupling).
3. **Each item should be independently testable.** After completing item R-001, all tests should pass before starting R-002.
4. **If an item requires more than 3 files to change simultaneously**, consider splitting it.
5. **If behavior preservation requires different strategies for different parts**, split into separate items with appropriate strategies.

---

## 2. Description Writing Guide

Refactor item descriptions are the primary input for autonomous pipeline sessions. A thin description forces the AI to guess about scope and safety constraints.

### Minimum Word Counts

| Complexity | Minimum Words | Warning Threshold |
|------------|---------------|-------------------|
| low        | 15            | 30                |
| medium     | 15            | 50                |
| high       | 15            | 80                |

Below 15 words is a validation error. Below the threshold triggers a warning.

### What to Include

Every refactor description should cover:

1. **What to change** — specific files, functions, classes, or patterns being refactored
2. **How to change it** — the refactoring operation (extract, rename, move, inline, simplify)
3. **Why** — the motivation (reduce complexity, improve testability, remove duplication)
4. **Constraints** — what must NOT change (public API, behavior contracts, external interfaces)
5. **Verification** — how to confirm the refactoring succeeded without breaking behavior

### Good vs Bad Examples

**Bad** (12 words — too thin):
```
"Extract the validation logic from the handler into a separate module."
```

**Good** (55 words — implementation-ready):
```
"Extract all input validation functions from src/api/handler.js (validateEmail, validatePassword, validateUsername) into a new src/utils/validators.js module. Update all imports in handler.js and any other files that import these functions directly. Preserve the exact function signatures and return types. The handler.js file should import from the new location. All existing tests must continue to pass without modification."
```

**Bad** (14 words):
```
"Convert the user service from callbacks to async/await pattern throughout."
```

**Good** (72 words — implementation-ready):
```
"Convert src/services/user-service.js from callback-based functions to async/await. Target functions: createUser, findUserById, updateUser, deleteUser (4 functions total). Each function currently accepts a callback as the last parameter and calls it with (err, result). Convert to return Promises and use async/await internally. Update all callers in src/routes/user-routes.js to use await instead of passing callbacks. Preserve all error handling behavior — errors that were passed to callbacks should now be thrown."
```

---

## 3. Common Refactoring Patterns

Use these patterns as starting points when decomposing refactoring goals.

### Pattern A: Extract Method/Function

**When**: A function is too long, has multiple responsibilities, or contains duplicated logic.

```
R-001: Extract [specific logic] from [source function] into [new function name]
  Type: extract
  Scope: [source file]
  Complexity: low
  Preservation: test-gate
```

### Pattern B: Extract Class/Module

**When**: A file/class is too large, a group of functions share a common concern, or a module has multiple responsibilities.

```
R-001: Create new module [name] with extracted [concern] logic
  Type: extract
  Scope: [source file, new file]
  Complexity: medium
  Preservation: test-gate

R-002: Update imports to use new [name] module (deps: R-001)
  Type: restructure
  Scope: [all importing files]
  Complexity: low
  Preservation: test-gate
```

### Pattern C: Move Module/File

**When**: A file is in the wrong directory, module organization needs restructuring.

```
R-001: Move [file] from [old path] to [new path]
  Type: restructure
  Scope: [file, all importers]
  Complexity: low-medium (depends on import count)
  Preservation: test-gate
```

### Pattern D: Inline (Reverse of Extract)

**When**: An abstraction is unnecessary, a wrapper adds no value, or indirection hurts readability.

```
R-001: Inline [function/module] into [target]
  Type: simplify
  Scope: [source file, target file]
  Complexity: low
  Preservation: test-gate
```

### Pattern E: Rename (Variable, Function, Class, File)

**When**: Names are misleading, inconsistent, or don't follow conventions.

```
R-001: Rename [old name] to [new name] across codebase
  Type: rename
  Scope: [all files containing the name]
  Complexity: low
  Preservation: test-gate
```

### Pattern F: Decouple Dependencies

**When**: Circular dependencies, tight coupling between modules, or difficulty testing in isolation.

```
R-001: Define interface/contract for [dependency] (deps: none)
  Type: decouple
  Scope: [new interface file]
  Complexity: medium
  Preservation: test-gate

R-002: Implement [dependency] behind new interface (deps: R-001)
  Type: decouple
  Scope: [implementation file]
  Complexity: medium
  Preservation: test-gate

R-003: Update consumers to use interface instead of concrete (deps: R-002)
  Type: decouple
  Scope: [all consumer files]
  Complexity: medium
  Preservation: test-gate
```

### Pattern G: Architecture Migration

**When**: Converting between paradigms (callbacks to promises, classes to functions, monolith to modules).

```
R-001: Add new [pattern] alongside old [pattern] (deps: none)
  Type: migrate
  Scope: [target files]
  Complexity: medium-high
  Preservation: test-gate or snapshot

R-002: Migrate [specific area] to new pattern (deps: R-001)
  Type: migrate
  Scope: [area files]
  Complexity: medium
  Preservation: test-gate

R-003: Remove old [pattern] code (deps: R-002)
  Type: simplify
  Scope: [cleaned files]
  Complexity: low
  Preservation: test-gate
```

---

## 4. Dependency Ordering Rules

Correct ordering minimizes risk and ensures each step is independently verifiable.

### Ordering Priority (execute in this order)

1. **Safe renames** — Lowest risk. Pure name changes with no structural impact. Can be reverted trivially.
2. **Extract/inline** — Moderate risk. Changes module boundaries but doesn't reorganize architecture.
3. **Structural changes** — Higher risk. Reorganizes file layout, module hierarchy, or dependency graph.
4. **Migrations** — Highest risk. Changes programming patterns or paradigms.

### Dependency Rules

1. **No circular dependencies.** Dependencies MUST form a directed acyclic graph (DAG).
2. **Minimal dependency sets.** Each item should depend only on items it directly needs.
3. **Rename before restructure.** If you're renaming something AND moving it, rename first (easier to track).
4. **Create before consume.** If item A creates a new module and item B uses it, B depends on A.
5. **Interface before implementation.** If decoupling, define the interface before implementing behind it.
6. **Preserve before remove.** If migrating, ensure new code works before removing old code.

### Validation Checklist

- [ ] No item depends on itself
- [ ] No circular dependency chains exist
- [ ] Every item ID referenced in a dependency list is defined in the plan
- [ ] The graph can be topologically sorted
- [ ] Renames appear before structural changes that reference the renamed entities

---

## 5. Acceptance Criteria for Refactoring

Refactoring acceptance criteria focus on structural improvement AND behavior preservation. They differ from feature acceptance criteria.

### Standard Criteria Templates

**For extract operations:**
- [ ] New module/function exists at [target path]
- [ ] Original location imports from new location (no duplication)
- [ ] All existing tests pass without modification
- [ ] No new circular dependencies introduced

**For rename operations:**
- [ ] Old name does not appear anywhere in codebase (except git history)
- [ ] All references updated to new name
- [ ] All existing tests pass without modification

**For restructure operations:**
- [ ] Files are in their new locations
- [ ] All import paths updated
- [ ] Module boundary is clean (no reaching into internal paths)
- [ ] All existing tests pass without modification

**For decouple operations:**
- [ ] Interface/contract defined and documented
- [ ] Implementation satisfies interface
- [ ] Consumers depend on interface, not implementation
- [ ] No circular dependencies remain
- [ ] All existing tests pass without modification

**For migrate operations:**
- [ ] New pattern is used in target area
- [ ] Old pattern code is removed (no dead code)
- [ ] All existing tests pass (may need test updates to use new pattern)
- [ ] Behavior is identical (verified via test-gate or snapshot)

### Writing Principles

1. **Always include "all existing tests pass"** — this is the fundamental refactoring invariant.
2. **Be specific about structural outcomes** — "files are organized by feature" is vague; "auth files are in src/features/auth/" is concrete.
3. **Include negative criteria** — "no circular dependencies", "no dead code", "no duplicated logic".
4. **Keep count manageable** — 3-5 criteria per item. More than 6 suggests the item should be split.

---

## 6. Complexity Estimation for Refactoring

| Factor | Low | Medium | High |
|--------|-----|--------|------|
| File count | 1-2 files | 3-5 files | 6+ files |
| Cross-module scope | Same module | 2 modules | 3+ modules |
| Test coverage | High (>80%) | Moderate (40-80%) | Low (<40%) |
| Pattern familiarity | Well-known (rename, extract) | Common (restructure) | Novel (custom migration) |
| Dependency changes | None | Minor (1-2 imports) | Significant (module graph changes) |

**Rule**: Take the highest individual factor as the overall complexity. When in doubt, estimate higher.

### Complexity Red Flags (Consider Splitting)

- Item touches more than 5 files
- Item requires changes to both test files and source files in non-trivial ways
- Item involves both structural change AND pattern migration
- Item has more than 6 acceptance criteria
- Item's description exceeds 100 words (suggests multiple operations combined)
