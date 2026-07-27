# Bug Input Format Detection & Extraction

Auto-detect the user's input format and extract structured bug information accordingly.

## Format A: Stack Trace / Error Log

```
TypeError: Cannot read property 'token' of null
    at AuthService.handleLogin (src/services/auth.ts:42)
    at LoginPage.onSubmit (src/pages/login.tsx:28)
```

Extract: `error_source.type="stack_trace"`, `error_message`, `stack_trace`, `affected_modules`

## Format B: Natural Language User Report

```
When I click the login button with correct credentials, the page turns white.
Expected: redirect to home page.
Actual: white screen with no error message visible.
```

Extract: `error_source.type="user_report"`, `reproduction_steps`, `description` (expected vs actual)

## Format C: Failed Test Output

```
FAIL src/services/__tests__/auth.test.ts
  ● AuthService > handleLogin > should return token on success
    Expected: "abc123"
    Received: null
```

Extract: `error_source.type="failed_test"`, `failed_test_path`, `error_message`

## Format D: Log Pattern

```
[2026-03-07 10:23:45] ERROR [auth-service] Connection timeout after 30000ms
[2026-03-07 10:23:45] ERROR [auth-service] Failed to authenticate user: ETIMEDOUT
[2026-03-07 10:23:46] ERROR [auth-service] Connection timeout after 30000ms
```

Extract: `error_source.type="log_pattern"`, `log_snippet`, `affected_modules`

## Format E: Monitoring Alert

```
ALERT: CPU usage > 95% for auth-service pod (5min avg)
ALERT: Error rate spike: 500 errors/min on /api/login endpoint
```

Extract: `error_source.type="monitoring_alert"`, `error_message`, `affected_modules`
