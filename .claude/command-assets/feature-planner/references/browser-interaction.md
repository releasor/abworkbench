# Browser Interaction Planning

For web apps with UI, features that involve user-facing pages or interactive flows can optionally include a `browser_interaction` field. This enables the dev-pipeline to verify UI behavior automatically after implementation using the configured browser tool (`playwright-cli` or `opencli`).

## Browser Tool Selection (Mandatory — Ask User)

Before auto-generating `browser_interaction` for features, you MUST ask the user which browser tool to use as the project default via `AskUserQuestion`:

**Question**: "Which browser verification tool should this project use by default?"
- **Auto — AI chooses per feature (Recommended)** — `playwright-cli` for local UI, `opencli` for authenticated flows. AI decides per-feature at planning time.
- **playwright-cli** — isolated browser instance, no login state. Best for local dev server, forms, components.
- **opencli** — reuses Chrome's logged-in sessions via Browser Bridge. Best for OAuth, third-party dashboards, SSO.

Store the user's choice as the project-level default. Individual features can still override (see Tool Selection per Feature below).

## How to Capture

During Phase 4.2, auto-generate `browser_interaction` for all qualifying features (see SKILL.md §Browser Interaction Planning for auto-detection rules). Present a **batch summary** to the user showing which features received `browser_interaction` — do NOT ask per-feature. The user can opt out specific features from the summary.

For each qualifying feature, generate the `browser_interaction` object:

```json
{
  "browser_interaction": {
    "tool": "auto",
    "verify_steps": [
      "Verify login form renders with email and password fields",
      "Verify valid credentials redirect to dashboard",
      "Verify invalid password shows error message"
    ]
  }
}
```

## Field Rules

- `tool` selects the browser verification tool. Values: `"playwright-cli"`, `"opencli"`, `"auto"` (default).
  - **`"auto"`** (default): AI chooses at runtime based on available tools and scenario. Recommended for most cases.
  - **`"playwright-cli"`**: Isolated browser instance, no login state. Best for local dev server verification, form testing, component rendering checks.
  - **`"opencli"`**: Reuses Chrome's logged-in sessions via Browser Bridge. Best for verifying third-party integrations (OAuth callbacks, API dashboards), features requiring real authentication state, or pages behind SSO.

  | Scenario | Recommended `tool` |
  |----------|-------------------|
  | Local dev server, pure frontend components | `playwright-cli` |
  | Needs real login state (e.g., OAuth redirect page) | `opencli` |
  | Third-party API integration dashboard verification | `opencli` |
  | Headless CI environment | `playwright-cli` |
  | Unsure / mixed scenarios | `auto` |

- `verify_steps` are **verification goals**, not specific tool commands. Describe WHAT to verify, not HOW to verify it. The pipeline AI will:
  1. Auto-detect the dev server start command from project config (`package.json`, `Makefile`, etc.)
  2. Start the server and discover the URL/port at runtime
  3. Use `playwright-cli snapshot` to discover real element refs
  4. Decide the concrete click/fill/assert operations itself
  This works better than prescribing URLs/commands at planning time because: (1) ports may differ across environments, (2) element refs don't exist yet, (3) UI structure may change during implementation, (4) the AI has full context of the actual code when it runs verification.
  - **Good**: `"Verify login form accepts valid credentials and redirects to dashboard"`
  - **Bad**: `"click <ref> — click login button"` (guesses at refs that don't exist yet)
- Do NOT specify `url`, `setup_command`, or `port` — the AI detects these at runtime from the actual project configuration
- An empty `browser_interaction: {}` object (no verify_steps) is valid — the AI will explore the app and verify the feature works as expected
