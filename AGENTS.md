<!-- PRIZMKIT:START — managed by PrizmKit, do not edit manually -->
## PrizmKit Documentation Framework

This project uses PrizmKit with the Prizm documentation system for AI-optimized progressive context loading.

### Progressive Loading Protocol
- ON SESSION START: Always read `.prizmkit/prizm-docs/root.prizm` first (L0 — project map)
- ON RESUME (feature/bugfix directory has session-summary.md): Read session-summary.md first for prior context, then load only L1/L2 for modules mentioned in it
- ON TASK: Read L1 (`.prizmkit/prizm-docs/<module>.prizm`) for relevant modules referenced in MODULE_INDEX or MODULE_GROUPS. If entries have keyword tags (e.g., `[login, jwt, oauth]`), match user's task against tags to prioritize which modules to load.
- ON FILE EDIT: Read L2 (`.prizmkit/prizm-docs/<module>/<submodule>.prizm`) before modifying files. Pay attention to TRAPS and DECISIONS.
- NEVER load all .prizm docs at once. Load only what is needed for the current task.

### Auto-Update Protocol
- BEFORE EVERY COMMIT: Update affected `.prizmkit/prizm-docs/` files
- Platform hooks (rules or UserPromptSubmit) will remind you automatically
- Use `/prizmkit-committer` for the complete commit workflow

### Doc Format Rules
- All `.prizm` files use KEY: value format, not prose
- Size limits: L0 = 4KB, L1 = 4KB, L2 = 5KB
- Arrow notation (->) indicates load pointers to other .prizm docs
- Memory files must not contain CHANGELOG sections/files, UPDATED/date metadata, feature/bug/refactor/task/session/run/pipeline/workflow IDs, branch names, absolute worktree paths, or `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths
- Update durable sections in place; git history is the change log
- No date/time fields — git is the authoritative source for temporal info

### Creating New L2 Docs
- When you first modify files in a sub-module that has no L2 doc:
  1. Read the source files in that sub-module
  2. Generate a new L2 `.prizm` file following Prizm specification
  3. Add a pointer in the parent L1 doc's SUBDIRS section

### Available PrizmKit Skills
Codex discovers repository skills from `.agents/skills/`. When a user or prompt mentions `/prizmkit-xxx`, use the matching skill at `.agents/skills/prizmkit-xxx/SKILL.md`.

- Start with `.agents/skills/prizm-kit/SKILL.md` to see all available PrizmKit skills.
- Skill assets and references live inside each `.agents/skills/<skill>/` directory.
- PrizmKit behavioral rules live in `.agents/rules/`; read the relevant Markdown guidance before commit, documentation, or context-loading work.
- Native Codex subagents live in `.codex/agents/*.toml`; use them when spawning or coordinating subagents.

### Fast Path for Simple Changes
Not every change needs the full spec -> plan workflow. Use fast path for:
- Bug fixes with clear root cause, config tweaks, typo fixes, simple refactors
- Documentation-only changes, test additions for existing code
- Fast path: `/prizmkit-plan` (simplified) → `/prizmkit-implement` → `/prizmkit-committer`

Use the full workflow (/prizmkit-plan -> /prizmkit-implement) for:
- New features, multi-file coordinated changes, architectural decisions, data model or API changes
<!-- PRIZMKIT:END -->
