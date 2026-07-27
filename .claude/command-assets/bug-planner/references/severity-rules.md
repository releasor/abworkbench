# Severity Auto-Classification Rules

When extracting bugs, apply these rules to auto-suggest severity:

| Severity | Indicators | Examples |
|----------|------------|----------|
| **critical** | System crash, data loss, security breach, OOM, unrecoverable error | `Segmentation fault`, `OutOfMemoryError`, `SQL injection vulnerability`, `Database corrupted` |
| **high** | Core feature broken, authentication failure, data integrity issue, timeout | `Auth token invalid`, `Payment failed`, `Connection timeout`, `500 Internal Server Error` |
| **medium** | Feature partially broken, workaround exists, incorrect output | `CSV encoding issue`, `Pagination not working`, `Wrong date format`, `Missing validation` |
| **low** | Cosmetic issue, minor inconvenience, edge case | `UI misalignment`, `Typo in error message`, `Slow loading (non-critical page)`, `Non-breaking warning` |

## Special Cases

- Failed test → medium (unless test covers critical path, then high)
- User report with "cannot use app" → high
- User report with "annoying but works" → low
