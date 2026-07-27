# Pre-Generation Completeness Review

Before generating `.prizmkit/plans/feature-list.json`, review the full feature set holistically. Individual features may look fine in isolation but have gaps when viewed together.

## Step 1: Description Adequacy Scan

For each feature, evaluate against the word-count thresholds in `planning-guide.md`:
- Does the description cover: what to build, key behaviors, integration points, data model (if applicable), error/edge cases?
- Is the description specific enough for an AI coding session to implement without guessing?
- Flag any feature below the recommended minimum word count for its complexity level (30+/50+/80+/100+ words for low/medium/high/critical). There is no upper limit — more detail is always better.

**Implementation clarity check** — Every feature description will be consumed by an autonomous AI session. Verify each description specifies:
1. Concrete deliverables (files to create, endpoints to build, components to implement, models to define)
2. Key behaviors and business rules (validation, state transitions, error handling)
3. Integration points with other modules (which APIs to call, which models to use)

**Dependency context check** — If the feature depends on others, the description should reference what it needs from them:
- Good: "Uses User model from F-001 to link projects to users via userId foreign key"
- Bad: "depends on F-001" (too vague)

**Ambiguity check** — Flag vague phrases:
- Bad: "Create a nice dashboard" (what components? what data? what layout?)
- Good: "Create dashboard at /dashboard with: (1) summary cards showing total projects count, active tasks count; (2) recent activity feed (last 10 items); (3) quick-access project list (5 most recent). Fetch data via GET /api/dashboard/summary."

If any feature description is unclear, **expand it now** before generating the output file.

## Step 2: Cross-Feature Completeness Check

Look at the feature set as a whole:
- **Implied functionality gaps**: Does feature A's acceptance criteria assume a capability that no other feature provides?
- **Missing integration seams**: If two features share data or interact at runtime, is the interface specified?
- **Scope leaks**: Does any feature's description reference functionality outside the agreed scope?

## Step 3: Present Review to User

Show a structured summary table:

```
Feature    | Description | Cross-Feature        | Recommendation
           | Adequacy    | Issues               |
F-001      | ✓ (65 words)| —                    | Ready
F-002      | ⚠ (28 words)| —                    | Expand: add API endpoints, error handling
F-003      | ✓ (52 words)| Assumes email from   | Clarify: who sends the notification?
           |             | F-006 (not yet defined)|
```

Then ask if any features need further discussion.

## Step 4: Interactive Supplementation

For each feature the user wants to discuss:
1. Ask targeted questions about the unclear aspects
2. Propose concrete description supplements
3. Update the feature description with agreed details
4. Re-check: does the supplement resolve the gap?

Continue until the user confirms all features are implementation-ready. Fixing thin descriptions here costs minutes; fixing misimplemented features downstream costs hours.
