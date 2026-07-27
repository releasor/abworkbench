# Error Recovery & Resume Support

Structured error handling for validation failures, interrupted sessions, and checkpoint-based resumption.

## Validation Failures

When `Invoke-PrizmPython scripts/validate-and-generate.py validate --input <file> --mode <mode>` returns errors:

### Parse validation output
Script returns JSON with `"valid": false`, `"errors": [...]`, `"warnings": [...]`

### Decision Tree

**if `error_count == 0` (warnings only):**
- Proceed with user approval
- Show warnings and ask: "Continue? (Y/n)"

**elif `error_count > 0` (critical errors):**

Group errors by type and apply targeted fixes:

| Error Type | Symptom | Fix Offered | Auto-Fix? |
|-----------|---------|------------|-----------|
| **Schema mismatch** | `$schema` invalid, missing `project_name`, wrong `features` type | "Set `$schema` to `dev-pipeline-feature-list-v1`, `project_name` to string" | Yes |
| **Feature ID issues** | Invalid format (not `F-NNN`), duplicate IDs, undefined refs | "Suggest corrected IDs, show duplicates" | Yes |
| **Dependency errors** | Circular dependency, undefined target features | "Show cycle chain (e.g., `F-003 → F-005 → F-003`), suggest break point" | No |
| **Missing fields** | Feature missing required keys (title, description, AC) | "List each feature + missing keys, guide patch" | Partial |
| **Insufficient AC** | Feature has <2 acceptance criteria | "Show feature, suggest AC examples" | No |
| **Invalid values** | complexity not in [low/medium/high/critical], status not pending | "Show field, valid values" | Yes |

### Execution

```
For auto-fixable errors:
  1. Show summary: "Found N schema/ID/format issues"
  2. Offer: auto-fix? (Y/n)
  3. Apply fix → regenerate file
  4. Re-run validation
  5. If new errors → loop (max 2 more attempts)

For manual fixes (dependencies, AC content):
  1. Show concise prompt: "Edit line X-Y in feature-list.json"
  2. Wait for user action
  3. Retry validation (max 2 more attempts)

if all_retries_exceeded:
  → Escalate: "After 3 attempts, validation still fails.
              (a) Review file manually, OR
              (b) Restart planning from Phase 1"
```

## Resume Support

feature-planner sessions can be resumed from the last completed checkpoint when artifacts are found.

### Detection Logic

Check for artifact files in `.prizmkit/plans/`:

| Artifacts Found | Resume Action |
|-----------------|---------------|
| None | Start fresh planning (Phase 1) |
| `feature-list.json` exists but not validated | Offer to validate or extend (Phase 9) |
| `feature-list.json` + validation passed | Offer: handoff to `feature-pipeline-launcher` |
| `feature-list.draft.json` only | Resume interactive planning from last checkpoint |

When existing file detected, suggest:
> "Existing plan found with N features. Resume incremental planning? (Y/n)"

### Incremental Mode Abort

If in Incremental mode but existing `feature-list.json` not found:
- Ask: "Start new plan or provide existing file?"
- If new plan chosen → switch to Route A (New Feature Set)

### Artifact Path Convention

**CRITICAL PATH RULE**: `feature-list.json` MUST be written to `.prizmkit/plans/` directory.

Before writing, verify the directory exists: `New-Item -ItemType Directory -Force -Path .prizmkit/plans | Out-Null`

```
<project-root>/
  └── .prizmkit/plans/
      ├── feature-list.json              # Primary output
      ├── feature-list.draft.json        # Draft backup (Session Exit Gate)
      └── <ISO-timestamp>.backup.json    # Optional incremental backups
```

> **Note**: For cross-session workflow recovery (e.g., interrupted pipeline execution, branch-level state detection), use `recovery-workflow` instead. This error-recovery reference handles only within-session validation retries and checkpoint resumption.
