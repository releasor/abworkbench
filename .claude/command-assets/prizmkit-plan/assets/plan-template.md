# Plan: [TITLE]

## Change Approach
[Description of the technical approach — how these changes integrate with the existing system]

## Component Design

### New Components
- [Component]: [Purpose]

### Modified Components
- [Component]: [What changes and why]

## Behavior Preservation Strategy
<!-- Include when the task modifies existing behavior. Delete if not applicable (e.g., greenfield feature). -->
<!-- Strategy: one of test-gate / snapshot / manual -->
<!-- test-gate: all tests must pass after each task -->
<!-- snapshot: before-after comparison of outputs -->
<!-- manual: reviewer verification at checkpoints -->
- Strategy: [test-gate / snapshot / manual]
- Baseline: [describe green test suite or snapshot state]

## Data Model
<!-- Include when changes involve database / data persistence. Delete if not applicable. -->
<!-- IMPORTANT: Read existing schema/model files BEFORE designing new tables -->

### Existing Schema Audit
<!-- List existing tables/models reviewed. Note observed conventions. -->
- Tables reviewed: [list tables examined]
- Naming convention: [snake_case/camelCase — document what existing schema uses]
- ID strategy: [UUID/auto-increment/CUID — match existing]
- Timestamp fields: [created_at/updated_at pattern — match existing]
- Soft delete: [yes/no, field name if applicable]
- Constraint patterns: [NOT NULL defaults, UNIQUE patterns, index conventions]

### Schema Changes
| Entity | Type | Fields | Constraints | Relationships | Migration Notes |
|--------|------|--------|-------------|---------------|-----------------|
| [name] | new/modify | [field: type, ...] | [NOT NULL, UNIQUE, INDEX, ...] | [FK → existing_table(id)] | [migration strategy] |

### Style Conformance Checklist
- [ ] Table/column naming matches existing conventions
- [ ] ID strategy consistent with existing tables
- [ ] Timestamp fields follow existing patterns
- [ ] Foreign key constraints and indexes defined
- [ ] Soft delete strategy matches existing pattern (if applicable)
- [ ] All fields have explicit nullability (NOT NULL or nullable)

### Unresolved Questions
<!-- NONE — all DB design questions must be resolved inline before proceeding to Tasks -->

## Interface Design
[API endpoints, request/response formats, module interfaces — include all details here]

## Integration Points
- [Service/Module]: [How integrated]

## Testing Strategy
- Unit: [Approach]
- Integration: [Approach]
- E2E: [Approach]

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk] | [H/M/L] | [Plan] |

## Deployment Considerations
<!-- Include when there is deployment impact (new services, infra, environment changes). Delete if not applicable. -->

### New Infrastructure Requirements
- [Component]: [Deployment target from config deploy_strategy] — [any special config needed]

### New Environment Variables
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| [VAR_NAME] | yes/no | [Purpose] | [example value] |

### Deployment Impact
- [ ] No infrastructure changes needed (skip this section)
- [ ] New service/container required
- [ ] New environment variables added
- [ ] Database migration required in production
- [ ] CI/CD pipeline update needed

## Pre-Implementation Gates
- [ ] Spec coverage: all goals mapped to components
- [ ] Data model reviewed — existing schema conventions documented and followed (if applicable)
- [ ] All `[NEEDS CLARIFICATION]` items resolved
- [ ] Testing approach agreed
- [ ] Behavior preservation strategy defined (if modifying existing behavior)
- [ ] Root cause confirmed with reproduction test design (if fixing a defect)

## Tasks

### Strategy: [MVP-first | Incremental | Parallel]

### Phase: Setup
- [ ] [T-001] [Description] — file: [path]

### Phase: Foundation
- [ ] [T-010] [Description] — file: [path]

### Phase: Core
<!-- Organize by goals (G-1, G-2, ...) or by logical grouping appropriate to the task -->
- [ ] [T-100] [P] [G-1] [Task description] — file: [path]

### Phase: Polish
- [ ] [T-900] Final verification
- [ ] [T-901] Documentation update

### Checkpoints
- [ ] [CP-1] After Setup: project builds and tests pass
- [ ] [CP-2] After Foundation: base changes verified
- [ ] [CP-3] After each Core group: acceptance criteria pass
