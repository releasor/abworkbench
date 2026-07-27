#!/usr/bin/env python3
"""
detect-recovery-state.py — Universal workflow recovery detector.

Auto-detects which interactive workflow (feature-workflow, bug-fix-workflow,
refactor-workflow) was interrupted and what phase it reached, by inspecting
the workspace: git branch names, characteristic artifacts, and pipeline state.

Does NOT run tests — that's left to the skill so the user sees output in real time.

Usage:
  python3 detect-recovery-state.py [--project-root .]
"""

import argparse
import json
import os
import re
import subprocess
import sys


# ---------------------------------------------------------------------------
# Git helper
# ---------------------------------------------------------------------------

def run_git(args, cwd=None):
    """Run a git command and return stdout, or empty string on failure."""
    try:
        result = subprocess.run(
            ["git"] + args,
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=10,
        )
        return result.stdout.strip()
    except (subprocess.SubprocessError, FileNotFoundError):
        return ""


def detect_main_branch(project_root):
    """Detect the default branch name (main or master)."""
    for candidate in ["main", "master"]:
        check = run_git(["rev-parse", "--verify", candidate], cwd=project_root)
        if check:
            return candidate
    return "main"


# ---------------------------------------------------------------------------
# Workflow signature detection (priority-ordered)
# ---------------------------------------------------------------------------

def extract_bug_id_from_branch(branch):
    """Extract bug ID from branch name like fix/B-001-login-crash → B-001."""
    match = re.match(r"fix/(B-\d+)", branch)
    return match.group(1) if match else None


def detect_workflow_type(project_root):
    """Priority-ordered signature matching.

    Returns (workflow_type, context_dict) or (None, None).
    """
    branch = run_git(["branch", "--show-current"], cwd=project_root)

    # Priority 1: fix/* branch → bug-fix-workflow
    if branch.startswith("fix/"):
        bug_id = extract_bug_id_from_branch(branch)
        return ("bug-fix-workflow", {"bug_id": bug_id, "branch": branch})

    # Priority 2: .prizmkit/bugfix/ has content → bug-fix-workflow
    bugfix_dir = os.path.join(project_root, ".prizmkit", "bugfix")
    if os.path.isdir(bugfix_dir):
        bug_ids = sorted(
            d for d in os.listdir(bugfix_dir)
            if os.path.isdir(os.path.join(bugfix_dir, d))
        )
        if bug_ids:
            return ("bug-fix-workflow", {"bug_id": bug_ids[-1], "branch": branch})

    # Priority 3: refactor/* branch → refactor-workflow
    if branch.startswith("refactor/"):
        return ("refactor-workflow", {"branch": branch})

    # Priority 4: refactor-list.json exists → refactor-workflow
    # Check both new and old paths for backward compatibility
    new_refactor = os.path.join(project_root, ".prizmkit", "plans", "refactor-list.json")
    old_refactor = os.path.join(project_root, "refactor-list.json")
    if os.path.isfile(new_refactor):
        return ("refactor-workflow", {"branch": branch})
    elif os.path.isfile(old_refactor):
        print(f"⚠️  Migration notice: refactor-list.json found in root. "
              f"Please move to .prizmkit/plans/refactor-list.json", file=sys.stderr)
        return ("refactor-workflow", {"branch": branch})

    # Priority 5: feat/* branch → feature-workflow
    if branch.startswith("feat/"):
        return ("feature-workflow", {"branch": branch})

    # Priority 6: feature-list.json exists → feature-workflow
    # Check both new and old paths for backward compatibility
    new_feature = os.path.join(project_root, ".prizmkit", "plans", "feature-list.json")
    old_feature = os.path.join(project_root, "feature-list.json")
    if os.path.isfile(new_feature):
        return ("feature-workflow", {"branch": branch})
    elif os.path.isfile(old_feature):
        print(f"⚠️  Migration notice: feature-list.json found in root. "
              f"Please move to .prizmkit/plans/feature-list.json", file=sys.stderr)
        return ("feature-workflow", {"branch": branch})

    # No match
    return (None, None)


