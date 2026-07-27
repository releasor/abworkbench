# Refactor Scoping Guide

This guide helps assess refactoring scope, determine the appropriate approach, and identify risks before decomposing into executable items.

---

## 1. Scope Classification

Every refactoring effort falls into one of three scope categories. Classification determines the planning depth required.

### Incremental Refactoring

**Definition**: Gradual, low-risk improvements applied piece by piece. Each step is independently deployable.

**Characteristics**:
- Targets a specific area without restructuring the whole module
- Each item can be merged independently
- Low coordination overhead between items
- Suitable for ongoing tech debt reduction

**When to use**:
- Code smell is localized (one file, one function, one class)
- Team wants continuous improvement without large PRs
- Risk tolerance is low
- No architectural changes needed

**Planning depth**: Lightweight. Phase 3 (Code Analysis) can be abbreviated. Fast path may apply.

### Full Refactoring

**Definition**: Comprehensive restructuring of an entire module, subsystem, or architectural layer.

**Characteristics**:
- Touches many files across the target area
- Items have significant interdependencies
- Requires careful ordering and coordination
- Higher risk, bigger payoff
- May need a feature branch or phased rollout

**When to use**:
- Module has accumulated significant tech debt
- Current structure actively impedes feature development
- Multiple code smells are interconnected
- Architecture needs fundamental restructuring

**Planning depth**: Full workflow required. All 7 phases mandatory. No fast path.

### Targeted Refactoring

**Definition**: Focused on a specific concern, pattern, or dependency — not the entire module.

**Characteristics**:
- Clear, narrow objective (e.g., "extract payment logic", "break circular dependency")
- May touch multiple files but only for the specific concern
- Moderate risk
- Well-defined "done" state

**When to use**:
- Specific pain point identified (circular dependency, god class, leaky abstraction)
- New feature requires cleaner structure in one area
- Code review identified a specific structural issue

**Planning depth**: Standard workflow. Phase 3 focuses on the specific concern.

---

## 2. File Impact Analysis

Before decomposing, assess the blast radius of the proposed refactoring.

### Impact Assessment Steps

1. **Identify primary targets**: Files/modules directly being refactored
2. **Trace imports/dependencies**: What files import from the targets?
3. **Trace test files**: What test files exercise the targets?
4. **Trace configuration**: Do any config files reference the targets (routes, DI containers, etc.)?
5. **Count total affected files**: Primary + importing + testing + config

### Impact Categories

| Affected Files | Impact Level | Planning Implication |
|---------------|-------------|---------------------|
| 1-3 | Low | Single item likely sufficient |
| 4-8 | Medium | 2-4 items, standard workflow |
| 9-15 | High | 5+ items, careful dependency ordering |
| 16+ | Very High | Consider phased approach, split into multiple planning sessions |

### Dependency Graph Analysis

For each target file, map:
- **Incoming dependencies**: Who imports/uses this file? (blast radius)
- **Outgoing dependencies**: What does this file import? (coupling assessment)
- **Circular dependencies**: Does this file participate in any cycles? (critical risk)

Tools to assess:
```powershell
# Find all importers of a module (JS/TS)
Get-ChildItem -Recurse -Include *.js,*.ts -File | Select-String -Pattern 'from.*[''"].*target-module' -List

# Find all importers of a module (Python)
Get-ChildItem -Recurse -Include *.py -File | Select-String -Pattern 'from.*target_module|import.*target_module' -List

# Count total affected files
# Primary targets + importers + their test files
```

---

## 3. Cross-Module Dependency Assessment

Cross-module refactoring carries higher risk because changes ripple through module boundaries.

### Assessment Checklist

| Question | If Yes |
|----------|--------|
| Does the refactoring change any module's public API? | All consumers must be updated. Document API changes explicitly. |
| Does it change import paths? | All importers must be updated. Consider re-exports for backward compatibility. |
| Does it move shared types/interfaces? | All type consumers must be updated. May need temporary type aliases. |
| Does it change event/message contracts? | All subscribers/handlers must be updated. Version the contract if possible. |
| Does it affect database schema? | Migration required. This may be beyond refactoring scope. |
| Does it change configuration format? | Config consumers must be updated. Consider backward-compatible format. |

