#!/usr/bin/env python3
"""
validate-and-generate.py - Validate and generate feature-list.json files
for the dev-pipeline system.

Commands:
  validate    Validate an existing .prizmkit/plans/feature-list.json
  template    Generate a blank template .prizmkit/plans/feature-list.json
  generate    Validate a draft JSON and generate final feature-list.json with defaults
  summary     Print a summary table of features from a .prizmkit/plans/feature-list.json
  grade       Generate grading results from eval runs (for npm run skill:review)

Usage:
  python3 validate-and-generate.py validate --input .prizmkit/plans/feature-list.json [--output validated.json] [--mode new|incremental]
  python3 validate-and-generate.py template --output .prizmkit/plans/feature-list.json
  python3 validate-and-generate.py generate --input draft.json --output .prizmkit/plans/feature-list.json [--mode new|incremental]
  python3 validate-and-generate.py summary --input .prizmkit/plans/feature-list.json [--format markdown|json]
  python3 validate-and-generate.py grade --workspace /.codebuddy/skill-evals/feature-planner-workspace --iteration iteration-1

Python 3.6+ required. No external dependencies.
"""

import argparse
import collections
import json
import os
import re
import sys
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCHEMA_VERSION = "dev-pipeline-feature-list-v1"

VALID_STATUSES = {"pending", "in_progress", "completed", "failed", "skipped", "split", "auto_skipped"}
VALID_COMPLEXITIES = {"low", "medium", "high", "critical"}
VALID_PRIORITIES = {"critical", "high", "medium", "low"}
VALID_GRANULARITIES = {"feature", "sub_feature", "auto"}
VALID_PLANNING_MODES = {"new", "incremental"}

FEATURE_ID_RE = re.compile(r"^F-\d{3}(-[A-Z])?$")
SUB_FEATURE_ID_RE = re.compile(r"^F-\d{3}-[A-Z]$")

