---
description: "One-stop entry point for feature development. Brainstorms requirements with the user until fully clarified, then orchestrates feature-planner → feature-pipeline-launcher → execution. Handles multi-feature batch development from a single request. Use this skill whenever the user wants to build an app, develop multiple features at once, or go from idea to running code in one step. Trigger on: 'build an app', 'develop features', 'implement all features', 'one-stop development', 'batch implement', 'build a new application', 'build a system', 'one-click complete', 'batch implement'."
---

# Feature Workflow

One-stop entry point for feature development. Covers the complete journey from a vague idea to running code: deep requirement brainstorming → structured planning → autonomous pipeline execution.

## When to Use

User says:
- "Build a new application", "Build XXX system", "Create a project"
- "One-click complete these features", "Batch implement these requirements"
- "Build a task management App from scratch"
- "Help me implement user login, registration, and avatar upload features"
- After receiving a batch of related feature requests

**Do NOT use this skill when:**
- User only wants to plan features (use `feature-planner` directly)
- User only wants to launch pipeline for existing .prizmkit/plans/feature-list.json (use `feature-pipeline-launcher`)
- User wants to fix bugs (use `bug-planner` + `bugfix-pipeline-launcher`)
- User wants to refactor code (use `refactor-workflow`)

---

## Overview

```
feature-workflow <idea / requirements>
   │
   ├── Phase 1: Brainstorm → collect materials → parallel deep read → discuss requirements
   │
   ├── Phase 2: Plan → feature-planner → .prizmkit/plans/feature-list.json
   │
   ├── Phase 3: Launch → feature-pipeline-launcher → pipeline execution
   │
   └── Phase 4: Monitor → track progress → report results
```

### What This Skill Does

| Phase | Action | Result |
|-------|--------|--------|
| 1 | **Brainstorm** — collect reference materials, parallel deep read code & docs, discuss requirements grounded in real context | Fully clarified requirements document |
| 2 | Call `feature-planner` with clarified requirements | `.prizmkit/plans/feature-list.json` with N features |
| 3 | Call `feature-pipeline-launcher` | Pipeline started (execution mode chosen by user via launcher) |
| 4 | Monitor progress | Status updates, completion report |

### Why This Skill Exists

Without this skill, users must:
1. Figure out all requirements themselves
2. Invoke `feature-planner` → wait for .prizmkit/plans/feature-list.json
3. Invoke `feature-pipeline-launcher` → wait for pipeline start
4. Manually check progress

With this skill, users can:
1. Say "Build a task management App" with a rough idea
2. The skill brainstorms to fill in all gaps
3. All planning + execution happens automatically

### Branch Management

The dev-pipeline handles branch management per-feature automatically:
- Each feature is implemented on its own branch by the pipeline
- Branches are created, committed, and managed by the pipeline session
- This workflow does NOT create a top-level branch — the pipeline manages granular per-feature branches

---

## Input Modes

**Mode A: From natural language requirements** (default)

Natural language description of the project or features. Can be:
- A project vision: "Build a task management App with user login, task CRUD, and task categories"
- A batch of features: "Implement user registration, login, and password recovery features"
- An incremental request: "Add user avatar upload and nickname modification to the existing system"

Flow: brainstorm → feature-planner → feature-pipeline-launcher → monitor

**Mode B: From existing .prizmkit/plans/feature-list.json**

When user says "run pipeline from existing file" or .prizmkit/plans/feature-list.json already exists:
- Skip brainstorm and `feature-planner` (file already exists)
- Invoke `feature-pipeline-launcher` directly
- Monitor and report progress

**Mode C: Incremental (add to existing project)**

When user says "add features to existing project" or the project already has features:
- Brainstorm new feature requirements with the user
- Invoke `feature-planner` in incremental mode (reads existing .prizmkit/plans/feature-list.json)
- Append new features to existing list
- Invoke `feature-pipeline-launcher`
- Monitor and report progress

---

## Phase 1: Brainstorm — Deep Requirement Clarification

**Goal**: Through interactive Q&A and deep context reading, transform the user's rough idea into fully clarified, implementation-ready requirements. This phase is the foundation for high-quality code generation — vague requirements produce vague code.

**CRITICAL RULE**: The number of questions is **unlimited**. Do NOT rush through this phase. Ask as many rounds as needed until every aspect is clear. The framework strives for perfect code generation, which requires perfect understanding of requirements.

