#!/usr/bin/env python3
"""
Validate and generate .prizmkit/plans/bug-fix-list.json files
for the dev-pipeline system.

Commands:
  validate    Validate an existing bug-fix-list.json
  generate    Validate a draft JSON and generate final bug-fix-list.json with defaults

Usage:
  python3 validate-bug-list.py validate .prizmkit/plans/bug-fix-list.json [--feature-list .prizmkit/plans/feature-list.json]
  python3 validate-bug-list.py generate --input draft.json --output .prizmkit/plans/bug-fix-list.json

Exit codes:
  0 = valid / generated
  1 = validation errors found
  2 = file not found or JSON parse error

Python 3.6+ required. No external dependencies.
"""

import argparse
import json
import sys
import os
import re
from datetime import datetime, timezone

VALID_SEVERITIES = {"critical", "high", "medium", "low"}
VALID_SOURCE_TYPES = {"stack_trace", "user_report", "failed_test", "log_pattern", "monitoring_alert"}
VALID_VERIFICATION_TYPES = {"automated", "manual", "hybrid"}
VALID_STATUSES = {"pending", "triaging", "reproducing", "fixing", "verifying", "completed", "failed", "needs_info", "skipped"}
BUG_ID_PATTERN = re.compile(r"^B-\d{3}$")
SCHEMA_VERSION = "dev-pipeline-bug-fix-list-v1"


def _err(msg):
    """Print an error message to stderr."""
    print("ERROR: {}".format(msg), file=sys.stderr)


def _warn(msg):
    """Print a warning message to stderr."""
    print("WARN: {}".format(msg), file=sys.stderr)


def _info(msg):
    """Print an informational message to stderr."""
    print("INFO: {}".format(msg), file=sys.stderr)


def _load_json(path):
    """Load and return parsed JSON from a file. Returns (data, error_string)."""
    if not os.path.isfile(path):
        return None, "File not found: {}".format(path)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data, None
    except json.JSONDecodeError as e:
        return None, "Invalid JSON in {}: {}".format(path, e)
    except Exception as e:
        return None, "Cannot read {}: {}".format(path, e)


def _write_json(path, data):
    """Write data as pretty-printed JSON to path. Creates parent dirs if needed."""
    parent = os.path.dirname(os.path.abspath(path))
    if parent and not os.path.isdir(parent):
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def validate(data, feature_ids=None):
    """Validate a parsed bug-fix-list data structure.

    Returns a dict with keys: valid, errors, warnings, stats.
    """
    errors = []
    warnings = []

    # Top-level required fields
    if "$schema" not in data:
        errors.append("Missing required field: $schema")
    elif data["$schema"] != SCHEMA_VERSION:
        errors.append("Invalid $schema: expected '{}', got '{}'".format(SCHEMA_VERSION, data["$schema"]))

    if not data.get("project_name"):
        errors.append("Missing or empty required field: project_name")

    bugs = data.get("bugs", [])
    if not bugs or not isinstance(bugs, list):
        errors.append("Missing or empty required field: bugs")
        return {
            "valid": False,
            "errors": errors,
            "warnings": warnings,
            "stats": {"total_bugs": 0, "severity_distribution": {}},
        }

    # Per-bug validation
    seen_ids = set()
    severity_counts = {}

    for i, bug in enumerate(bugs):
        prefix = "bugs[{}]".format(i)

        # Required fields
        bug_id = bug.get("id", "")
        if not bug_id:
            errors.append("{}: missing required field 'id'".format(prefix))
        elif not BUG_ID_PATTERN.match(bug_id):
            errors.append("{}: id '{}' does not match pattern B-NNN".format(prefix, bug_id))

        if bug_id in seen_ids:
            errors.append("{}: duplicate bug id '{}'".format(prefix, bug_id))
        seen_ids.add(bug_id)

        if not bug.get("title"):
            errors.append("{} ({}): missing required field 'title'".format(prefix, bug_id))

        if not bug.get("description"):
            errors.append("{} ({}): missing required field 'description'".format(prefix, bug_id))

        severity = bug.get("severity", "")
        if severity not in VALID_SEVERITIES:
            errors.append("{} ({}): invalid severity '{}' — must be one of {}".format(
                prefix, bug_id, severity, sorted(VALID_SEVERITIES)))
        else:
            severity_counts[severity] = severity_counts.get(severity, 0) + 1

        # error_source
        error_source = bug.get("error_source", {})
        source_type = error_source.get("type", "") if isinstance(error_source, dict) else ""
        if source_type not in VALID_SOURCE_TYPES:
            errors.append("{} ({}): invalid error_source.type '{}' — must be one of {}".format(
                prefix, bug_id, source_type, sorted(VALID_SOURCE_TYPES)))

        # verification_type
        vtype = bug.get("verification_type", "")
        if vtype not in VALID_VERIFICATION_TYPES:
            errors.append("{} ({}): invalid verification_type '{}' — must be one of {}".format(
                prefix, bug_id, vtype, sorted(VALID_VERIFICATION_TYPES)))

        # acceptance_criteria
        ac = bug.get("acceptance_criteria", [])
        if not ac or not isinstance(ac, list):
            errors.append("{} ({}): missing or empty acceptance_criteria array".format(prefix, bug_id))

        # status
        status = bug.get("status", "")
        if status not in VALID_STATUSES:
            errors.append("{} ({}): invalid status '{}' — must be one of {}".format(
                prefix, bug_id, status, sorted(VALID_STATUSES)))

        # Priority validation (optional field)
        priority = bug.get("priority")
        if priority is not None:
            if priority not in ("high", "medium", "low"):
                errors.append("{} ({}): invalid priority '{}' — must be one of 'high', 'medium', 'low'".format(
                    prefix, bug_id, priority))

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "stats": {
            "total_bugs": len(bugs),
            "severity_distribution": severity_counts,
        },
    }


