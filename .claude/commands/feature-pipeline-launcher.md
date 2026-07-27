---
description: "Launch and manage the dev-pipeline from within an AI CLI session. Start pipeline in background, monitor logs, check status, stop pipeline. Use this skill whenever the user wants to start building features, run the pipeline, check pipeline progress, retry features, or stop the pipeline. Trigger on: 'run pipeline', 'start pipeline', 'start building', 'pipeline status', 'stop pipeline', 'retry feature', 'launch pipeline', 'start implementing', 'check pipeline status', 'stop the pipeline'. (project)"
---

# Dev-Pipeline Launcher

Launch the autonomous development pipeline from within an AI CLI conversation. The pipeline runs as a fully detached background process -- closing the AI CLI session does NOT stop the pipeline.

### Execution Mode

Three execution modes are available. The user chooses one before configuring other options:

1. **Foreground** (recommended) — `.\.prizmkit\dev-pipeline\run-feature.ps1 run`. Visible output, direct error feedback, no orphaned processes.
2. **Background daemon** — `.\.prizmkit\dev-pipeline\launch-feature-daemon.ps1`. Runs fully detached, survives AI CLI session closure.
3. **Manual** — Display the assembled command(s) only. Do not execute anything. User runs them on their own.

### When to Use

**Start pipeline** -- User says:
- "run pipeline", "start pipeline", "start building", "launch dev-pipeline"
- "run the features", "execute feature list", "start implementing"
- "launch pipeline", "run the pipeline", "start auto-development"
- After feature-planner completes: "build it", "start developing from the feature list"
- "run only F-001 to F-005", "run features F-001,F-003", "only build these features"

**Check status** -- User says:
- "pipeline status", "check pipeline", "how's it going", "progress"
- "check progress", "what's the current situation"

**Stop pipeline** -- User says:
- "stop pipeline", "kill pipeline", "halt", "pause"
- "stop the pipeline", "pause the pipeline"

**Show logs** -- User says:
- "show logs", "pipeline logs", "tail logs", "what's happening"
- "view logs", "check the logs"

**Retry single feature node** -- User says:
- "retry F-003", "retry this feature", "retry this node", "re-run this feature"

**Do NOT use this skill when:**
- User wants to plan features (use `feature-planner` instead)
- User wants to implement a single feature manually within current session (use `prizmkit-implement`)
- User wants to define specs/plan (use `prizmkit-plan`)

### Prerequisites

Before any action, validate:

1. **dev-pipeline exists**: Confirm `.\.prizmkit\dev-pipeline\launch-feature-daemon.ps1` is present and executable
2. **For start**: `.prizmkit/plans/feature-list.json` must exist in `.prizmkit/plans/` (or user-specified path)
3. **Dependencies**: `python` or the Windows `py` launcher, `git`, and one AI CLI (`codex`, `claude`, or `cbc`) must be in PATH
4. **Python version**: Requires Python 3.8+ for dev-pipeline scripts
5. **Browser tools** (optional): If any feature has `browser_interaction` field, check the corresponding tool is available. Features may specify `tool: "playwright-cli"`, `tool: "opencli"`, or `tool: "auto"` (AI chooses at runtime).

Quick check:
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
try {
  $prizmPythonPath = Invoke-PrizmPython -c "import sys; print(sys.executable)"
  "Python OK: $prizmPythonPath"
} catch {
  "Missing Python: install Python 3 and ensure python or py is in PATH"
}
Get-Command git
$aiCli = @("codex", "claude", "cbc") | Where-Object { Get-Command $_ -ErrorAction SilentlyContinue } | Select-Object -First 1
if ($aiCli) { "AI CLI OK: $aiCli" } else { "Missing AI CLI: install codex, claude, or cbc" }
# Optional: browser interaction support (check both tools — features may use either)
if (Get-Command playwright-cli -ErrorAction SilentlyContinue) { "playwright-cli OK" } else { "playwright-cli not found (playwright browser verification will be skipped)" }
if (Get-Command opencli -ErrorAction SilentlyContinue) { "opencli OK" } else { "opencli not found (opencli browser verification will be skipped)" }
```

If `.prizmkit/plans/feature-list.json` is missing, inform user:
> "No .prizmkit/plans/feature-list.json found. Run the `feature-planner` skill first to generate one, or provide a path to your feature list."

### Workflow

Detect user intent from their message, then follow the corresponding workflow:

---

#### Intent A: Start Pipeline

> **Execution model**: The pipeline processes features **sequentially** (one at a time, in order). The `dependencies` field in feature-list.json is reserved for future parallel execution support and does NOT affect current execution order.

1. **Check prerequisites**:
   ```powershell
   if (Test-Path .prizmkit/plans/feature-list.json) { "Found" } else { "Missing" }
   ```

2. **Check not already running**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-feature-daemon.ps1 status
   ```
   If running, inform user and ask: "Pipeline is already running. Want to restart it, check status, or view logs?"

