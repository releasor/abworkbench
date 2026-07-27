---
description: "Launch and manage the refactor pipeline from within an AI CLI session. Start pipeline in background, monitor logs, check status, stop pipeline. Use this skill whenever the user wants to start refactoring, run the refactor pipeline, check refactor progress, retry refactors, or stop the pipeline. Trigger on: 'run refactor pipeline', 'start refactoring', 'refactor pipeline status', 'stop refactor pipeline', 'retry refactor', 'launch refactor pipeline'. (project)"
---

# Refactor Pipeline Launcher

Launch the autonomous refactor pipeline from within an AI CLI conversation. The pipeline runs as a fully detached background process -- closing the AI CLI session does NOT stop the pipeline.

### Execution Mode

Three execution modes are available. The user chooses one before configuring other options:

1. **Foreground** (recommended) — `.\.prizmkit\dev-pipeline\run-refactor.ps1 run`. Visible output, direct error feedback, no orphaned processes.
2. **Background daemon** — `.\.prizmkit\dev-pipeline\launch-refactor-daemon.ps1`. Runs fully detached, survives AI CLI session closure.
3. **Manual** — Display the assembled command(s) only. Do not execute anything. User runs them on their own.

### When to Use

**Start pipeline** -- User says:
- "run refactor pipeline", "start refactoring", "launch refactor pipeline"
- "execute refactor list", "refactor all", "start refactoring tasks"
- After refactor-planner completes: "refactor it", "start refactoring from the list"

**Check status** -- User says:
- "refactor pipeline status", "refactor progress", "check refactoring"
- "how's the refactoring going", "refactor status"

**Stop pipeline** -- User says:
- "stop refactor pipeline", "stop refactoring", "halt refactor", "pause refactoring"

**Show logs** -- User says:
- "refactor logs", "show refactor logs", "what's being refactored"
- "view refactor logs"

**Retry single refactor** -- User says:
- "retry R-001", "retry this refactor", "re-run R-001"

**Do NOT use this skill when:**
- User wants to plan refactoring (use `refactor-planner` instead)
- User wants a single interactive refactor in current session (use `refactor-workflow` — but note it will delegate back here for batch execution)
- User wants to implement features (use `feature-pipeline-launcher`)

### Prerequisites

Before any action, validate:

1. **refactor pipeline exists**: Confirm `.\.prizmkit\dev-pipeline\launch-refactor-daemon.ps1` and `.\.prizmkit\dev-pipeline\run-refactor.ps1` are present and executable
2. **For start**: `.prizmkit/plans/refactor-list.json` must exist in `.prizmkit/plans/` (or user-specified path)
3. **Dependencies**: `python` or the Windows `py` launcher, `git`, and one AI CLI (`codex`, `claude`, or `cbc`) must be in PATH
4. **Python version**: Requires Python 3.8+ for dev-pipeline scripts
5. **Browser tools** (optional): If any refactor has `browser_interaction` field, check the corresponding tool is available. Refactors may specify `tool: "playwright-cli"`, `tool: "opencli"`, or `tool: "auto"` (AI chooses at runtime).

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
# Optional: browser interaction support (check both tools — refactors may use either)
if (Get-Command playwright-cli -ErrorAction SilentlyContinue) { "playwright-cli OK" } else { "playwright-cli not found (playwright browser verification will be skipped)" }
if (Get-Command opencli -ErrorAction SilentlyContinue) { "opencli OK" } else { "opencli not found (opencli browser verification will be skipped)" }
```

If `.prizmkit/plans/refactor-list.json` is missing, inform user:
> "No .prizmkit/plans/refactor-list.json found. Run the `refactor-planner` skill first to generate one, or provide a path to your refactor list."

### Workflow

Detect user intent from their message, then follow the corresponding workflow:

---

#### Intent A: Start Pipeline

> **Execution model**: The pipeline processes refactor tasks **sequentially** (one at a time, in priority order). The `dependencies` field in refactor-list.json is reserved for future parallel execution support and does NOT affect current execution order.

1. **Check prerequisites**:
   ```powershell
   if (Test-Path .prizmkit/plans/refactor-list.json) { "Found" } else { "Missing" }
   ```

2. **Check not already running**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-refactor-daemon.ps1 status
   ```
   If running, inform user and ask: "Refactor pipeline is already running. Want to restart it, check status, or view logs?"

