# Behavior Preservation Guide

This guide covers strategies for ensuring that refactoring changes structure without changing behavior. Every refactor item must declare a behavior preservation strategy.

---

## 1. Preservation Strategies

### Strategy: test-gate

**Definition**: Run the full test suite after each refactoring change. All previously-passing tests must continue to pass.

**How it works**:
1. Run the full test suite before starting the refactor item (establish baseline)
2. Implement the refactoring change
3. Run the full test suite again
4. Compare: all tests that passed before must still pass
5. If any test fails -> revert the change, investigate, and retry

**When to use**:
- Target area has good test coverage (>60%)
- Tests are reliable (no flaky tests in the target area)
- Test suite runs in reasonable time (<5 minutes for the relevant subset)
- Tests cover the behavior contracts you need to preserve

**Strengths**:
- Most reliable automated strategy
- Catches regressions immediately
- Well-understood and widely practiced
- Works with any test framework

**Limitations**:
- Only as good as test coverage — untested behavior can still break
- Slow test suites may bottleneck iteration speed
- Flaky tests create false negatives

**Configuration in refactor-list.json**:
```json
{
  "behavior_preservation": "test-gate",
  "test_command": "npm test"
}
```

---

### Strategy: snapshot

**Definition**: Capture the observable output/state of the target code before and after refactoring, then compare.

**How it works**:
1. Identify observable outputs of the target code (API responses, rendered UI, log output, file output)
2. Capture a "before" snapshot by exercising the code with representative inputs
3. Implement the refactoring change
4. Capture an "after" snapshot with the same inputs
5. Compare: snapshots must match (or differ only in acceptable ways like formatting)

**When to use**:
- Test coverage is insufficient but behavior is observable
- The code produces deterministic output for given inputs
- You can identify representative inputs that exercise the key behavior paths
- API endpoints, CLI tools, data processing pipelines

**Strengths**:
- Works even when formal tests are missing
- Captures real behavior rather than test assertions
- Can detect subtle regressions that tests might miss

**Limitations**:
- Requires deterministic behavior (non-deterministic outputs need normalization)
- May miss edge cases if representative inputs are incomplete
- Snapshot comparison tools may need configuration for acceptable differences
- More manual setup than test-gate

**Configuration in refactor-list.json**:
```json
{
  "behavior_preservation": "snapshot",
  "snapshot_targets": ["API responses for /api/users/*", "CLI output for --help flag"]
}
```

---

### Strategy: manual

**Definition**: Human verification is required to confirm behavior is preserved. Useful as a last resort.

**When to use**:
- No test coverage AND no easily observable deterministic output
- UI-heavy changes where visual regression is the primary concern
- Legacy code with unknown behavior contracts
- Code that interacts with external services in non-reproducible ways

**How it works**:
1. Document the current behavior (screenshots, recordings, written descriptions)
2. Implement the refactoring change
3. Human manually verifies the behavior matches the documentation
4. Human signs off on the change

**Strengths**:
- Works for any situation
- Humans can assess subjective quality (UI layout, user experience)
- Can catch issues that automated tools miss

**Limitations**:
- Slowest strategy — blocks on human availability
- Error-prone — humans miss regressions, especially subtle ones
- Not scalable — each item needs separate human attention
- Not repeatable — different humans may verify differently

**Configuration in refactor-list.json**:
```json
{
  "behavior_preservation": "manual",
  "verification_notes": "Manually verify login flow works: email login, social login, password reset"
}
```

---

## 2. Choosing the Right Strategy

Use this decision tree to select the appropriate strategy for each refactor item:

```
Does the target area have test coverage >60%?
├── YES: Are the tests reliable (no flaky tests)?
│   ├── YES → test-gate
│   └── NO: Fix flaky tests first, then → test-gate
│         (or if fixing is out of scope → snapshot)
└── NO: Does the code produce deterministic, observable output?
    ├── YES → snapshot
    └── NO → manual (flag as high-risk)
```

### Strategy Selection Table

| Test Coverage | Output Observable | Recommended Strategy | Risk Level |
|--------------|-------------------|---------------------|------------|
| High (>60%) | Yes | test-gate | Low |
| High (>60%) | No | test-gate | Low |
| Medium (30-60%) | Yes | test-gate + snapshot | Medium |
| Medium (30-60%) | No | test-gate (acknowledge gaps) | Medium |
| Low (<30%) | Yes | snapshot | Medium-High |
| Low (<30%) | No | manual | High |
| None (0%) | Yes | snapshot | High |
| None (0%) | No | manual | Very High |

### Mixed Strategies

For complex items, you can combine strategies:
- **test-gate + snapshot**: Run tests AND compare output snapshots. Provides defense in depth.
- **test-gate + manual**: Run tests AND have a human verify UI/UX aspects.
- Use the primary strategy in the `behavior_preservation` field and note the secondary in `verification_notes`.

---

## 3. Common Behavior-Breaking Pitfalls

These are patterns that frequently cause unintended behavior changes during refactoring. Check for each one when planning.

### 3.1 Side Effect Ordering

**Pitfall**: Reordering function calls or module initialization can change side effects.

