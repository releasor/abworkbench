# Operation: Update — Detailed Steps

Update .prizmkit/prizm-docs/ to reflect recent code changes.

PRECONDITION: .prizmkit/prizm-docs/ exists with root.prizm.

STEPS:
1. Get changed files via `git diff --cached --name-status`. If nothing staged, use `git diff --name-status`. If no git changes at all, do full rescan comparing code against existing docs — this includes checking for modules that have source files but no L2 doc.
2. Map changed files to modules by matching against MODULE_INDEX or MODULE_GROUPS in root.prizm. Group changes by module.
3. Classify each change: A (added) -> new KEY_FILES entries. D (deleted) -> remove entries, update counts. M (modified) -> check dependency changes. R (renamed) -> update all path references.
4. Update affected docs: L2 first (KEY_FILES, INTERFACES, DATA_FLOW, DEPENDENCIES, TRAPS, DECISIONS), then L1 (FILES count, KEY_FILES, DEPENDENCIES — L1 does NOT contain INTERFACES/DATA_FLOW/TRAPS/DECISIONS), then L0 (MODULE_INDEX or MODULE_GROUPS counts, CROSS_CUTTING) only if structural change. Do not write CHANGELOG sections/files, UPDATED/date metadata, feature/bug/refactor/task/session/run/pipeline/workflow IDs, branch names, absolute worktree paths, or `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths — git tracks history. **Preserve** any `PROJECT_BRIEF:` line in root.prizm — it is managed by prizmkit-init, not by this skill.
5. Skip updates if: only internal implementation changed (no interface/dependency change), only comments/whitespace/formatting, only .prizm files changed. DO NOT skip test file changes or bug fixes — they may reveal TRAPS worth capturing in L2.
6. If new directory qualifies as a module (per MODULE_DISCOVERY_CRITERIA) and matches no existing module: create L1 immediately, add to MODULE_INDEX. If the current diff includes Added or Modified source files in this module → also create L2 immediately with sections: MODULE, FILES, RESPONSIBILITY, INTERFACES, DATA_FLOW, KEY_FILES, DEPENDENCIES, RULES, TRAPS, DECISIONS. Otherwise defer L2.
6a. **L2 gap check** (runs during full rescan mode only — when no git changes detected): For each existing module in MODULE_INDEX, check if L2 doc exists. If L2 is missing and the module has source files with meaningful logic (not trivial config/wrapper) → create L2 with sections: MODULE, FILES, RESPONSIBILITY, INTERFACES, DATA_FLOW, KEY_FILES, DEPENDENCIES, RULES, TRAPS, DECISIONS. This ensures Update fills documentation gaps left by previous sessions.
7. Enforce size limits: L0 > 4KB -> consolidate. L1 > 4KB -> trim KEY_FILES descriptions, ensure RULES <= 3 entries. L2 > 5KB -> trim non-essential derived detail or split oversized cross-cutting detail.
7a. Validate memory hygiene: no CHANGELOG/UPDATED fields, no workflow metadata, no L1 behavioral sections.
8. Stage updated .prizm files via `git add .prizmkit/prizm-docs/`

OUTPUT: List of updated/created/skipped docs with reasons.