### Cross-Module Risk Mitigation

1. **Re-export pattern**: When moving a module, leave a re-export at the old path during transition
2. **Adapter pattern**: When changing an interface, create an adapter that bridges old and new
3. **Feature flag**: For risky cross-module changes, implement behind a flag
4. **Phased rollout**: Update consumers module by module, not all at once

---

## 4. Risk Assessment Framework

Assess risk for each refactoring item and for the overall plan.

### Per-Item Risk Factors

| Factor | Low Risk | Medium Risk | High Risk |
|--------|----------|-------------|-----------|
| Test coverage | >80% on target | 40-80% | <40% |
| Dependency count | 0-2 dependents | 3-5 dependents | 6+ dependents |
| Code age | Recently written/modified | 6-12 months old | 1+ year untouched |
| Documentation | Well-documented | Partially documented | No documentation |
| Complexity (cyclomatic) | <10 | 10-20 | >20 |
| Cross-module impact | None | 1 other module | 2+ other modules |

### Overall Plan Risk

Aggregate item risks to assess the plan:
- **Low risk plan**: All items are low risk, or mostly low with 1-2 medium
- **Medium risk plan**: Mix of low and medium, or 1-2 high risk items
- **High risk plan**: Multiple high risk items, or cross-module migration

### Risk Mitigation Strategies

| Risk Level | Strategy |
|-----------|----------|
| Low | Standard test-gate, proceed normally |
| Medium | Ensure snapshot comparison, add extra acceptance criteria |
| High | Require manual verification step, consider writing tests first, split into smaller items |
| Very High | Recommend writing comprehensive tests before refactoring, consider phased approach across multiple sessions |

---

## 5. When to Split Large Refactors

### Splitting Heuristics

Split a refactoring plan into multiple sessions when:

1. **Item count exceeds 8**: More than 8 items in a single plan increases coordination risk. Split into logical phases.
2. **Estimated duration exceeds a day**: If the pipeline is expected to run for many hours, split at natural boundaries.
3. **Risk accumulates**: If items 1-4 are low risk but items 5-8 are high risk, execute them in separate sessions to validate the foundation first.
4. **Cross-module boundaries**: If the refactoring touches modules A and B, consider separate plans for each module.
5. **Different preservation strategies needed**: If some items need test-gate and others need manual verification, split to handle each strategy appropriately.

### How to Split

1. **By module**: Each module gets its own `refactor-list.json` session
2. **By risk level**: Low-risk items first, high-risk items in a subsequent session
3. **By operation type**: All renames first, then extracts, then structural changes
4. **By dependency layer**: Foundation changes first, consumer updates second

### Merging Split Plans

When executing split plans sequentially:
- Run the first plan fully (including validation)
- Verify all tests pass after the first plan
- Then start planning the second phase (the codebase has changed)
- Do NOT pre-plan the second phase based on the original code state

---

## 6. Scope Boundary Enforcement

During planning, actively enforce scope boundaries to prevent scope creep.

### In-Scope Markers

Explicitly define what IS in scope:
- Specific files or directories
- Specific refactoring operations
- Specific code smells being addressed

### Out-of-Scope Markers

Explicitly define what is NOT in scope:
- New features (redirect to `feature-planner`)
- Bug fixes (redirect to `bug-planner`)
- Performance optimization that changes behavior
- Database schema changes (requires migration planning)
- API contract changes (requires consumer coordination)

### Scope Creep Detection

Flag and discuss with the user when:
- A refactoring item implies new functionality
- An item requires changing external interfaces
- An item's description includes "also add" or "while we're at it"
- An item's acceptance criteria describe new behavior, not preserved behavior
