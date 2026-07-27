# [TITLE]

## Overview
[One paragraph describing the purpose and motivation]

## Goals

### G-1: [Goal Title]
[Goal description — use whatever format best suits the task:
  - User Story format: "As a [role], I want [capability], so that [benefit]."
  - Objective format: "Objective: [change to make]. Target state: [desired outcome]."
  - Fix format: "Fix: [symptom]. Root cause: [brief cause]."
  - Or any other clear format.]

**Acceptance Criteria:**
- [ ] [Criterion 1 — Given/When/Then, or a concrete verifiable statement]

## Scope

### In Scope
- [Item 1]

### Out of Scope
- [Item 1]

## Behavior Preservation
<!-- Include this section when the task modifies existing behavior (refactoring, bug fixes, migrations, etc.). Delete if not applicable. -->
- [What behavior / contracts / interfaces must remain unchanged]
- [Existing test suites that must continue to pass]

## Root Cause
<!-- Include this section when the task is fixing a defect. Delete if not applicable. -->
- Error classification: [Runtime / Network / Auth / Data / Logic / Config / External]
- Root cause: [specific code location and mechanism]
- Affected files: [file list with line numbers]
- Impact: [blast radius — which modules / features are affected]

## Dependencies
- [Dependency 1]: [Why needed]

## Data Model
<!-- Include this section when changes involve database / data persistence. Delete if not applicable. -->

### Existing Schema Reference
<!-- Read existing schema/model files BEFORE designing new tables. Document observed conventions here. -->
- Tables reviewed: [list existing tables related to this change]
- Naming convention: [snake_case/camelCase — match existing]
- ID strategy: [UUID/auto-increment — match existing]
- Timestamp pattern: [created_at/updated_at — match existing]
- Soft delete: [yes/no, field name — match existing]

### New/Modified Entities
| Entity | Type (new/modify) | Key Fields | Relationships | Constraints |
|--------|-------------------|------------|---------------|-------------|
| [entity_name] | new | [field: type] | [FK to existing_table] | [NOT NULL, UNIQUE, etc.] |

### Open Data Model Questions
<!-- All questions here MUST be resolved before /prizmkit-plan generates Tasks -->
- [NEEDS CLARIFICATION] [Any uncertain data model decisions — field types, nullability, relationships]

## Constraints
- [Constraint 1]

## Clarifications
[NEEDS CLARIFICATION]: [Ambiguous item]

## Review Checklist
- [ ] All goals have acceptance criteria
- [ ] Scope boundaries are clearly defined
- [ ] Dependencies are identified
- [ ] No implementation details (WHAT not HOW)
- [ ] Behavior preservation defined (if modifying existing behavior)
- [ ] Root cause identified with evidence (if fixing a defect)
