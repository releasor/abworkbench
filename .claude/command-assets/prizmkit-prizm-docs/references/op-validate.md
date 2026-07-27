# Operation: Validate — Detailed Steps

Check format compliance and consistency of all .prizm docs.

PRECONDITION: .prizmkit/prizm-docs/ exists.

STEPS:
1. FORMAT CHECK: Verify all .prizm files use KEY: value format. Flag any prose paragraphs, code blocks (```), markdown headers (##), emoji, ASCII art, or horizontal rules. Flag TRAPS entries missing severity prefix ([CRITICAL], [HIGH], or [LOW]). Flag CHANGELOG sections/files, UPDATED/date metadata, feature/bug/refactor/task/session/run/pipeline/workflow IDs, branch names, absolute worktree paths, and `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths as auxiliary noise. Note: [REVIEW] preceding severity (e.g., `[REVIEW][HIGH]`) is a valid temporary staleness marker, not a format violation.
2. SIZE CHECK: Verify size limits: L0 <= 4KB, L1 <= 4KB, L2 <= 5KB. Report files exceeding limits with current size.
3. POINTER CHECK: Verify all arrow (->) references resolve to existing .prizm files. Report broken pointers.
4. STALENESS CHECK: Compare git modification time of each .prizm file against source directory. Flag docs where source was modified more recently.
5. COMPLETENESS CHECK: Verify root.prizm has all required fields (PRIZM_VERSION, PROJECT, LANG, MODULE_INDEX or MODULE_GROUPS). Verify L1 docs have MODULE, FILES, RESPONSIBILITY, DEPENDENCIES (no INTERFACES/TRAPS/DECISIONS). Verify L2 docs have MODULE, FILES, KEY_FILES, DEPENDENCIES, INTERFACES, TRAPS.
6. ANTI-PATTERN CHECK: Flag duplicate information across levels, implementation details in L0/L1, TODO items, session-specific context, changelog/history sections, and workflow metadata.
7. RULES HIERARCHY CHECK: Verify L1/L2 RULES do not contradict root.prizm RULES. L1/L2 may only supplement with module-specific exceptions.
8. TRAPS STALENESS CHECK: For each L2 doc where TRAPS section has more than 8 entries, verify that TRAPS include staleness metadata (`STALE_IF:` or `REF:` fields). Flag TRAPS without any staleness metadata as `NEEDS_METADATA` — these are not auto-removed, but flagged for the next `/prizmkit-retrospective` to enrich with `STALE_IF:` globs or `REF:` hashes.

OUTPUT: Validation report with PASS/FAIL per check, list of issues with file paths and suggested fixes.
