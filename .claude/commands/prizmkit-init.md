---
description: "Project takeover and bootstrap. Scans any project, generates Prizm docs and project brief. Use this skill whenever a user opens a new project for the first time, says 'initialize', 'set up PrizmKit', 'take over this project', 'bootstrap', 'scan this codebase', 'init', or when .prizmkit/prizm-docs/ doesn't exist yet. Also use when PrizmKit was just installed via npx but not yet initialized. (project)"
---

# PrizmKit Init

Project takeover and bootstrap skill. Scans any project (brownfield or greenfield), generates Prizm documentation and project brief. Supports Codex, Claude Code, CodeBuddy, and multi-platform installations.

### When to Use
- Taking over a new project (brownfield or greenfield)
- User says "initialize PrizmKit", "set up PrizmKit", "take over this project"
- First time using PrizmKit on a project
- After `npx prizmkit install` when project has no `.prizmkit/prizm-docs/`

### When NOT to Use
- All artifacts exist and are up to date → use `/prizmkit-prizm-docs` (Update) instead if you only want to resync docs
- User just wants to update stale docs → use `/prizmkit-prizm-docs` (Update or Rebuild) instead (faster, targeted)
- User wants to start a feature on an already-initialized project → skip init, go to `/prizmkit-plan`

### Error Handling
- If artifacts already exist: idempotent status check offers regenerate/skip choices (see Phase 3: Idempotent Status Check)
- If no source files found in any directory: fall back to greenfield mode

## Execution Steps

**Phase 1: Platform Detection**
1. Detect which platform is running (Codex, Claude Code, or CodeBuddy) via AI CLI environment.
2. Hold detected platform value in memory — written to disk in Phase 6 along with other config fields.

**Phase 2: Mode Detection**
- If project has source code: brownfield mode
- If project is nearly empty: greenfield mode

**Phase 3: Idempotent Status Check**

Scan all init artifacts and display their status:

| Artifact | Path | Check |
|----------|------|-------|
| Prizm docs | `.prizmkit/prizm-docs/` | Directory exists + `root.prizm` present |
| Runtime config | `.prizmkit/config.json` | File exists |
| Project brief | `.prizmkit/plans/project-brief.md` | File exists |

Display status table to user:
```
Init Status Check:
  [exists]  .prizmkit/prizm-docs/          (N files)
  [exists]  .prizmkit/config.json
  [missing] .prizmkit/plans/project-brief.md
```

- **If all missing**: skip interaction, proceed to generate everything.
- **If some exist**: ask user once:
  - **[A] Regenerate all** — overwrite all existing artifacts (fresh start)
  - **[B] Only generate missing** — skip existing, fill gaps (default)
  - **[C] Pick per item** — ask for each existing artifact: regenerate or skip

Each subsequent phase checks its artifact's action before executing:
- `action == skip` → output "Skipped (exists)" and move on
- `action == generate | regenerate` → run normally
- **Special case for `.prizmkit/prizm-docs/`**:
  - `skip` = **Update** mode: preserve existing L1/L2 docs, re-scan tech stack, merge changes, check for missing docs (see `.claude/command-assets/prizmkit-init/references/update-supplement.md`)
  - `regenerate` = **Reinitialize**: overwrite everything

BROWNFIELD WORKFLOW (existing project):

