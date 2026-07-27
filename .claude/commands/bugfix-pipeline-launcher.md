---
description: "Launch and manage the bugfix pipeline from within an AI CLI session. Start pipeline in background, monitor logs, check status, stop pipeline. Use this skill whenever the user wants to start fixing bugs, run the bugfix pipeline, check bugfix progress, or stop the bugfix pipeline. Trigger on: 'start fixing bugs', 'run bugfix pipeline', 'bugfix status', 'stop bug fix', 'launch bug fix', 'fix progress', 'stop fixing'. (project)"
---

# Bugfix-Pipeline Launcher

Launch the autonomous bug fix pipeline from within an AI CLI conversation. Supports foreground and background execution modes.

### Execution Mode

Three execution modes are available. The user chooses one before configuring other options:

1. **Foreground** (recommended) — `.\.prizmkit\dev-pipeline\run-bugfix.ps1 run`. Visible output, direct error feedback, no orphaned processes.
2. **Background daemon** — `.\.prizmkit\dev-pipeline\launch-bugfix-daemon.ps1`. Runs fully detached, survives AI CLI session closure.
3. **Manual** — Display the assembled command(s) only. Do not execute anything. User runs them on their own.

**Background mode documentation**: When the user chooses background/daemon mode, record the choice and PID in `.prizmkit/bugfix-pipeline-run.log` (append-only) with timestamp, so the decision is traceable:
```
[2026-03-26T10:30:00] MODE=daemon PID=12345 BUG_LIST=.prizmkit/plans/bug-fix-list.json BUGS=3
```

### When to Use

**Start bugfix pipeline** -- User says:
- "start fixing bugs", "run bugfix pipeline", "launch bug fixes", "fix all bugs"
- "start bug fix", "execute bug list", "begin fixing", "batch fix"
- After bug-planner completes: "fix them", "start fixing"

**Check status** -- User says:
- "bugfix status", "check bug fixes", "how's the fixing going", "bug fix progress"
- "fix progress", "bug fix status", "check fix progress", "how far along are the fixes"

**Stop bugfix pipeline** -- User says:
- "stop bug fix", "stop fixing", "halt bugfix", "pause bug fix", "stop fix pipeline"

**Show logs** -- User says:
- "bugfix logs", "show fix logs", "what's being fixed"
- "view fix logs", "fix logs"

**Do NOT use this skill when:**
- User wants to plan/collect bugs (use `bug-planner` instead)
- User wants to fix a single bug interactively in current session (use `bug-fix-workflow`)
- User wants to launch the feature pipeline (use `feature-pipeline-launcher`)

### Prerequisites

Before any action, validate:

1. **bugfix pipeline exists**: Confirm `.\.prizmkit\dev-pipeline\launch-bugfix-daemon.ps1` and `.\.prizmkit\dev-pipeline\run-bugfix.ps1` are present and executable
2. **For start**: `.prizmkit/plans/bug-fix-list.json` must exist in `.prizmkit/plans/` (or user-specified path)
3. **Dependencies**: `python` or the Windows `py` launcher, `git`, and one AI CLI (`codex`, `claude`, or `cbc`) must be in PATH
4. **Browser tools** (optional): If any bug has `browser_interaction` field, check the corresponding tool is available. Bugs may specify `tool: "playwright-cli"`, `tool: "opencli"`, or `tool: "auto"` (AI chooses at runtime).

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
# Optional: browser interaction support (check both tools — bugs may use either)
if (Get-Command playwright-cli -ErrorAction SilentlyContinue) { "playwright-cli OK" } else { "playwright-cli not found (playwright browser verification will be skipped)" }
if (Get-Command opencli -ErrorAction SilentlyContinue) { "opencli OK" } else { "opencli not found (opencli browser verification will be skipped)" }
```

If `.prizmkit/plans/bug-fix-list.json` is missing, inform user:
> "No .prizmkit/plans/bug-fix-list.json found. Run the `bug-planner` skill first to generate one, or provide a path to your bug fix list."

### Workflow

Detect user intent from their message, then follow the corresponding workflow:

---

#### Intent A: Start Bugfix Pipeline

> **Execution model**: The pipeline processes bugs **sequentially** (one at a time, in severity/priority order). The `dependencies` field in bug-fix-list.json is reserved for future parallel execution support and does NOT affect current execution order.

1. **Check prerequisites**:
   ```powershell
   if (Test-Path .prizmkit/plans/bug-fix-list.json) { "Found" } else { "Missing" }
   ```

2. **Check not already running**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-bugfix-daemon.ps1 status
   ```
   If running, inform user and ask: "Bugfix pipeline is already running. Want to restart it, check status, or view logs?"

