# Adversarial Critic Review & Browser Verification

## Adversarial Critic Review (Testing Defaults)

All bug fixes support optional critic review for additional quality assurance. The critic mechanism is disabled by default but can be enabled per-bug based on severity and complexity.

### Default Critic Behavior

| Severity | `critic` | `critic_count` | Rationale |
|----------|----------|----------------|-----------|
| critical | `true` | `1` | Single critic review for critical bugs |
| high | `true` | `1` | Single critic review for high-severity bugs |
| medium | `false` | (omitted) | Skip critic for medium-severity bugs |
| low | `false` | (omitted) | Skip critic for low-severity bugs |

- `critic: true` — Enable adversarial review after fix implementation
- `critic_count: 1` — Single critic agent reviews the fix
- Critic verifies: fix addresses root cause, no regressions introduced, acceptance criteria met

**User Override**: During Phase 2 or Phase 3, users can opt to enable/disable critic on a per-bug basis.

## Browser Verification

**Browser verification is a feature-pipeline capability only.** Bug fixes use the `verification_type` field instead:

- `verification_type: automated` — Use unit/integration tests to verify the fix
- `verification_type: manual` — Describe manual testing steps in acceptance criteria (including any browser verification steps)
- `verification_type: hybrid` — Combine automated tests with manual browser verification steps

For UI-related bugs that require visual verification (e.g., "Button doesn't show error message"), describe the verification steps in acceptance criteria.

### Example

```
Bug Title: Login error message not displaying
Verification Type: manual
Acceptance Criteria:
  1. Navigate to /login with invalid credentials
  2. Verify error message "Invalid email or password" appears below the email field
  3. Verify error message is red (#FF0000)
  4. Verify form fields are still enabled and can be re-submitted
```

The bugfix pipeline AI will use these criteria during manual verification.