**Phase 4: Project Scanning**
1. Detect tech stack from build files (`package.json`, `requirements.txt`, `go.mod`, `pom.xml`, `Cargo.toml`, etc.)
2. Map directory structure using a TWO-TIER model — flat structures lose the nesting relationships that AI needs to navigate the codebase:
   - TOP-LEVEL modules: directories directly under project root that contain source files or sub-directories with source files (e.g. `src/`, `internal/`, `lib/`)
   - SUB-MODULES: directories INSIDE a top-level module (e.g. `src/routes/`, `src/models/`)
   - A sub-module maps to `.prizmkit/prizm-docs/<M>/<S>.prizm`, never to `.prizmkit/prizm-docs/<S>.prizm` — flattening would create ambiguous paths when two modules have identically-named sub-modules
   - Exclude: `.git/`, `node_modules/`, `vendor/`, `build/`, `dist/`, `__pycache__/`, `target/`, `bin/`, `.agents/`, `.codex/`, `.claude/`, `.codebuddy/`, `.prizmkit/`
   - **Scan command** — run this to get a 2-level directory tree (excludes noise directories):
     ```powershell
     Get-ChildItem -Path . -Directory -Recurse -Depth 2 -Force -ErrorAction SilentlyContinue |
       Where-Object {
         $_.FullName -notmatch '\\(node_modules|\.git|dist|build|__pycache__|vendor|\.agents|\.codex|\.claude|\.codebuddy|\.prizmkit|target)(\\|$)'
       } |
       ForEach-Object {
         $relative = Resolve-Path -Relative $_.FullName
         $depth = (($relative -replace '^[.][\\/]', '') -split '[\\/]').Count - 1
         ('  ' * [Math]::Max(0, $depth)) + ($relative -replace '^[.][\\/]', '')
       }
     ```
3. Identify entry points by language convention
4. Catalog dependencies (external packages)
5. Count source files per directory
6. Detect detailed tech stack (adaptive — only include fields that apply):
   → Read `.claude/command-assets/prizmkit-init/references/tech-stack-catalog.md` for the full field catalog.

   **IMPORTANT**: Not all projects have all fields. A pure backend API will have no `frontend_framework` or `frontend_styling`. A library may have no database. Only record what is actually detected — never generate empty or placeholder values.

**Phase 4.5: Layer Detection**

After tech stack detection, determine which development layers exist in the project — these are code domains that may benefit from custom dev rules (frontend, backend, database, mobile). This is a quick detection step, not an interactive Q&A — rules can be configured later based on detected layers.

1. Read `.claude/command-assets/prizmkit-init/references/rules/layer-detection.md` for the detection signal table and AI judgment guidelines.
2. Scan the project against each signal, and supplement with your own judgment — the signal table is a guide, not exhaustive. If you see clear evidence of a layer not covered by the table, include it. If a signal matches but context is misleading, downgrade or ignore it:
   - **frontend**: React/Vue/Angular/etc. in dependencies, or `src/components/` with UI files
   - **backend**: Express/FastAPI/Gin/etc. in dependencies, or `routes/`/`controllers/` with server code
   - **database**: Prisma/TypeORM/SQLAlchemy/etc. in dependencies, or `migrations/`/`prisma/` directory
   - **mobile**: `pubspec.yaml` (Flutter), `react-native` in package.json, or simultaneous `ios/`+`android/` directories
3. For mobile signals — if ambiguous (e.g., monorepo with web + ios/android dirs), use `AskUserQuestion` to confirm: "Mobile platform signals detected. Is this project a mobile app?" Options: "Yes, this is a mobile app" / "No, these are for another purpose".
4. Assemble `detected_layers` array (e.g., `["frontend", "backend", "database"]`). If no layers detected (library/CLI project), array is empty.

**Phase 4.6: Infrastructure Quick Scan**

Detect database and deployment signals, then ask 1-2 brief questions. This phase is **optional** — users can skip and configure later.

- **BROWNFIELD**: Auto-detect infrastructure signals from existing files, then ask 1-2 brief questions (pre-filled with detection results)
- **GREENFIELD**: No auto-detection possible — ask the 2 brief questions directly (database need and deployment target)

1. **Auto-detect infrastructure signals** (no user interaction):
   - **Database signals**: ORM/database client dependencies in `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pyproject.toml` (look for: prisma, typeorm, sequelize, mongoose, sqlalchemy, django, gorm, diesel, sqlx, pg, mysql2, etc.); directories named `migrations/`, `db/`, `schema/`, `prisma/`; environment variables `DATABASE_URL`, `DB_HOST`, `DB_NAME`, `MONGO_URI` in `.env*` files
   - **Deployment signals**: `Dockerfile`, `docker-compose.yml`, `vercel.json`, `fly.toml`, `railway.json`, `netlify.toml`, `cloudflare.json`, `.github/workflows/`, `Procfile`, `app.yaml`, `serverless.yml`, `terraform/`, `pulumi/`

