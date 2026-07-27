# Deploy History Record Schema

Each event in `.prizmkit/deploy/deploy-history/<id>.json` follows this schema:

```json
{
  "eventId": "<releaseId or event id>",
  "eventType": "deploy|rollback|status|validation|failed-deploy|user-aborted|takeover|adapter-gap",
  "timestamp": "<ISO 8601>",
  "serverId": "<server id from deploy.config.json>",
  "appIds": ["<app ids involved>"],
  "branch": "<git branch>",
  "commitSha": "<full or short commit SHA>",
  "releasePath": "<full server path, e.g. /var/www/prizm-ideas/releases/20260430-22783a3>",
  "previousReleasePath": "<previous release path or null for first deploy>",
  "targetPort": 3101,
  "targetColor": "blue|green",
  "previousPort": 3102,
  "phases": {
    "preflight": "success|failed|skipped",
    "prepareRelease": "success|failed|skipped",
    "fetchCode": "success|failed|skipped",
    "installDependencies": "success|failed|skipped",
    "build": "success|failed|skipped",
    "stageRuntime": "success|failed|skipped",
    "healthCheck": "success|failed|skipped",
    "switchTraffic": "success|failed|skipped",
    "verifyLive": "success|failed|skipped",
    "cleanupOldReleases": "success|failed|skipped",
    "recordHistory": "success|failed|skipped"
  },
  "healthCheckResults": [
    {
      "name": "home",
      "url": "/",
      "expected": [200],
      "actual": 200,
      "pass": true
    }
  ],
  "rollbackResult": null,
  "logPath": "<server log path>",
  "operatorMode": "ai-assisted|user-managed",
  "notes": "<human-readable summary of what happened>"
}
```

## Field Notes

- `eventId`: Use `<releaseId>` for deploy events, `<releaseId>-rollback` for rollbacks.
- `eventType`: Use `failed-deploy` when deploy fails before traffic switch, `deploy` when it succeeds. Use `adapter-gap` when no adapter exists for the detected project type or target — include `detectedProjectType`, `missingAdapter`, and `fallbackOutput` in the record.
- `phases`: Only include phases that were attempted. Skip phases that were never reached.
- `healthCheckResults`: Include all configured health checks. `pass` = actual status matches one of the expected status codes.
- `rollbackResult`: `null` for non-rollback events, `"success"` or `"failed"` for rollbacks.
- `notes`: Keep concise but include any anomalies or manual interventions.

## What NOT to record

- Raw secret values or API keys — never.
- Unsalted hashes of secret values — inferable with rainbow tables.
- Passphrases or decryption keys — even if hashed.
- Full environment variable values — presence metadata only (e.g., `{"SUPABASE_KEY": {"present": true}}`).
