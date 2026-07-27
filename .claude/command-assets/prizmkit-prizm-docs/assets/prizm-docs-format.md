PRIZM_SPEC_VERSION: 4
PURPOSE: AI-only documentation framework for vibe coding projects
AUDIENCE: AI agents (not humans)
FORMAT: KEY: value pairs, ALL CAPS section headers, arrow pointers
FILE_EXT: .prizm
DOC_ROOT: .prizmkit/prizm-docs/
LICENSE: MIT

---

## Table of Contents

1. Overview
2. Architecture
3. Document Format Specification
4. Format Conventions
5. Path Mapping Rules
6. Progressive Loading Protocol
7. Auto-Update Protocol
8. Anti-Patterns
9. Initialization Procedure
10. Skill Definition
11. Hook Configuration
12. Language-Specific Initialization Hints

---

# SECTION 1: OVERVIEW

WHAT: Prizm is a self-maintaining documentation system where AI reads, generates, updates, and loads project context progressively.
WHY: Reduce AI hallucinations, minimize token waste, ensure AI has accurate project knowledge at all times.
HOW: Three-level progressive loading (L0 -> L1 -> L2) with auto-update before every commit.

CORE_PRINCIPLES:
- Token efficiency over human readability
- Progressive disclosure (load only what is needed)
- Self-updating (docs stay fresh via commit-time hooks)
- Universal (language and framework agnostic)
- Durable project knowledge over auxiliary history (decisions, traps, interfaces, dependencies)
- Memory hygiene over traceability noise (no CHANGELOG sections/files, UPDATED/date metadata, feature/bug/refactor/task/session/run/pipeline/workflow IDs, branch names, absolute worktree paths, or `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths)
- Size-enforced (hard limits per level prevent bloat)
- Lazy L2 generation (detail docs created on first modification or deep read, not during init)
- Rules hierarchy (root.prizm RULES are authoritative, module RULES supplement only)

---

# SECTION 2: ARCHITECTURE

## 2.1 Progressive Loading Levels

LEVELS:
- L0: Root index. ALWAYS loaded at session start. Max 4KB.
  FILE: .prizmkit/prizm-docs/root.prizm
  CONTAINS: project meta, module index with pointers, build commands, tech stack, top rules

- L1: Structural index. Loaded ON DEMAND when AI works in a module area. Max 4KB each.
  FILE: .prizmkit/prizm-docs/<mirrored-path>.prizm (mirrors source directory structure)
  CONTAINS: module responsibility, subdirs with pointers, key files, dependency graph, critical rules summary (1-3 only)
  DOES NOT CONTAIN: interface signatures, data flow, TRAPS, DECISIONS (those belong in L2)

- L2: Behavioral detail. Loaded when AI modifies files in that module OR needs deep understanding. Max 5KB each.
  FILE: .prizmkit/prizm-docs/<mirrored-path>/<submodule>.prizm
  CONTAINS: interface signatures, data flow, full rules, TRAPS, DECISIONS, domain-specific sections, rejected approaches

## 2.2 Directory Layout

STRUCTURE: Mirrors source tree under .prizmkit/prizm-docs/

EXAMPLE (Go project):
  .prizmkit/prizm-docs/
    root.prizm                            # L0
    internal/
      logic.prizm                         # L1 for internal/logic/
      model.prizm                         # L1 for internal/model/
      repo.prizm                          # L1 for internal/repo/
      service.prizm                       # L1 for internal/service/
      common.prizm                        # L1 for internal/common/
      logic/
        statemachine.prizm                # L2 for internal/logic/statemachine/
        session.prizm                     # L2 for internal/logic/session/
        ivr.prizm                         # L2 for internal/logic/ivr/
      repo/
        rpc.prizm                         # L2 for internal/repo/rpc/
        store.prizm                       # L2 for internal/repo/store/
      service/
        http.prizm                        # L2 for internal/service/http/
        sso.prizm                         # L2 for internal/service/sso/

EXAMPLE (JS/TS project):
  .prizmkit/prizm-docs/
    root.prizm                            # L0
    src/
      components.prizm                    # L1 for src/components/
      hooks.prizm                         # L1 for src/hooks/
      services.prizm                      # L1 for src/services/
      components/
        auth.prizm                        # L2 for src/components/auth/
        dashboard.prizm                   # L2 for src/components/dashboard/

EXAMPLE (Python project):
  .prizmkit/prizm-docs/
    root.prizm                            # L0
    app/
      models.prizm                        # L1 for app/models/
      views.prizm                         # L1 for app/views/
      services.prizm                      # L1 for app/services/
      services/
        payment.prizm                     # L2 for app/services/payment/
    cross-cutting/                          # Optional: cross-module concern details
      auth.prizm                          # L2-style doc for cross-cutting auth concern

## 2.3 Git Configuration

COMMIT: .prizmkit/prizm-docs/ MUST be committed to git alongside source code
RATIONALE: .prizmkit/prizm-docs/ is shared project knowledge that all team members (human and AI) benefit from.

---

# SECTION 3: DOCUMENT FORMAT SPECIFICATION

## 3.1 L0: root.prizm

TEMPLATE:

  PRIZM_VERSION: 4
  PROJECT: <name>
  LANG: <primary language>
  FRAMEWORK: <primary framework or "none">
  BUILD: <build command>
  TEST: <test command>
  ENTRY: <entry point file(s)>

  ARCHITECTURE: <layer1> -> <layer2> -> <layer3> -> ...
  LAYERS:
  - <layer-name>: <one-line description>

  TECH_STACK:
  - runtime: <list>
  - deps: <key external dependencies>
  - infra: <infrastructure: databases, queues, caches, etc.>

  MODULE_INDEX:
  - <source-path>: <file-count> files. <one-line description>. -> .prizmkit/prizm-docs/<mirrored-path>.prizm
  (Multi-level entries allowed for efficient navigation. No hard depth limit — constrained by L0 4KB.
   If navigating from L0 to a target module requires 3+ hops, add intermediate entries here.)

  ENTRY_POINTS:
  - <name>: <file-path> (<protocol/port if applicable>)

  RULES:
  - MUST: <project-wide mandatory rule>
  - NEVER: <project-wide prohibition>
  - PREFER: <project-wide preference>

  PATTERNS:
  - <pattern-name>: <one-line description of code pattern used across project>

  CROSS_CUTTING:
  - <concern-name>: <one-line description>. Modules: <affected-module-list>.
  (Optional: -> .prizmkit/prizm-docs/cross-cutting/<name>.prizm for detailed cross-cutting doc.
   Only record concerns spanning 2+ modules. Single-module patterns go in that module's RULES.)

  DECISIONS:
  - <project-level architectural decision and rationale>
  - REJECTED: <rejected approach + why>

CONSTRAINTS:
- Max 4KB (roughly 100 lines)
- Every line must be a KEY: value pair or a list item
- MODULE_INDEX must have arrow pointer (->) for every entry
- MODULE_INDEX may list entries at any depth needed for efficient navigation (no hard depth limit)
- RULES limited to 5-10 most critical conventions
- No prose paragraphs
- root.prizm RULES are AUTHORITATIVE: they override any conflicting L1/L2 RULES

### MODULE_GROUPS (alternative to MODULE_INDEX for projects with 15+ modules)

When MODULE_INDEX would exceed 15 entries, replace it with MODULE_GROUPS to stay within the 4KB limit. Group modules by functional domain:

  MODULE_GROUPS:
    <domain-name>:
      - <module>: <file-count> files. <one-line description>. -> .prizmkit/prizm-docs/<module>.prizm
      - <module>: <file-count> files. <one-line description>. -> .prizmkit/prizm-docs/<module>.prizm
    <domain-name>:
      - <module>: <file-count> files. <one-line description>. -> .prizmkit/prizm-docs/<module>.prizm

CONSTRAINTS for MODULE_GROUPS:
- Exactly ONE of MODULE_INDEX or MODULE_GROUPS must be present in root.prizm (not both)
- Domain names: lowercase, descriptive (e.g., api, frontend, infrastructure, shared, data)
- 3-8 domains is the ideal range
- Each module appears in exactly one domain
- Every entry must have an arrow pointer (->), same as MODULE_INDEX
- AI should load the relevant domain's modules when working on a task, not all domains

### Optional Keyword Tags (applies to both MODULE_INDEX and MODULE_GROUPS)

Entries may include keyword tags for AI intent matching:

  MODULE_INDEX:
    - auth [login, session, jwt, oauth]: 12 files. Authentication and authorization. -> .prizmkit/prizm-docs/auth.prizm
    - payments [stripe, billing, subscription]: 8 files. Payment processing. -> .prizmkit/prizm-docs/payments.prizm
    - users: 6 files. User management. -> .prizmkit/prizm-docs/users.prizm

Tags are optional, enclosed in square brackets after the module name. They contain lowercase keywords that describe the module's domain concepts. AI matches user requirement descriptions against tags to identify relevant modules before loading L1. Tags are auto-generated during Init from module source content (function names, imports, domain terms) and refined during Rebuild.

## 3.2 L1: module.prizm (Structural Index)

TEMPLATE:

  MODULE: <source-path>
  FILES: <count>
  RESPONSIBILITY: <one-line>

  SUBDIRS:
  - <name>/: <one-line description>. -> .prizmkit/prizm-docs/<child-path>.prizm

  KEY_FILES:
  - <filename>: <role/purpose>

  DEPENDENCIES:
  - imports: <internal modules this module uses>
  - imported-by: <internal modules that depend on this>
  - external: <third-party packages used>

  RULES:
  - MUST: <1-3 most critical module-specific rules only — full list in L2>

CONSTRAINTS:
- Max 4KB
- L1 is a STRUCTURAL INDEX — it answers "what exists here" not "how it works"
- DOES NOT CONTAIN: INTERFACES, DATA_FLOW, TRAPS, DECISIONS (those belong in L2)
- RULES: summary only, max 3 entries of the most critical constraints. Full rules in L2.
- DEPENDENCIES has 3 sub-categories (imports, imported-by, external)
- SUBDIRS entries must have arrow pointer (->) if child doc exists
- KEY_FILES lists only the most important files (max 10-15)
- RULES may only SUPPLEMENT root.prizm RULES with module-specific exceptions, never contradict them

TRAPS_FORMAT_REFERENCE (spec-only — do NOT include this block in generated .prizm files):
- Severity levels: CRITICAL = data loss/security/financial/crash, HIGH = functional failure/silent error, LOW = naming/minor quality
- Temporary prefix: [REVIEW] may precede severity (e.g., `[REVIEW][HIGH]`) — signals the TRAP needs re-validation. Consumed by the next retrospective: verify and either remove [REVIEW] or delete the TRAP.
- REF: first 7 chars of the commit where the trap was discovered (optional, for traceability)
- STALE_IF: glob pattern — when matched files are deleted or heavily rewritten, this trap needs re-validation (optional)
- Minimal valid format: `- [SEVERITY] <description> | FIX: <approach>`
- Full format: `- [SEVERITY] <description> | FIX: <approach> | REF: <hash> | STALE_IF: <glob>`

## 3.3 L2: detail.prizm (Behavioral Detail)

TEMPLATE:

  MODULE: <source-path>
  FILES: <comma-separated list of all files>
  RESPONSIBILITY: <one-line>

  INTERFACES:
  - <function/method signature>: <what it does>

  DATA_FLOW:
  - <numbered step describing how data moves through this module>

  <DOMAIN-SPECIFIC SECTIONS>
  (AI generates these based on what the module does. Examples below.)

  KEY_FILES:
  - <filename>: <detailed description, line count, complexity notes>

  DEPENDENCIES:
  - uses: <external lib>: <why/how used>
  - imports: <internal module>: <which interfaces consumed>

  RULES:
  - MUST: <module-specific mandatory rule>
  - NEVER: <module-specific prohibition>
  - PREFER: <module-specific preference>
  (Full rules list — L1 only has a 1-3 item summary of these)

  TRAPS:
  - [CRITICAL|HIGH|LOW] <gotcha: something that looks correct but is wrong or dangerous> | FIX: <correct approach>
  - [CRITICAL|HIGH|LOW] <non-obvious coupling, race condition, or side effect> | FIX: <approach>

  DECISIONS:
  - <decision made within this module> — <rationale>
  - REJECTED: <approach that was tried/considered and abandoned + why>

DOMAIN_SPECIFIC_SECTION_EXAMPLES:
- For state machines: STATES, TRIGGERS, TRANSITIONS
- For API handlers: ENDPOINTS, REQUEST_FORMAT, RESPONSE_FORMAT, ERROR_CODES
- For data stores: TABLES, QUERIES, INDEXES, CACHE_KEYS
- For config modules: CONFIG_KEYS, ENV_VARS, DEFAULTS
- For UI components: PROPS, EVENTS, SLOTS, STYLES

CONSTRAINTS:
- Max 5KB
- L2 is the BEHAVIORAL DETAIL — it answers "how it works, what can go wrong, what was decided"
- INTERFACES: lists only PUBLIC/EXPORTED signatures (moved here from L1 in V4)
- DATA_FLOW: describes how data moves through the module (moved here from L1 in V4)
- RULES: full module-specific rules list (L1 only has a 1-3 item summary)
- DOMAIN-SPECIFIC SECTIONS are flexible, not prescribed
- DECISIONS records durable rationale only; update or remove stale entries in place when code reality changes
- TRAPS section is CRITICAL for preventing AI from making known mistakes
- TRAPS entries MUST have severity prefix ([CRITICAL], [HIGH], or [LOW]). [REVIEW] may precede severity as a temporary staleness marker.
- TRAPS optional fields: append `| REF: <7-char-hash>` for traceability, `| STALE_IF: <glob>` for auto-expiry detection
- TRAPS severity: CRITICAL = data loss/security/financial/crash, HIGH = functional failure/silent error, LOW = naming/minor quality (see TRAPS_FORMAT_REFERENCE in Section 3.2)
- REJECTED entries prevent AI from re-proposing failed approaches
- FILES lists all files, not just key ones
- RULES may only SUPPLEMENT root.prizm RULES with module-specific exceptions, never contradict them

## 3.4 Metadata Policy

TEMPORAL_INFO: Git history is the authoritative source for change timing and edit history.
AUXILIARY_FIELDS: Do not generate CHANGELOG or UPDATED fields in .prizm files.
WORKFLOW_METADATA: Do not write feature/bug/refactor/task/session/run/pipeline/workflow IDs, branch names, absolute worktree paths, or `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths into .prizm files.
RATIONALE: Keep project memory focused on durable architecture, interfaces, dependencies, traps, rules, and decisions.

---

# SECTION 4: FORMAT CONVENTIONS

HEADERS: ALL CAPS followed by colon (MODULE:, FILES:, RESPONSIBILITY:, etc.)
VALUES: Single space after colon, value on same line (KEY: value)
LISTS: Dash-space prefix for items within a section (- item)
POINTERS: Arrow notation (->) to reference other .prizm files
NESTING: Indent 2 spaces for sub-keys within a section
COMMENTS: None. Every line carries information. No comments in .prizm files.
TIMESTAMPS: No date/time fields in .prizm files. Git is the authoritative source for temporal information. Use `git log` or `git blame` on .prizm files when needed.

---

# SECTION 5: PATH MAPPING RULES

## 5.1 Mapping Algorithm

RULE: Mirror the source directory tree under .prizmkit/prizm-docs/
RULE: L1 file for directory D = .prizmkit/prizm-docs/<D>.prizm
RULE: L2 file for subdirectory D/S = .prizmkit/prizm-docs/<D>/<S>.prizm
RULE: Root index = .prizmkit/prizm-docs/root.prizm (always)

## 5.2 Examples

SOURCE_PATH                   L1_PRIZM_FILE                            L2_PRIZM_FILES
internal/logic/               .prizmkit/prizm-docs/internal/logic.prizm         .prizmkit/prizm-docs/internal/logic/*.prizm
internal/logic/session/       (described in L1 logic.prizm SUBDIRS)    .prizmkit/prizm-docs/internal/logic/session.prizm
internal/repo/store/          (described in L1 repo.prizm SUBDIRS)     .prizmkit/prizm-docs/internal/repo/store.prizm
src/components/               .prizmkit/prizm-docs/src/components.prizm         .prizmkit/prizm-docs/src/components/*.prizm
src/components/auth/          (described in L1 components.prizm)       .prizmkit/prizm-docs/src/components/auth.prizm
app/services/                 .prizmkit/prizm-docs/app/services.prizm           .prizmkit/prizm-docs/app/services/*.prizm

## 5.3 Discovery Rule

FOR any source file at path P:
  1. Walk up directory tree to find the first ancestor D where .prizmkit/prizm-docs/<D>.prizm exists
  2. That file is the L1 doc for this source file
  3. If P is inside a subdirectory S of D, check if .prizmkit/prizm-docs/<D>/<S>.prizm exists for L2
  4. If no .prizm doc found, the module is undocumented (may need prizmkit-prizm-docs Update operation)

---

# SECTION 6: PROGRESSIVE LOADING PROTOCOL

## 6.1 When to Load

ON_SESSION_START:
  ALWAYS: Read .prizmkit/prizm-docs/root.prizm (L0) if it exists
  PURPOSE: Get the project map, understand architecture, know where to look

ON_TASK_RECEIVED:
  IF task references specific file or directory:
    LOAD: L1 for the containing module (structural index: files, deps, key rules)
  IF task is broad (e.g., "refactor auth", "improve performance"):
    LOAD: L1 for all matching modules from MODULE_INDEX
  IF task is exploratory (e.g., "explain the codebase", "how does X work"):
    LOAD: L0 only, then navigate via pointers as needed
  IF task is cross-cutting (e.g., "add logging everywhere"):
    LOAD: L1 for affected modules, check DEPENDENCIES.imported-by and CROSS_CUTTING in root.prizm

ON_FILE_MODIFICATION:
  BEFORE editing any source file:
    TARGETED LOAD from L2 (NEVER read the entire L2 file — use grep to extract only needed sections):
    1. Use Grep tool to search for "^TRAPS:" in the L2 doc, read that section (prevent known mistakes)
    2. Use Grep tool to search for "^DECISIONS:" and "^REJECTED:", read those sections (understand prior choices)
    3. Use Grep tool to search for "^INTERFACES:" if you need to understand the public API contract
    Only load additional L2 sections if the task specifically requires them.
    IF L2 does not exist: GENERATE L2 from source code analysis, then extract needed sections

ON_DEEP_READ:
  WHEN AI needs deep understanding of a module WITHOUT modifying it:
    TARGETED LOAD from L2 using grep (same approach as ON_FILE_MODIFICATION)
    IF L2 does not exist: GENERATE L2 from source code analysis, then extract needed sections
    USE_CASES: code review, architecture analysis, dependency tracing, explaining complex logic

## 6.2 Loading Rules

NEVER: Load all L1 and L2 docs at session start (defeats progressive loading)
NEVER: Read entire L2 files — always use grep/search to extract only the sections you need
NEVER: Load L2 for modules not being modified or deeply analyzed (wastes context window)
NEVER: Skip L0 (it is the map for everything else)
PREFER: Load L1 before L2 (understand module context before diving into details)
PREFER: Load minimum docs and minimum sections needed for the task
BUDGET: Typical task should consume 3000-5000 tokens of prizm docs total

## 6.3 L2 Targeted Loading Protocol

L2 docs can be up to 5KB. Loading them in full defeats the purpose of progressive loading.
Use targeted grep to extract only the sections relevant to your current task:

COMMAND_PATTERN:
  Grep tool with pattern "^SECTION_NAME:" and context lines (-A flag) to read a specific section.
  Stop reading at the next ALL-CAPS section header.

EXAMPLES:
  - Before editing a file: grep for "^TRAPS:" and "^DECISIONS:" sections
  - Before changing an API: grep for "^INTERFACES:" section
  - Before modifying data handling: grep for "^DATA_FLOW:" section
  - For full module understanding (rare): read the entire L2 (only when task explicitly requires comprehensive analysis)

---

# SECTION 7: AUTO-UPDATE PROTOCOL

## 7.1 Trigger

WHEN: Before every commit (detected automatically via hook, or manually via prizmkit-prizm-docs Update operation)
GOAL: Keep prizm docs synchronized with source code

## 7.2 Update Decision Logic

SUMMARY: Get changed files → map to modules → classify (A/D/M/R) → update docs bottom-up (L2→L1→L0) → skip if no structural impact → enforce size limits → stage.

DETAILED_STEPS: → ${SKILL_DIR}/references/op-update.md

## 7.3 Auxiliary Metadata Policy

NEVER: Add CHANGELOG sections or changelog.prizm during doc sync.
NEVER: Add UPDATED/date/time fields to .prizm files.
NEVER: Add workflow metadata such as feature/bug/refactor/task/session/run/pipeline/workflow IDs, branch names, absolute worktree paths, or `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths.
RATIONALE: Git already provides history; .prizm files should store only durable project memory.

---

# SECTION 8: ANTI-PATTERNS

WHAT_NOT_TO_PUT_IN_PRIZM_DOCS:

NEVER: Prose paragraphs or explanatory text (use KEY: value or bullet lists)
NEVER: Code snippets longer than 1 line (reference file_path:line_number instead)
NEVER: Human-readable formatting (emoji, ASCII art, markdown tables, horizontal rules)
NEVER: Duplicate information across levels (L0 summarizes, L1 indexes structure, L2 details behavior)
NEVER: Implementation details or behavioral detail in L0 or L1 (INTERFACES, DATA_FLOW, TRAPS, DECISIONS belong in L2 only)
NEVER: Stale information (update or delete, never leave outdated entries)
NEVER: Full file contents or large code blocks (summarize purpose and interfaces)
NEVER: TODO items or future plans (those belong in issue trackers)
NEVER: Session-specific context or conversation history (docs are session-independent)
NEVER: Workflow metadata such as feature/bug/refactor/task/session/run/pipeline/workflow IDs, branch names, absolute worktree paths, or `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths
NEVER: CHANGELOG sections, changelog.prizm, or update-history sections
NEVER: Flowcharts, diagrams, mermaid blocks, or ASCII art (wastes tokens, AI cannot parse visually)
NEVER: Markdown headers (## / ###) inside .prizm files (use ALL CAPS KEY: format instead)
NEVER: Rewrite entire .prizm files on update (modify only affected sections)
NEVER: TRAPS entries without severity prefix ([CRITICAL], [HIGH], or [LOW])

---

# SECTION 9: INITIALIZATION PROCEDURE

## 9.1 Algorithm

OPERATION: Init (invoked via prizmkit-prizm-docs skill)
PRECONDITION: No .prizmkit/prizm-docs/ directory exists (or user confirms overwrite)

INPUT: Project root directory
OUTPUT: .prizmkit/prizm-docs/ with root.prizm and L1 docs for discovered modules

SUMMARY: Detect project type → discover modules (MODULE_DISCOVERY_CRITERIA) → create mirrored directory structure → generate root.prizm (L0) → generate L1 docs → skip L2 (lazy) → configure hook → validate → report.

DETAILED_STEPS: → ${SKILL_DIR}/references/op-init.md

KEY_CONCEPTS:

MODULE_DISCOVERY_CRITERIA — a directory qualifies as a module if ANY of the following is true:
- Contains source files that collectively form a logical unit (shared responsibility)
- Contains entry points, configuration files, or interface definitions
- Contains sub-directories that themselves qualify as modules
- Is referenced by multiple other modules as a dependency

A directory does NOT qualify if ALL of the following are true:
- Contains only generated/derived files (build output, compiled assets)
- Contains only vendored/third-party code
- Is in the EXCLUDE list

HIERARCHY RULE: if directory X lives inside top-level module M, X is a sub-module of M — NOT a separate top-level module.

EXCLUDE: .git/, node_modules/, vendor/, build/, dist/, __pycache__/, target/, bin/, .claude/, .codebuddy/, .prizmkit/, .prizmkit/prizm-docs/, dev-pipeline/

## 9.2 Post-Init Behavior

After initialization, L2 docs are created incrementally:

ON_MODIFY trigger:
- First time AI modifies a file in sub-module S within module M:
  IF .prizmkit/prizm-docs/<M>/<S>.prizm does not exist:
    AI reads the source files in S, generates L2 doc, then proceeds with modification
- This ensures L2 docs have real depth, written when AI has actual context

ON_DEEP_READ trigger:
- When AI needs to deeply understand a module but not modify it (e.g., code review, architecture analysis, dependency tracing, explaining complex logic):
  IF .prizmkit/prizm-docs/<M>/<S>.prizm does not exist:
    AI reads the source files in S, generates L2 doc for future reference
- This ensures L2 docs are available for read-heavy analysis tasks, not just modifications
- RATIONALE: Some tasks require deep understanding without editing (reviewing PRs, answering architecture questions, tracing bugs). Generating L2 during these tasks captures valuable context.

---

# SECTION 10: SKILL DEFINITION

## 10.1 SKILL.md Reference

The Prizm skill is defined at: ${SKILL_DIR}/SKILL.md

OPERATIONS (all invoked via the prizmkit-prizm-docs skill):

  Init       - Bootstrap .prizmkit/prizm-docs/ for a new project. → ${SKILL_DIR}/references/op-init.md
  Update     - Sync docs with code changes. → ${SKILL_DIR}/references/op-update.md
  Status     - Check freshness of all docs. → ${SKILL_DIR}/references/op-status.md
  Rebuild    - Regenerate docs for a specific module. → ${SKILL_DIR}/references/op-rebuild.md
  Validate   - Check format compliance and consistency. → ${SKILL_DIR}/references/op-validate.md
  Migrate    - Convert existing docs to .prizmkit/prizm-docs/ format. Steps inline in SKILL.md.

---

# SECTION 11: HOOK CONFIGURATION

## 11.1 Mechanism

HOOK_TYPE: command (shell echo, fast and reliable)
EVENT: UserPromptSubmit
BEHAVIOR: When matcher detects commit-related keywords, echoes doc update reminder as stdout
INJECTION: stdout content is injected into AI's context as a system-reminder
NOTE: Previously used type: prompt (LLM-evaluated), but switched to type: command for reliability — prompt type is prone to timeout and JSON format errors

## 11.2 Configuration Template

Place in: .codebuddy/settings.json (project-level)

JSON:
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "(?i)\\b(commit|push|finish|ship|merge|pull request|pr)\\b|提交|推送|收尾|完成任务|合并|发版|发布",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'PRIZMKIT_MAINTENANCE_REQUIRED: Before committing, you MUST run /prizmkit-retrospective. It maintains .prizmkit/prizm-docs/ architecture index — structural sync (KEY_FILES, INTERFACES, DEPENDENCIES) + TRAPS/RULES/DECISIONS injection. After retrospective completes, proceed with /prizmkit-committer for the actual git commit.'"
          }
        ]
      }
    ]
  }
}

## 11.3 How It Works

FLOW:
1. User types prompt (e.g., "commit these changes" or "push to main")
2. UserPromptSubmit hook fires, matcher regex checks for commit-related keywords
3. IF matcher matches: command hook runs echo, stdout is injected as system-reminder
   - AI sees the update instructions and executes them before committing
4. IF matcher does not match: hook does not fire, AI proceeds normally

KEYWORDS_DETECTED: commit, push, finish, done, ship, merge, PR, pull request, /commit, save changes

## 11.4 Adapting for Other AI Tools

The hook configuration above is specific to CodeBuddy Code.
For other AI coding assistants:
- Cursor: Use .cursorrules file to add the auto-update protocol as a rule
- Aider: Use .aider.conf.yml conventions section
- Continue: Use .continue/config.json customInstructions
- Generic: Add the auto-update protocol text to whatever system prompt or rules file the tool supports

The core requirement is: before any commit operation, AI must update affected .prizmkit/prizm-docs/ files.

---

# SECTION 12: LANGUAGE-SPECIFIC INITIALIZATION HINTS

## 12.1 Module Boundary Detection

LANGUAGE          MODULE_BOUNDARY                         ENTRY_POINT_DETECTION
Go                Directories with .go files              main.go, cmd/**/main.go
JavaScript/TS     Directories with index.ts/js/tsx/jsx    package.json main/bin
Python            Directories with __init__.py            __main__.py, manage.py, app.py, wsgi.py
Rust              Directories with mod.rs                 main.rs, lib.rs
Java              src/main/java/* package directories     *Application.java, Main.java
C#                Directories with *.cs files             Program.cs, Startup.cs

## 12.2 Interface Detection

LANGUAGE          EXPORTED_INTERFACE_PATTERN
Go                Capitalized function/type names (func Foo, type Bar)
JavaScript/TS     export/export default declarations
Python            Functions/classes without underscore prefix
Rust              pub fn, pub struct, pub enum, pub trait
Java              public class, public interface, public method
C#                public class, public interface, public method

## 12.3 Dependency Detection

LANGUAGE          IMPORT_PATTERN
Go                import "path/to/package"
JavaScript/TS     import ... from "...", require("...")
Python            import ..., from ... import ...
Rust              use crate::..., use super::..., extern crate
Java              import package.Class
C#                using Namespace