2. **Brief inquiry** (using `AskUserQuestion`, max 2 questions):

   **Question 1 — Database**:
   - If database signals detected: pre-fill with detected info
   - Question: "Does your project use a database?"
   - Options:
     - "Yes — {detected ORM/DB}" (if detected, mark as Recommended)
     - "Yes — different database" (let user specify)
     - "No database needed"
     - "Skip — decide later"
   - If "Yes": follow up to confirm database type (MySQL / PostgreSQL / MongoDB / SQLite / Other) — skip this follow-up if already clear from detection

   **Question 2 — Deployment target**:
   - If deployment signals detected: pre-fill with detected info
   - Question: "Where will this project be deployed?"
   - Options:
     - "{Detected platform}" (if detected, e.g., "Vercel" from vercel.json, mark as Recommended)
     - "Own server / VPS"
     - "SaaS platform" (if no specific platform detected)
     - "Container (Docker / K8s)"
     - "Skip — decide later"
   - If "SaaS platform": follow up with platform selection (Vercel / Railway / Fly.io / Cloudflare / AWS / Other)

3. **Write results**:
   - Append `### Infrastructure` section to the detected platform instruction file (`AGENTS.md` for Codex, `CLAUDE.md` for Claude Code, `CODEBUDDY.md` for CodeBuddy) with detection results and user answers. Format:
     ```markdown
     ### Infrastructure

     #### Database
     - **Type**: [PostgreSQL / MySQL / MongoDB / SQLite / none]
     - **ORM**: [detected ORM or "none detected"]

     #### Deployment
     - **Target**: [platform name or "undecided"]
     ```
     → This is intentionally minimal (Quick Scan). Full conventions and deployment details can be added later.
   - If user selects "Skip — decide later" for BOTH topics: write deferred marker instead:
     ```markdown
     ### Infrastructure
     <!-- infrastructure: deferred -->
     ```
   - If user skips only one topic, write the answered one normally and mark the skipped one:
     ```markdown
     #### Database
     <!-- database: deferred -->
     ```

**Phase 4.7: Rules Quick Entry**

After Infrastructure Quick Scan completes, check if `detected_layers` is non-empty (from Phase 4.5). If layers were detected, offer a lightweight entry point for rules configuration.

1. If `detected_layers` is empty (library/CLI project) → skip this phase entirely, proceed to Phase 5.
2. If layers detected, use `AskUserQuestion`:

   **Question**: "Detected **{list detected layers}** code. Would you like to set up custom development rules for AI to follow? This helps AI generate code that matches your conventions."
   - **Configure later (Recommended)** — Record layers and configure rules later
   - **Skip entirely** — no custom rules, AI uses general best practices

3. If user picked "Skip entirely" → clear `detected_layers` to empty array, proceed to Phase 5.
4. If user picked "Configure later" → keep `detected_layers`, proceed to Phase 5. The layers will be written to config.json in Phase 6.