**Example**: Moving `initLogger()` after `loadConfig()` when the logger depends on config.

**Prevention**: Map side effects and their dependencies before restructuring. Document execution order constraints.

### 3.2 Error Handling Changes

**Pitfall**: Extracting code into a new function changes which errors are caught and where.

**Example**: A try/catch block that previously caught errors from inline code no longer catches them when the code is extracted to a separate function with its own error handling.

**Prevention**: Trace error propagation paths before and after. Ensure the same errors reach the same handlers.

### 3.3 Closure and Scope Changes

**Pitfall**: Moving code changes what variables are in scope, especially with closures.

**Example**: Extracting a closure that captures `this` into a standalone function loses the `this` binding.

**Prevention**: Identify all captured variables. Ensure they are passed as parameters or the binding is preserved.

### 3.4 Import Order Side Effects

**Pitfall**: In some languages/frameworks, import order matters (module initialization, polyfills, monkey-patching).

**Example**: Moving an import of a polyfill to a different position causes it to load after the code that needs it.

**Prevention**: Identify imports with side effects. Document order constraints. Test module initialization explicitly.

### 3.5 Default Parameter Changes

**Pitfall**: Extracting a function and adding default parameters changes behavior for callers that relied on the old defaults.

**Example**: Original: `function process(data, format) { format = format || 'json'; ... }` — Refactored: `function process(data, format = 'json') { ... }` — These behave differently for `process(data, '')` (empty string).

**Prevention**: Audit all default value logic. Use identical defaulting behavior in the refactored version.

### 3.6 Async/Await Conversion Gotchas

**Pitfall**: Converting callbacks to async/await can change error propagation, timing, and concurrency.

**Example**: Callback errors that were silently swallowed now throw unhandled promise rejections.

**Prevention**: Map all error paths in the callback version. Ensure async version handles every path. Test with error scenarios.

### 3.7 Type Coercion Changes

**Pitfall**: Moving code between contexts can change implicit type coercion behavior.

**Example**: `==` comparisons that relied on type coercion break when types change due to new module boundaries.

**Prevention**: Prefer strict equality. Audit type assumptions at module boundaries.

### 3.8 Timing and Race Conditions

**Pitfall**: Restructuring async code can change execution timing, revealing or creating race conditions.

**Example**: Splitting a synchronous operation into two async steps creates a window where state is inconsistent.

**Prevention**: Identify shared mutable state. Ensure atomicity is preserved. Test concurrent scenarios.

---

## 4. Test Coverage Assessment

Before refactoring, assess the test coverage of the target area to select the appropriate preservation strategy.

### Quick Coverage Assessment

If a formal coverage tool is available:
```powershell
# JavaScript (Istanbul/nyc)
npx nyc --reporter=text -- npm test -- --Select-String "target-module"

# Python (pytest-cov)
pytest --cov=target_module --cov-report=term-missing

# Go
go test -coverprofile=coverage.out ./target-package/...
```

### Manual Coverage Assessment

When coverage tools aren't available, assess manually:

1. **List all public functions/methods** in the target area
2. **Search for test files** that import or reference the target
3. **Check test assertions** — do they test behavior or just structure?
4. **Identify untested paths** — error handling, edge cases, default behavior

### Coverage-Based Planning Decisions

| Coverage Level | Planning Decision |
|---------------|-------------------|
| >80% | Proceed with test-gate. High confidence in behavior preservation. |
| 60-80% | Proceed with test-gate. Note gaps in refactor item descriptions for the pipeline to be cautious about. |
| 30-60% | Consider writing additional tests before refactoring (as a prerequisite R-000 item). Or use snapshot strategy for low-coverage areas. |
| <30% | Strongly recommend writing tests first. If user declines, use snapshot or manual strategy and flag as high risk. |
| 0% | WARN user explicitly. Recommend writing tests as a prerequisite. If user insists on proceeding, use manual strategy and document all known behaviors. |

### Adding Tests as a Prerequisite Item

When test coverage is insufficient, add a prerequisite refactor item:

```
Refactor Item R-000:
  Title: Add test coverage for [target area] before refactoring
  Type: restructure
  Scope: [test files]
  Priority: critical
  Complexity: medium
  Behavior Preservation: manual (no existing tests to gate against)
  Acceptance Criteria:
    - Test coverage for [target area] reaches >60%
    - Tests cover: [list key behavior contracts]
    - All new tests pass
  Dependencies: none
```

This item runs first, establishing the test baseline that all subsequent items use for their test-gate strategy.

---

## 5. Behavior Verification Checklist

Before marking a refactor item as complete, verify:

- [ ] All previously-passing tests still pass
- [ ] No new warnings or deprecation notices in test output
- [ ] No new lint errors introduced
- [ ] Public API surface is unchanged (same exports, same function signatures)
- [ ] Error messages and error codes are unchanged (consumers may depend on these)
- [ ] Logging output is unchanged (monitoring/alerting may depend on log patterns)
- [ ] Configuration interface is unchanged (env vars, config files, CLI flags)
- [ ] Performance characteristics are within acceptable bounds (no regression >10%)
- [ ] No dead code left behind (unused imports, unreachable functions)