3. **Show refactor summary** (so user knows what will be refactored):
   ```powershell
   $data = Get-Content .prizmkit\plans\refactor-list.json -Raw | ConvertFrom-Json
   $refactors = @($data.refactors)
   "Total refactor tasks: $($refactors.Count)"
   $refactors | Group-Object type | ForEach-Object { "  $($_.Name): $($_.Count)" }
   ""
   $priorityOrder = @{ critical = 0; high = 1; medium = 2; low = 3 }
   $refactorsSorted = $refactors | Sort-Object `
     @{ Expression = { if ($priorityOrder.ContainsKey($_.priority)) { $priorityOrder[$_.priority] } else { 2 } } }, `
     @{ Expression = { $_.id } }
   foreach ($refactor in $refactorsSorted) {
     $priority = if ($refactor.priority) { $refactor.priority.ToUpperInvariant() } else { "MEDIUM" }
     $type = if ($refactor.type) { $refactor.type } else { "?" }
     $title = if ($refactor.title) { $refactor.title } else { "untitled" }
     "  $($refactor.id): [$priority] [$type] $title"
   }
   ```
   If pipeline state already exists, use the status command instead:
   ```powershell
   Invoke-PrizmPython .prizmkit/dev-pipeline/scripts/update-refactor-status.py `
     --refactor-list .prizmkit/plans/refactor-list.json `
     --state-dir .prizmkit/state/refactor `
     --action status
   ```

4. **Run preflight checks** (behavior-preservation baseline):

   Before refactoring, verify the codebase is in a clean, testable state:
   ```powershell
   # Check git working tree is clean
   git status --porcelain | Select-Object -First 5
   # Run existing test suite to establish baseline
   npm test 2>&1 | Select-Object -Last 20
   if ($LASTEXITCODE -ne 0) { "Test command failed or not configured" }
   ```

   If git working tree is dirty, warn the user:
   > "Working tree has uncommitted changes. It's recommended to commit or stash changes before starting refactoring so each refactor task has a clean baseline. Continue anyway?"

   If test baseline fails, warn the user:
   > "Test suite is not passing. Refactoring relies on tests to verify behavior preservation. Fix failing tests before starting the refactor pipeline, or continue at your own risk."

   Wait for user confirmation before proceeding.

5. **Ask execution mode** (first user decision — SEPARATE `AskUserQuestion` call):

   ⛔ **This MUST be its own standalone `AskUserQuestion` call.** Do NOT combine execution mode with step 6 config questions. The execution mode question is asked ALONE, user responds, THEN you proceed to step 6.

   Use `AskUserQuestion` with exactly 1 question:

   **Question 1 — Execution mode** (multiSelect: false):
   - Foreground (Recommended) — pipeline runs in the current session via `run-refactor.ps1 run`. Visible output and direct error feedback.
   - Background daemon — pipeline runs fully detached via `launch-refactor-daemon.ps1`. Survives AI CLI session closure.
   - Manual — display the final assembled commands only. Do not execute anything. User runs them on their own.

   ⚠️ STOP HERE and wait for user response before continuing to step 6.

6. **Ask configuration options** ⚠️ MANDATORY INTERACTIVE STEP — applies to ALL execution modes (Foreground, Background, AND Manual). This is a SEPARATE `AskUserQuestion` call from step 5. You MUST ask the user to configure options and WAIT for their response BEFORE proceeding to step 7.

   ⛔ **HARD STOP**: You MUST call `AskUserQuestion` with the 3 questions below and WAIT for the user's response. You MUST NOT:
   - Combine step 5 and step 6 into one `AskUserQuestion` call (this is the most common violation — execution mode MUST be asked separately in step 5)
   - Skip this step and jump to step 7
   - Merge step 6 and step 7 into one response
   - Assume default values and show the command without asking
   - Show the command as text and ask "ready?" without presenting the options
   If you find yourself writing the final command before the user has answered these 3 questions, STOP — you are violating this rule.

   Use `AskUserQuestion` to present ALL 3 configuration choices (the full 3-question budget goes to config, NOT shared with execution mode):

   **Question 1 — Verbose logging** (multiSelect: false):
   - On (default) — Detailed AI session logs including tool calls and subagent activity
   - Off — Minimal logging

   **Question 2 — Max retries** (multiSelect: false):
   - 3 (default)
   - 1
   - 5

   **Question 3 — Advanced config?** (multiSelect: false):
   - No (default) — Use defaults for critic review, session timeout, and failure behavior
   - Yes — Configure critic review, session timeout, and stop-on-failure options

   Note: Refactor filter defaults to all refactor items (by priority order). If the user selects "Other" on any option, handle their custom input.

   **If user chose "Yes" to Advanced config**, ask a second round of `AskUserQuestion`:

   **Question 1 — Session timeout** (multiSelect: false):
   - None (default) — No timeout
   - 30 min — `SESSION_TIMEOUT=1800`
   - 1 hour — `SESSION_TIMEOUT=3600`
   - 2 hours — `SESSION_TIMEOUT=7200`

   **Question 2 — Stop on failure** (multiSelect: false):
   - Off (default) — Pipeline continues to next task after failure
   - On — Pipeline halts immediately when a task exhausts all retries (`STOP_ON_FAILURE=1`)

   **Question 3 — Critic review** (multiSelect: false):
   - Off (default) — Skip adversarial review
   - On — Enable adversarial critic review: an independent AI agent reviews the refactor plan for completeness and the implementation for regressions, missing edge cases, and behavior violations. Adds ~5-10 min per refactor task.

   Default Critic to Off unless refactor items have `priority: "critical"` (in which case default to On).

   **Environment variable mapping** (for translating user responses → env vars):

   | Config choice | Environment variable |
   |-----------|---------------------|
   | Verbose: On | `VERBOSE=1` |
   | Verbose: Off | `VERBOSE=0` |
   | Max retries: N | `MAX_RETRIES=N` |
   | Critic: On | `ENABLE_CRITIC=true` |
   | Timeout: value | `SESSION_TIMEOUT=<seconds>` |
   | Stop on failure: On | `STOP_ON_FAILURE=1` |

   **Advanced environment variables** (not exposed in interactive menu, pass via `--env`):

   | Variable | Default | Purpose |
   |----------|---------|---------|
   | `MODEL` | (none) | AI model override (e.g. `claude-opus-4.6`) |

   ⚠️ STOP HERE and wait for user response before continuing to step 7.

7. **Show final command**: After user confirms configuration in step 6, assemble the complete command from execution mode + user-confirmed configuration, and present it to the user.

   **Foreground command:**
   ```powershell
   $env:VERBOSE = "1"; .\.prizmkit\dev-pipeline\run-refactor.ps1 run .prizmkit/plans/refactor-list.json
   ```
   With all options:
   ```powershell
   $env:VERBOSE = "1"; $env:MAX_RETRIES = "5"; $env:SESSION_TIMEOUT = "3600"
   .\.prizmkit\dev-pipeline\run-refactor.ps1 run .prizmkit/plans/refactor-list.json
   ```

   **Background daemon command:**
   ```powershell
   .\.prizmkit\dev-pipeline\launch-refactor-daemon.ps1 start .prizmkit/plans/refactor-list.json --env "VERBOSE=1"
   ```
   With all options:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-refactor-daemon.ps1 start .prizmkit/plans/refactor-list.json `
     --env "VERBOSE=1 MAX_RETRIES=5"
   ```

   **Manual mode**: Print the assembled command(s) and **stop here**. Do not execute anything. Do not proceed to step 8.
	   ```
	   # To run in foreground:
	   $env:VERBOSE = "1"; .\.prizmkit\dev-pipeline\run-refactor.ps1 run .prizmkit/plans/refactor-list.json

	   # To run in background (detached):
	   .\.prizmkit\dev-pipeline\launch-refactor-daemon.ps1 start .prizmkit/plans/refactor-list.json --env "VERBOSE=1"

   # To check status:
   .\.prizmkit\dev-pipeline\run-refactor.ps1 status .prizmkit/plans/refactor-list.json
   ```

8. **Confirm and launch** (Foreground and Background only — Manual mode ends at step 7):

   Ask: "Ready to launch the refactor pipeline with the above command?"

   After user confirms, execute the command from step 7.

9. **Post-launch** (depends on execution mode):

   **If foreground**: Pipeline runs to completion in the terminal. After it finishes:
   - Summarize results: total refactors, succeeded, failed, skipped
   - If all succeeded: each refactor session has already run `prizmkit-retrospective` internally. Ask user what's next.
   - If some failed: show failed refactor IDs and suggest `reset-refactor.ps1 <R-XXX> --clean --run` for a fresh retry

   **If background daemon**:
   1. Verify launch:
      ```powershell
      .\.prizmkit\dev-pipeline\launch-refactor-daemon.ps1 status
      ```
   2. Start log monitoring — Use the PowerShell terminal with `run_in_background: true`:
      ```powershell
      Get-Content -Wait -Tail 50 .prizmkit/state/daemon/refactor-daemon.log
      ```
   3. Report to user:
      - Pipeline PID
      - Log file location
      - "You can ask me 'refactor status' or 'show refactor logs' at any time"
      - "Closing this session will NOT stop the pipeline"

---

#### Intent B: Check Status

1. **Check daemon status**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-refactor-daemon.ps1 status
   ```

