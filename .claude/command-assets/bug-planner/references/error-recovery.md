# Error Recovery & Resume Support

Reference document for bug-planner error handling and session recovery. Load this when validation fails, a session is interrupted, or existing artifacts are detected.

## Validation Failure Handling

### Warnings Only

If `validate-bug-list.py` returns warnings but no errors:
1. Present warnings to user
2. Ask: "Proceed with these warnings, or fix them first?"
3. If user approves → write file and continue
4. If user wants fixes → address each warning, re-validate

### Errors Found

If validation returns errors:
1. Group errors by type (missing fields, invalid values, duplicate IDs, broken references)
2. Auto-fix where possible:
   - Missing `status` → set to `pending`
   - Duplicate IDs → re-number with next sequential B-NNN
   - Invalid `priority` → re-derive from severity using the mapping table
3. Present fixes to user for confirmation
4. Re-validate after fixes
5. Maximum 3 total validation attempts — if still failing after 3 rounds, present the raw errors and ask user for guidance

### JSON Parse Failure

If the generated JSON is malformed:
1. Do not write the file
2. Regenerate from the collected bug data (Phase 2-3 state)
3. Re-validate before writing

## Resume Support

### Checkpoint-Based Resumption

When bug-planner detects existing artifacts, determine the last completed checkpoint and offer to resume:

| Existing Artifact | Last Checkpoint | Resume From |
|---|---|---|
| `.prizmkit/plans/bug-fix-list.json` (valid) | CP-BP-5 | Offer: "Valid bug list exists. Append new bugs (Route B) or regenerate?" |
| `.prizmkit/plans/bug-fix-list.json` (invalid) | CP-BP-4 | Re-run Phase 5 validation and fix |
| `.prizmkit/plans/bug-fix-list.draft.json` | CP-BP-2 or CP-BP-3 | Load draft, determine phase from content completeness, resume |
| `.prizmkit/config.json` with tech_stack | CP-BP-1 (partial) | Skip project context questions, start at Phase 2 |
| No artifacts | — | Start from Phase 1 |

### Resume Detection Flow

1. Check for `.prizmkit/plans/bug-fix-list.json`
   - If exists and valid → offer Route B (append) or full regeneration
   - If exists but invalid → offer to fix and re-validate (resume from CP-BP-4)
2. Check for `.prizmkit/plans/bug-fix-list.draft.json`
   - If exists → load draft, count bugs with/without confirmation, resume from appropriate phase
3. Check for `.prizmkit/config.json`
   - If exists with tech_stack → skip Phase 1 context gathering
4. If no artifacts → start fresh (Route A)

### Session Interruption Recovery

If a bug-planner session is interrupted mid-planning:

1. On next invocation, run the Resume Detection Flow above
2. If a draft exists, present: "Found a draft with N bugs from a previous session. Resume from where you left off, or start fresh?"
3. If user resumes → load draft state, skip completed phases
4. If user starts fresh → archive draft as `bug-fix-list.draft.TIMESTAMP.json`, begin Phase 1

## Draft Management

- Save drafts to `.prizmkit/plans/bug-fix-list.draft.json` after each completed phase (CP-BP-1 through CP-BP-4)
- Drafts use the same schema as the final file but may have incomplete fields
- Delete draft after successful generation of the final `bug-fix-list.json`
- Keep at most 1 draft — overwrite on each phase completion