def detect_other_workflows(project_root, primary_type):
    """Scan for other interrupted workflow signals beyond the primary match.

    Returns a list of workflow type strings that also have signals present,
    excluding the primary_type already detected.
    """
    others = []
    branch = run_git(["branch", "--show-current"], cwd=project_root)

    # Bug-fix signals
    if primary_type != "bug-fix-workflow":
        if branch.startswith("fix/"):
            others.append("bug-fix-workflow")
        else:
            bugfix_dir = os.path.join(project_root, ".prizmkit", "bugfix")
            if os.path.isdir(bugfix_dir):
                bug_ids = [
                    d for d in os.listdir(bugfix_dir)
                    if os.path.isdir(os.path.join(bugfix_dir, d))
                ]
                if bug_ids:
                    others.append("bug-fix-workflow")

    # Refactor signals
    if primary_type != "refactor-workflow":
        if branch.startswith("refactor/"):
            others.append("refactor-workflow")
        else:
            for path in [
                os.path.join(project_root, ".prizmkit", "plans", "refactor-list.json"),
                os.path.join(project_root, "refactor-list.json"),
            ]:
                if os.path.isfile(path):
                    others.append("refactor-workflow")
                    break

    # Feature signals
    if primary_type != "feature-workflow":
        if branch.startswith("feat/"):
            others.append("feature-workflow")
        else:
            for path in [
                os.path.join(project_root, ".prizmkit", "plans", "feature-list.json"),
                os.path.join(project_root, "feature-list.json"),
            ]:
                if os.path.isfile(path):
                    others.append("feature-workflow")
                    break

    return others


# ---------------------------------------------------------------------------
# Phase inference — one function per workflow
# ---------------------------------------------------------------------------

def infer_bugfix_phase(project_root, bug_id, code_changes, commits_ahead):
    """Infer bug-fix-workflow phase from artifacts and git state.

    Detection table (from bug-fix-workflow SKILL.md):
      (nothing)                              → Phase 1: Deep Bug Diagnosis
      fix-plan.md only                       → Phase 4: Fix
      fix-plan.md + code changes             → Phase 5: Review
      all docs + review passed               → Phase 6: User Verification
      all docs + committed                   → Phase 7: Merge Decision
    """
    bugfix_dir = os.path.join(project_root, ".prizmkit", "bugfix", bug_id) if bug_id else ""
    has_fix_plan = bugfix_dir and os.path.isfile(os.path.join(bugfix_dir, "fix-plan.md"))
    has_fix_report = bugfix_dir and os.path.isfile(os.path.join(bugfix_dir, "fix-report.md"))

    artifacts = {
        "fix_plan_exists": has_fix_plan,
        "fix_report_exists": has_fix_report,
    }
    if has_fix_plan:
        artifacts["fix_plan_path"] = os.path.relpath(
            os.path.join(bugfix_dir, "fix-plan.md"), project_root
        )
    if has_fix_report:
        artifacts["fix_report_path"] = os.path.relpath(
            os.path.join(bugfix_dir, "fix-report.md"), project_root
        )

    if commits_ahead > 0:
        return 7, "Merge Decision", artifacts, \
            f"{commits_ahead} commit(s) ahead — fix likely committed", \
            "merge decision only"

    if has_fix_report:
        return 6, "User Verification", artifacts, \
            "fix-report.md exists — review completed", \
            "user verification → commit & merge"

    if has_fix_plan and code_changes["has_changes"]:
        return 5, "Review", artifacts, \
            "fix-plan.md exists + code changes present", \
            "code review → user verification → commit & merge"

    if has_fix_plan:
        return 4, "Fix", artifacts, \
            "fix-plan.md exists, no code changes yet", \
            "implement fix → review → user verification → commit & merge"

    # On fix branch but no artifacts
    return 1, "Deep Bug Diagnosis", artifacts, \
        "on fix branch but no artifacts found", \
        "diagnosis → triage → reproduce → fix → review → commit & merge"