3. **Show feature summary** (so user knows what will be built):
   ```powershell
   $data = Get-Content .prizmkit\plans\feature-list.json -Raw | ConvertFrom-Json
   $features = @($data.features)
   "Total features: $($features.Count)"
   foreach ($feature in $features) {
     $title = if ($feature.title) { $feature.title } else { "untitled" }
     "  $($feature.id): $title"
   }
   ```
   If pipeline state already exists, use the status command instead:
   ```powershell
   Invoke-PrizmPython .prizmkit/dev-pipeline/scripts/update-feature-status.py `
     --feature-list .prizmkit/plans/feature-list.json `
     --state-dir .prizmkit/state/features `
     --action status
   ```

4. **Run environment preflight checks** (database connectivity, migrations, dev server):

   Run the preflight script to auto-detect the database type, verify env vars, test connectivity, and check migration status:
   ```powershell
   Invoke-PrizmPython .claude/command-assets/feature-pipeline-launcher/scripts/preflight-check.py .prizmkit/plans/feature-list.json
   ```

   The script:
   - Reads `global_context.database` from `.prizmkit/plans/feature-list.json` and `.prizmkit/config.json`
   - Scans `.env.local` / `.env` for connection variables (supports Supabase, PostgreSQL, MySQL, MongoDB, Firebase, and generic `DATABASE_URL`)
   - Tests connectivity using the appropriate method per database type
   - Checks migration status (Prisma, Drizzle, Supabase raw SQL, or generic migration directories)
   - Checks if the dev server is running (from `browser_interaction` URLs)
   - Outputs `PREFLIGHT ✓` (pass), `PREFLIGHT ⚠` (warning), or `PREFLIGHT ℹ` (info) lines
   - Exits 0 (all clear), 1 (warnings found), or 2 (error — feature list not found)

   If the script reports `⚠` warnings, present them to the user and ask:
   > "Environment preflight found issues (listed above). The pipeline can still run, but database-related features may produce code that passes mock tests without real database verification. Continue anyway?"

   Wait for user confirmation. If they want to fix issues first, suggest remediation based on the warnings (apply migrations, configure env vars, check database service status).

   If `global_context.database` is absent and no features mention database keywords, the script skips DB checks automatically.

5. **Ask execution mode** (first user decision — SEPARATE `AskUserQuestion` call):

   ⛔ **This MUST be its own standalone `AskUserQuestion` call.** Do NOT combine execution mode with step 6 config questions. The execution mode question is asked ALONE, user responds, THEN you proceed to step 6.

   Use `AskUserQuestion` with exactly 1 question:

   **Question 1 — Execution mode** (multiSelect: false):
   - Foreground (Recommended) — pipeline runs in the current session via `run-feature.ps1 run`. Visible output and direct error feedback.
   - Background daemon — pipeline runs fully detached via `launch-feature-daemon.ps1`. Survives AI CLI session closure.
   - Manual — display the final assembled commands only. Do not execute anything. User runs them on their own.

   ⚠️ STOP HERE and wait for user response before continuing to step 6.

6. **Ask configuration options** ⚠️ MANDATORY INTERACTIVE STEP — applies to ALL execution modes (Foreground, Background, AND Manual). This is a SEPARATE `AskUserQuestion` call from step 5. You MUST ask the user to configure options and WAIT for their response BEFORE proceeding to step 7.

   ⛔ **HARD STOP**: You MUST call `AskUserQuestion` with the 4 questions below and WAIT for the user's response. You MUST NOT:
   - Combine step 5 and step 6 into one `AskUserQuestion` call (this is the most common violation — execution mode MUST be asked separately in step 5)
   - Skip this step and jump to step 7
   - Merge step 6 and step 7 into one response
   - Assume default values and show the command without asking
   - Show the command as text and ask "ready?" without presenting the options
   If you find yourself writing the final command before the user has answered these 4 questions, STOP — you are violating this rule.

   Use `AskUserQuestion` to present ALL 4 configuration choices (the full 4-question budget goes to config, NOT shared with execution mode):

   **Question 1 — Critic review** (multiSelect: false):
   - Off (default) — Skip adversarial review
   - On — Enable adversarial critic review: an independent AI agent reviews the spec/plan for completeness and the implementation for defects, edge cases, and missing requirements. Adds ~5-10 min per feature.

   **Question 2 — Verbose logging** (multiSelect: false):
   - On (default) — Detailed AI session logs including tool calls and subagent activity
   - Off — Minimal logging

   **Question 3 — Max retries** (multiSelect: false):
   - 3 (default)
   - 1
   - 5

   **Question 4 — Advanced config?** (multiSelect: false):
   - No (default) — Use defaults for session timeout and failure behavior
   - Yes — Configure session timeout and stop-on-failure options

   Default Critic to Off unless features have `estimated_complexity: "high"` or above (in which case default to On).

   **If user chose "Yes" to Advanced config**, ask a second round of `AskUserQuestion`:

   **Question 1 — Session timeout** (multiSelect: false):
   - None (default) — No timeout
   - 30 min — `SESSION_TIMEOUT=1800`
   - 1 hour — `SESSION_TIMEOUT=3600`
   - 2 hours — `SESSION_TIMEOUT=7200`

   **Question 2 — Stop on failure** (multiSelect: false):
   - Off (default) — Pipeline continues to next task after failure
   - On — Pipeline halts immediately when a task exhausts all retries (`STOP_ON_FAILURE=1`)

   **Environment variable mapping** (for translating user responses → env vars):

   | Config choice | Environment variable |
   |-----------|---------------------|
   | Critic: On | `ENABLE_CRITIC=true` |
   | Verbose: Off | `VERBOSE=0` |
   | Verbose: On | `VERBOSE=1` |
   | Max retries: N | `MAX_RETRIES=N` |
   | Timeout: value | `SESSION_TIMEOUT=<seconds>` |
   | Stop on failure: On | `STOP_ON_FAILURE=1` |

   **Advanced environment variables** (not exposed in interactive menu, pass via `--env`):

   | Variable | Default | Purpose |
   |----------|---------|---------|
   | `MODEL` | (none) | AI model override (e.g. `claude-opus-4.6`) |
   | `PIPELINE_MODE` | (none) | Override mode for all features: `lite`\|`standard`\|`full` |

   ⚠️ STOP HERE and wait for user response before continuing to step 7.

7. **Show final command**: After user confirms configuration in step 6, assemble the complete command from execution mode + user-confirmed configuration, and present it to the user.

   **Foreground command:**
   ```powershell
   $env:VERBOSE = "1"; .\.prizmkit\dev-pipeline\run-feature.ps1 run .prizmkit/plans/feature-list.json
   ```
   With all options:
   ```powershell
   $env:VERBOSE = "1"; $env:ENABLE_CRITIC = "true"; $env:MAX_RETRIES = "5"; $env:SESSION_TIMEOUT = "3600"
   .\.prizmkit\dev-pipeline\run-feature.ps1 run .prizmkit/plans/feature-list.json --features F-001:F-005
   ```

   **Background daemon command:**
   ```powershell
   .\.prizmkit\dev-pipeline\launch-feature-daemon.ps1 start .prizmkit/plans/feature-list.json --env "VERBOSE=1"
   ```
   With all options:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-feature-daemon.ps1 start .prizmkit/plans/feature-list.json --features F-001:F-005 `
     --env "VERBOSE=1 ENABLE_CRITIC=true MAX_RETRIES=5"
   ```

   **Manual mode**: Print the assembled command(s) and **stop here**. Do not execute anything. Do not proceed to step 8.
   ```
   # To run in foreground:
   $env:VERBOSE = "1"; .\.prizmkit\dev-pipeline\run-feature.ps1 run .prizmkit/plans/feature-list.json

   # To run in background (detached):
   .\.prizmkit\dev-pipeline\launch-feature-daemon.ps1 start .prizmkit/plans/feature-list.json --env "VERBOSE=1"

   # To check status:
   .\.prizmkit\dev-pipeline\run-feature.ps1 status .prizmkit/plans/feature-list.json
   ```

8. **Confirm and launch** (Foreground and Background only — Manual mode ends at step 7):

   Ask: "Ready to launch the pipeline with the above command?"

   After user confirms, execute the command from step 7.

9. **Post-launch** (depends on execution mode):

   **If foreground**: Pipeline runs to completion in the terminal. After it finishes:
   - Summarize results: total features, succeeded, failed, skipped
   - If all succeeded: each feature session has already run `prizmkit-retrospective` internally. Ask user what's next.
   - If some failed: show failed feature IDs and suggest `reset-feature.ps1 <F-XXX> --clean --run` for a fresh retry
   - **Browser verification**: If any completed features have `browser_interaction` and the corresponding browser tool (`playwright-cli` or `opencli`) is installed, offer to run browser verification (see Post-Pipeline Browser Verification)

   **If background daemon**:
   1. Verify launch:
      ```powershell
      .\.prizmkit\dev-pipeline\launch-feature-daemon.ps1 status
      ```
   2. Start log monitoring — Use the PowerShell terminal with `run_in_background: true`:
      ```powershell
      Get-Content -Wait -Tail 50 .prizmkit/state/daemon/feature-daemon.log
      ```
   3. Report to user:
      - Pipeline PID
      - Log file location
      - "You can ask me 'pipeline status' or 'show logs' at any time"
      - "Closing this session will NOT stop the pipeline"

---

#### Intent B: Check Status

1. **Check daemon status**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-feature-daemon.ps1 status
   ```

