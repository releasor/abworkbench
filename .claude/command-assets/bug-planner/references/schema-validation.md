# Schema Validation Checklist

Use this checklist for manual validation when `validate-bug-list.py` is not available. The script is the source of truth — this checklist mirrors its logic.

## Required Top-Level Fields

- [ ] `$schema`: must be `"dev-pipeline-bug-fix-list-v1"`
- [ ] `project_name`: non-empty string
- [ ] `bugs`: non-empty array

## Per-Bug Required Fields

- [ ] `id`: matches pattern `B-NNN` (e.g., `B-001`)
- [ ] `title`: non-empty string
- [ ] `description`: non-empty string
- [ ] `severity`: one of `critical`, `high`, `medium`, `low`
- [ ] `error_source.type`: one of `stack_trace`, `user_report`, `failed_test`, `log_pattern`, `monitoring_alert`
- [ ] `verification_type`: one of `automated`, `manual`, `hybrid`
- [ ] `acceptance_criteria`: non-empty array of strings
- [ ] `status`: must be `pending` for new bugs

## Consistency Checks

- [ ] No duplicate bug IDs
- [ ] If `priority` is set, must be one of `high`, `medium`, `low`
