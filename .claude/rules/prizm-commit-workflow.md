---
description: "PrizmKit commit workflow rules"
---

Before any git commit in this project:
1. Run `/prizmkit-retrospective` to sync `.prizmkit/prizm-docs/` (architecture index with TRAPS/RULES/DECISIONS)
2. Use Conventional Commits format: type(scope): description
3. Bug fixes use `fix()` prefix, not `feat()`
4. Bug fixes run retrospective with structural sync only (Job 1)
5. Use `/prizmkit-committer` command for the pure commit workflow
6. After commit, `/prizmkit-committer` generates `session-summary.md` (lightweight cross-session handoff, not committed to git)
