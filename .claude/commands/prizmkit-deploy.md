---
description: "Universal deployment gateway for any PrizmKit project. Discovers project type and target (SSH server, Vercel, Docker, etc.), then routes: full automation for SSH Linux with PM2 + Nginx + blue/green switching, guided setup for cloud platforms, or safe documentation fallback for unsupported targets. Also operates existing deployments: status, logs, restart, rollback, health checks, history, validate. Use this skill whenever the user asks about deployment, hosting, going live, or server operations. Triggers on: 'deploy', 'ship it', 'take this live', 'deploy to Vercel', 'deploy to my server', 'check deploy status', 'view logs', 'restart app', 'rollback', 'how do I deploy this', any deployment or hosting question."
---

# PrizmKit Deploy — Universal Deployment Gateway

`/prizmkit-deploy` is the single entry point for all deployment work. When a user asks to deploy anything — any project type, any target — this skill handles it.

Three possible outcomes depending on what's supported:
1. **Full automation** (SSH Linux server): configure, bootstrap, deploy, verify, operate — complete AI takeover.
2. **Guided setup** (cloud platforms like Vercel, Netlify, Docker): generate config, walk through CLI steps, verify.
3. **Documented fallback** (unsupported targets): detect what's possible, produce deploy.md, record the adapter gap.

When invited, behave as a deployment engineer. Ask until you understand what is being deployed, where it runs, how it is built, how it starts, what secrets it needs, how traffic reaches it, and how health is checked.

## Deployment Discovery

Before doing anything else, discover what you're deploying and where. This phase routes the request to the right adapter or fallback. It runs regardless of mode (interactive or headless), but interactive mode may ask questions; headless mode reads from existing config and exits with `NEEDS_INPUT` if critical details are missing.

### Step 1: Project Detection

Scan the project root for build/package files and classify:

| File found | Language/Framework | Build command | Start command |
|------------|-------------------|---------------|---------------|
| `package.json` with `next` dep | Next.js | `next build` | `next start -p <port>` |
| `package.json` with `vite` dep | Vite (React/Vue) | `vite build` | `vite preview` |
| `package.json` (generic) | Node.js | `npm run build` | `npm run start` |
| `go.mod` | Go | `go build` | `./<binary>` |
| `Cargo.toml` | Rust | `cargo build --release` | `./target/release/<binary>` |
| `requirements.txt` / `pyproject.toml` | Python | — | `python -m uvicorn` or similar |
| `Dockerfile` | Containerized | `docker build` | `docker run` |
| `docker-compose.yml` | Docker Compose | `docker compose build` | `docker compose up` |
| `Makefile` only | C/C++/generic | `make` | `make run` or binary |

Also scan for:
- **Environment variables**: grep for `process.env.`, `os.environ`, `os.Getenv`, `env::var` — catalog every reference
- **Port usage**: grep for port numbers, `listen()`, `PORT` env var
- **Database dependencies**: check package.json/requirements.txt/go.mod for database drivers

### Step 2: Deployment Target Detection

Determine WHERE the user wants to deploy. Check in order:

**A. User-specified target** (highest priority):
- "deploy to Vercel" / "deploy to my server" / "deploy with Docker" → use what the user says.

