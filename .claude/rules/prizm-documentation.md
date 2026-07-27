---
description: "PrizmKit .prizmkit/prizm-docs maintenance rules — when/how to update structured AI documentation"
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.py"
  - "**/*.go"
  - "**/*.rs"
  - "**/*.java"
---

WHEN TO UPDATE .prizmkit/prizm-docs/:
- Feature development (new interface, new module, new behavior) → UPDATE .prizmkit/prizm-docs/
- Bug fix (fixing broken logic, no structural change) → SKIP, do NOT update
- Rationale: bugs are incomplete features. Recording bug details causes doc bloat with no AI value.
- Before modifying any source file, read `.prizmkit/prizm-docs/root.prizm` if it exists to understand project structure.

FORMAT RULES (enforced by pre-commit hook — violations block commit):
- ALL CAPS section headers: MODULE:, FILES:, RESPONSIBILITY:, etc.
- KEY: value pairs and dash-prefixed lists only
- PROHIBITED: prose paragraphs, markdown headers (##/###), code blocks (```), emoji, ASCII art
- No UPDATED timestamps — git is the authoritative source for temporal information
- PROHIBITED: CHANGELOG sections/files, UPDATED/date metadata, feature/bug/refactor/task/session/run/pipeline/workflow IDs, branch names, absolute worktree paths, and `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths
- This format is designed for AI token efficiency, not human readability. Do not add human-friendly formatting.

SIZE LIMITS (hard — pre-commit hook blocks commits exceeding these):
- L0 root.prizm: 4KB max
- L1 module.prizm: 4KB max
- L2 detail.prizm: 5KB max

SIZE OVERFLOW HANDLING:
- L0 approaching 4KB: if MODULE_INDEX has > 15 entries, convert to MODULE_GROUPS format (group by domain). Otherwise consolidate descriptions, keep only top-5 RULES, remove PATTERNS detail.
- L1 approaching 4KB: trim KEY_FILES descriptions, ensure RULES <= 3 entries, move detail to L2
- L2 approaching 5KB: remove stale or trivially derivable entries; never create changelog-archive.prizm
- NEVER exceed hard limits — pre-commit hook will block the commit

REQUIRED FIELDS PER LEVEL:

L0 root.prizm:
- PRIZM_VERSION
- PROJECT
- LANG
- MODULE_INDEX or MODULE_GROUPS (with -> pointers to L1 files)
- RULES (top-level project rules)

L1 module.prizm (structural index only):
- MODULE
- FILES
- RESPONSIBILITY
- DEPENDENCIES
- L1 does NOT contain: INTERFACES, DATA_FLOW, TRAPS, DECISIONS (those belong in L2)

L2 detail.prizm:
- MODULE
- FILES
- KEY_FILES
- DEPENDENCIES
- INTERFACES
- TRAPS (with severity prefix: [CRITICAL], [HIGH], or [LOW])

L2 GENERATION TEMPLATE (use when AI first touches a sub-module with no L2 doc):

MODULE: <path>
FILES: <comma-separated file list>
RESPONSIBILITY: <one-line>
KEY_FILES:
- <file>: <role, line count, complexity note>
DEPENDENCIES:
- uses: <lib>: <why>
- imports: <module>: <what>
INTERFACES:
- <exported function/class>: <signature and purpose>
TRAPS:
- [LOW] <gotcha, race condition, or non-obvious coupling> | FIX: <approach>

TRAPS is critical — always record gotchas, race conditions, non-obvious behavior, and surprising coupling between modules. Every TRAP must have a severity prefix ([CRITICAL], [HIGH], or [LOW]).