def _infer_pipeline_workflow_phase(project_root, list_filename, state_subdir, workflow_label):
    """Infer phase for pipeline-driven workflows (feature-workflow, refactor-workflow).

    Both follow the same structure:
      No list file                → Phase 1: Brainstorm
      List file, no pipeline state → Phase 3: Launch
      List file + pipeline state   → Phase 4: Monitor

    Checks new path (.prizmkit/plans/<list_filename>) first, then falls back
    to old root-level path with a migration warning.
    """
    # Check new path first, then old path with fallback warning
    new_list_path = os.path.join(project_root, ".prizmkit", "plans", list_filename)
    old_list_path = os.path.join(project_root, list_filename)
    has_list = os.path.isfile(new_list_path)
    if not has_list and os.path.isfile(old_list_path):
        has_list = True
        print(f"⚠️  Migration notice: {list_filename} found in root. "
              f"Please move to .prizmkit/plans/{list_filename}", file=sys.stderr)

    # Check new state path first, then old path with fallback warning
    new_state_dir = os.path.join(project_root, ".prizmkit", "state", state_subdir)
    old_state_dir = os.path.join(project_root, "dev-pipeline", "state", state_subdir)
    has_pipeline_state = os.path.isdir(new_state_dir) and bool(os.listdir(new_state_dir))
    if not has_pipeline_state and os.path.isdir(old_state_dir) and bool(os.listdir(old_state_dir)):
        has_pipeline_state = True
        print(f"⚠️  Migration notice: pipeline state found at dev-pipeline/state/{state_subdir}. "
              f"Please move to .prizmkit/state/{state_subdir}", file=sys.stderr)

    artifacts = {
        f"{workflow_label}_list_exists": has_list,
        "pipeline_state_exists": has_pipeline_state,
    }

    if has_list and has_pipeline_state:
        return 4, "Monitor", artifacts, \
            f".prizmkit/plans/{list_filename} + pipeline state exist", \
            "check pipeline status and report results"

    if has_list:
        return 3, "Launch", artifacts, \
            f".prizmkit/plans/{list_filename} exists, no pipeline state", \
            "launch pipeline → monitor progress"

    return 1, "Brainstorm", artifacts, \
        f"no .prizmkit/plans/{list_filename} found", \
        f"{workflow_label} goal clarification → plan → launch → monitor"


def infer_feature_phase(project_root):
    """Infer feature-workflow phase from artifacts and pipeline state."""
    return _infer_pipeline_workflow_phase(
        project_root, "feature-list.json", "features", "feature"
    )


def infer_refactor_phase(project_root):
    """Infer refactor-workflow phase from artifacts and pipeline state."""
    return _infer_pipeline_workflow_phase(
        project_root, "refactor-list.json", "refactor", "refactor"
    )


# ---------------------------------------------------------------------------
# Git state helpers
# ---------------------------------------------------------------------------

def detect_commits_ahead(project_root, main_branch="main"):
    """Count commits ahead of main branch."""
    log_output = run_git(
        ["log", f"{main_branch}..HEAD", "--oneline"], cwd=project_root
    )
    if log_output:
        return len(log_output.strip().split("\n"))
    return 0


def detect_git_state(project_root, main_branch="main", cached_branch=None):
    """Detect git branch and change state."""
    current = cached_branch or run_git(["branch", "--show-current"], cwd=project_root)

    # Uncommitted changes (working tree)
    uncommitted = 0
    diff_stat = run_git(["diff", "--stat"], cwd=project_root)
    if diff_stat:
        lines = diff_stat.strip().split("\n")
        uncommitted = max(0, len(lines) - 1)

    # Staged changes
    staged = 0
    staged_stat = run_git(["diff", "--cached", "--stat"], cwd=project_root)
    if staged_stat:
        lines = staged_stat.strip().split("\n")
        staged = max(0, len(lines) - 1)

    commits_ahead = detect_commits_ahead(project_root, main_branch)

    return {
        "current_branch": current,
        "uncommitted_files": uncommitted,
        "staged_files": staged,
        "commits_ahead_of_main": commits_ahead,
    }


# ---------------------------------------------------------------------------
# Code change detection (reused from original, workflow-agnostic)
# ---------------------------------------------------------------------------