2. **Show feature-level progress**:
   ```powershell
   Invoke-PrizmPython .prizmkit/dev-pipeline/scripts/update-feature-status.py `
     --feature-list .prizmkit/plans/feature-list.json `
     --state-dir .prizmkit/state/features `
     --action status
   ```

3. **Show recent log activity** (last 20 lines):
   ```powershell
   Get-Content -Tail 20 .prizmkit/state/daemon/feature-daemon.log
   ```

4. **Summarize** to user: total features, completed, in-progress, failed, pending.

---

#### Intent C: Stop Pipeline

1. **Stop the daemon**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-feature-daemon.ps1 stop
   ```

2. **Verify stopped**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-feature-daemon.ps1 status
   ```

3. **Inform user**: "Pipeline stopped. State is preserved -- you can resume later with 'start pipeline' and it will pick up where it left off."

---

#### Intent D: Show Logs

1. **Check if running**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-feature-daemon.ps1 status
   ```

2. **If running** -- Start live tail with PowerShell terminal `run_in_background: true`:
   ```powershell
   Get-Content -Wait -Tail 50 .prizmkit/state/daemon/feature-daemon.log
   ```

3. **If not running** -- Show last 50 lines:
   ```powershell
   Get-Content -Tail 50 .prizmkit/state/daemon/feature-daemon.log
   ```

