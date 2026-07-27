# Brainstorm Guide — Structured Ideation Before Implementation

> Separate WHAT from HOW. Explore the problem space before committing to a solution.

This guide provides the structured brainstorming framework used in Phase 1 of the workflow.
The AI facilitates this process as a **design collaborator**, not a builder.

## Four Phases

### Phase A: Assess Clarity

Evaluate the user's initial goal statement:

- **Clear** — Specific and actionable (e.g., "add JWT auth to the API")
- **Vague** — Direction exists but needs narrowing (e.g., "improve security")
- **Exploring** — No firm goal yet, just a direction (e.g., "something with auth")

If **vague** or **exploring**, ask follow-up questions to sharpen the goal.
Do NOT proceed until there is a concrete, testable problem statement (one sentence).

### Phase B: Understand the Idea

Answer these questions (use codebase exploration as needed):

1. **What problem does this solve?** — State the pain point in concrete terms.
2. **Who benefits?** — End users, developers, operators?
3. **What exists today?** — Current state, prior art in the codebase, adjacent systems.
4. **What constraints matter?** — Performance, compatibility, security, timeline.

Non-functional requirements to explicitly clarify or propose defaults for:
- Performance expectations
- Scale (users, data, traffic)
- Security or privacy constraints
- Reliability / availability needs
- Maintenance and ownership expectations

If the user is unsure on any point, propose reasonable defaults and clearly mark them as **assumptions**.

Summarize findings before moving on. If anything is unclear, ask.

### Phase C: Explore Approaches

Generate **2-3 distinct approaches**. For each:

- **Name** — Short label (e.g., "JWT middleware", "OAuth proxy")
- **How it works** — 2-3 sentences
- **Pros** — What it gets right
- **Cons** — What it gets wrong or defers
- **Effort** — Rough scope (small / medium / large)

#### Adversarial Critique (Red Team)

Before asking the user to choose, stress-test each approach using the red team checklist
(`references/red-team-checklist.md`):

1. What breaks first?
2. What's the hidden cost?
3. What assumption is wrong?
4. Who disagrees?

Mark any approach that fails 2+ red team questions as **HIGH RISK**.
If all approaches fail, generate a hybrid addressing the weaknesses.

Present the comparison and let the user pick an approach or request a hybrid.

### Phase D: Capture Design

Produce a structured summary:

```markdown
## Problem Statement
[One sentence, testable]

## Approaches Considered
[2-3 approaches with pros/cons/effort]

## Selected Approach
[User's choice + rationale]

## Assumptions
[All assumptions explicitly listed]

## Open Questions
[Unresolved items, if any]

## Key Decisions
[What was decided and why — alternatives and rationale]
```

This summary becomes the input for the next phase (specification or planning).

---

## Rules

- Ask as many questions as needed — no rushing
- One topic at a time for complex clarifications
- Prefer multiple-choice questions when possible
- Assumptions must be explicit, never silent
- YAGNI ruthlessly — avoid premature complexity
- Do NOT implement, code, or modify behavior during brainstorming