# Keywords in acceptance criteria that indicate UI/browser interaction behavior.
UI_KEYWORDS_RE = re.compile(
    r"\b(click|button|modal|page|form|display|navigate|tab|input|opens|shows|"
    r"renders|visible|redirect|download|upload|preview|select|toggle|dropdown|"
    r"popup|toast|menu)\b",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _err(msg):
    """Print an error message to stderr."""
    print("ERROR: {}".format(msg), file=sys.stderr)


def _warn(msg):
    """Print a warning message to stderr."""
    print("WARNING: {}".format(msg), file=sys.stderr)


def _info(msg):
    """Print an informational message to stderr."""
    print("INFO: {}".format(msg), file=sys.stderr)


def _load_json(path):
    """Load and return parsed JSON from *path*.

    Returns (data, error_message).  On success error_message is None.
    """
    if not os.path.isfile(path):
        return None, "File not found: {}".format(path)
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data, None
    except json.JSONDecodeError as exc:
        return None, "JSON parse error in {}: {}".format(path, exc)
    except Exception as exc:
        return None, "Failed to read {}: {}".format(path, exc)


def _write_json(path, data):
    """Write *data* as pretty-printed JSON to *path*."""
    parent = os.path.dirname(path)
    if parent and not os.path.isdir(parent):
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


# ---------------------------------------------------------------------------
# Cycle detection (Kahn's algorithm)
# ---------------------------------------------------------------------------



def _detect_cycles(features):
    """Return (has_cycles: bool, max_depth: int) using Kahn's topological sort.

    *features* is the list of feature dicts.  We build a graph from the
    ``dependencies`` field and run Kahn's algorithm.

    Returns a tuple ``(has_cycles, max_depth)`` where *max_depth* is the
    longest path in the DAG (0 if there are cycles or a single node).
    """
    id_set = {f["id"] for f in features}
    # Build adjacency list and in-degree map.
    adj = {fid: [] for fid in id_set}       # dependency -> [dependent]
    in_degree = {fid: 0 for fid in id_set}

    for feat in features:
        fid = feat["id"]
        for dep in feat.get("dependencies", []):
            if dep in id_set:
                adj[dep].append(fid)
                in_degree[fid] += 1

    # Kahn's algorithm
    queue = collections.deque()
    for fid, deg in in_degree.items():
        if deg == 0:
            queue.append(fid)

    sorted_order = []
    # Track depth for each node to compute max dependency depth.
    depth = {fid: 0 for fid in id_set}

    while queue:
        node = queue.popleft()
        sorted_order.append(node)
        for neighbour in adj[node]:
            in_degree[neighbour] -= 1
            new_depth = depth[node] + 1
            if new_depth > depth[neighbour]:
                depth[neighbour] = new_depth
            if in_degree[neighbour] == 0:
                queue.append(neighbour)

    has_cycles = len(sorted_order) != len(id_set)
    max_depth = max(depth.values()) if depth else 0
    return has_cycles, max_depth


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def validate_feature_list(data, planning_mode="new"):
    """Validate a parsed feature-list data structure.

    Returns a dict with keys ``valid``, ``errors``, ``warnings``, ``stats``.
    """
    if planning_mode not in VALID_PLANNING_MODES:
        planning_mode = "new"

    errors = []
    warnings = []

    # ------------------------------------------------------------------
    # 1. Top-level schema validation
    # ------------------------------------------------------------------
    schema = data.get("$schema")
    if schema != SCHEMA_VERSION:
        errors.append(
            "$schema must be '{}', got '{}'".format(SCHEMA_VERSION, schema)
        )

    # Support both project_name (canonical) and app_name (legacy)
    app_name = data.get("project_name", data.get("app_name"))
    if not isinstance(app_name, str) or not app_name.strip():
        errors.append("project_name must be a non-empty string")

    features = data.get("features")
    if not isinstance(features, list) or len(features) == 0:
        errors.append("features must be a non-empty array")
        # Early-out: nothing else to validate if features are missing.
        return {
            "valid": False,
            "errors": errors,
            "warnings": warnings,
            "stats": {
                "total_features": 0,
                "total_sub_features": 0,
                "complexity_distribution": {},
                "max_dependency_depth": 0,
                "has_cycles": False,
            },
        }

    # ------------------------------------------------------------------
    # 2. Per-feature validation
    # ------------------------------------------------------------------
    required_keys = {
        "id", "title", "description", "priority",
        "dependencies", "acceptance_criteria", "status",
    }

    seen_ids = set()
    priorities = []
    complexity_dist = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    total_sub_features = 0

    for idx, feat in enumerate(features):
        label = "features[{}]".format(idx)

        # -- Required keys --
        if not isinstance(feat, dict):
            errors.append("{} is not an object".format(label))
            continue

        missing = required_keys - set(feat.keys())
        if missing:
            errors.append("{} missing required keys: {}".format(
                label, ", ".join(sorted(missing))
            ))

        # -- ID format & uniqueness --
        fid = feat.get("id", "")
        if not FEATURE_ID_RE.match(str(fid)):
            errors.append(
                "{}: id '{}' does not match pattern F-NNN or F-NNN-X".format(label, fid)
            )
        if fid in seen_ids:
            errors.append("{}: duplicate id '{}'".format(label, fid))
        seen_ids.add(fid)

        # -- Title / description --
        for key in ("title", "description"):
            val = feat.get(key)
            if not isinstance(val, str) or not val.strip():
                errors.append("{}: {} must be a non-empty string".format(label, key))

        # -- Description depth check --
        desc = feat.get("description", "")
        if isinstance(desc, str) and desc.strip():
            word_count = len(desc.split())
            complexity = feat.get("estimated_complexity", "medium")
            min_words = {
                "low": 30, "medium": 50, "high": 80, "critical": 100,
            }.get(complexity, 50)
            if word_count < 15:
                errors.append(
                    "{}: description too short ({} words, minimum 15). "
                    "Include: what to build, key behaviors, integration points, "
                    "and data model overview.".format(label, word_count)
                )
            elif word_count < min_words:
                warnings.append(
                    "{}: description only {} words (recommend {}+ for {} complexity). "
                    "Richer descriptions produce better pipeline results.".format(
                        label, word_count, min_words, complexity
                    )
                )

        # -- Priority --
        priority = feat.get("priority")
        if isinstance(priority, str) and priority in VALID_PRIORITIES:
            priorities.append(priority)
        else:
            errors.append("{}: priority must be one of 'high', 'medium', 'low', got {}".format(
                label, repr(priority)
            ))

        # -- Dependencies (list of strings) --
        deps = feat.get("dependencies")
        if not isinstance(deps, list):
            errors.append("{}: dependencies must be an array".format(label))

        # -- Acceptance criteria --
        criteria = feat.get("acceptance_criteria")
        if isinstance(criteria, list):
            if len(criteria) < 1:
                errors.append("{}: must have at least 1 acceptance criterion".format(label))
            elif len(criteria) < 3:
                warnings.append(
                    "{}: only {} acceptance criteria (recommend at least 3)".format(
                        label, len(criteria)
                    )
                )
        else:
            errors.append("{}: acceptance_criteria must be an array".format(label))

        # -- Status --
        status = feat.get("status")
        if status not in VALID_STATUSES:
            errors.append(
                "{}: status '{}' invalid, must be one of: {}".format(
                    label, status, ", ".join(sorted(VALID_STATUSES))
                )
            )
        if planning_mode == "new" and status and status != "pending":
            warnings.append(
                "{}: status is '{}' (expected 'pending' for new plans)".format(label, status)
            )

        # -- Complexity (optional but validated if present) --
        complexity = feat.get("estimated_complexity")
        if complexity is not None:
            if complexity not in VALID_COMPLEXITIES:
                errors.append(
                    "{}: estimated_complexity '{}' invalid, must be one of: {}".format(
                        label, complexity, ", ".join(sorted(VALID_COMPLEXITIES))
                    )
                )
            else:
                complexity_dist[complexity] += 1

        # -- Granularity (optional but validated if present) --
        granularity = feat.get("session_granularity")
        if granularity is not None:
            if granularity not in VALID_GRANULARITIES:
                errors.append(
                    "{}: session_granularity '{}' invalid, must be one of: {}".format(
                        label, granularity, ", ".join(sorted(VALID_GRANULARITIES))
                    )
                )
            if granularity == "auto":
                subs = feat.get("sub_features")
                if not isinstance(subs, list) or len(subs) == 0:
                    warnings.append(
                        "{}: granularity is 'auto' but no sub_features defined".format(label)
                    )

        # -- Sub-features --
        subs = feat.get("sub_features")

        # -- Critic fields (optional but validated if present) --
        critic = feat.get("critic")
        if critic is not None and not isinstance(critic, bool):
            errors.append(
                "{}: 'critic' must be a boolean, got {}".format(label, type(critic).__name__)
            )
        critic_count = feat.get("critic_count")
        if critic_count is not None and critic_count not in (1, 3):
            errors.append(
                "{}: 'critic_count' must be 1 or 3, got {}".format(label, critic_count)
            )

        # -- Browser interaction check (warning for frontend features) --
        has_frontend = bool(
            data.get("global_context", {}).get("frontend_framework")
        )
        if has_frontend and feat.get("status") != "completed":
            criteria = feat.get("acceptance_criteria", [])
            criteria_text = " ".join(
                c for c in criteria if isinstance(c, str)
            )
            if UI_KEYWORDS_RE.search(criteria_text):
                if feat.get("browser_interaction") is None:
                    warnings.append(
                        "{}: has UI acceptance criteria but no browser_interaction "
                        "field. Consider adding browser verification.".format(label)
                    )

        if isinstance(subs, list):
            for sidx, sub in enumerate(subs):
                sub_label = "{}->sub_features[{}]".format(label, sidx)
                if not isinstance(sub, dict):
                    errors.append("{} is not an object".format(sub_label))
                    continue

                sub_missing = {"id", "title", "description"} - set(sub.keys())
                if sub_missing:
                    errors.append("{} missing required keys: {}".format(
                        sub_label, ", ".join(sorted(sub_missing))
                    ))

                sub_id = sub.get("id", "")
                if not SUB_FEATURE_ID_RE.match(str(sub_id)):
                    errors.append(
                        "{}: id '{}' must be F-NNN-X format".format(sub_label, sub_id)
                    )

                # Sub-feature ID should share parent prefix
                parent_prefix = str(fid).rstrip("ABCDEFGHIJKLMNOPQRSTUVWXYZ").rstrip("-")
                sub_prefix = str(sub_id)[:5]  # e.g. "F-001"
                if parent_prefix and sub_prefix != parent_prefix:
                    warnings.append(
                        "{}: sub-feature '{}' does not share parent prefix '{}'".format(
                            sub_label, sub_id, parent_prefix
                        )
                    )

                if sub_id in seen_ids:
                    errors.append("{}: duplicate id '{}'".format(sub_label, sub_id))
                seen_ids.add(sub_id)
                total_sub_features += 1

    # ------------------------------------------------------------------
    # 3. Dependency validation
    # ------------------------------------------------------------------
    all_ids = {f.get("id") for f in features}
    for idx, feat in enumerate(features):
        label = "features[{}]".format(idx)
        deps = feat.get("dependencies", [])
        if isinstance(deps, list):
            for dep in deps:
                if dep not in all_ids:
                    errors.append(
                        "{}: dependency '{}' does not exist in feature list".format(label, dep)
                    )

    # -- Cycle detection --
    has_cycles, max_depth = _detect_cycles(features)
    if has_cycles:
        errors.append("Dependency graph contains cycles (not a valid DAG)")

    # ------------------------------------------------------------------
    # 4. Build result
    # ------------------------------------------------------------------
    is_valid = len(errors) == 0

    return {
        "valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "stats": {
            "total_features": len(features),
            "total_sub_features": total_sub_features,
            "complexity_distribution": complexity_dist,
            "max_dependency_depth": max_depth,
            "has_cycles": has_cycles,
        },
    }