3. **Show bug summary** (so user knows what will be fixed):
   ```powershell
   $data = Get-Content .prizmkit\plans\bug-fix-list.json -Raw | ConvertFrom-Json
   $bugs = @($data.bugs)
   $severityOrder = @{ critical = 0; high = 1; medium = 2; low = 3 }
   "Total bugs: $($bugs.Count)"
   $bugs | Group-Object severity | ForEach-Object { "  $($_.Name): $($_.Count)" }
   ""
   $bugsSorted = $bugs | Sort-Object `
     @{ Expression = { if ($severityOrder.ContainsKey($_.severity)) { $severityOrder[$_.severity] } else { 2 } } }, `
     @{ Expression = { if ($_.priority) { [int]$_.priority } else { 99 } } }
   foreach ($bug in $bugsSorted) {
     $severity = if ($bug.severity) { $bug.severity.ToUpperInvariant() } else { "?" }
     $title = if ($bug.title) { $bug.title } else { "untitled" }
     "  $($bug.id): [$severity] $title"
   }
   ```
   If pipeline state already exists, use the status command instead:
   ```powershell
   Invoke-PrizmPython .prizmkit/dev-pipeline/scripts/update-bug-status.py `
     --bug-list .prizmkit/plans/bug-fix-list.json `
     --state-dir .prizmkit/state/bugfix `
     --action status
   ```

4. **Ask execution mode** (first user decision — SEPARATE `AskUserQuestion` call):

   ⛔ **This MUST be its own standalone `AskUserQuestion` call.** Do NOT combine execution mode with step 5 config questions. The execution mode question is asked ALONE, user responds, THEN you proceed to step 5.

   Use `AskUserQuestion` with exactly 1 question:

   **Question 1 — Execution mode** (multiSelect: false):
   - Foreground (Recommended) — pipeline runs in the current session via `run-bugfix.ps1 run`. Visible output and direct error feedback.
   - Background daemon — pipeline runs fully detached via `launch-bugfix-daemon.ps1`. Survives AI CLI session closure.
   - Manual — display the final assembled commands only. Do not execute anything. User runs them on their own.

   ⚠️ STOP HERE and wait for user response before continuing to step 5.

5. **Ask configuration options** ⚠️ MANDATORY INTERACTIVE STEP — applies to ALL execution modes (Foreground, Background, AND Manual). This is a SEPARATE `AskUserQuestion` call from step 4. You MUST ask the user to configure options and WAIT for their response BEFORE proceeding to step 6.

   ⛔ **HARD STOP**: You MUST call `AskUserQuestion` with the 4 questions below and WAIT for the user's response. You MUST NOT:
   - Combine step 4 and step 5 into one `AskUserQuestion` call (this is the most common violation — execution mode MUST be asked separately in step 4)
   - Skip this step and jump to the next step
   - Merge this step and the next step into one response
   - Assume default values and show the command without asking
   - Show the command as text and ask "ready?" without presenting the options
   If you find yourself writing the final command before the user has answered these 4 questions, STOP — you are violating this rule.

   Use `AskUserQuestion` to present ALL 4 configuration choices (the full 4-question budget goes to config, NOT shared with execution mode):

   **Question 1 — Verbose logging** (multiSelect: false):
   - On (default) — Detailed AI session logs including tool calls and subagent activity
   - Off — Minimal logging

   **Question 2 — Max retries** (multiSelect: false):
   - 3 (default)
   - 1
   - 5

   **Question 3 — Critic review** (multiSelect: false):
   - Off (default) — Skip adversarial review
   - On — Enable adversarial critic review: an independent AI agent reviews the diagnosis/plan for completeness and the fix for defects, edge cases, and regression risks. Adds ~5-10 min per bug.

   **Question 4 — Advanced config?** (multiSelect: false):
   - No (default) — Use defaults for session timeout and failure behavior
   - Yes — Configure session timeout and stop-on-failure options

   Note: Bug filter defaults to all bugs (by severity order). Default Critic to Off unless bugs have `severity: "critical"` or `severity: "high"` (in which case default to On). If the user selects "Other" on any option, handle their custom input.

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
   | Verbose: Off | `VERBOSE=0` |
   | Verbose: On | `VERBOSE=1` |
   | Max retries: N | `MAX_RETRIES=N` |
   | Critic: On | `ENABLE_CRITIC=true` |
   | Timeout: value | `SESSION_TIMEOUT=<seconds>` |
   | Stop on failure: On | `STOP_ON_FAILURE=1` |

   **Advanced environment variables** (not exposed in interactive menu, pass via `--env`):

   | Variable | Default | Purpose |
   |----------|---------|---------|
   | `MODEL` | (none) | AI model override (e.g. `claude-opus-4.6`) |

   ⚠️ STOP HERE and wait for user response before continuing to step 6.

6. **Show final command**: Assemble the complete command from execution mode + confirmed configuration, and present it to the user.

   **Foreground command:**
   ```powershell
   $env:VERBOSE = "1"; .\.prizmkit\dev-pipeline\run-bugfix.ps1 run .prizmkit/plans/bug-fix-list.json
   ```
   With all options:
   ```powershell
   $env:VERBOSE = "1"; $env:MAX_RETRIES = "5"; $env:SESSION_TIMEOUT = "3600"
   .\.prizmkit\dev-pipeline\run-bugfix.ps1 run .prizmkit/plans/bug-fix-list.json
   ```

   **Background daemon command:**
   ```powershell
   .\.prizmkit\dev-pipeline\launch-bugfix-daemon.ps1 start .prizmkit/plans/bug-fix-list.json --env "VERBOSE=1"
   ```
   With all options:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-bugfix-daemon.ps1 start .prizmkit/plans/bug-fix-list.json `
     --env "VERBOSE=1 MAX_RETRIES=5"
   ```

   **Manual mode**: Print the assembled command(s) and **stop here**. Do not execute anything. Do not proceed to step 7.
   ```
   # To run in foreground:
   $env:VERBOSE = "1"; .\.prizmkit\dev-pipeline\run-bugfix.ps1 run .prizmkit/plans/bug-fix-list.json

   # To run in background (detached):
   .\.prizmkit\dev-pipeline\launch-bugfix-daemon.ps1 start .prizmkit/plans/bug-fix-list.json --env "VERBOSE=1"

   # To check status:
   .\.prizmkit\dev-pipeline\run-bugfix.ps1 status .prizmkit/plans/bug-fix-list.json
   ```

7. **Confirm and launch** (Foreground and Background only — Manual mode ends at step 6):

   Ask: "Ready to launch the bugfix pipeline with the above command?"

   After user confirms, execute the command from step 6.

8. **Post-launch** (depends on execution mode):

   **If foreground**: Pipeline runs to completion in the terminal. After it finishes:
   - Summarize results: total bugs, fixed, failed, skipped
   - If all fixed: each bug session has already run `prizmkit-retrospective` internally (structural sync by default; full retrospective when the fix changed interfaces, dependencies, or observable behavior). Ask user what's next.
   - If some failed: show failed bug IDs and suggest `.\.prizmkit\dev-pipeline\reset-bug.ps1 <B-XXX> --clean --run` for a fresh retry

   **If background daemon**:
   1. Verify launch:
      ```powershell
      .\.prizmkit\dev-pipeline\launch-bugfix-daemon.ps1 status
      ```
   2. Start log monitoring — Use the PowerShell terminal with `run_in_background: true`:
      ```powershell
      Get-Content -Wait -Tail 50 .prizmkit/state/daemon/bugfix-daemon.log
      ```
   3. Report to user:
      - Pipeline PID
      - Log file location
      - "You can ask me 'bugfix status' or 'show fix logs' at any time"
      - "Closing this session will NOT stop the pipeline"

---

#### Intent B: Check Status

1. **Check daemon status**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-bugfix-daemon.ps1 status
   ```