**Phase 5: Prizm Documentation Generation**
Invoke prizmkit-prizm-docs (Init operation), passing the two-tier module structure from Phase 4:
  - Create `.prizmkit/prizm-docs/` directory structure mirroring the source tree (sub-module dirs become subdirectories under `.prizmkit/prizm-docs/<top-level>/`)
  - Generate `root.prizm` (L0) with project meta and MODULE_INDEX listing only top-level modules. If module count > 15, use MODULE_GROUPS format instead (group by functional domain).
  - For each module entry in MODULE_INDEX/MODULE_GROUPS, include keyword tags extracted from the module's source files — scan for: exported symbols, imported packages, domain terms in file/directory names. Format: `- module-name [tag1, tag2, tag3]: ...`. Tags help AI match user intent to relevant modules.
  - Generate L1 docs for top-level modules at `.prizmkit/prizm-docs/<M>.prizm` and for sub-modules at `.prizmkit/prizm-docs/<M>/<S>.prizm`
  - Skip L2 (lazy generation) — L2 is generated on first file modification, saving tokens upfront
  - Do not create auxiliary `changelog.prizm`, CHANGELOG sections/files, UPDATED/date metadata, feature/bug/refactor/task/session/run/pipeline/workflow IDs, branch names, absolute worktree paths, or `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths; git history is the source of change history

**Phase 6: Workspace Initialization**
6a. Create `.prizmkit/` directory structure (if missing):
  - `.prizmkit/config.json` (adoption_mode, speckit_hooks_enabled, platform)
  - `.prizmkit/specs/` (empty)
  - `.prizmkit/plans/` (empty — needed by Phase 7 and future pipeline tasks)

6b. Write detected tech stack to `.prizmkit/config.json`:
   → Read `.claude/command-assets/prizmkit-init/references/config-schema.md` for merge strategy, field definitions, and examples.

6c. Write `detected_layers` to `.prizmkit/config.json` (alongside `tech_stack`):
   - Field: `"detected_layers": ["frontend", "backend"]` — the layers from Phase 4.5
   - If user chose "Skip entirely" in Phase 4.7, write empty array `[]`
   - For greenfield projects (Phase 4.5 skipped): write `[]` — no code layers to configure rules for yet; user can configure rules later when code exists
   - This field indicates which development layers exist in the project and can be used to determine available rule configuration options.

**Phase 7: Project Brief Generation**

If action for project brief == skip, output "Project brief: skipped (exists)" and proceed to Phase 8 (Report).

Otherwise, generate a project brief to capture the user's overall product vision. This file is referenced by `root.prizm` so every new AI session understands the project goals.

→ Read `.claude/command-assets/prizmkit-init/assets/project-brief-template.md` for the brief format rules and checklist template.

**Brownfield** (existing codebase):
1. Infer project goals from:
   - Generated `root.prizm` (tech stack, module structure, module groups)
   - `README.md` (if exists)
   - Package metadata (`package.json` description, `pyproject.toml`, etc.)
   - Quick scan of key entry points identified in L1 docs
2. Generate a draft in the checklist format defined in the template
3. Present the draft to the user and ask:
   - Is this inference correct?
   - Anything to add, remove, or modify?
4. Apply user edits and write to `.prizmkit/plans/project-brief.md`

**Greenfield** (new/empty project):
1. Use **progressive questioning** (defined in template) to fully understand the user's intent:
   - Round 1: Problem & Vision → Round 2: Scope & Features → Round 3: Technical Constraints → Round 4: Clarification (adaptive)
   - Stop when completion criteria are met: problem, users, core features, boundaries, and technical direction are all clear
   - If answers are vague, probe deeper — don't accept shallow responses
2. Generate brief from answers in checklist format
3. Present to user for confirmation/editing
4. Write to `.prizmkit/plans/project-brief.md`

**After writing the brief**:
- Check if `root.prizm` already contains a `PROJECT_BRIEF:` line
- If exact match `PROJECT_BRIEF: .prizmkit/plans/project-brief.md` exists: skip (already correct)
- If `PROJECT_BRIEF:` exists with a different path: warn user and ask to confirm update or keep old path
- If not present: add `PROJECT_BRIEF: .prizmkit/plans/project-brief.md` at the end of `root.prizm`, after all standard sections
- This ensures every AI session that loads L0 knows to read the project brief

**Phase 8: Report**
Output summary: platform detected, tech stack detected (with detail), modules discovered, L1 docs generated, project brief status, next recommended steps.

Tech stack report format (only show detected fields, adapt to project type):
```
Tech stack detected:
  Language:     TypeScript
  Runtime:      Node.js 20
  Frontend:     React + Tailwind CSS
  Backend:      Express.js
  Database:     PostgreSQL (Prisma)
  Testing:      Vitest
  Bundler:      Vite
  Project type: fullstack
