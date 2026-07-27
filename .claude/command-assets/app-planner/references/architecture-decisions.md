# Architecture Decision Capture

During planning, key **framework-level** architectural decisions may emerge. When they do, capture them in the project instruction file so all future AI sessions have this context.

## What Qualifies (ALL must apply)

Only capture decisions that are **framework-shaping** — NOT individual feature details. Qualifying categories:

| Category | Examples |
|----------|----------|
| Tech stack choices | PostgreSQL over MongoDB, React over Vue, Node.js runtime |
| Communication patterns | REST vs GraphQL, WebSocket vs SSE vs polling |
| Architectural patterns | Monorepo, microservices, monolith, event-driven |
| Data model strategies | Relational vs document, event sourcing, CQRS |
| Security architecture | JWT vs session, OAuth provider, RBAC model |

**Do NOT capture**: individual feature implementation details, UI component choices, specific API endpoint designs, or anything scoped to a single feature.

**This is conditional** — most planning sessions will NOT produce architecture decisions. Only capture when genuinely impactful decisions are made during the discussion.

## When to Capture

After Phase 2 (Confirm constraints and tech assumptions), before Phase 3 (Capture architecture decisions and finalize project brief). At this point decisions are settled.

## How to Capture

1. **Detect platform** — determine which project instruction file to update:
   - If `.prizmkit/manifest.json` exists, read `platform` and use it as the source of truth.
   - `codex` → append to `AGENTS.md`
   - `claude` → append to `CLAUDE.md`
   - `codebuddy` → append to `CODEBUDDY.md`
   - `all` → append to all three files. Legacy manifests may contain `both`; treat it as read-only compatibility and append to `CLAUDE.md` and `CODEBUDDY.md` only when encountered.
   - Only when the manifest is missing, fall back to PrizmKit-owned install artifacts: `.codex/agents/*.toml`, `.claude/commands/prizm-kit.md`, `.codebuddy/skills/prizm-kit/SKILL.md`.
   - Do not treat a generic `.agents/` directory as Codex; it may contain unrelated third-party skills.
   - If no platform can be determined, skip (no project instruction file).

2. **Check for existing section** — read the target file and look for `### Architecture Decisions` heading:
   - If heading exists → append new entries below it (avoid duplicates with existing entries)
   - If heading does not exist → create it at the end of the file

3. **Format** — one line per decision, no feature IDs:
   ```markdown
   ### Architecture Decisions
   - WebSocket for real-time: sub-second latency required for collaboration features
   - PostgreSQL: relational data model with complex queries, ACID compliance needed
   - Monorepo structure: shared types between frontend and backend
   ```

4. **User confirmation** — before writing, show the collected decisions and ask:
   > "These architecture decisions were identified during planning. Record them to [AGENTS.md / CLAUDE.md / CODEBUDDY.md]? (Y/n)"

   If user declines, skip without further prompting.
