# Cloud Platform Deployment Path

Guided deployment for Vercel, Netlify, Fly.io, and similar cloud platforms. Full automation isn't available — these platforms require browser-based authentication — but the skill provides structured CLI assistance.

## Detect and Validate

1. Check if the platform CLI is installed: `vercel --version`, `netlify --version`, `fly version`.
2. If missing, guide the user to install: `npm install -g vercel` or link to docs.
3. Check authentication: `vercel whoami`, `netlify status`. If not logged in, guide the user through `vercel login`.
4. Read the platform config file (`vercel.json`, `netlify.toml`, `fly.toml`) to understand existing settings.

## Generate Configuration

1. If no platform config file exists, generate one based on project detection:
   - **Next.js on Vercel**: minimal config — Vercel auto-detects Next.js. Generate `vercel.json` only if custom rewrites/redirects are needed.
   - **Static site on Netlify**: generate `netlify.toml` with build command and publish directory.
   - **Any on Fly.io**: generate `fly.toml` with app name, builder, and HTTP service config.
2. Set environment variables via the platform CLI: `vercel env add`, `netlify env:set`.
3. Document all env vars needed (from Discovery Step 1 scan).

## Deploy and Verify

1. Run the platform deploy command: `vercel deploy --prod`, `netlify deploy --prod`, `fly deploy`.
2. If the command requires interactive input, run it and show output to the user.
3. After deploy, run health checks against the production URL.
4. Write a deploy-history event recording: platform, project name, deploy URL, commit SHA, timestamp.

## Operations

| Command | Vercel | Netlify | Fly.io |
|---------|--------|---------|--------|
| status | `vercel list` | `netlify status` | `fly status` |
| logs | `vercel logs` | `netlify logs` | `fly logs` |
| rollback | `vercel rollback` | `netlify rollback` | `fly rollback` |
| env | `vercel env ls` | `netlify env:list` | `fly secrets list` |

Platform rollback is instant — no release-based rollback needed.

## Platform-Specific Patterns

### Vercel

Vercel auto-detects Next.js projects — no config file required for basic deployments. Generate `vercel.json` only for custom rewrites, redirects, or headers.

Key behaviors:
- Next.js: framework auto-detected, build command and output directory inferred automatically
- Static sites: set build command and output directory via `vercel.json` or CLI
- Env vars: `vercel env add <KEY>` (supports `production`, `preview`, `development` environments)
- Deploy preview: every branch gets a preview URL automatically (if connected via GitHub)

### Netlify

Netlify requires explicit build and publish configuration. Use `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Key behaviors:
- SPA redirects: the catch-all redirect above is essential for client-side routing
- Env vars: `netlify env:set <KEY> <VALUE>` (per-context: `production`, `deploy-preview`, `branch-deploy`)
- Branch deploys: every branch gets a deploy-preview URL automatically (if connected via GitHub)

### Fly.io

Fly.io requires a `fly.toml` with app name, builder, and HTTP service config:

```toml
app = "<app-name>"
primary_region = "lhr"

[build]
  builder = "dockerfile"

[http_service]
  internal_port = 3000
  force_https = true
```

Key behaviors:
- Builder: `dockerfile` (default, uses Dockerfile) or `static` (static site hosting)
- Secrets: `fly secrets set <KEY>=<VALUE>` for runtime environment variables
- Scale: `fly scale count <N>` to adjust VM instances
- Volumes: for persistent data, configure `[mounts]` in fly.toml

**Note**: These are minimum-viable platform references; browser-based authentication remains a user-action step. Enriched platform coverage is planned for future iterations.