```

Adapt fields to match project type — only show detected fields.

Saved to: `.prizmkit/config.json` → `tech_stack` field

Next step: "Use `/prizmkit-plan` to start your first feature"

GREENFIELD WORKFLOW (new project):
- Skip Phase 4 code scanning (no code to scan — Phase 4.5 Layer Detection and Phase 4.7 Rules Quick Entry are skipped; no layers to detect yet):
  - Ask the user about their intended tech stack:
  - "What language/framework will you use?" (e.g. React + Node.js, Python + FastAPI, etc.)
  - Record answers in `config.json` `tech_stack` with `"_auto_detected": false` (user-provided, not auto-detected)
  - If user is unsure, skip tech_stack — it can be populated later on re-init after code exists
- Phase 4.6: Run Infrastructure Quick Scan — in greenfield mode, no auto-detection is possible, so only ask the 2 brief questions (database need and deployment target). If user is unsure, skip — these can be configured later.
- Phase 5: Create minimal `.prizmkit/prizm-docs/` with just `root.prizm` skeleton (populate TECH_STACK from user answers if provided)
- Phase 7: Generate project brief (greenfield flow — ask user about project goals, see Phase 7 above)
- Phases 6, 8: Same as brownfield (Phase 8 Report recommends `/prizmkit-plan` for first feature)

## Example

**Brownfield init on a fullstack Node.js project:**
```
$ /prizmkit-init

Platform detected: Claude Code
Init Status Check:
  [missing] .prizmkit/prizm-docs/
  [missing] .prizmkit/config.json
  [missing] .prizmkit/plans/project-brief.md
→ All missing, generating everything.

Mode: Brownfield (154 source files found)

Tech stack detected:
  Language:     TypeScript
  Runtime:      Node.js 20
  Frontend:     React + Tailwind CSS
  Backend:      Express.js
  Database:     PostgreSQL (Prisma)
  Testing:      Vitest
  Bundler:      Vite
  Project type: fullstack

Layer Detection:
  Detected layers: frontend, backend, database (from dependency + directory signals)
  → Stored for config.json

Infrastructure Quick Scan:
  Database: PostgreSQL (Prisma) — detected from dependencies
  Deployment: Vercel — detected from vercel.json
  → Written to the detected platform instruction file `### Infrastructure`

Rules Quick Entry:
  Matched layers: frontend (React), backend (Express.js), database (Prisma) → keeping default rules

Modules discovered:
  src/routes/     → .prizmkit/prizm-docs/routes.prizm (12 files)
  src/models/     → .prizmkit/prizm-docs/models.prizm (8 files)
  src/services/   → .prizmkit/prizm-docs/services.prizm (15 files)
  src/middleware/  → .prizmkit/prizm-docs/middleware.prizm (5 files)

Project brief: inferred from codebase → confirmed by user
  → .prizmkit/plans/project-brief.md

Generated: root.prizm + 4 L1 docs
Saved: .prizmkit/config.json (tech_stack + detected_layers recorded)

Next: Use /prizmkit-plan to start your first feature
```

UPDATE SUPPLEMENT (runs after tech stack merge in Update mode):
→ Read `.claude/command-assets/prizmkit-init/references/update-supplement.md` for the 5-step gap-fill procedure.

**Re-init after PrizmKit upgrade (existing config preserved):**
```
$ /prizmkit-init

Init Status Check:
  [exists]  .prizmkit/prizm-docs/          (12 files)
  [exists]  .prizmkit/config.json
  [missing] .prizmkit/plans/project-brief.md

Missing items will be generated.
For existing items: [A] Regenerate all  [B] Only generate missing (default)  [C] Pick per item
> B (Only generate missing)

Tech stack changes detected:
  + bundler: Vite (newly detected)
  ~ testing: Jest → Vitest (updated)
  = language: TypeScript (unchanged)
  = frontend: React (unchanged)

Documentation gap-fill:
  + app/share/[token].prizm (L2) — created (3 source files, meaningful logic)
  = routes.prizm (L1) — up to date
  ~ models.prizm (L1) — FILES count updated (8 → 10)

Project brief: inferred from codebase → confirmed by user
  → .prizmkit/plans/project-brief.md (generated)

Merged into .prizmkit/config.json (2 fields updated, user overrides preserved)
```