2. **Show refactor-level progress**:
   ```powershell
   Invoke-PrizmPython .prizmkit/dev-pipeline/scripts/update-refactor-status.py `
     --refactor-list .prizmkit/plans/refactor-list.json `
     --state-dir .prizmkit/state/refactor `
     --action status
   ```

3. **Show recent log activity** (last 20 lines):
   ```powershell
   Get-Content -Tail 20 .prizmkit/state/daemon/refactor-daemon.log
   ```

4. **Summarize** to user: total refactors, completed, in-progress, failed, pending.

---

#### Intent C: Stop Pipeline

1. **Stop the daemon**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-refactor-daemon.ps1 stop
   ```

2. **Verify stopped**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-refactor-daemon.ps1 status
   ```

3. **Inform user**: "Refactor pipeline stopped. State is preserved -- you can resume later with 'start refactoring' and it will pick up where it left off."

---

#### Intent D: Show Logs

1. **Check if running**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-refactor-daemon.ps1 status
   ```

2. **If running** -- Start live tail with PowerShell terminal `run_in_background: true`:
   ```powershell
   Get-Content -Wait -Tail 50 .prizmkit/state/daemon/refactor-daemon.log
   ```

3. **If not running** -- Show last 50 lines:
   ```powershell
   Get-Content -Tail 50 .prizmkit/state/daemon/refactor-daemon.log
   ```

