# Project Brief Template

> Capture the user's key product ideas as a simple checklist. Each line is one idea. This file is referenced by `root.prizm` (`PROJECT_BRIEF:`) so every new AI session automatically knows the project's goals.

## File Location

`.prizmkit/plans/project-brief.md`

## Format

```markdown
# Project Brief

[ ] Core product idea or constraint
[ ] Another product idea
[ ] Third idea — one sentence, no sub-bullets
[x] Already implemented feature -> src/feature/, src/utils/helper.ts
```

## Rules

1. **First line**: `# Project Brief`
2. **Remaining lines**: One idea per line, prefixed with `[ ]` (pending) or `[x]` (done)
3. Each line is **one sentence** — no paragraphs, no sub-bullets, no grouping headers
4. Language: match the user's language (Chinese or English)
5. **Size limit**: 500 words max (this file is injected into every session's context window)
6. **Completion marking** (mandatory): When a brief item is implemented:
   - Change `[ ]` to `[x]`
   - Append `->` followed by the **key file or directory paths** that implement it
   - List the most important 1-3 paths only (entry point, core module, or directory) — not every touched file
   - Example: `[x] User authentication with OAuth -> src/auth/, src/middleware/auth.ts`
   - This lets future AI sessions instantly locate the implementation without re-scanning

## Brownfield Init

When initializing an existing project, AI infers the brief from:
- Generated `root.prizm` (tech stack, module structure)
- `README.md` (if exists)
- Package metadata (`package.json` description, `pyproject.toml`, etc.)

Then presents the draft to the user for confirmation and editing.

## Greenfield Init

When initializing a new/empty project, use **progressive questioning** to fully understand the user's intent before generating the brief. Do NOT dump all questions at once — ask in rounds, adapting based on answers.

### Round 1: Problem & Vision (required)
- What problem does this project solve? (or: what's the core idea?)
- Who is the target user / audience?

### Round 2: Scope & Features (required)
- What are the 3-5 core features or capabilities? (ask user to list them)
- What is the MVP scope? (what's the minimum version that delivers value?)
- Are there any explicit non-goals? (things this project deliberately does NOT do)

### Round 3: Technical Constraints (if user has preferences)
- Any preferred tech stack / language / framework?
- Any integration requirements? (third-party APIs, databases, auth providers)
- Deployment target? (web app, mobile, CLI, library, self-hosted, cloud)

### Round 4: Clarification (adaptive — only if gaps remain)
If previous answers are vague or incomplete, probe deeper:
- "You mentioned X — can you give a concrete example of how a user would use it?"
- "Are there existing tools that do something similar? How is yours different?"
- "What does success look like for V1?"

### Completion Criteria
Stop asking when ALL of these are clear:
1. **Problem** — what pain point or opportunity this addresses
2. **Users** — who will use it and in what context
3. **Core features** — at least 3 concrete capabilities (not vague aspirations)
4. **Boundaries** — what's in scope vs. out of scope for V1
5. **Technical direction** — enough to populate `config.json` tech_stack (or explicitly deferred)

If the user gives short/vague answers, don't accept them — rephrase and ask again. A weak brief leads to weak specs downstream.

### Generate & Confirm
Once all criteria are met:
1. Generate brief in checklist format (see Format section above)
2. Present to user with: "Here's what I captured — anything to add, remove, or change?"
3. Apply edits and write to `.prizmkit/plans/project-brief.md`

