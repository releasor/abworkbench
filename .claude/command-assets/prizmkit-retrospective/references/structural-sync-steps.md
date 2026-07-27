# Structural Sync — Detailed Steps

**1a.** Get changed files (staged + unstaged vs HEAD):
```bash
git diff HEAD --name-status
```

**1b.** Read `.prizmkit/prizm-docs/root.prizm` to get MODULE_INDEX (or MODULE_GROUPS). Map each changed file to its module.

**1c.** Classify changes:
- `A` (added) → add to KEY_FILES, check for new INTERFACES
- `D` (deleted) → remove from KEY_FILES, update FILE count
- `M` (modified) → check if public interfaces or dependencies changed
- `R` (renamed) → update all path references

**1d.** Update affected docs (bottom-up: L2 → L1 → L0):

- **L2**: If L2 exists → update **only the sections affected by the diff files in this module**. For example, if only `api.js` changed: update its KEY_FILES entry, its INTERFACES (if exports changed), its DEPENDENCIES (if imports changed). Do NOT re-scan unchanged files in the module. If L2 does NOT exist AND the module has Added or Modified source files in the current diff with meaningful logic (not trivial config) → create L2 with these sections: MODULE, FILES, RESPONSIBILITY, INTERFACES, DATA_FLOW, KEY_FILES, DEPENDENCIES, RULES, TRAPS, DECISIONS. Populate **only from the diff files** (the Added/Modified files in this module from step 1a), not from the entire module directory.
- **L1**: Update FILES count, KEY_FILES (if major files added/removed), DEPENDENCIES (if module-level deps changed). **L1 does NOT contain INTERFACES, DATA_FLOW, TRAPS, or DECISIONS** — those belong in L2 only.
- **L0 root.prizm**: Update MODULE_INDEX file counts only if counts changed. Update CROSS_CUTTING if cross-module concerns changed. Update only if structural change (module added/removed). **Preserve** any `PROJECT_BRIEF:` line — it is managed by prizmkit-init.

**Memory hygiene**: During L0/L1/L2 updates, do not write CHANGELOG sections/files, UPDATED/date metadata, feature/bug/refactor/task/session/run/pipeline/workflow IDs, branch names, absolute worktree paths, or `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths. Update durable sections in place; git history is the change log.

**1e.** If new directory qualifies as a module and matches no existing module:
- A directory qualifies as a module if any of: contains source files forming a logical unit, contains entry/config/interface files, contains qualifying sub-modules, or is referenced by multiple modules as dependency.
- Create L1 doc immediately, add to MODULE_INDEX.
- If the current diff includes Added or Modified source files with meaningful logic → create L2 immediately. Otherwise defer L2.

**1f.** Enforce size limits:
- L0 > 4KB → if using MODULE_INDEX with > 15 entries, convert to MODULE_GROUPS format (group by functional domain). Otherwise, consolidate MODULE_INDEX descriptions.
- L1 > 4KB → trim KEY_FILES descriptions, ensure RULES <= 3 entries
- L2 > 5KB → trim non-essential detail, split oversized cross-cutting detail, or move derived context back to source references

**SKIP structural sync if**: only internal implementation changed (no interface/dependency impact), only comments/whitespace, only .prizm files. **DO NOT skip** test file changes or bug fixes — they may reveal TRAPS worth capturing in L2.

**1g. TRAPS staleness check** (only when an L2 doc's TRAPS section has > 10 entries):

Perform a quick staleness scan on existing TRAPS to prevent unbounded accumulation:
1. If a TRAP has `STALE_IF:` and the glob-matched files no longer exist (verified via `ls`) → delete the TRAP entry
2. If a TRAP has `REF:` → check if the referenced file still exists and the REF commit is less than 180 days old (via `git log --since="180 days ago" <hash> 2>/dev/null`). If the file is deleted OR the REF commit is older than 180 days → prepend `[REVIEW]` to the severity, signaling it needs verification during the next retrospective Job 2
3. Process at most 5 of the oldest TRAPS per L2 doc per session (to bound context cost)

This step is lightweight — it only triggers when TRAPS exceed 10 entries, and processes at most 5 per run.