2. **Show bug-level progress**:
   ```powershell
   Invoke-PrizmPython .prizmkit/dev-pipeline/scripts/update-bug-status.py `
     --bug-list .prizmkit/plans/bug-fix-list.json `
     --state-dir .prizmkit/state/bugfix `
     --action status
   ```

3. **Show recent log activity** (last 20 lines):
   ```powershell
   Get-Content -Tail 20 .prizmkit/state/daemon/bugfix-daemon.log
   ```

4. **Summarize** to user: total bugs, completed, in-progress, failed, pending, needs-info.

---

#### Intent C: Stop Bugfix Pipeline

1. **Stop the daemon**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-bugfix-daemon.ps1 stop
   ```

2. **Verify stopped**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-bugfix-daemon.ps1 status
   ```

3. **Inform user**: "Bugfix pipeline stopped. State is preserved -- you can resume later with 'start bug fix' and it will pick up where it left off."

---

#### Intent D: Show Logs

1. **Check if running**:
   ```powershell
   .\.prizmkit\dev-pipeline\launch-bugfix-daemon.ps1 status
   ```

2. **If running** -- Start live tail with PowerShell terminal `run_in_background: true`:
   ```powershell
   Get-Content -Wait -Tail 50 .prizmkit/state/daemon/bugfix-daemon.log
   ```

3. **If not running** -- Show last 50 lines:
   ```powershell
   Get-Content -Tail 50 .prizmkit/state/daemon/bugfix-daemon.log
   ```

4. **For per-bug session logs** (when user asks about a specific bug):
   ```powershell
   # Check bug status for last session ID
   Get-Content .prizmkit/state/bugfix/bugs/<BUG_ID>/status.json -ErrorAction SilentlyContinue
   # Then tail that bug's session log
   Get-Content -Tail 100 .prizmkit/state/bugfix/bugs/<BUG_ID>/sessions/<SESSION_ID>/logs/session.log
   ```

---

#### Intent E: Retry Single Bug

When user says "retry B-001":

```powershell
.\.prizmkit\dev-pipeline\reset-bug.ps1 B-001 --clean --run .prizmkit/plans/bug-fix-list.json
```

**Note:** `reset-bug.ps1 B-001 --clean --run` performs a clean reset for `B-001` before retrying that bug — this gives a fresh start.

### Error Handling

| Error | Action |
|-------|--------|
| `.prizmkit/plans/bug-fix-list.json` not found | Tell user to run `bug-planner` skill first |
| JSON parsing failed | Use the bundled Python validation/status scripts instead of external JSON tools |
| AI CLI not in PATH | Check Codex (`codex`), Claude (`claude`), or CodeBuddy (`cbc`) installation |
| Bugfix pipeline already running | Show status, ask if user wants to stop and restart |
| PID file stale (process dead) | `launch-bugfix-daemon.ps1` auto-cleans, retry start |
| Launch failed (process died immediately) | Show last 20 lines of log: `Get-Content -Tail 20 .prizmkit/state/daemon/bugfix-daemon.log` |
| All bugs blocked/failed/needs-info | Show status, suggest retrying or providing more info |
| `playwright-cli` not installed | Browser verification skipped for playwright bugs (non-blocking). Suggest: `npm install -g @playwright/cli@latest; playwright-cli install --skills` |
| `opencli` not installed | Browser verification skipped for opencli bugs (non-blocking). Install opencli for Chrome session-based browser verification |
| PowerShell execution policy blocks script | Run `Set-ExecutionPolicy -Scope Process Bypass` for the current terminal |

### Integration Notes

- **After bug-planner**: This is the natural next step. When user finishes bug planning and has `.prizmkit/plans/bug-fix-list.json`, suggest launching the bugfix pipeline.
- **Session independence**: In daemon mode, the bugfix pipeline runs completely detached. User can close the AI CLI, open a new session later, and use this skill to check progress or stop the pipeline.
- **Single instance**: Only one bugfix pipeline can run at a time. The PID file prevents duplicates.
- **Feature pipeline coexistence**: Bugfix and feature pipelines use separate state directories (`.prizmkit/state/bugfix/` vs `.prizmkit/state/features/`), so they can run simultaneously without conflict.
- **State preservation**: Stopping and restarting the bugfix pipeline resumes from where it left off -- completed bugs are not re-fixed.
- **Bug ordering**: Bugs are processed by severity (critical → high → medium → low), then by priority number within the same severity.
- **Background mode traceability**: When daemon mode is chosen, the decision is logged to `.prizmkit/bugfix-pipeline-run.log` with timestamp, PID, and bug count for auditability.
- **HANDOFF**: After pipeline completes all bugs, suggest running `prizmkit-retrospective` to capture lessons learned, or checking the fix reports in `.prizmkit/bugfix/`.
