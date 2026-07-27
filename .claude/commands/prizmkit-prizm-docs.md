---
description: "Project documentation specification and standard for AI-optimized progressive context loading. Defines the .prizmkit/prizm-docs/ 3-level hierarchy (L0/L1/L2), format rules, size limits, and loading protocol. Use this skill to: bootstrap docs for new projects (init), check doc freshness (status), regenerate stale modules (rebuild), validate format compliance (validate), or migrate existing docs (migrate). For incremental doc updates after code changes, use /prizmkit-retrospective instead — it is the sole writer of .prizmkit/prizm-docs/ during development. Trigger on: 'initialize docs', 'check doc status', 'rebuild docs', 'validate docs', 'migrate docs', 'docs are stale', 'prizm docs'. (project)"
---

# Prizm Docs - AI Documentation Framework

Full specification: .claude/command-assets/prizmkit-prizm-docs/assets/prizm-docs-format.md

## Intent Routing

This skill handles 6 operations. When invoked, determine the user's intent and execute the matching operation:

| User Intent | Operation | Trigger Phrases |
|---|---|---|
| Bootstrap new project docs | **Init** | "initialize docs", "set up prizm docs", "bootstrap documentation" |
| Sync docs after code changes | **Update** | "update docs", "sync documentation", "docs are stale" |
| Check doc freshness | **Status** | "check docs", "are docs up to date", "doc status" |
| Regenerate module docs | **Rebuild** | "rebuild docs for X", "regenerate module docs" |
| Check format compliance | **Validate** | "validate docs", "check doc format", "docs valid?" |
| Convert existing docs | **Migrate** | "migrate docs", "convert docs to prizm format" |

---

## Role Clarification

**This skill vs `/prizmkit-retrospective`**:

| Aspect | `/prizmkit-prizm-docs` | `/prizmkit-retrospective` |
|--------|----------------------|--------------------------|
| **Role** | Documentation SPECIFICATION + BOOTSTRAP | Incremental WRITER during development |
| **When** | Project setup, health checks, migrations | After feature completion, before commit |
| **Writes** | Initial .prizmkit/prizm-docs/ structure (init, rebuild, migrate) | Incremental updates to existing .prizmkit/prizm-docs/ |
| **Reads** | Source code structure (for init/rebuild) | git diff + code changes (for sync) |
| **Knowledge** | Defines format rules, size limits, loading protocol | Extracts TRAPS/RULES/DECISIONS into `.prizmkit/prizm-docs/` |

**Key principle**: `/prizmkit-prizm-docs` defines WHAT the docs should look like and bootstraps them. `/prizmkit-retrospective` is the SOLE WRITER that keeps docs in sync with code during ongoing development.

## Operation: Init

Bootstrap .prizmkit/prizm-docs/ for the current project.
PRECONDITION: No .prizmkit/prizm-docs/ directory exists, or user confirms overwrite.
→ Read `.claude/command-assets/prizmkit-prizm-docs/references/op-init.md` for detailed steps.

## Operation: Update

Update .prizmkit/prizm-docs/ to reflect recent code changes.
PRECONDITION: .prizmkit/prizm-docs/ exists with root.prizm.
→ Read `.claude/command-assets/prizmkit-prizm-docs/references/op-update.md` for detailed steps.

## Operation: Status

Check freshness of all .prizm docs.
PRECONDITION: .prizmkit/prizm-docs/ exists with root.prizm.
→ Read `.claude/command-assets/prizmkit-prizm-docs/references/op-status.md` for detailed steps.

## Operation: Rebuild

Regenerate docs for a specific module from scratch. Requires a module path argument.
PRECONDITION: .prizmkit/prizm-docs/ exists. Module path is valid.
→ Read `.claude/command-assets/prizmkit-prizm-docs/references/op-rebuild.md` for detailed steps.

## Operation: Validate

Check format compliance and consistency of all .prizm docs.
PRECONDITION: .prizmkit/prizm-docs/ exists.
→ Read `.claude/command-assets/prizmkit-prizm-docs/references/op-validate.md` for detailed steps.

## Operation: Migrate

Convert existing documentation to .prizmkit/prizm-docs/ format.
PRECONDITION: Existing docs/ or docs/AI_CONTEXT/ directory. No .prizmkit/prizm-docs/ (or user confirms overwrite).

STEPS:
1. DISCOVER existing docs: Scan docs/, docs/AI_CONTEXT/, README.md, ARCHITECTURE.md, and any structured documentation files.
2. EXTRACT information from existing docs: project metadata, module descriptions, architecture patterns, rules, decisions, dependencies.
3. MAP existing doc content to Prizm levels: project-wide info -> L0 root.prizm, module-level info -> L1 docs (MODULE, FILES, RESPONSIBILITY, KEY_FILES, DEPENDENCIES), detailed module info -> L2 docs (INTERFACES, DATA_FLOW, TRAPS, DECISIONS, domain-specific sections).
4. CONVERT prose content to KEY: value format. Strip markdown formatting, tables, diagrams. Condense explanatory text into single-line values.
5. GENERATE .prizmkit/prizm-docs/ structure following standard init procedure but seeded with extracted information instead of scanning source code alone.
6. VALIDATE migrated docs against Prizm format rules and size limits.
7. REPORT migration summary: files processed, content mapped, information that could not be automatically converted (requires manual review).

OUTPUT: Migration report with list of source docs processed, generated .prizm files, and any manual review items.

## Error Handling

- **root.prizm is corrupted or invalid format**: Back up the existing file, then run Rebuild on all modules to regenerate from source code.
- **Broken pointers (-> references to non-existent files)**: Create the missing .prizm file if the source module exists; remove the pointer if the source module was deleted.
- **Size limit exceeded**: For L0, consolidate MODULE_INDEX entries. For L1, move implementation details to L2. For L2, trim non-essential derived detail and keep only durable project knowledge.
- **No git history available**: Fall back to filesystem timestamps for freshness checks; warn user that accuracy may be reduced.

### Key Protocols (reference)
For detailed protocol specifications, see prizm-docs-format.md:
- Progressive Loading: Section 6.1
- Auto-Update: Section 7.1
- RULES hierarchy: Section 3.1

## Examples

**Init output (Node.js project):**
```
Generated .prizmkit/prizm-docs/:
  root.prizm (L0) — 3 modules in MODULE_INDEX
  routes.prizm (L1) — 12 files, 4 interfaces
  models.prizm (L1) — 8 files, 3 interfaces
  services.prizm (L1) — 15 files, 6 interfaces
```

**Update after adding new API endpoint:**
```
Changed: src/routes/avatar.ts (A), src/models/user.ts (M)
Updated: .prizmkit/prizm-docs/routes.prizm — added avatar.ts to KEY_FILES, new POST /api/avatar interface
Updated: .prizmkit/prizm-docs/models.prizm — updated User interface with avatar_url field
Skipped: .prizmkit/prizm-docs/services.prizm — no changes in services module
```