4. **For per-feature session logs** (when user asks about a specific feature):
   ```powershell
   # Check feature status for last session ID
   Get-Content .prizmkit/state/features/features/<FEATURE_ID>/status.json -ErrorAction SilentlyContinue
   # Then tail that feature's session log
   Get-Content -Tail 100 .prizmkit/state/features/features/<FEATURE_ID>/sessions/<SESSION_ID>/logs/session.log
   ```

---

#### Intent E: Retry Single Feature Node

When user says "retry F-003" or "clean retry F-003":

```powershell
.\.prizmkit\dev-pipeline\reset-feature.ps1 F-003 --clean --run .prizmkit/plans/feature-list.json
```

Notes:
- `reset-feature.ps1 F-003 --clean --run` performs a clean reset for `F-003` before retrying that feature — this gives a fresh start.
- Keep pipeline daemon mode for main run management (`launch-feature-daemon.ps1`).

---

#### Post-Pipeline Browser Verification

After pipeline completion, if features have `browser_interaction` fields and the corresponding browser tool (`playwright-cli` or `opencli`) is installed:

1. **Check which features qualify**:
   ```powershell
   $data = Get-Content .prizmkit\plans\feature-list.json -Raw | ConvertFrom-Json
   foreach ($feature in @($data.features)) {
     if ($feature.browser_interaction -and $feature.status -eq "completed") {
       $tool = if ($feature.browser_interaction.tool) { $feature.browser_interaction.tool } else { "auto" }
       "  $($feature.id): $($feature.title) (tool: $tool)"
     }
   }
   ```