# ---------------------------------------------------------------------------
# Template generation
# ---------------------------------------------------------------------------


def generate_template():
    """Return a template feature-list dict with placeholder values."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    return {
        "$schema": SCHEMA_VERSION,
        "project_name": "YOUR_PROJECT_NAME",
        "project_description": "YOUR_PROJECT_DESCRIPTION",
        "created_at": now,
        "created_by": "feature-planner",
        "features": [
            {
                "id": "F-001",
                "title": "Project Infrastructure Setup",
                "description": (
                    "Initialize project structure, configure build tools, "
                    "set up development environment."
                ),
                "priority": "high",
                "estimated_complexity": "medium",
                "dependencies": [],
                "acceptance_criteria": [
                    "Project builds successfully",
                    "Development server starts",
                    "Linting and formatting configured",
                ],
                "status": "pending",
                "session_granularity": "feature",
                "sub_features": [],
            }
        ],
        "global_context": {
            "tech_stack": "",
            "design_system": "",
            "testing_strategy": "",
        },
    }


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------


def _build_dependency_graph_text(features):
    """Build a human-readable text representation of the dependency graph.

    Produces an arrow-chain format that shows all dependency paths,
    including convergent edges (where multiple paths lead to the same node).

    Returns a list of lines.
    """
    all_ids = [f["id"] for f in features]

    # Build adjacency: dependency -> list of dependents (forward edges)
    dependents = {fid: [] for fid in all_ids}
    has_parent = set()
    for feat in features:
        for dep in feat.get("dependencies", []):
            if dep in dependents:
                dependents[dep].append(feat["id"])
                has_parent.add(feat["id"])

    # Sort children for deterministic output
    for fid in dependents:
        dependents[fid] = sorted(set(dependents[fid]))

    # Roots: features with no incoming dependencies
    roots = [fid for fid in all_ids if fid not in has_parent]
    if not roots:
        return ["(cycle detected - no root nodes)"]
    if not any(dependents[r] for r in all_ids):
        # No dependencies at all
        return ["(no dependencies)"]

    result_lines = []

    def _render(node, prefix, is_continuation):
        """Render a node and its dependents recursively.

        *prefix*: whitespace to print before " -> node" on branch lines.
        *is_continuation*: True if this node is appended on the same line
                           as its parent (first child).
        """
        children = dependents.get(node, [])
        if not children:
            return

        for i, child in enumerate(children):
            if i == 0:
                # First child: continue on the same line
                result_lines[-1] += " -> {}".format(child)
                _render(child, prefix + " " * (len(node) + 4), True)
            else:
                # Subsequent children: new line, indented under the arrow
                line = "{}-> {}".format(prefix, child)
                result_lines.append(line)
                child_prefix = prefix + " " * (len(child) + 4)
                _render(child, child_prefix, True)

    for root in sorted(roots):
        result_lines.append(root)
        _render(root, " " * len(root), False)

    return result_lines


def generate_summary_markdown(data):
    """Generate a markdown summary of the feature list."""
    app_name = data.get("project_name", data.get("app_name", "Unknown"))
    features = data.get("features", [])

    lines = []
    lines.append("# Feature Summary: {}".format(app_name))
    lines.append("")

    # Table header
    lines.append("| ID | Title | Complexity | Priority | Dependencies | Criteria | Granularity |")
    lines.append("|----|-------|------------|----------|--------------|----------|-------------|")

    for feat in features:
        fid = feat.get("id", "?")
        title = feat.get("title", "?")
        complexity = feat.get("estimated_complexity", "-")
        priority = feat.get("priority", "?")
        deps = feat.get("dependencies", [])
        deps_str = ", ".join(deps) if deps else "-"
        criteria_count = len(feat.get("acceptance_criteria", []))
        granularity = feat.get("session_granularity", "-")

        lines.append("| {} | {} | {} | {} | {} | {} | {} |".format(
            fid, title, complexity, priority, deps_str, criteria_count, granularity
        ))

    lines.append("")

    # Dependency graph
    lines.append("## Dependency Graph")
    graph_lines = _build_dependency_graph_text(features)
    for gl in graph_lines:
        lines.append(gl)
    lines.append("")

    # Statistics
    complexity_dist = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    total_sub = 0
    for feat in features:
        c = feat.get("estimated_complexity")
        if c in complexity_dist:
            complexity_dist[c] += 1
        subs = feat.get("sub_features")
        if isinstance(subs, list):
            total_sub += len(subs)

    _, max_depth = _detect_cycles(features)

    lines.append("## Statistics")
    lines.append("- Total features: {}".format(len(features)))
    if total_sub > 0:
        lines.append("- Total sub-features: {}".format(total_sub))
    lines.append("- Complexity: {} low, {} medium, {} high, {} critical".format(
        complexity_dist["low"], complexity_dist["medium"],
        complexity_dist["high"], complexity_dist["critical"]
    ))
    lines.append("- Max dependency depth: {}".format(max_depth))

    return "\n".join(lines)


def generate_summary_json(data):
    """Generate a JSON summary of the feature list."""
    features = data.get("features", [])

    complexity_dist = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    total_sub = 0
    for feat in features:
        c = feat.get("estimated_complexity")
        if c in complexity_dist:
            complexity_dist[c] += 1
        subs = feat.get("sub_features")
        if isinstance(subs, list):
            total_sub += len(subs)

    has_cycles, max_depth = _detect_cycles(features)

    feature_summaries = []
    for feat in features:
        feature_summaries.append({
            "id": feat.get("id"),
            "title": feat.get("title"),
            "priority": feat.get("priority"),
            "estimated_complexity": feat.get("estimated_complexity"),
            "dependencies": feat.get("dependencies", []),
            "acceptance_criteria_count": len(feat.get("acceptance_criteria", [])),
            "session_granularity": feat.get("session_granularity"),
            "status": feat.get("status"),
        })

    return {
        "project_name": data.get("project_name", data.get("app_name", "")),
        "features": feature_summaries,
        "stats": {
            "total_features": len(features),
            "total_sub_features": total_sub,
            "complexity_distribution": complexity_dist,
            "max_dependency_depth": max_depth,
            "has_cycles": has_cycles,
        },
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def cmd_validate(args):
    """Handle the 'validate' command."""
    if not args.input:
        _err("--input is required for the validate command")
        return 2

    data, load_err = _load_json(args.input)
    if load_err:
        _err(load_err)
        result = {
            "valid": False,
            "errors": [load_err],
            "warnings": [],
            "stats": {
                "total_features": 0,
                "total_sub_features": 0,
                "complexity_distribution": {},
                "max_dependency_depth": 0,
                "has_cycles": False,
            },
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 2

    result = validate_feature_list(data, planning_mode=args.mode)

    # Print results to stdout
    print(json.dumps(result, indent=2, ensure_ascii=False))

    # Log to stderr for humans
    if result["valid"]:
        _info("Validation passed with {} warning(s)".format(len(result["warnings"])))
    else:
        _err("Validation failed with {} error(s) and {} warning(s)".format(
            len(result["errors"]), len(result["warnings"])
        ))

    for e in result["errors"]:
        _err("  " + e)
    for w in result["warnings"]:
        _warn("  " + w)

    # Optionally write validated/cleaned output
    if args.output and result["valid"]:
        _write_json(args.output, data)
        _info("Validated output written to {}".format(args.output))

    return 0 if result["valid"] else 1


def cmd_template(args):
    """Handle the 'template' command."""
    if not args.output:
        _err("--output is required for the template command")
        return 2

    template = generate_template()
    _write_json(args.output, template)
    _info("Template written to {}".format(args.output))
    return 0


def cmd_generate(args):
    """Handle the 'generate' command.

    Loads a draft JSON (produced by AI), fills in defaults, validates,
    and writes the final feature-list.json.
    """
    if not args.input:
        _err("--input is required for the generate command")
        return 2
    if not args.output:
        _err("--output is required for the generate command")
        return 2

    # Load draft (supports stdin via '-')
    if args.input == "-":
        try:
            data = json.load(sys.stdin)
        except json.JSONDecodeError as exc:
            _err("Invalid JSON from stdin: {}".format(exc))
            return 2
    else:
        data, load_err = _load_json(args.input)
        if load_err:
            _err(load_err)
            return 2

    # Fill in defaults
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    data.setdefault("$schema", SCHEMA_VERSION)
    data.setdefault("created_at", now)
    data.setdefault("created_by", "feature-planner")

    # Ensure project_name from app_name if needed
    if "project_name" not in data and "app_name" in data:
        data["project_name"] = data["app_name"]

    # Set default status for features without one
    for feature in data.get("features", []):
        feature.setdefault("status", "pending")

    # Validate
    mode = getattr(args, "mode", "new") or "new"
    result = validate_feature_list(data, planning_mode=mode)

    # Output validation result
    print(json.dumps(result, indent=2, ensure_ascii=False))

    if result["valid"]:
        _write_json(args.output, data)
        _info("Generated feature-list written to {}".format(args.output))
        return 0
    else:
        _err("Validation failed with {} error(s)".format(len(result["errors"])))
        for e in result["errors"]:
            _err("  " + e)
        for w in result.get("warnings", []):
            _warn("  " + w)
        return 1


def cmd_summary(args):
    """Handle the 'summary' command."""
    if not args.input:
        _err("--input is required for the summary command")
        return 2

    data, load_err = _load_json(args.input)
    if load_err:
        _err(load_err)
        return 2

    output_format = getattr(args, "format", "markdown") or "markdown"

    if output_format == "json":
        summary = generate_summary_json(data)
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    else:
        summary = generate_summary_markdown(data)
        print(summary)

    return 0


def cmd_grade(args):
    """Handle the 'grade' command for evaluation framework integration.
    
    Collects validation results from eval runs and generates grading data.
    Used by npm run skill:review for automated evaluation of feature-planner.
    """
    workspace = getattr(args, 'workspace', None)
    iteration = getattr(args, 'iteration', None)
    
    if not workspace or not iteration:
        _err("--workspace and --iteration are required for the grade command")
        return 2
    
    workspace_path = os.path.expanduser(workspace)
    
    if not os.path.isdir(workspace_path):
        _err("Workspace directory not found: {}".format(workspace_path))
        return 2
    
    # Collect run outputs from iteration subdirectory
    iteration_dir = os.path.join(workspace_path, iteration)
    if not os.path.isdir(iteration_dir):
        _err("Iteration directory not found: {}".format(iteration_dir))
        return 2
    
    # Find all eval-* subdirectories
    eval_dirs = []
    try:
        for item in os.listdir(iteration_dir):
            item_path = os.path.join(iteration_dir, item)
            if os.path.isdir(item_path) and item.startswith('eval-'):
                eval_dirs.append((item, item_path))
    except Exception as exc:
        _err("Failed to list iteration directory: {}".format(exc))
        return 2
    
    if not eval_dirs:
        _warn("No eval-* directories found in {}".format(iteration_dir))
    
    grades = []
    
    for eval_name, eval_path in sorted(eval_dirs):
        output_json = os.path.join(eval_path, "outputs", "feature-list.json")
        
        if not os.path.isfile(output_json):
            _info("Skipping {}: no output/feature-list.json found".format(eval_name))
            continue
        
        # Load and validate the output
        data, load_err = _load_json(output_json)
        if load_err:
            _warn("Failed to load {}: {}".format(output_json, load_err))
            continue
        
        # Run validation
        result = validate_feature_list(data, planning_mode="new")
        
        # Create grading entry
        grade_entry = {
            "test_name": eval_name,
            "passed": result["valid"],
            "assertions": [
                {
                    "name": "Feature list valid schema",
                    "passed": result["valid"],
                    "evidence": "valid={}".format(result["valid"])
                },
                {
                    "name": "No cycles in DAG",
                    "passed": not result["stats"].get("has_cycles", False),
                    "evidence": "cycles={}".format(result["stats"].get("has_cycles", False))
                },
                {
                    "name": "Features generated",
                    "passed": result["stats"].get("total_features", 0) > 0,
                    "evidence": "count={}".format(result["stats"].get("total_features", 0))
                },
                {
                    "name": "No validation errors",
                    "passed": len(result.get("errors", [])) == 0,
                    "evidence": "error_count={}".format(len(result.get("errors", [])))
                }
            ]
        }
        
        grades.append(grade_entry)
        
        # Write grading.json to eval run directory
        grading_file = os.path.join(eval_path, "grading.json")
        _write_json(grading_file, grade_entry)
        _info("Wrote grading to {}".format(grading_file))
    
    # Write aggregated results
    aggregated = {
        "iteration": iteration,
        "total_runs": len(grades),
        "passed_runs": sum(1 for g in grades if g["passed"]),
        "pass_rate": len([g for g in grades if g["passed"]]) / len(grades) if grades else 0,
        "grades": grades
    }
    
    benchmark_file = os.path.join(iteration_dir, "benchmark.json")
    _write_json(benchmark_file, aggregated)
    _info("Wrote aggregated benchmark to {}".format(benchmark_file))
    
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Validate and generate .prizmkit/plans/feature-list.json files for the dev-pipeline system.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  %(prog)s validate --input .prizmkit/plans/feature-list.json\n"
            "  %(prog)s validate --input .prizmkit/plans/feature-list.json --mode incremental\n"
            "  %(prog)s validate --input .prizmkit/plans/feature-list.json --output validated.json\n"
            "  %(prog)s template --output .prizmkit/plans/feature-list.json\n"
            "  %(prog)s generate --input draft.json --output .prizmkit/plans/feature-list.json\n"
            "  %(prog)s summary --input .prizmkit/plans/feature-list.json\n"
            "  %(prog)s summary --input .prizmkit/plans/feature-list.json --format json\n"
        ),
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # -- validate --
    p_validate = subparsers.add_parser(
        "validate",
        help="Validate an existing .prizmkit/plans/feature-list.json",
    )
    p_validate.add_argument(
        "--input", required=True, help="Path to input .prizmkit/plans/feature-list.json"
    )
    p_validate.add_argument(
        "--output", help="Path to write validated output (optional)"
    )
    p_validate.add_argument(
        "--mode",
        choices=["new", "incremental"],
        default="new",
        help="Validation mode (default: new)",
    )

    # -- template --
    p_template = subparsers.add_parser(
        "template",
        help="Generate a blank template .prizmkit/plans/feature-list.json",
    )
    p_template.add_argument(
        "--output", required=True, help="Path to write template file"
    )

    # -- generate --
    p_generate = subparsers.add_parser(
        "generate",
        help="Validate a draft and generate final feature-list.json with defaults filled in",
    )
    p_generate.add_argument(
        "--input", required=True, help="Path to draft JSON (or '-' for stdin)"
    )
    p_generate.add_argument(
        "--output", required=True, help="Path to write final feature-list.json"
    )
    p_generate.add_argument(
        "--mode",
        choices=["new", "incremental"],
        default="new",
        help="Validation mode (default: new)",
    )

    # -- summary --
    p_summary = subparsers.add_parser(
        "summary",
        help="Print a summary table of features from a .prizmkit/plans/feature-list.json",
    )
    p_summary.add_argument(
        "--input", required=True, help="Path to input .prizmkit/plans/feature-list.json"
    )
    p_summary.add_argument(
        "--format",
        choices=["json", "markdown"],
        default="markdown",
        help="Output format (default: markdown)",
    )

    # -- grade --
    p_grade = subparsers.add_parser(
        "grade",
        help="Generate grading results from eval runs (for npm run skill:review)",
    )
    p_grade.add_argument(
        "--workspace",
        required=True,
        help="Path to eval workspace (e.g., /.codebuddy/skill-evals/feature-planner-workspace)",
    )
    p_grade.add_argument(
        "--iteration",
        required=True,
        help="Iteration ID (e.g., iteration-1)",
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help(sys.stderr)
        return 2

    dispatch = {
        "validate": cmd_validate,
        "template": cmd_template,
        "generate": cmd_generate,
        "summary": cmd_summary,
        "grade": cmd_grade,
    }

    handler = dispatch.get(args.command)
    if handler is None:
        _err("Unknown command: {}".format(args.command))
        return 2

    return handler(args)


if __name__ == "__main__":
    sys.exit(main())
