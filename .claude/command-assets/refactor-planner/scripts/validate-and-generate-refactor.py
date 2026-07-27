#!/usr/bin/env python3
"""
validate-and-generate-refactor.py - Validate and generate refactor-list.json files
for the dev-pipeline system.

Commands:
  validate    Validate an existing .prizmkit/plans/refactor-list.json
  template    Generate a blank template .prizmkit/plans/refactor-list.json
  generate    Validate a draft JSON and generate final refactor-list.json with defaults
  summary     Print a summary table of refactors from a .prizmkit/plans/refactor-list.json

Usage:
  python3 validate-and-generate-refactor.py validate --input .prizmkit/plans/refactor-list.json [--output validated.json]
  python3 validate-and-generate-refactor.py template --output .prizmkit/plans/refactor-list.json
  python3 validate-and-generate-refactor.py generate --input draft.json --output .prizmkit/plans/refactor-list.json
  python3 validate-and-generate-refactor.py summary --input .prizmkit/plans/refactor-list.json [--format markdown|json]

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

SCHEMA_VERSION = "dev-pipeline-refactor-list-v1"

VALID_STATUSES = {"pending", "in_progress", "completed", "failed", "skipped"}
VALID_TYPES = {"extract", "rename", "restructure", "simplify", "decouple", "migrate"}
VALID_PRIORITIES = {"critical", "high", "medium", "low"}
VALID_COMPLEXITIES = {"low", "medium", "high"}
VALID_PRESERVATION_STRATEGIES = {"test-gate", "snapshot", "manual"}

REFACTOR_ID_RE = re.compile(r"^R-\d{3}$")

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


def _detect_cycles(refactors):
    """Return (has_cycles: bool, max_depth: int) using Kahn's topological sort.

    *refactors* is the list of refactor dicts.  We build a graph from the
    ``dependencies`` field and run Kahn's algorithm.

    Returns a tuple ``(has_cycles, max_depth)`` where *max_depth* is the
    longest path in the DAG (0 if there are cycles or a single node).
    """
    id_set = {r["id"] for r in refactors}
    # Build adjacency list and in-degree map.
    adj = {rid: [] for rid in id_set}       # dependency -> [dependent]
    in_degree = {rid: 0 for rid in id_set}

    for refactor in refactors:
        rid = refactor["id"]
        for dep in refactor.get("dependencies", []):
            if dep in id_set:
                adj[dep].append(rid)
                in_degree[rid] += 1

    # Kahn's algorithm
    queue = collections.deque()
    for rid, deg in in_degree.items():
        if deg == 0:
            queue.append(rid)

    sorted_order = []
    # Track depth for each node to compute max dependency depth.
    depth = {rid: 0 for rid in id_set}

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


def validate_refactor_list(data):
    """Validate a parsed refactor-list data structure.

    Returns a dict with keys ``valid``, ``errors``, ``warnings``, ``stats``.
    """
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

    project_name = data.get("project_name")
    if not isinstance(project_name, str) or not project_name.strip():
        errors.append("project_name must be a non-empty string")

    refactors = data.get("refactors")
    if not isinstance(refactors, list) or len(refactors) == 0:
        errors.append("refactors must be a non-empty array")
        # Early-out: nothing else to validate if refactors are missing.
        return {
            "valid": False,
            "errors": errors,
            "warnings": warnings,
            "stats": {
                "total_refactors": 0,
                "type_distribution": {},
                "complexity_distribution": {},
                "max_dependency_depth": 0,
                "has_cycles": False,
            },
        }

    # ------------------------------------------------------------------
    # 2. Per-refactor validation
    # ------------------------------------------------------------------
    required_keys = {
        "id", "title", "description", "scope", "type", "priority",
        "complexity", "behavior_preservation", "acceptance_criteria",
        "dependencies", "status",
    }

    seen_ids = set()
    type_dist = {t: 0 for t in VALID_TYPES}
    complexity_dist = {"low": 0, "medium": 0, "high": 0}

    for idx, refactor in enumerate(refactors):
        label = "refactors[{}]".format(idx)

        # -- Required keys --
        if not isinstance(refactor, dict):
            errors.append("{} is not an object".format(label))
            continue

        missing = required_keys - set(refactor.keys())
        if missing:
            errors.append("{} missing required keys: {}".format(
                label, ", ".join(sorted(missing))
            ))

        # -- ID format & uniqueness --
        rid = refactor.get("id", "")
        if not REFACTOR_ID_RE.match(str(rid)):
            errors.append(
                "{}: id '{}' does not match pattern R-NNN".format(label, rid)
            )
        if rid in seen_ids:
            errors.append("{}: duplicate id '{}'".format(label, rid))
        seen_ids.add(rid)

        # -- Title --
        title = refactor.get("title")
        if not isinstance(title, str) or not title.strip():
            errors.append("{}: title must be a non-empty string".format(label))

        # -- Description depth check --
        desc = refactor.get("description", "")
        if not isinstance(desc, str) or not desc.strip():
            errors.append("{}: description must be a non-empty string".format(label))
        elif isinstance(desc, str) and desc.strip():
            word_count = len(desc.split())
            complexity = refactor.get("complexity", "medium")
            min_words = {"low": 30, "medium": 50, "high": 80}.get(complexity, 50)
            if word_count < 15:
                errors.append(
                    "{}: description too short ({} words, minimum 15). "
                    "Include: what to refactor, why, affected components, "
                    "and expected outcome.".format(label, word_count)
                )
            elif word_count < min_words:
                warnings.append(
                    "{}: description only {} words (recommend {}+ for {} complexity). "
                    "Richer descriptions produce better pipeline results.".format(
                        label, word_count, min_words, complexity
                    )
                )

        # -- Scope --
        scope = refactor.get("scope")
        if isinstance(scope, dict):
            scope_files = scope.get("files")
            if not isinstance(scope_files, list):
                errors.append("{}: scope.files must be an array of strings".format(label))
            elif not all(isinstance(f, str) for f in scope_files):
                errors.append("{}: scope.files must contain only strings".format(label))

            scope_modules = scope.get("modules")
            if not isinstance(scope_modules, list):
                errors.append("{}: scope.modules must be an array of strings".format(label))
            elif not all(isinstance(m, str) for m in scope_modules):
                errors.append("{}: scope.modules must contain only strings".format(label))
        else:
            errors.append("{}: scope must be an object with 'files' and 'modules'".format(label))

        # -- Type --
        rtype = refactor.get("type")
        if isinstance(rtype, str) and rtype in VALID_TYPES:
            type_dist[rtype] += 1
        else:
            errors.append(
                "{}: type must be one of {}, got {}".format(
                    label, ", ".join(sorted(VALID_TYPES)), repr(rtype)
                )
            )

        # -- Priority --
        priority = refactor.get("priority")
        if not isinstance(priority, str) or priority not in VALID_PRIORITIES:
            errors.append(
                "{}: priority must be one of {}, got {}".format(
                    label, ", ".join(sorted(VALID_PRIORITIES)), repr(priority)
                )
            )

        # -- Complexity --
        complexity = refactor.get("complexity")
        if isinstance(complexity, str) and complexity in VALID_COMPLEXITIES:
            complexity_dist[complexity] += 1
        else:
            errors.append(
                "{}: complexity must be one of {}, got {}".format(
                    label, ", ".join(sorted(VALID_COMPLEXITIES)), repr(complexity)
                )
            )

        # -- Behavior preservation --
        bp = refactor.get("behavior_preservation")
        if isinstance(bp, dict):
            strategy = bp.get("strategy")
            if not isinstance(strategy, str) or strategy not in VALID_PRESERVATION_STRATEGIES:
                errors.append(
                    "{}: behavior_preservation.strategy must be one of {}, got {}".format(
                        label,
                        ", ".join(sorted(VALID_PRESERVATION_STRATEGIES)),
                        repr(strategy),
                    )
                )

            # Optional fields validation
            existing_tests = bp.get("existing_tests")
            if existing_tests is not None and not isinstance(existing_tests, bool):
                errors.append(
                    "{}: behavior_preservation.existing_tests must be a boolean, got {}".format(
                        label, type(existing_tests).__name__
                    )
                )

            new_tests = bp.get("new_tests_needed")
            if new_tests is not None:
                if not isinstance(new_tests, list):
                    errors.append(
                        "{}: behavior_preservation.new_tests_needed must be an array of strings".format(label)
                    )
                elif not all(isinstance(t, str) for t in new_tests):
                    errors.append(
                        "{}: behavior_preservation.new_tests_needed must contain only strings".format(label)
                    )
        else:
            errors.append(
                "{}: behavior_preservation must be an object with 'strategy'".format(label)
            )

        # -- Acceptance criteria --
        criteria = refactor.get("acceptance_criteria")
        if isinstance(criteria, list):
            if len(criteria) < 1:
                errors.append("{}: must have at least 1 acceptance criterion".format(label))
            elif len(criteria) < 3:
                warnings.append(
                    "{}: only {} acceptance criteria (recommend at least 3)".format(
                        label, len(criteria)
                    )
                )
            for ci, c in enumerate(criteria):
                if not isinstance(c, str) or not c.strip():
                    errors.append(
                        "{}: acceptance_criteria[{}] must be a non-empty string".format(label, ci)
                    )
        else:
            errors.append("{}: acceptance_criteria must be an array".format(label))

        # -- Dependencies (list of strings matching R-NNN) --
        deps = refactor.get("dependencies")
        if isinstance(deps, list):
            for dep in deps:
                if not isinstance(dep, str) or not REFACTOR_ID_RE.match(dep):
                    errors.append(
                        "{}: dependency '{}' does not match R-NNN pattern".format(label, dep)
                    )
        else:
            errors.append("{}: dependencies must be an array".format(label))

        # -- Status --
        status = refactor.get("status")
        if status not in VALID_STATUSES:
            errors.append(
                "{}: status '{}' invalid, must be one of: {}".format(
                    label, status, ", ".join(sorted(VALID_STATUSES))
                )
            )

    # ------------------------------------------------------------------
    # 3. Dependency validation
    # ------------------------------------------------------------------
    all_ids = {r.get("id") for r in refactors}
    for idx, refactor in enumerate(refactors):
        label = "refactors[{}]".format(idx)
        deps = refactor.get("dependencies", [])
        if isinstance(deps, list):
            for dep in deps:
                if isinstance(dep, str) and REFACTOR_ID_RE.match(dep) and dep not in all_ids:
                    errors.append(
                        "{}: dependency '{}' does not exist in refactor list".format(label, dep)
                    )

    # -- Cycle detection --
    has_cycles, max_depth = _detect_cycles(refactors)
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
            "total_refactors": len(refactors),
            "type_distribution": type_dist,
            "complexity_distribution": complexity_dist,
            "max_dependency_depth": max_depth,
            "has_cycles": has_cycles,
        },
    }


# ---------------------------------------------------------------------------
# Template generation
# ---------------------------------------------------------------------------


def generate_template():
    """Return a template refactor-list dict with placeholder values."""
    return {
        "$schema": SCHEMA_VERSION,
        "project_name": "YOUR_PROJECT_NAME",
        "refactors": [
            {
                "id": "R-001",
                "title": "Extract authentication module",
                "description": (
                    "Extract authentication logic from the monolithic user service "
                    "into a dedicated auth module. This will improve separation of "
                    "concerns, make the auth logic independently testable, and reduce "
                    "coupling between user management and authentication flows."
                ),
                "scope": {
                    "files": [
                        "src/services/user-service.js",
                        "src/middleware/auth.js",
                    ],
                    "modules": ["user-service", "auth"],
                },
                "type": "extract",
                "priority": "high",
                "complexity": "medium",
                "behavior_preservation": {
                    "strategy": "test-gate",
                    "existing_tests": True,
                    "new_tests_needed": [
                        "Auth module unit tests",
                        "Integration test for login flow",
                    ],
                },
                "acceptance_criteria": [
                    "Auth logic moved to dedicated module",
                    "All existing auth tests pass without modification",
                    "No changes to public API surface",
                ],
                "dependencies": [],
                "status": "pending",
            }
        ],
    }


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------


def _build_dependency_graph_text(refactors):
    """Build a human-readable text representation of the dependency graph.

    Returns a list of lines.
    """
    all_ids = [r["id"] for r in refactors]

    # Build adjacency: dependency -> list of dependents (forward edges)
    dependents = {rid: [] for rid in all_ids}
    has_parent = set()
    for refactor in refactors:
        for dep in refactor.get("dependencies", []):
            if dep in dependents:
                dependents[dep].append(refactor["id"])
                has_parent.add(refactor["id"])

    # Sort children for deterministic output
    for rid in dependents:
        dependents[rid] = sorted(set(dependents[rid]))

    # Roots: refactors with no incoming dependencies
    roots = [rid for rid in all_ids if rid not in has_parent]
    if not roots:
        return ["(cycle detected - no root nodes)"]
    if not any(dependents[r] for r in all_ids):
        return ["(no dependencies)"]

    result_lines = []

    def _render(node, prefix, is_continuation):
        """Render a node and its dependents recursively."""
        children = dependents.get(node, [])
        if not children:
            return

        for i, child in enumerate(children):
            if i == 0:
                result_lines[-1] += " -> {}".format(child)
                _render(child, prefix + " " * (len(node) + 4), True)
            else:
                line = "{}-> {}".format(prefix, child)
                result_lines.append(line)
                child_prefix = prefix + " " * (len(child) + 4)
                _render(child, child_prefix, True)

    for root in sorted(roots):
        result_lines.append(root)
        _render(root, " " * len(root), False)

    return result_lines


def generate_summary_markdown(data):
    """Generate a markdown summary of the refactor list."""
    project_name = data.get("project_name", "Unknown")
    refactors = data.get("refactors", [])

    lines = []
    lines.append("# Refactor Summary: {}".format(project_name))
    lines.append("")

    # Table header
    lines.append("| ID | Title | Type | Complexity | Priority | Dependencies | Criteria | Strategy |")
    lines.append("|----|-------|------|------------|----------|--------------|----------|----------|")

    for refactor in refactors:
        rid = refactor.get("id", "?")
        title = refactor.get("title", "?")
        rtype = refactor.get("type", "-")
        complexity = refactor.get("complexity", "-")
        priority = refactor.get("priority", "?")
        deps = refactor.get("dependencies", [])
        deps_str = ", ".join(deps) if deps else "-"
        criteria_count = len(refactor.get("acceptance_criteria", []))
        bp = refactor.get("behavior_preservation", {})
        strategy = bp.get("strategy", "-") if isinstance(bp, dict) else "-"

        lines.append("| {} | {} | {} | {} | {} | {} | {} | {} |".format(
            rid, title, rtype, complexity, priority, deps_str, criteria_count, strategy
        ))

    lines.append("")

    # Dependency graph
    lines.append("## Dependency Graph")
    graph_lines = _build_dependency_graph_text(refactors)
    for gl in graph_lines:
        lines.append(gl)
    lines.append("")

    # Statistics
    type_dist = {t: 0 for t in VALID_TYPES}
    complexity_dist = {"low": 0, "medium": 0, "high": 0}
    for refactor in refactors:
        t = refactor.get("type")
        if t in type_dist:
            type_dist[t] += 1
        c = refactor.get("complexity")
        if c in complexity_dist:
            complexity_dist[c] += 1

    _, max_depth = _detect_cycles(refactors)

    lines.append("## Statistics")
    lines.append("- Total refactors: {}".format(len(refactors)))
    lines.append("- Complexity: {} low, {} medium, {} high".format(
        complexity_dist["low"], complexity_dist["medium"], complexity_dist["high"]
    ))
    type_parts = ["{} {}".format(v, k) for k, v in sorted(type_dist.items()) if v > 0]
    if type_parts:
        lines.append("- Types: {}".format(", ".join(type_parts)))
    lines.append("- Max dependency depth: {}".format(max_depth))

    return "\n".join(lines)


def generate_summary_json(data):
    """Generate a JSON summary of the refactor list."""
    refactors = data.get("refactors", [])

    type_dist = {t: 0 for t in VALID_TYPES}
    complexity_dist = {"low": 0, "medium": 0, "high": 0}
    for refactor in refactors:
        t = refactor.get("type")
        if t in type_dist:
            type_dist[t] += 1
        c = refactor.get("complexity")
        if c in complexity_dist:
            complexity_dist[c] += 1

    has_cycles, max_depth = _detect_cycles(refactors)

    refactor_summaries = []
    for refactor in refactors:
        bp = refactor.get("behavior_preservation", {})
        refactor_summaries.append({
            "id": refactor.get("id"),
            "title": refactor.get("title"),
            "type": refactor.get("type"),
            "priority": refactor.get("priority"),
            "complexity": refactor.get("complexity"),
            "dependencies": refactor.get("dependencies", []),
            "acceptance_criteria_count": len(refactor.get("acceptance_criteria", [])),
            "preservation_strategy": bp.get("strategy") if isinstance(bp, dict) else None,
            "status": refactor.get("status"),
        })

    return {
        "project_name": data.get("project_name", ""),
        "refactors": refactor_summaries,
        "stats": {
            "total_refactors": len(refactors),
            "type_distribution": type_dist,
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
                "total_refactors": 0,
                "type_distribution": {},
                "complexity_distribution": {},
                "max_dependency_depth": 0,
                "has_cycles": False,
            },
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 2

    result = validate_refactor_list(data)

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
    and writes the final refactor-list.json.
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
    data.setdefault("created_by", "refactor-planner")

    # Set default status for refactors without one
    for refactor in data.get("refactors", []):
        refactor.setdefault("status", "pending")

    # Validate
    result = validate_refactor_list(data)

    # Output validation result
    print(json.dumps(result, indent=2, ensure_ascii=False))

    if result["valid"]:
        _write_json(args.output, data)
        _info("Generated refactor-list written to {}".format(args.output))
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


def main():
    parser = argparse.ArgumentParser(
        description="Validate and generate .prizmkit/plans/refactor-list.json files for the dev-pipeline system.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  %(prog)s validate --input .prizmkit/plans/refactor-list.json\n"
            "  %(prog)s validate --input .prizmkit/plans/refactor-list.json --output validated.json\n"
            "  %(prog)s template --output .prizmkit/plans/refactor-list.json\n"
            "  %(prog)s generate --input draft.json --output .prizmkit/plans/refactor-list.json\n"
            "  %(prog)s summary --input .prizmkit/plans/refactor-list.json\n"
            "  %(prog)s summary --input .prizmkit/plans/refactor-list.json --format json\n"
        ),
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # -- validate --
    p_validate = subparsers.add_parser(
        "validate",
        help="Validate an existing .prizmkit/plans/refactor-list.json",
    )
    p_validate.add_argument(
        "--input", required=True, help="Path to input .prizmkit/plans/refactor-list.json"
    )
    p_validate.add_argument(
        "--output", help="Path to write validated output (optional)"
    )

    # -- template --
    p_template = subparsers.add_parser(
        "template",
        help="Generate a blank template .prizmkit/plans/refactor-list.json",
    )
    p_template.add_argument(
        "--output", required=True, help="Path to write template file"
    )

    # -- generate --
    p_generate = subparsers.add_parser(
        "generate",
        help="Validate a draft and generate final refactor-list.json with defaults",
    )
    p_generate.add_argument(
        "--input", required=True, help="Path to draft JSON (or '-' for stdin)"
    )
    p_generate.add_argument(
        "--output", required=True, help="Path to write final refactor-list.json"
    )

    # -- summary --
    p_summary = subparsers.add_parser(
        "summary",
        help="Print a summary table of refactors from a .prizmkit/plans/refactor-list.json",
    )
    p_summary.add_argument(
        "--input", required=True, help="Path to input .prizmkit/plans/refactor-list.json"
    )
    p_summary.add_argument(
        "--format",
        choices=["json", "markdown"],
        default="markdown",
        help="Output format (default: markdown)",
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
    }

    handler = dispatch.get(args.command)
    if handler is None:
        _err("Unknown command: {}".format(args.command))
        return 2

    return handler(args)


if __name__ == "__main__":
    sys.exit(main())