### Step 1.1: Understand the User's Vision

Ask the user to describe what they want to build. Listen for:
- **What** the system/feature does (core functionality)
- **Who** uses it (user roles, personas)
- **Why** it's needed (business value, problem being solved)

### Step 1.2: Collect Reference Materials

**Upfront Material Detection (Hard Rule)**: If the user has already provided materials (file paths, URLs, rules, specifications, code snippets) in the same message that invoked this skill:
1. Acknowledge what was received: "I received the following materials: [list]"
2. Read/fetch all provided materials immediately
3. You MUST still ask: "Are there any additional materials you'd like to provide?"
4. NEVER skip this collection step just because the user already provided some materials

**If the user has NOT provided any materials upfront**, ask the user explicitly what resources they have. Do NOT skip this step — user-provided materials are far more valuable than blind directory scanning.

Ask:
1. **Existing code** — "Is there existing code I should look at? Which files or directories are relevant?"
2. **Design documents** — "Do you have any design docs, wireframes, API specs, or PRDs I should read?"
3. **Knowledge docs** — "Are there related `.prizmkit/prizm-docs/`, README files, or internal wiki pages?"
4. **Reference projects** — "Any reference implementations or similar projects I should look at for inspiration?"

Record everything the user provides — these become inputs for Step 1.3.

### Step 1.3: Parallel Deep Reading

**Goal**: Build comprehensive understanding of the project context before discussing detailed requirements. Spawn multiple agents in parallel to read all relevant materials simultaneously.

**Parallel reading tasks** (launch concurrently):

| Agent | What to read | Purpose |
|-------|-------------|---------|
| Agent A | User-provided code paths — read existing source files | Understand current architecture, patterns, conventions |
| Agent B | User-provided documents — design docs, specs, PRDs | Understand intended requirements and constraints |
| Agent C | `.prizmkit/prizm-docs/` — root.prizm, L1/L2 docs, TRAPS, RULES | Understand existing architecture knowledge and known pitfalls |
| Agent D | Database/schema files + `.prizmkit/config.json` | Understand data model and tech stack preferences |

