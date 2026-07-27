# config.json Schema — Tech Stack Fields

## Merge Strategy

Handles re-init without losing user edits:

- Read existing `config.json` if present
- If `tech_stack` field exists AND `_auto_detected` is `false` or absent:
  → **SKIP** — user has manually configured tech stack, preserve their settings
- Always update `detected_layers` with new layer detection results on every init run — layer detection is based on code that exists, not user preference. This ensures greenfield projects that later gain code get their `detected_layers` populated correctly. Note: the final value written is still determined by Phase 6c (e.g., if user chose "Skip entirely" in Phase 4.7, Phase 6c writes `[]` regardless of detection results).
- If `tech_stack` field exists AND `_auto_detected` is `true`:
  → **MERGE** — overwrite auto-detected values with new detection results, but preserve any keys the user added manually (keys not in the new detection result). Overwrite `detected_layers` with new layer detection results.
- If `tech_stack` field does NOT exist:
  → **WRITE** full detected tech stack with `"_auto_detected": true`, and write `detected_layers` from layer detection
- Only include fields that were actually detected (no empty/null values)

## Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `adoption_mode` | string | `"passive"` \| `"advisory"` \| `"active"` |
| `platform` | string | `"codebuddy"` \| `"claude"` \| `"codex"` \| `"all"` |
| `tech_stack` | object | Detected or user-provided tech stack |
| `tech_stack._auto_detected` | boolean | `true` if auto-detected, `false` if user-provided |
| `detected_layers` | string[] | Development layers detected in the project. Written by prizmkit-init Phase 4.5. Used to determine available rule configuration options. Values: `frontend` / `backend` / `database` / `mobile`. Empty array when no layers detected or user skipped rules. Always updated on every init run based on fresh code detection — not gated by `_auto_detected` (see Merge Strategy above). |

Legacy manifests may still contain `both` for read-only migration compatibility. New config writes must use `codebuddy`, `claude`, `codex`, or `all`.

## Examples

Fullstack project:
```json
{
  "adoption_mode": "passive",
  "platform": "claude",
  "detected_layers": ["frontend", "backend", "database"],
  "tech_stack": {
    "language": "TypeScript",
    "runtime": "Node.js 20",
    "frontend_framework": "React",
    "frontend_styling": "Tailwind CSS",
    "backend_framework": "Express.js",
    "database": "PostgreSQL",
    "orm": "Prisma",
    "testing": "Vitest",
    "bundler": "Vite",
    "project_type": "fullstack",
    "_auto_detected": true
  }
}
```

Pure Python backend:
```json
{
  "adoption_mode": "passive",
  "platform": "claude",
  "tech_stack": {
    "language": "Python",
    "runtime": "Python >=3.11",
    "backend_framework": "FastAPI",
    "database": "PostgreSQL",
    "orm": "SQLAlchemy",
    "testing": "pytest",
    "project_type": "backend",
    "_auto_detected": true
  },
  "detected_layers": ["backend", "database"]
}
```
