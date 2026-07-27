# New App Planning Reference

Use this reference when the user is planning a product from scratch.

## Phase Guide

### Phase 1: Vision
Capture:
- problem statement
- target users
- core value proposition
- non-goals (what to exclude from MVP)

### Phase 2: Stack Defaults
If user has no preference, propose defaults aligned with project conventions:
- Frontend: Next.js + TypeScript
- Backend: Express/Nest (choose one and stay consistent)
- DB: PostgreSQL
- ORM: Prisma
- Test: unit + e2e baseline

If `.prizmkit/config.json` exists, prioritize its settings.

### Phase 3: MVP Features
Rules:
- Include foundational setup feature first
- Aim 5-12 features for MVP
- Keep each feature implementable in one pipeline unit unless clearly too large

For each feature define:
- `id`
- `title`
- `description`
- `priority` — string: `"critical"`, `"high"`, `"medium"`, or `"low"` (never numeric)
- `estimated_complexity`
- `dependencies`
- `acceptance_criteria`
- `status: "pending"`
- `browser_interaction` (optional — for UI features, see §Browser Interaction Planning in SKILL.md)

### Phase 4: Dependency & Priority
Check:
- no cycles
- all dependency targets exist
- order is executable
- priorities align with delivery value and risk

### Phase 5: Granularity
Split into `sub_features` when:
- scope crosses too many modules
- acceptance criteria are excessive
- complexity is high and uncertainty is high

### Phase 6: Generate + Validate
1. Write `feature-list.json`.
2. Run the command below after defining `Invoke-PrizmPython` from the main `SKILL.md`:
   ```powershell
   Invoke-PrizmPython ${SKILL_DIR}/scripts/validate-and-generate.py validate --input feature-list.json --mode new
   ```
3. Fix all errors, then re-run.

## Quality Rules

- Keep titles concise and English
- Make descriptions implementation-oriented (clear boundaries, interfaces, behavior)
- **Description depth by complexity:**
  - **Low complexity**: ≥30 words — what to build, key behavior, which files/modules are affected
  - **Medium complexity**: ≥50 words — add integration points, data model overview, error handling approach
  - **High complexity**: ≥80 words — add architecture decisions, performance considerations, security implications, migration strategy if applicable
- **Description must cover** (adapt per feature):
  1. **What**: concrete deliverable (API endpoints, UI components, data models)
  2. **How it integrates**: which existing modules/services it connects to
  3. **Key behaviors**: business rules, validation rules, state transitions
  4. **Data model**: entities, relationships, key fields (when applicable)
  5. **Error/edge cases**: what happens on failure, empty states, limits
- Write testable acceptance criteria (at least 3; prefer 5+ for medium/high)
- Keep dependency graph simple and explicit

## Final Delivery Checklist

- [ ] User confirmed MVP scope
- [ ] IDs are sequential
- [ ] `status` initialized to `pending`
- [ ] Validation passes
- [ ] Next step recommendation: `feature-pipeline-launcher`