**Also gather** (can be included in any agent's task):
- Directory structure of the project
- Existing test patterns and conventions
- Dependency relationships between existing modules

**After all agents complete**: Synthesize findings into a coherent understanding before proceeding to discussion.

### Step 1.4: Discuss Requirements

**Now** — with deep knowledge of the actual codebase and documents — discuss the requirements with the user. This discussion is grounded in real context, not abstract questions.

Present what you learned from the parallel reading:
- Current project structure and patterns (with specific references)
- Existing data model and schema conventions
- Known TRAPS and pitfalls from `.prizmkit/prizm-docs/`
- Integration points with existing modules

Then ask targeted questions based on what you read. **Adapt question depth to the feature complexity** — a simple CRUD feature needs fewer questions than a real-time collaboration system.

**Functional Requirements:**
- What are the core user actions/workflows?
- What inputs does the system accept? What outputs does it produce?
- What are the key business rules and validation logic?
- Are there different user roles with different permissions?

**Data Model & Database** (if applicable):
- What entities/data need to be stored?
- What are the relationships between entities?
- Are there existing database tables this feature must integrate with?
- What fields are required vs optional? What data types?
- Any unique constraints, indexes, or special query patterns needed?
- **RULE**: If the project has existing database tables, ALL new table designs must reference and conform to the existing schema style (naming conventions, ID strategy, timestamp patterns, constraint patterns). Ask the user to confirm the data model before proceeding.

**User Experience:**
- What does the user see and interact with?
- What is the expected flow/sequence of actions?
- How should errors be displayed to the user?
- Are there any specific UI/UX requirements?

**Integration & Architecture:**
- "Based on the existing code, this feature would integrate with [modules]. Does that match your expectations?"
- Any external APIs or services involved?
- What authentication/authorization model applies?
- Any real-time requirements (WebSocket, SSE, polling)?

**Edge Cases & Error Handling:**
- What happens when things go wrong? (network failure, invalid input, concurrent access)
- What are the boundary conditions? (empty states, max limits, permissions denied)
- Any rate limiting, quotas, or resource constraints?

**Non-Functional Requirements:**
- Performance expectations? (response time, throughput)
- Scalability considerations?
- Security requirements? (encryption, audit logs, compliance)

### Step 1.5: Confirm and Supplement

After the discussion:

1. **Summarize** the requirements — present it back to the user
2. **Ask explicitly**: "Is there anything else you'd like to discuss or supplement before we proceed to formal planning?"
3. **Identify gaps** — if any areas are still unclear, list them explicitly and ask follow-up questions
4. **Repeat** until the user confirms: "That covers everything" or "Let's proceed"

**Signs that brainstorming is complete:**
- All functional requirements have concrete acceptance criteria
- Data model entities and relationships are defined
- Edge cases and error handling are addressed
- Integration points are identified
- The user has confirmed the summary is accurate

**Signs that more questions are needed:**
- User's answers contain vague terms ("handle it appropriately", "make it user-friendly", "standard behavior")
- Core business rules are undefined ("depends on the situation")
- Data relationships are unclear ("somehow connected")
- User says "I'm not sure" — help them think through it with concrete options

### Step 1.6: Requirements Summary

Once brainstorming is complete, produce a structured requirements summary:

```markdown
## Requirements Summary

### Project/Feature: [Name]

### Core Functionality
- [Bullet list of what the system does]

### User Roles
- [Role]: [What they can do]

### Data Model Overview
- [Entity]: [Key fields, relationships]

### Key Business Rules
- [Rule 1]
- [Rule 2]

### Integration Points
- [External system/API/module]

### Edge Cases & Error Handling
- [Case]: [Expected behavior]

### Non-Functional Requirements
- [Requirement]

### Reference Materials Reviewed
- [List of code paths, documents, .prizmkit/prizm-docs/ files that were read]

### Confirmed by user: ✓
```

Present this summary to the user and get explicit confirmation before proceeding.

**CHECKPOINT CP-FW-0**: Requirements fully clarified and confirmed by user.

---

### Step 1.7: Complexity Assessment & Approach Selection

After confirming requirements, assess whether this feature needs the full pipeline or can be done directly in the current session.

**Simple feature → Fast Path candidate** (ALL must be true):
- Single module, no cross-module architectural impact
- ≤2 new files to create
- No new external dependencies or infrastructure changes
- Straightforward implementation (CRUD, utility, simple UI component)
- Clear acceptance criteria with existing patterns to follow
- No dependency on other unbuilt features

**User choice required (mandatory)** — Use `AskUserQuestion` to present interactive selectable options:

```
AskUserQuestion:
  question: "This feature appears straightforward. How would you like to proceed?"
  header: "Approach"
  options:
    - label: "Implement now (fast path)"
      description: "Plan and implement directly in this session using /prizmkit-plan + /prizmkit-implement"
    - label: "Add to feature list (pipeline)"
      description: "Generate .prizmkit/plans/feature-list.json via feature-planner, then launch pipeline for autonomous execution"
```

- **Implement now** → Fast Path Workflow:
  1. Invoke `/prizmkit-plan` with the requirements summary → generates `spec.md` + `plan.md`
  2. Invoke `/prizmkit-implement` to execute the plan
  3. After implementation, run `/prizmkit-code-review` for quality check
  4. Commit via `/prizmkit-committer` with `feat(<scope>):` prefix
  5. Run `/prizmkit-retrospective` to sync `.prizmkit/prizm-docs/`
  6. **End workflow** — skip Phase 2/3/4
- **Add to feature list** → Continue to Phase 2 (Plan via pipeline)

**Complex feature → Planning Path** (ANY is true):
- Cross-module impact (>2 modules affected)
- New infrastructure, dependencies, or architectural patterns required
- Multiple interrelated features with dependency ordering
- Data model or API design decisions needed
- Requires integration with external services

**User choice required (mandatory)** — Use `AskUserQuestion` to present interactive selectable options:

```
AskUserQuestion:
  question: "This feature is complex and will benefit from structured planning. How would you like to proceed?"
  header: "Approach"
  options:
    - label: "Plan and implement now"
      description: "Create a plan and implement in this session using /prizmkit-plan + /prizmkit-implement"
    - label: "Add to feature list (pipeline)"
      description: "Generate .prizmkit/plans/feature-list.json via feature-planner, then launch pipeline for autonomous execution"
```

- **Plan and implement now** → Invoke `/prizmkit-plan` with requirements → `/prizmkit-implement` → `/prizmkit-code-review` → `/prizmkit-committer` → `/prizmkit-retrospective`. **End workflow** — skip Phase 2/3/4.
- **Add to feature list** → Continue to Phase 2 (Plan via pipeline)

**NEVER proceed without explicit user confirmation via `AskUserQuestion`. Do NOT render options as plain text — the user must be able to click/select.**

**CHECKPOINT CP-FW-0.5**: Approach selected by user (fast path or pipeline).

---

## Phase 2: Plan

**Goal**: Generate structured .prizmkit/plans/feature-list.json from the clarified requirements.

**STEPS**:

1. **run the `/feature-planner` command** with the full requirements summary from Phase 1:
   - Pass the structured requirements summary as input — NOT the raw user conversation
   - For new projects: standard planning mode
   - For existing projects with `--incremental`: incremental planning mode
   - **Input**: Markdown requirements summary (feature descriptions, goals, constraints)
   - **Output**: `.prizmkit/plans/feature-list.json` (schema: `dev-pipeline-feature-list-v1`) containing `project_name`, `features[]` with id (F-NNN), title, description, priority, dependencies, acceptance_criteria, status

2. **Interactive planning** (if feature-planner requires clarification):
   - Because Phase 1 was thorough, feature-planner should need minimal clarification
   - If questions arise, answer from the Phase 1 context or pass through to user

3. **Validate output**:
   - Confirm `.prizmkit/plans/feature-list.json` exists
   - Show summary: total features, complexity distribution, dependencies

**CHECKPOINT CP-FW-1**: `.prizmkit/plans/feature-list.json` generated and validated.

**If user says `--from <file>`**: Skip Phase 1 and Phase 2 entirely.

---

## Phase 3: Launch

**Goal**: Start the development pipeline.

**STEPS**:

1. **Show feature summary** before launching:
   ```
   Ready to launch pipeline with N features:
     F-001: User authentication (high complexity)
     F-002: Task CRUD (medium complexity)
     F-003: Task categories (low complexity)

   Proceed? (Y/n)
   ```

2. **run the `/feature-pipeline-launcher` command**:
   - **Input**: Path to validated `.prizmkit/plans/feature-list.json`
   - The launcher handles all prerequisites checks
   - The launcher presents execution mode choices to the user (foreground/background/manual)
   - The launcher asks whether to enable Critic Agent (adversarial review) — passes `--critic` flag if chosen
   - Do NOT duplicate execution mode or critic selection here — let the launcher handle it
   - **Output**: PID/status, log file path, execution mode selected

3. **Verify launch success**:
   - Confirm pipeline is running
   - Record PID and log path for Phase 4

**CHECKPOINT CP-FW-2**: Pipeline launched successfully.

---

## Phase 4: Monitor

**Goal**: Track pipeline progress and report to user.

**STEPS**:

1. **Initial status check**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-feature-daemon.ps1 status
   ```

2. **Offer monitoring options**:
   - "I'll check progress periodically. Say 'status' anytime for an update."
   - "Say 'logs' to see recent activity."
   - "Say 'stop' to pause the pipeline."

3. **Periodic progress reports** (when user asks):
   ```powershell
   function Invoke-PrizmPython {
     param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
     $python = Get-Command python -ErrorAction SilentlyContinue
     if ($python) {
       & $python.Source -c 'import sys; raise SystemExit(0 if sys.version_info[0] == 3 else 1)' *> $null
       if ($LASTEXITCODE -eq 0) {
         & $python.Source @Arguments
         return
       }
     }
     $py = Get-Command py -ErrorAction SilentlyContinue
     if ($py) {
       & $py.Source -3 -c 'import sys; raise SystemExit(0 if sys.version_info[0] == 3 else 1)' *> $null
       if ($LASTEXITCODE -eq 0) {
         & $py.Source -3 @Arguments
         return
       }
     }
     throw "Python 3 is required. Install Python and ensure python or py is in PATH."
   }
   Invoke-PrizmPython .prizmkit/dev-pipeline/scripts/update-feature-status.py `
     --feature-list .prizmkit/plans/feature-list.json `
     --state-dir .prizmkit/state/features `
     --action status
   ```

4. **Completion report** (when pipeline finishes all features):
   ```
   Pipeline completed: 3/3 features

   Summary:
   - F-001: User authentication → COMMITTED (feat: user auth)
   - F-002: Task CRUD → COMMITTED (feat: task crud)
   - F-003: Task categories → COMMITTED (feat: categories)

   Next steps:
   - Review changes: git log --oneline -5
   - Run tests: npm test
   - Push when ready: git push
   ```

**CHECKPOINT CP-FW-3**: All features completed or user stopped pipeline.

---

## Resume — Interruption Recovery

The workflow supports resuming by detecting existing state:

| State Found | Resume From |
|-------------|------------|
| No `.prizmkit/plans/feature-list.json` | Phase 1: Brainstorm |
| `.prizmkit/plans/feature-list.json` exists, no pipeline state | Phase 3: Launch |
| `.prizmkit/plans/feature-list.json` + pipeline state exists | Phase 4: Monitor (check status) |
| All features completed | Report completion, suggest next steps |

**Resume**: If `.prizmkit/plans/feature-list.json` exists, ask user: "Existing feature plan found with N features. Resume pipeline or re-plan?"

---

## Interaction During Pipeline

While the pipeline runs, the user can continue the conversation:

| User says | Action |
|-----------|--------|
| "status" / "progress" | Show current progress |
| "logs" | Show recent log activity |
| "stop" | Stop the pipeline (state preserved) |
| "show F-002 logs" | Show specific feature's session log |

---

## Error Handling

| Error | Action |
|-------|--------|
| User's idea is too vague to brainstorm | Ask for more context: "Can you describe the main problem this solves?" |
| Brainstorming stalls | Offer concrete options: "Would you prefer A or B?" |
| `feature-planner` cannot parse requirements | Refine the requirements summary and retry |
| `.prizmkit/plans/feature-list.json` generation failed | Show error, retry with refined input |
| Pipeline launch failed | Show daemon log, suggest manual start |
| All features blocked/failed | Show status, suggest retrying specific features |
| User wants to cancel mid-brainstorming | Save conversation context, offer to resume later |

---

## Relationship to Other Skills

| Skill | Relationship |
|-------|-------------|
| `feature-planner` | **Called by Phase 2** — generates .prizmkit/plans/feature-list.json from clarified requirements |
| `feature-pipeline-launcher` | **Called by Phase 3** — starts pipeline (handles execution mode selection) |
| `bug-planner` | **Alternative** — for bug fix workflows |
| `bugfix-pipeline-launcher` | **Alternative** — for bug fix pipelines |
| `refactor-workflow` | **Alternative** — for code restructuring |

---

## Comparison with Alternative Workflows

| Dimension | feature-workflow | bug-fix-workflow | refactor-workflow |
|-----------|-----------------|------------------|-------------------|
| **Purpose** | New features (batch) | Single bug fix (interactive) | Code restructuring (batch) |
| **Brainstorming** | Yes — collect materials, parallel read, discuss | No (bug report is input) | Yes — clarify type, collect materials, parallel read, discuss |
| **Planning Skill** | `feature-planner` | None (triage built-in) | `refactor-planner` |
| **Branch** | Pipeline manages per-feature | `fix/<BUG_ID>-*` | Pipeline manages per-refactor |
| **Execution** | Foreground or background daemon | In-session, interactive | Foreground or background daemon |
| **Input** | Rough idea or requirements | Bug report / stack trace | Rough refactoring idea or target |
| **Output** | Multiple `feat()` commits | Single `fix()` commit | Multiple `refactor()` commits |
| **Behavior Change** | Expected (new functionality) | Fix behavior | Forbidden (structure only) |
| **Batch alternative** | (this is the batch flow) | `bug-planner` + `bugfix-pipeline-launcher` | (this is the batch flow) |

---

## Path References

All internal asset paths use `.claude/command-assets/feature-workflow` placeholder for cross-IDE compatibility.

## Output

- Structured requirements summary (Phase 1 artifact)
- `.prizmkit/plans/feature-list.json` (Phase 2 artifact)
- Pipeline execution (Phase 3)
- Progress updates (Phase 4)
- Multiple git commits with `feat(<scope>):` prefix
- Updated `.prizmkit/prizm-docs/` (via prizmkit-retrospective per feature)
