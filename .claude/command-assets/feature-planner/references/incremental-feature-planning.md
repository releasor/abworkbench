# Incremental Feature Planning Reference

Use this reference when the user adds features to an existing app/plan.

## Pre-Checks

1. Read existing `feature-list.json`.
2. Determine current max ID and continue from next `F-NNN`.
3. **Detect existing writing style** (see §Style Detection below).
4. Preserve compatibility with existing dependency structure.
5. **Project conventions** — handled by the main SKILL.md flow (rule #6) before incremental planning begins. No additional action needed here; conventions are loaded automatically.

If `feature-list.json` is missing, ask whether to initialize a new plan.

## Style Detection (Automatic)

Before drafting new features, analyze existing plan to preserve consistency:

1. **Language Detection**
   - Scan `title` and `description` fields
   - If >70% English titles → default to English
   - If >70% Chinese titles → suggest Chinese (or allow bilingual)

2. **Description Density**
   - Calculate avg word count per description
   - If avg <30 words → draft concise descriptions
   - If avg 30-80 words → draft standard detail
   - If avg >80 words → draft detailed descriptions

3. **Acceptance Criteria Patterns**
   - Count avg AC per feature
   - Identify dominant format (Given/When/Then Gherkin, BDD, or loose)
   - Draft new AC in same format

4. **Complexity Distribution**
   - Count low/medium/high distribution in existing features
   - Alert if new features deviate significantly (>20 percentile points)
   - Suggest rebalancing if needed

### Style Consistency Prompt

If new features deviate significantly from detected style:

```
"Your new features use avg X words/description, but existing features use Y.
Current ratio: low:M%, medium:N%, high:O%.
Adjust new features to match? (Y/n)"
```

Accept user choice, then adjust draft accordingly before JSON generation.

## Incremental Planning Flow

### Step 1: Clarify Increment Scope
Capture:
- business objective of the new increment
- affected existing modules/features
- timeline or priority constraints

### Step 2: Impact Mapping
For each candidate feature, identify:
- upstream dependencies
- downstream impacts
- risk hotspots (auth, data migration, API compatibility)

### Step 3: Append Features
Append new items only (do not rewrite old validated features unless user asks).

For each new feature:
- assign next ID
- set `status: "pending"`
- link dependencies to existing IDs where needed
- keep title in English
- **write rich descriptions** (see `planning-guide.md` §4):
  - minimum 15 words (validation error below this)
  - recommended minimum: 30+ (low), 50+ (medium), 80+ (high), 100+ (critical) — no upper limit, more detail is always better
  - include: what to build, key behaviors, integration points, data model, error/edge cases

### Step 4: Rebalance Priority
Allow priority updates for both old and new features if user requests reprioritization.
Keep dependency correctness as first constraint.

### Step 5: Validate
Run after defining `Invoke-PrizmPython` from the main `SKILL.md`:
```powershell
Invoke-PrizmPython ${SKILL_DIR}/scripts/validate-and-generate.py validate --input feature-list.json --mode incremental
```

Fix and re-run until pass.

## Merge/Rewrite Rules

- Default: append only
- Rewrite existing features only when user explicitly asks
- Never break valid IDs/references
- Never set new features to `in_progress` or `completed`

## Practical Prompts

Use concise prompts during interaction:
- "What is the goal of this increment? Which user problem is the priority?"
- "Which existing Feature IDs do these new features depend on?"
- "Do you want to reprioritize at the same time, or just append to the current sequence?"

## Final Delivery Checklist

- [ ] Existing file read before edits
- [ ] New IDs continue sequence
- [ ] Existing style preserved
- [ ] Dependency graph still DAG
- [ ] Validation passes
- [ ] Next step recommendation: `feature-pipeline-launcher`