def cmd_validate(args):
    """Handle the 'validate' command."""
    bug_list = args.input
    feature_list = args.feature_list

    data, load_err = _load_json(bug_list)
    if load_err:
        _err(load_err)
        return 2

    # Load feature-list.json (optional, for cross-reference)
    if feature_list:
        fl_data, fl_err = _load_json(feature_list)
        if not fl_data:
            _warn("Could not load feature-list.json at {}: {}".format(feature_list, fl_err))

    result = validate(data)

    # Print results to stdout
    print(json.dumps(result, indent=2, ensure_ascii=False))

    if result["valid"]:
        bug_count = result["stats"]["total_bugs"]
        sev = result["stats"]["severity_distribution"]
        sev_str = ", ".join("{}={}".format(k, v) for k, v in sorted(sev.items()))
        _info("VALIDATION PASSED — {} bugs ({})".format(bug_count, sev_str))
        return 0
    else:
        _err("VALIDATION FAILED — {} error(s), {} warning(s)".format(
            len(result["errors"]), len(result["warnings"])))
        for e in result["errors"]:
            _err("  ERROR: {}".format(e))
        for w in result["warnings"]:
            _warn("  WARN: {}".format(w))
        return 1


def cmd_generate(args):
    """Handle the 'generate' command.

    Loads a draft JSON (produced by AI), fills in defaults, validates,
    and writes the final bug-fix-list.json.
    """
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
    data.setdefault("created_by", "bug-planner")

    # Set default status for bugs without one
    for bug in data.get("bugs", []):
        bug.setdefault("status", "pending")

    # Validate
    result = validate(data)

    # Output validation result
    print(json.dumps(result, indent=2, ensure_ascii=False))

    if result["valid"]:
        _write_json(args.output, data)
        _info("Generated bug-fix-list written to {}".format(args.output))
        return 0
    else:
        _err("Validation failed with {} error(s)".format(len(result["errors"])))
        for e in result["errors"]:
            _err("  ERROR: {}".format(e))
        return 1


def main():
    # Backward compatibility: if first arg is a file path (not a subcommand),
    # treat it as 'validate' command
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-") and sys.argv[1] not in ("validate", "generate"):
        sys.argv.insert(1, "validate")

    parser = argparse.ArgumentParser(
        description="Validate and generate .prizmkit/plans/bug-fix-list.json files.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  %(prog)s validate .prizmkit/plans/bug-fix-list.json\n"
            "  %(prog)s validate .prizmkit/plans/bug-fix-list.json --feature-list .prizmkit/plans/feature-list.json\n"
            "  %(prog)s generate --input draft.json --output .prizmkit/plans/bug-fix-list.json\n"
        ),
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # -- validate --
    p_validate = subparsers.add_parser(
        "validate",
        help="Validate an existing bug-fix-list.json",
    )
    p_validate.add_argument(
        "input", help="Path to bug-fix-list.json"
    )
    p_validate.add_argument(
        "--feature-list", default=None, help="Path to feature-list.json for cross-reference"
    )

    # -- generate --
    p_generate = subparsers.add_parser(
        "generate",
        help="Validate a draft and generate final bug-fix-list.json with defaults",
    )
    p_generate.add_argument(
        "--input", required=True, help="Path to draft JSON (or '-' for stdin)"
    )
    p_generate.add_argument(
        "--output", required=True, help="Path to write final bug-fix-list.json"
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help(sys.stderr)
        return 2

    dispatch = {
        "validate": cmd_validate,
        "generate": cmd_generate,
    }

    handler = dispatch.get(args.command)
    if handler is None:
        _err("Unknown command: {}".format(args.command))
        return 2

    return handler(args)


if __name__ == "__main__":
    sys.exit(main())