4. **For per-refactor session logs** (when user asks about a specific refactor):
   ```powershell
   # Check refactor status for last session ID
   Get-Content .prizmkit/state/refactor/refactors/<REFACTOR_ID>/status.json -ErrorAction SilentlyContinue
   # Then tail that refactor's session log
   Get-Content -Tail 100 .prizmkit/state/refactor/refactors/<REFACTOR_ID>/sessions/<SESSION_ID>/logs/session.log
   ```

---

#### Intent E: Retry Single Refactor

When user says "retry R-001" or "clean retry R-001":

```powershell
.\.prizmkit\dev-pipeline\reset-refactor.ps1 R-001 --clean --run .prizmkit/plans/refactor-list.json
```

Notes:
- `reset-refactor.ps1 R-001 --clean --run` performs a clean reset for `R-001` before retrying that refactor — this gives a fresh start.
- Keep pipeline daemon mode for main run management (`launch-refactor-daemon.ps1`).

---

### Error Handling

| Error | Action |
|-------|--------|
| `.prizmkit/plans/refactor-list.json` not found | Tell user to run `refactor-planner` skill first |
| Circular dependencies in refactor list | Fix dependency graph in `.prizmkit/plans/refactor-list.json` before launching |
| Test baseline failing | Fix failing tests before starting refactoring -- behavior preservation requires a green baseline |
| JSON parsing failed | Use the bundled Python validation/status scripts instead of external JSON tools |
| AI CLI not in PATH | Check Codex (`codex`), Claude (`claude`), or CodeBuddy (`cbc`) installation |
| Refactor pipeline already running | Show status, ask if user wants to stop and restart |
| PID file stale (process dead) | `launch-refactor-daemon.ps1` auto-cleans, retry start |
| Launch failed (process died immediately) | Show last 20 lines of log: `Get-Content -Tail 20 .prizmkit/state/daemon/refactor-daemon.log` |
| Refactor stuck/blocked | Use `reset-refactor.ps1 <R-XXX> --clean --run` for a fresh retry |
| All refactors blocked/failed | Show status, suggest recovery: `.\.prizmkit\dev-pipeline\reset-refactor.ps1 <R-XXX> --clean --run .prizmkit/plans/refactor-list.json` |
| `playwright-cli` not installed | Browser verification skipped for playwright refactors (non-blocking). Suggest: `npm install -g @playwright/cli@latest; playwright-cli install --skills` |
| `opencli` not installed | Browser verification skipped for opencli refactors (non-blocking). Install opencli for Chrome session-based browser verification |
| PowerShell execution policy blocks script | Run `Set-ExecutionPolicy -Scope Process Bypass` for the current terminal |

### Integration Notes

- **After refactor-planner**: This is the natural next step. When user finishes refactor planning and has `.prizmkit/plans/refactor-list.json`, suggest launching the refactor pipeline.
- **Session independence**: The pipeline runs completely detached. User can close the AI CLI session, open a new session later, and use this skill to check progress or stop the pipeline.
- **Single instance**: Only one refactor pipeline can run at a time. The PID file prevents duplicates.
- **Pipeline coexistence**: Refactor pipeline uses `.prizmkit/state/refactor/` separate from `.prizmkit/state/features/` (features) and `.prizmkit/state/bugfix/` (bugs), so all three pipelines can run simultaneously without conflict.
- **State preservation**: Stopping and restarting the pipeline resumes from where it left off -- completed refactors are not re-run.
- **HANDOFF**: After pipeline completes all refactors, each session has already run `prizmkit-retrospective` internally. Ask user what's next.