2. **Ask user**: "N features have browser verification configured. Run browser verification now? (Y/n)"

3. **If yes**, for each qualifying feature:
   - Start dev server if `setup_command` is specified
   - Select browser tool based on `browser_interaction.tool`:
     - `"playwright-cli"` → Use `playwright-cli snapshot` to discover element refs, then verify each goal in `verify_steps`
     - `"opencli"` → Use `opencli browser` to interact with Chrome's logged-in session (ideal for OAuth/third-party verification)
     - `"auto"` → AI chooses the appropriate tool based on context (default: `playwright-cli` for local dev, `opencli` for authenticated flows)
   - Take a screenshot after verification
   - Close browser and stop dev server

4. **Report results**:
   - For each feature: URL opened, tool used, steps executed, screenshot path
   - If any step fails: flag as verification failure

**Important**: Browser verification is best-effort — failures here do NOT change the feature's pipeline status. They serve as visual confirmation aids for the user.

---

### Error Handling

| Error | Action |
|-------|--------|
| `.prizmkit/plans/feature-list.json` not found | Tell user to run `feature-planner` skill first |
| JSON parsing failed | Use the bundled Python validation/status scripts instead of external JSON tools |
| AI CLI not in PATH | Check Codex (`codex`), Claude (`claude`), or CodeBuddy (`cbc`) installation |
| Pipeline already running | Show status, ask if user wants to stop and restart |
| PID file stale (process dead) | `launch-feature-daemon.ps1` auto-cleans, retry start |
| Launch failed (process died immediately) | Show last 20 lines of log: `Get-Content -Tail 20 .prizmkit/state/daemon/feature-daemon.log` |
| Feature stuck/blocked | Use `reset-feature.ps1 <F-XXX> --clean --run` for a fresh retry |
| All features blocked/failed | Show status, suggest daemon-safe recovery: `.\.prizmkit\dev-pipeline\reset-feature.ps1 <F-XXX> --clean --run .prizmkit/plans/feature-list.json` |
| `playwright-cli` not installed | Browser verification skipped for playwright features (non-blocking). Suggest: `npm install -g @playwright/cli@latest; playwright-cli install --skills` |
| `opencli` not installed | Browser verification skipped for opencli features (non-blocking). Install opencli for Chrome session-based browser verification |
| PowerShell execution policy blocks script | Run `Set-ExecutionPolicy -Scope Process Bypass` for the current terminal |
| Pipeline stop failed | Use `Stop-Process -Id <PID> -Force`; inspect AI CLI processes with `Get-Process | Select-String codex` |
| `.env.local` missing or incomplete | Warn: database connection variables not found. Suggest creating env file with required connection variables for the project's database |
| Database unreachable | Warn: database features will produce mock-only tests. Suggest checking database service status and connection credentials |
| Migrations not applied | Warn: tables or schema referenced in migration files not found in database. Suggest applying pending migrations |

### Integration Notes

- **After feature-planner**: This is the natural next step. When user finishes planning and has `.prizmkit/plans/feature-list.json`, suggest launching the pipeline.
- **Session independence**: The pipeline runs completely detached. User can close the AI CLI session, open a new session later, and use this skill to check progress or stop the pipeline.
- **Single instance**: Only one pipeline can run at a time. The PID file prevents duplicates.
- **Pipeline coexistence**: Feature and bugfix pipelines use separate state directories (`.prizmkit/state/features/` vs `.prizmkit/state/bugfix/`), so they can run simultaneously without conflict.
- **State preservation**: Stopping and restarting the pipeline resumes from where it left off -- completed features are not re-run.
- **HANDOFF**: After pipeline completes all features, each session has already run `prizmkit-retrospective` internally. Ask user what's next.
