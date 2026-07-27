# Knowledge Injection — Detailed Steps (2a–2c)

**2a.** Gather context — read the **actual code that was changed** plus any available artifacts:

- `git diff HEAD` — the real source of truth for what happened
- `review-report.md` in the artifact directory — read the findings and fix instructions. If this file exists, use it as a source for pre-categorized decisions and findings.
- `plan.md` in the artifact directory — read planned vs actual
- Any companion documents in the artifact directory (e.g., `refactor-analysis.md`, `fix-report.md`) — read what was discovered
- The relevant `.prizmkit/prizm-docs/` L1/L2 docs for affected modules

**2b.** Extract knowledge from what was **observed in code**, not invented:

**TRAPS** (highest priority) — things that look safe but break:
- Minimal format: `- [SEVERITY] <description> | FIX: <approach>`
- Full format: `- [SEVERITY] <description> | FIX: <approach> | REF: <hash> | STALE_IF: <glob>`
- Source: actual bugs hit, surprising behavior discovered in code, non-obvious coupling

**TRAPS severity classification**:
- `[CRITICAL]`: data loss, security, financial error, system crash
- `[HIGH]`: functional failure, silent error, interface incompatibility
- `[LOW]`: misleading naming, non-intuitive API, minor performance issue

When writing TRAPS:
- Severity prefix is MANDATORY (e.g., `[CRITICAL]`, `[HIGH]`, `[LOW]`)
- OPTIONAL: append `| REF: <7-char-hash>` when you know the relevant commit (for traceability)
- OPTIONAL: append `| STALE_IF: <glob>` when the TRAP is tightly coupled to specific files (for auto-expiry detection)

**Consuming [REVIEW] markers** (from staleness check 1g):
- If you encounter a TRAP prefixed with `[REVIEW]` (e.g., `[REVIEW][HIGH] ...`), verify whether the trap is still valid by checking the current code. If still valid: remove the `[REVIEW]` prefix, keeping the severity. If no longer relevant: delete the TRAP entry.

**RULES** — conventions established or constraints discovered:
- Format: `- MUST/NEVER/PREFER: <rule>`
- Source: patterns that proved necessary during implementation

**DECISIONS** — key design choices that affect future development:
- Format: `- <what was decided> — <rationale>`
- Source: non-obvious design choices, interface conventions, cross-module contracts
- Only record decisions that a future AI session would benefit from knowing
- Do NOT record obvious implementation details that can be derived by reading the code

**QUALITY GATE**: Every item must answer: "If a new AI session reads only `.prizmkit/prizm-docs/` and this entry, does it gain actionable understanding?" If not, discard. Do not record trivially observable code patterns — the AI can read the code directly.

**MEMORY HYGIENE GATE**: Before writing any `.prizmkit/prizm-docs/` entry, remove or translate workflow metadata. Never write CHANGELOG sections/files, UPDATED/date metadata, feature/bug/refactor/task/session/run/pipeline/workflow IDs, branch names, absolute worktree paths, or `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths. If source artifacts say "fixed in B-001" or "implemented in F-003", write only the durable product/domain fact.

**2c.** Inject into the correct `.prizmkit/prizm-docs/` file:
- Module-level TRAPS/RULES/DECISIONS → the affected **L2** `.prizm` file. If the target L2 does not exist, create it first using the L2 GENERATION TEMPLATE before injecting knowledge. (TRAPS/DECISIONS/RULES belong in L2, not L1.)
- Project-level RULES/PATTERNS → `root.prizm` (respect the current format — MODULE_INDEX or MODULE_GROUPS — do not convert between them during injection)
- Cross-module concerns spanning 2+ modules → `root.prizm` CROSS_CUTTING section

**RULE**: Only add genuinely new information. Never duplicate existing entries. Never rewrite entire files.