def detect_code_changes(project_root, main_branch="main"):
    """Analyze code changes relative to main branch.

    Filters out pipeline/config files that aren't source code — only counts
    files that represent actual implementation work.

    Uses a file_statuses dict keyed by filepath to avoid double-counting
    files that appear in both committed diff and uncommitted changes.
    """
    IGNORED_FILES = {
        # Basename-matched list files (root-level legacy paths)
        "feature-list.json",
        "bug-fix-list.json",
        "refactor-list.json",
        # Lock files
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
    }
    # Note: .prizmkit/plans/*.json paths are caught by IGNORED_PREFIXES below
    IGNORED_PREFIXES = (
        ".prizmkit/",
        ".agents/",
        ".codex/",
        ".claude/",
        ".codebuddy/",
    )

    def is_source_file(filepath):
        """Return True if this file represents implementation code."""
        basename = os.path.basename(filepath)
        if basename in IGNORED_FILES:
            return False
        for prefix in IGNORED_PREFIXES:
            if filepath.startswith(prefix):
                return False
        return True

    # Track unique file → status to avoid double-counting.
    # Later sources (uncommitted, untracked) update the status if the file
    # was already seen in a committed diff.
    file_statuses = {}  # filepath → "M" | "A" | "D"

    # Diff relative to main (committed changes on branch)
    diff_output = run_git(
        ["diff", main_branch, "--name-status"], cwd=project_root
    )

    if diff_output:
        for line in diff_output.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split("\t", 1)
            if len(parts) < 2:
                continue
            status, filepath = parts[0][0], parts[1]  # first char of status
            if not is_source_file(filepath):
                continue
            file_statuses[filepath] = status

    # Uncommitted working tree changes — update status for already-seen files
    uncommitted = run_git(["diff", "--name-status"], cwd=project_root)
    if uncommitted:
        for line in uncommitted.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split("\t", 1)
            if len(parts) < 2:
                continue
            status, filepath = parts[0][0], parts[1]
            if not is_source_file(filepath):
                continue
            if filepath not in file_statuses:
                file_statuses[filepath] = "M"  # uncommitted change = modified
            # If already tracked from branch diff, keep the branch-level status

    # Untracked files
    untracked = run_git(
        ["ls-files", "--others", "--exclude-standard"], cwd=project_root
    )
    if untracked:
        for filepath in untracked.strip().split("\n"):
            filepath = filepath.strip()
            if filepath and is_source_file(filepath):
                if filepath not in file_statuses:
                    file_statuses[filepath] = "A"  # untracked = added

    # Count by status
    result = {
        "files_modified": 0,
        "files_added": 0,
        "files_deleted": 0,
        "test_files_touched": 0,
        "directories_touched": [],
        "has_changes": False,
    }

    test_patterns = re.compile(
        r"(test|spec|__tests__|\.test\.|\.spec\.)", re.IGNORECASE
    )
    dirs = set()

    for filepath, status in file_statuses.items():
        if status == "M":
            result["files_modified"] += 1
        elif status == "A":
            result["files_added"] += 1
        elif status == "D":
            result["files_deleted"] += 1

        if test_patterns.search(filepath):
            result["test_files_touched"] += 1
        parent = os.path.dirname(filepath)
        if parent:
            parts = parent.split(os.sep)
            dirs.add(os.sep.join(parts[:2]) + "/")

    result["directories_touched"] = sorted(dirs)
    result["has_changes"] = len(file_statuses) > 0

    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Auto-detect interrupted workflow state for recovery"
    )
    parser.add_argument(
        "--project-root",
        default=None,
        help="Project root directory (default: auto-detect from git)",
    )

    args = parser.parse_args()

    # Resolve project root
    if args.project_root:
        project_root = os.path.abspath(args.project_root)
    else:
        git_root = run_git(["rev-parse", "--show-toplevel"])
        project_root = git_root if git_root else os.getcwd()

    main_branch = detect_main_branch(project_root)

    # Step 1: Detect workflow type (also caches branch name)
    workflow_type, context = detect_workflow_type(project_root)

    if workflow_type is None:
        report = {
            "detected": False,
            "message": (
                "No interrupted workflow detected. "
                "Use /feature-workflow, /bug-fix-workflow, or /refactor-workflow to start."
            ),
        }
        print(json.dumps(report, indent=2))
        sys.exit(0)

    # Check for other interrupted workflows (informational)
    other_workflows = detect_other_workflows(project_root, workflow_type)

    # Step 2: Collect git state and code changes once (shared across phase inference + report)
    cached_branch = context.get("branch")
    git_state = detect_git_state(project_root, main_branch, cached_branch=cached_branch)
    code_changes = detect_code_changes(project_root, main_branch)

    # Step 3: Infer phase within the detected workflow
    if workflow_type == "bug-fix-workflow":
        phase, phase_name, artifacts, reason, remaining = \
            infer_bugfix_phase(project_root, context.get("bug_id"),
                               code_changes, git_state["commits_ahead_of_main"])
    elif workflow_type == "feature-workflow":
        phase, phase_name, artifacts, reason, remaining = \
            infer_feature_phase(project_root)
    elif workflow_type == "refactor-workflow":
        phase, phase_name, artifacts, reason, remaining = \
            infer_refactor_phase(project_root)
    else:
        # Should never reach here
        print(json.dumps({"detected": False, "message": "Unknown workflow type"}), file=sys.stderr)
        sys.exit(1)

    # Step 4: Build report
    report = {
        "detected": True,
        "workflow_type": workflow_type,
        "phase": phase,
        "phase_name": phase_name,
        "context": context,
        "artifacts": artifacts,
        "git": git_state,
        "code": code_changes,
        "recovery": {
            "reason": reason,
            "remaining_work": remaining,
        },
    }

    if other_workflows:
        report["other_interrupted_workflows"] = other_workflows

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