**B. Detect from project files** (if user hasn't specified):
- `vercel.json` → Vercel
- `netlify.toml` → Netlify
- `fly.toml` → Fly.io
- `Dockerfile` or `docker-compose.yml` → Docker
- `.github/workflows/deploy.yml` → check what it targets
- `app.yaml` → GCP App Engine
- `serverless.yml` → Serverless Framework

**C. Ask the user** (interactive only):
- "Where should this project be deployed?"
- Options to suggest based on detected files + common choices:
  - "My own Linux server (SSH access) — full AI automation"
  - "Vercel / Netlify — guided CLI setup"
  - "Docker — guided container deployment"
  - "Other — generate deployment documentation"

If headless mode and no target can be determined, exit with `NEEDS_INPUT` listing the missing target information.

**D. Check for existing deployment**:
- Does `.prizmkit/deploy/deploy.config.json` already exist? If yes, read the configured target.
- Does the user mention a server IP or hostname? Check if it's already reachable.

### Step 3: Route to Adapter

Based on detected target, route the rest of the session:

1. **SSH Linux server** → §SSH Deployment Path — full automation: bootstrap, configure, deploy, operate. First-version adapter: PM2 + Nginx + blue/green.
2. **Vercel / Netlify** → §Cloud Platform Deployment Path — guided: detect CLI tools, walk through deploy commands, generate deploy.md. Details in `references/cloud-platform-deploy.md`.
3. **Docker** → §Docker Deployment Path — guided: detect Dockerfile/Compose, build image, container lifecycle. Details in `references/docker-deploy.md`.
4. **Unsupported** → §Unsupported Deployment Fallback — generate deploy.md, record adapter gap, provide manual checklist.

Cloud and Docker paths follow the same discovery and documentation patterns but use platform CLIs instead of SSH + PM2.

**Compatibility check before routing to SSH**: The SSH adapter (PM2 + Nginx + blue/green) requires a Node.js project — verify `package.json` exists. Non-Node.js projects (Go, Rust, Python) targeting a Linux server route to Unsupported Fallback with a note: "Adapter gap: PM2 adapter requires Node.js."

### Step 4: Unsupported Deployment Fallback

When the deployment target or project type isn't covered by any adapter, don't fail silently. Instead:

1. **Detect what you can**: project language, framework, build/start commands, env vars, port usage, database dependencies.
2. **Generate `.prizmkit/deploy/deploy.md`**: human-readable deployment guide with prerequisites, environment variables table, build/start instructions, health check suggestions.
3. **Record the adapter gap**: write a note in deploy.md and deploy-history identifying what's missing (e.g., "Adapter needed: Python/FastAPI on systemd").
4. **Provide a manual checklist**: concrete steps the user can follow to deploy manually.
5. **Offer to generate CI/CD config**: if `.github/workflows/` exists or the user wants one, generate a basic deploy workflow.

## Mode Detection

Detect invocation mode from the user's initial message. The mode determines what you're allowed to do:

**Interactive mode** (user typed `/prizmkit-deploy` or asked directly):
- May ask as many questions as needed to fill in missing deployment details.
- May request approvals for privileged, destructive, or traffic-impacting actions.
- May deploy to any environment (dev/test/production).
- Production requires explicit user confirmation before execution.

**Headless mode** (invoked via `--headless` flag, pipeline, or script):
- Never wait for user input — unattended shells that time out on a prompt block pipelines silently without visible errors, so exit with clear status codes instead.
- May ONLY target `dev` or `test` environments.
- If `--env production` in headless mode: exit immediately with `ENVIRONMENT_DENIED — production deployment requires interactive mode`, because production deploys must never happen without human oversight.
- If required info is missing, exit with `NEEDS_INPUT` and write pending questions to `.prizmkit/deploy/pending-input.json`.
- May only perform actions already authorized by `deploy.config.json`.

## Command Routing

When the user invokes `/prizmkit-deploy`, determine intent from the first word after the command:

```
/prizmkit-deploy                  → deploy (if config exists) or configure (if not)
/prizmkit-deploy configure        → first-run or repair configuration wizard
/prizmkit-deploy deploy           → full deployment pipeline
/prizmkit-deploy status           → show PM2 process status for all apps
/prizmkit-deploy logs --app <id>  → tail PM2 logs for the given app
/prizmkit-deploy restart --app <id> → PM2 restart for the given app
/prizmkit-deploy rollback --app <id> [--to <releaseId>] → rollback to previous or specified release
/prizmkit-deploy health --app <id> → run configured health checks
/prizmkit-deploy history          → list recent deployment events from deploy-history/
/prizmkit-deploy validate         → run validation checks without deploying
```

### No-arg behavior

- If `.prizmkit/deploy/deploy.config.json` does not exist → start first-run configuration wizard.
- If config exists and validates → show deployment summary (active release, app status, last deploy time) and ask which environment, then proceed to deploy.
- If config exists but required fields are missing or validation is stale → enter repair flow.

## File Structure

All artifacts live under `.prizmkit/deploy/`:

```
.prizmkit/deploy/
  deploy.md                          # human-readable documentation
  deploy.config.json                 # machine-readable config & validation state
  pending-input.json                 # pending questions for headless mode resume
  deploy-history/
    <deployment-id>.json             # one per deploy/rollback/event
  deploy-scripts/                    # future — PrizmKit-managed deploy scripts
  secrets.enc.json                   # optional, encrypted local secrets
  secrets.local.json                 # optional, plaintext secrets (must be gitignored)
```

Read `references/deploy-config-schema.md` when writing or validating `deploy.config.json`. Read `references/deploy-history-schema.md` when writing history records.

## SSH Deployment Path

The following sections define the SSH deployment adapter — the only fully-automated path. Route here when Discovery determines the target is a Linux server with SSH access.

### SSH: Deployment Mode Selection

After Discovery routes to SSH, **before** entering the configuration wizard, ask the user how they want to deploy.

**First question:**
> "你想怎么部署到服务器？"
> - **A. 直接上传（快速上手）** — 本地构建，传到服务器启动。适合第一次部署。
> - **B. CI/CD 自动部署（推荐）** — 配置 GitHub Actions，以后 `git push` 自动部署。

**If user chooses CI/CD, second question:**
> "CI/CD 有两种模式："
> - **Push 模式** — GitHub Actions runner 编译，SCP 传到服务器。服务器压力小。
> - **Pull 模式** — 服务器自己拉代码编译。配置更简单但需 Deploy Key。

For detailed mode descriptions and the full Push/Pull comparison table, read `references/deployment-modes.md`.

**Config field:** `deployStrategy` in `deploy.config.json` — `"direct-upload"`, `"ci-cd-push"`, or `"ci-cd-pull"`. Existing configs without this field default to `"ci-cd-pull"` for backward compatibility.

### SSH: Server Model

Servers are generic SSH targets. A server is valid if it:
- Can be reached over SSH.
- Provides a Linux shell.
- Can install or has Node.js, npm, PM2, Nginx, Git.
- Can access the configured Git repository (Pull mode only).

Server-side directory layout:
```
/var/www/<project>/
  releases/
    <release-id>/
  shared/
    .env.production          # mode 600, owner: runtime user
    deploy-metadata.json     # active color, last release, timestamp
  current -> releases/<release-id>
  deploy-logs/
```

SSH roles: `bootstrapUser` (usually root, for initial setup) and `runtimeUser` (default `deploy`, for app processes). App processes never run as root.

### SSH: First-Run Configuration Wizard

When `.prizmkit/deploy/deploy.config.json` does not exist, enter configuration wizard. Flow: **deployment mode → collect → validate → confirm → persist**.

**Before any questions:** ask deployment mode (see §SSH: Deployment Mode Selection). This determines required steps:

| Step | Direct Upload | CI/CD Push | CI/CD Pull |
|------|:---:|:---:|:---:|
| SSH Server Discovery | Required | Required | Required |
| Repository Access | Skipped | Skipped | Required |
| Application Configuration | Required | Required | Required |
| Environment Variables | Required | Required | Required |
| Persist Configuration | Required | Required | Required |

#### Step 1: SSH Server Discovery

Ask for and validate:
- **Server host and port** (e.g., `43.161.221.171:22`)
- **Bootstrap user** (usually `root`) — for initial package install and user creation
- **Runtime user** (recommend `deploy`) — app runs as this user, never root
- **Auth method** — SSH key path or agent

Validate immediately: `ssh <bootstrapUser>@<host> 'echo OK'`. If that fails, nothing else matters — stop and fix connectivity first.

#### Step 2: Repository Access (CI/CD Pull mode only)

Only needed when `deployStrategy` is `"ci-cd-pull"` — the server needs to `git pull` code. Skip for `"direct-upload"` (no Git on server) and `"ci-cd-push"` (GitHub Actions handles checkout).

Ask for: Git URL, branch, auth strategy (prefer read-only Deploy Key).

If using Deploy Key:
1. Generate ed25519 key on server: `sudo -u <runtimeUser> ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""`
2. Show public key to user: "Add this to GitHub Deploy Keys (read-only)"
3. Wait for confirmation, then verify: attempt a git clone as runtime user

#### Step 3: Application Configuration

For each app, collect: id, path, packageManager, installCommand, buildCommand, startCommand, blue/green port pair (default 3101/3102), healthChecks.

#### Step 4: Environment Variables

Scan source code for `process.env.<VAR>` references. Ask user for each required value. Identify secrets vs non-secrets. Ask about secret storage strategy (see §Secrets Management).

#### Step 5: Persist Configuration

Write `deploy.config.json` with all collected values and `validated: {}` stubs for each section. Write `deploy.md` as human-readable documentation.

### SSH: Bootstrap Flow

Before first deployment, bootstrap the server. Present a plan showing every privileged action before executing anything.

**Always-run preflight:**
```
locale-gen en_US.UTF-8           # fix locale warnings on bare Ubuntu
apt-get update -qq               # refresh package list
```

**Check-and-install (idempotent):** Node.js, npm, PM2, Nginx, Git. Use v22 LTS if v25 not available.

**Detect port conflicts:** `ss -tlnp | grep :80 || true`. If port 80/443 is occupied, report and ask how to resolve.

**User and directory setup:**
```
useradd -m -s /bin/bash <runtimeUser>   # if not exists
mkdir -p /var/www/<project>/{releases,shared,deploy-logs}
chown -R <runtimeUser>:<runtimeUser> /var/www/<project>
```

**PM2 startup:**
```
env PATH=$PATH:/usr/bin pm2 startup systemd -u <runtimeUser> --hp /home/<runtimeUser>
```

**Deploy key (Pull mode only):**
```
sudo -u <runtimeUser> ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
sudo -u <runtimeUser> ssh-keyscan -H github.com >> ~/.ssh/known_hosts
```

**Security baseline (firewall):** After core tools are installed, ask whether to configure ufw. If user agrees, read `references/firewall-setup.md` for the full interactive flow and rule templates.

**Database setup:** If Discovery detected database drivers, ask whether to install the database on the server. If user agrees, read `references/database-setup.md` for platform-specific setup commands and security notes.

After each bootstrap step, record the result. Bootstrap operations must be idempotent. Back up any existing config files before modifying them.

### SSH: Direct Upload Deployment

When `deployStrategy` is `"direct-upload"`, the AI builds locally and transfers artifacts to the server. No Git operations on the server. Full procedure in `references/direct-upload.md`.

### SSH: CI/CD Pipeline Configuration

When `deployStrategy` is `"ci-cd-push"` or `"ci-cd-pull"`, generate `.github/workflows/deploy.yml` with the appropriate workflow template. Both modes share the same trigger and secrets. Full YAML templates in `references/ci-cd-workflows.md`.

After generating the workflow, verify: the first `git push` to the configured branch will trigger the first deployment. Monitor the GitHub Actions run and report results.

### SSH: DNS Guidance

Before SSL, check if the user has a domain pointing to the server.

1. Ask: "你有没有域名要绑定到这个项目？" If no domain → skip DNS + SSL, note in deploy.md.
2. Check DNS: `dig +short <domain> A`. If resolved → proceed to SSL.
3. If not resolved: show the user DNS setup instructions. Full procedure in `references/dns-setup.md`.

### SSH: SSL/HTTPS Configuration

Once DNS is confirmed pointing to the server, configure HTTPS via Let's Encrypt.

1. Detect cloud vendor via metadata endpoints.
2. If cloud vendor detected, ask: Let's Encrypt (recommended) or cloud vendor certificate.
3. Install certbot and request certificate.
4. Verify auto-renewal with `certbot renew --dry-run`.

Full procedure in `references/ssl-setup.md`.

### SSH: Deployment Execution Flow

Pipeline runs in strict order. Each group must complete before the next begins. If any step before traffic switch fails, STOP — do not touch the live version.

**Pre-flight — Change Summary:** Show what will be deployed using `git log --oneline <last-deployed-commit>..HEAD`. If first deployment, show last 5 commits. If no new commits, warn "没有新的代码变更。确定要重新部署吗？"

**Group 1 — Pre-flight & Prepare:**
- Verify SSH, runtime user, tools, deploy key, port availability.
- Generate `releaseId`: `YYYYMMDD-<short-commit-sha>`. Create `releases/<releaseId>`.
- Determine target color: read `activeColor` from `shared/deploy-metadata.json` and use the opposite. If first deploy (no metadata, no `current` symlink), default to blue (port 3101).

**Group 2 — Fetch & Build:**

- **CI/CD Pull mode** (server-side build): git clone → install → copy `.env.production` before build (NEXT_PUBLIC_* vars are baked at build time) → build. If build fails: STOP.
- **CI/CD Push mode** (runner-side build): extract tarball, skip install/build.
- **Direct-upload mode**: build was already done locally and SCP'd. Skip this group.

**Group 3 — Stage & Health Check:**
- Start new version on inactive port via PM2: `pm2 start npm --name <project>-<app>-<color> -- run start -- -p <inactivePort>`.
- PM2 process naming: `<project>-<app>-<color>` (e.g., `prizm-ideas-web-green`).
- Wait 3-5 seconds, run health checks against new port. If any fails: STOP, do NOT switch traffic.

**Group 4 — Switch & Verify:**
- Update Nginx upstream to new port. Run `nginx -t` — abort on failure.
- `systemctl reload nginx`. Update `current` symlink to new release.
- Write `shared/deploy-metadata.json` with new `activeColor`, `activePort`, `lastReleaseId`.
- Run health checks against public endpoint. If any fails: rollback immediately.

**Group 5 — Cleanup & Record:**
- Stop old PM2 process. Remove oldest releases beyond `releaseRetention` count. `pm2 save`.
- Write deploy-history JSON. Update `deploy.config.json` validation status.

**Post-deploy — Completion Summary:** Output a summary (project, URL, version, duration, health status) and append to deploy.md. If `deployStrategy` is `"direct-upload"`, offer CI/CD upgrade (see §SSH: Post-Deploy CI/CD Upgrade).

### SSH: Blue/Green PM2 + Nginx Strategy

- Blue: port 3101 (default), Green: port 3102 (default).
- Active color persisted in `/var/www/<project>/shared/deploy-metadata.json`.
- PM2 process naming: `<project>-<app>-<color>` (deterministic, never reuse old release IDs).
- Nginx config must include: `# PrizmKit Managed: <project> — DO NOT EDIT MANUALLY`.
- Before modifying any Nginx config lacking this marker, ask for user confirmation.
- Always `nginx -t` before `systemctl reload nginx`.

See `references/nginx-blue-green.md` for the full Nginx config template and traffic switch procedure.

### SSH: Rollback

Two triggers: **automatic** (health check failure after traffic switch) and **manual** (`/prizmkit-deploy rollback --app <id> [--to <releaseId>]`).

Steps: identify target release → verify build exists → start PM2 on its port → update Nginx upstream → `nginx -t` → reload → health checks → write rollback event. Do NOT delete the failed release or its logs — preserve for debugging.

If no previous release exists, rollback is not possible — state this clearly.

### SSH: Operations Commands

**status:** `pm2 list` as runtime user + active release, active color/port, last deploy timestamp.

**logs --app \<id\>:** `pm2 logs <process-name> --lines 100` as runtime user.

**restart --app \<id\>:** identify active PM2 process → `pm2 restart` → wait → health checks.

**health --app \<id\>:** run all configured health checks, report pass/fail for each.

**history:** list `.prizmkit/deploy/deploy-history/` events chronologically.

### SSH: Post-Deploy CI/CD Upgrade

After a successful direct-upload deployment, proactively offer CI/CD setup:

> "部署成功。要不要顺手帮你配置 CI/CD 自动部署？以后 `git push` 就自动上线。"

If user agrees, ask push vs pull, then configure accordingly. If Pull mode: set up deploy key. If Push mode: add GitHub Actions secrets. Generate `deploy.yml` from `references/ci-cd-workflows.md`, update `deployStrategy` in config, write upgrade event to history.

## Environment Policy

| Mode | dev | test | production |
|------|-----|------|------------|
| Interactive | Allowed | Allowed | Allowed (requires confirmation) |
| Headless | Allowed | Allowed | **REJECTED** — exits with ENVIRONMENT_DENIED |

Headless must reject production because production deploys require human oversight — an unattended pipeline timing out mid-deploy can leave the site in a broken state with no one monitoring.

## Secrets Management

Four storage modes, configured during first-run wizard:

- **ask-every-time**: Prompt for secrets on each deploy. Safest, most manual.
- **encrypted-local**: Store in `.prizmkit/deploy/secrets.enc.json`. Encrypt with user passphrase using Argon2id/scrypt KDF. Decryption material never stored alongside ciphertext.
- **plaintext-local**: Store in `.prizmkit/deploy/secrets.local.json`. Must be gitignored. Before each deploy, verify the file is not tracked by git. If tracked, stop and ask to resolve.
- **user-managed-on-server-only**: User handles secrets manually. Skill verifies server-side `.env.production` has all required vars before deploying.

Server runtime secrets live in `/var/www/<project>/shared/.env.production` with mode `600`, owned by runtime user.

Deploy history records secret presence metadata only (e.g., `{"SUPABASE_SERVICE_ROLE_KEY": {"present": true}}`). Never record raw secret values or unsalted hashes.

### SSH: Existing Deployment Takeover

When deploying to a server that already has deployment assets:

1. Detect: existing `/var/www/<project>` directory, existing PM2 processes with similar names, Nginx config referencing the same domain/IP, port conflicts.
2. Report findings and ask for takeover decision:
   - **Take over and backup**: Back up existing config, then proceed.
   - **Coexist**: Use different directory/ports/process names.
   - **Manual resolve**: Stop and let the user handle it.
3. Record takeover decision and validation results in config and history.

### SSH: Nginx Management

- First Nginx config creation or update of a non-PrizmKit block requires user confirmation.
- Subsequent updates to PrizmKit-managed blocks (`# PrizmKit Managed:` marker) may proceed automatically.
- Always `nginx -t` before reload.

See `references/nginx-blue-green.md` for the full Nginx config template.

### SSH: Bootstrap Safety Rules

Before executing privileged bootstrap work, generate an action plan listing: packages, users/groups, SSH keys, Nginx config, directories/permissions, services that may be restarted.

Rules:
- User gives one explicit approval for the entire bootstrap plan.
- If the plan changes during execution, pause and ask again.
- Bootstrap operations must be idempotent.
- Existing config files must be backed up before modification.
- All privileged actions and results recorded in deploy history.
- Failed bootstrap stops before deployment, provides recovery instructions.

### SSH: Multi-App Coordination

An all-app deploy creates one release group. Rules:
- Pre-traffic phases must complete for ALL selected apps before ANY app switches traffic.
- If any app fails before traffic switch, NO app switches traffic. Staged processes stopped, live system unchanged.
- If any app fails after traffic switch, default: group rollback.
- Single-app deploys (`--app <id>`) do not affect unrelated apps.

## Validation

Validation is mandatory before production deploy. Check: SSH connectivity, required tools (node, npm, git, pm2, nginx), repository reachability, port availability, required env vars, Nginx config syntax, health check routes accessible.

Persist validation in `deploy.config.json` under each section's `validated` field.

## Adapter Paths

After Discovery routes to a deployment target, read the corresponding reference:

| Target | Reference | Mode |
|--------|-----------|------|
| SSH Linux server | SSH sections in this file | Full automation |
| Vercel, Netlify, Fly.io | `references/cloud-platform-deploy.md` | Guided CLI |
| Docker / Docker Compose | `references/docker-deploy.md` | Guided build + run |
| Unrecognized target | §Deployment Discovery Step 4 | Documented fallback |

## Deploy History Record Schema

Each deployment, rollback, or significant event writes a record to `.prizmkit/deploy/deploy-history/<id>.json`. Full schema in `references/deploy-history-schema.md`. Never record raw secret values in history — presence metadata only.

## Implementation Notes

Live validation findings from the first PrizmKit deployment are in `references/live-validation-notes.md`. Read when troubleshooting bootstrap or deploy issues — these cover port conflict detection, npm verification, locale fixes, deploy key interactivity, PM2 PATH handling, and build-time env var timing.
